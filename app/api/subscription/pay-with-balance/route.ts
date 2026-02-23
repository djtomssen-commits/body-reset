export const runtime = "nodejs";

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

export async function POST(req: Request) {
  try {
    initAdmin();

    const uid = await getUidFromFirebaseAuth(req);
    if (!uid) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const db = admin.firestore();
    const subRef = db.collection("subscriptions").doc(uid);

    const PRICE = 4.99;

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(subRef);
      if (!snap.exists) return { ok: false, error: "No subscription doc" };

      const data: any = snap.data() || {};
      const currentBalance = Number(data.guthaben || 0);

      if (currentBalance < PRICE) {
        return { ok: false, error: "Nicht genug Guthaben." };
      }

      const now = admin.firestore.Timestamp.now();
      const nowDate = now.toDate();

      const currentEnd = data.endDate?.toDate ? data.endDate.toDate() : null;
      const base = currentEnd && currentEnd.getTime() > nowDate.getTime() ? currentEnd : nowDate;

      const newEnd = new Date(base);
      newEnd.setMonth(newEnd.getMonth() + 1);

      const newBalance = Math.round((currentBalance - PRICE) * 100) / 100;

      tx.update(subRef, {
        guthaben: newBalance,
        startDate: now,
        endDate: admin.firestore.Timestamp.fromDate(newEnd),
        isTrial: false,
        isFreeMonth: false,
      });

      return { ok: true, newBalance, newEnd: newEnd.toISOString() };
    });

    if (!result.ok) return NextResponse.json(result, { status: 400 });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("pay-with-balance error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}