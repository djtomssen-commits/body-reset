import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export const checkBadges = async (userId: string) => {

  if (!userId) return [];

  const ref = doc(db, "users", userId);

  const snap = await getDoc(ref);

  if (!snap.exists()) return [];

  const data = snap.data();

  const badges = data.badges || [];
  const xp = data.xp || 0;
  const streak = data.streak || 0;
  const trainingCount = data.trainingCount || 0;
  const startWeight = data.startWeight || 0;
  const weight = data.weight || 0;

  const newBadges = [...badges];
  const unlocked: string[] = [];

  if (trainingCount >= 10 &&
      !badges.includes("training_10")) {

    newBadges.push("training_10");
    unlocked.push("training_10");

  }

  if (streak >= 7 &&
      !badges.includes("streak_7")) {

    newBadges.push("streak_7");
    unlocked.push("streak_7");

  }

  if (Math.floor(xp / 100) + 1 >= 5 &&
      !badges.includes("level_5")) {

    newBadges.push("level_5");
    unlocked.push("level_5");

  }

  if ((startWeight - weight) >= 5 &&
      !badges.includes("minus_5kg")) {

    newBadges.push("minus_5kg");
    unlocked.push("minus_5kg");

  }

  if (unlocked.length > 0) {

    await updateDoc(ref, {
      badges: newBadges
    });

  }

  return unlocked;

};