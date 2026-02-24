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
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

async function getUidFromFirebaseAuth(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);

  if (!match) {
    throw new Error("Missing Authorization Bearer token");
  }

  const decoded = await admin.auth().verifyIdToken(match[1]);
  return decoded.uid;
}

export async function POST(req: Request) {
  try {
    initAdmin();

    const uid = await getUidFromFirebaseAuth(req);

    const db = admin.firestore();
    const subRef = db.collection("subscriptions").doc(uid);

    const now = admin.firestore.Timestamp.now();

    await subRef.set(
      {
        legalAcceptedAt: now,
        digitalWaiverAcceptedAt: now,
        consentUpdatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "consent failed" },
      { status: 500 }
    );
  }
}