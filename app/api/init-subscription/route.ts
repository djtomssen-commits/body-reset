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

async function getUidFromAuth(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);

  if (!match) {
    throw new Error("Missing Authorization Bearer token");
  }

  const idToken = match[1];
  const decoded = await admin.auth().verifyIdToken(idToken);
  return decoded.uid;
}

export async function POST(req: Request) {
  try {
    initAdmin();

    const uid = await getUidFromAuth(req);
    if (!uid) {
      return NextResponse.json({ ok: false, error: "Missing uid" }, { status: 401 });
    }

    const db = admin.firestore();
    const subRef = db.collection("subscriptions").doc(uid);
    const metaRef = db.collection("meta").doc("counters");

    const result = await db.runTransaction(async (tx) => {
      const subSnap = await tx.get(subRef);

      // schon da -> nichts tun
      if (subSnap.exists) {
        return { ok: true, created: false };
      }

      // Counter holen/erstellen
      const metaSnap = await tx.get(metaRef);
      const currentCount =
        metaSnap.exists && typeof metaSnap.data()?.userCount === "number"
          ? metaSnap.data()!.userCount
          : 0;

      const newCount = currentCount + 1;
      tx.set(metaRef, { userCount: newCount }, { merge: true });

      const now = admin.firestore.Timestamp.now();
      const nowDate = now.toDate();

      // first 50 => 1 Monat gratis, sonst 2 Tage Trial
      const isFreeMonth = newCount <= 50;

      const endDate = new Date(nowDate);
      if (isFreeMonth) endDate.setMonth(endDate.getMonth() + 1);
      else endDate.setDate(endDate.getDate() + 2);

      tx.set(subRef, {
        startDate: now,
        endDate: admin.firestore.Timestamp.fromDate(endDate),

        // Login-Streak/Bonus System
        streak: 0,
        lastLogin: new Date().toDateString(),
        lastBonusClaim: "",
        loginBonus: 0,
        guthaben: 0,

        // Info
        isFreeMonth,
        isTrial: !isFreeMonth,
        createdAt: now,
      });

      return { ok: true, created: true, isFreeMonth };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    const msg = e?.message || "init failed";
    const status = msg.includes("Authorization") ? 401 : 500;

    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}