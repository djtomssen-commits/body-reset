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
  const baseUrl = process.env.PAYPAL_BASE_URL; // https://api-m.paypal.com or sandbox
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

/** ✅ NEU: helper um Firestore Timestamp grob zu validieren */
function isRecentTimestamp(ts: any, maxAgeMinutes: number) {
  if (!ts || typeof ts.toDate !== "function") return false;
  const d = ts.toDate() as Date;
  const ageMs = Date.now() - d.getTime();
  return ageMs >= 0 && ageMs <= maxAgeMinutes * 60 * 1000;
}

export async function POST(req: Request) {
  try {
    initAdmin();

    // Wichtig: UID NICHT aus Body, sondern aus Firebase Token
    const uid = await getUidFromFirebaseAuth(req);

    // ✅ NEU: Consent serverseitig prüfen (AGB/Widerruf/Datenschutz + digitaler Start)
    const db = admin.firestore();
    const subRef = db.collection("subscriptions").doc(uid);

    const subSnap = await subRef.get();
    const subData = subSnap.exists ? (subSnap.data() as any) : null;

    const legalOk = isRecentTimestamp(subData?.legalAcceptedAt, 24 * 60); // 24h
    const waiverOk = isRecentTimestamp(subData?.digitalWaiverAcceptedAt, 24 * 60); // 24h

    if (!legalOk || !waiverOk) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Consent missing: Bitte AGB/Widerruf/Datenschutz akzeptieren und dem sofortigen Start der digitalen Leistung zustimmen.",
        },
        { status: 400 }
      );
    }

    const baseUrl = process.env.PAYPAL_BASE_URL!;
    const accessToken = await getPayPalAccessToken();

    // Fix: 4,99 EUR
    const PRICE_EUR = "4.99";

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: uid, // damit wir im Capture wissen, wem es gehört
            amount: {
              currency_code: "EUR",
              value: PRICE_EUR,
            },
            description: "Monatsabo (1 Monat)",
          },
        ],
      }),
    });

    const orderJson = await orderRes.json();

    if (!orderRes.ok) {
      return NextResponse.json(
        { ok: false, error: orderJson?.message || "create order failed", details: orderJson },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, orderId: orderJson.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "create order failed" },
      { status: 500 }
    );
  }
}