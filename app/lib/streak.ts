// lib/streak.ts

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export const updateStreak = async (userId: string) => {

  if (!userId) return;

  const ref = doc(db, "users", userId);

  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const data = snap.data();

  const lastActive = data.lastActive;
  const currentStreak = data.streak || 0;

  const today = new Date().toDateString();

  if (lastActive === today) return;

  const yesterday =
    new Date(Date.now() - 86400000)
      .toDateString();

  let newStreak = 1;

  if (lastActive === yesterday)
    newStreak = currentStreak + 1;

  await updateDoc(ref, {
    streak: newStreak,
    lastActive: today
  });

};