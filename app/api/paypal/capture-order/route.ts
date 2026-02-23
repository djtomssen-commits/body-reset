import { NextResponse } from "next/server";
import admin from "firebase-admin";

function initAdmin() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin credentials in env.");
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

async function getUidFromFirebaseAuth(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) throw new Error("Missing Authorization Bearer token");

  const decoded = await admin.auth().verifyIdToken(match[1]);
  return decoded.uid;
}

async function getPayPalAccessToken() {
  const baseUrl = process.env.PAYPAL_BASE_URL;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;

  if (!baseUrl || !clientId || !secret) throw new Error("Missing PayPal env vars");

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PayPal token failed: ${t}`);
  }

  const json = await res.json();
  return json.access_token as string;
}

function addOneMonthFrom(date: Date) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);

  // falls Monatsende-Problem (31. -> kürzerer Monat)
  // JS schiebt sonst in nächsten Monat; wir setzen auf letzten Tag des Zielmonats
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

export async function POST(req: Request) {
  try {
    initAdmin();

    const uid = await getUidFromFirebaseAuth(req);
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
    }

    const baseUrl = process.env.PAYPAL_BASE_URL!;
    const accessToken = await getPayPalAccessToken();

    // 1) Capture bei PayPal
    const capRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const capJson = await capRes.json();

    if (!capRes.ok) {
      return NextResponse.json(
        { ok: false, error: capJson?.message || "capture failed", details: capJson },
        { status: 500 }
      );
    }

    // PayPal Status prüfen
    // Bei Success typischerweise status: "COMPLETED"
    if (capJson?.status !== "COMPLETED") {
      return NextResponse.json(
        { ok: false, error: `Payment not completed: ${capJson?.status || "unknown"}` },
        { status: 400 }
      );
    }

    // 2) Firestore: Abo verlängern
    const db = admin.firestore();
    const subRef = db.collection("subscriptions").doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(subRef);
      const data = snap.exists ? (snap.data() as any) : {};

      const now = new Date();

      const currentEnd: Date | null =
        data?.endDate && typeof data.endDate.toDate === "function" ? data.endDate.toDate() : null;

      const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
      const newEnd = addOneMonthFrom(base);

      tx.set(
        subRef,
        {
          startDate: admin.firestore.Timestamp.fromDate(now),
          endDate: admin.firestore.Timestamp.fromDate(newEnd),

          isTrial: false,
          isFreeMonth: false,

          // optional: reset bonus/streak bei Kauf
          streak: 0,
          loginBonus: 0,
          lastBonusClaim: "",

          // Audit / Nachweis
          lastPayment: {
            provider: "paypal",
            orderId,
            status: capJson.status,
            capturedAt: admin.firestore.Timestamp.fromDate(now),
          },
          updatedAt: admin.firestore.Timestamp.fromDate(now),
        },
        { merge: true }
      );
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "capture failed" }, { status: 500 });
  }
}