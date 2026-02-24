"use client";

import Navbar from "../../components/Navbar";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth"; // ✅ HINZUGEFÜGT

export default function OnboardingPage() {

  const router = useRouter();

  const user = auth.currentUser;

  const [step, setStep] = useState(1);

  type GoalType = "fat_loss" | "maintain" | "muscle_gain" | "health";
  const [goal, setGoal] = useState<GoalType>("fat_loss");

  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");

  const next = () => setStep(step + 1);
  const back = () => setStep(step - 1);

  const clamp = (n: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, n));
  };

  // Simple BMR/TDEE (ohne Alter, bewusst simpel)
  // BMR (Mifflin ohne Alter-Teil): 10*kg + 6.25*cm + 5
  const estimateTDEE = (kg: number, cm: number) => {
    const bmr = 10 * kg + 6.25 * cm + 5;
    const activity = 1.4; // konservativ "leicht aktiv"
    return bmr * activity;
  };

  const recommendTargets = (g: GoalType, kg: number, cm: number) => {
    const tdee = estimateTDEE(kg, cm);

    let cal = tdee;
    let prot = 1.6 * kg;

    if (g === "fat_loss") {
      cal = tdee - 500;
      prot = 2.0 * kg;
    }

    if (g === "muscle_gain") {
      cal = tdee + 250;
      prot = 1.8 * kg;
    }

    if (g === "maintain") {
      cal = tdee;
      prot = 1.6 * kg;
    }

    if (g === "health") {
      cal = tdee - 250;
      prot = 1.6 * kg;
    }

    cal = clamp(Math.round(cal), 1400, 4000);
    prot = clamp(Math.round(prot), 90, 260);

    return { cal, prot };
  };

  const finish = async () => {

    if (!user) return;

    const h = Number(height);
    const w = Number(weight);

    const targets = recommendTargets(goal, w, h);

    const defaultGoalWeight =
      goal === "fat_loss"
        ? w - 5
        : goal === "muscle_gain"
          ? w + 3
          : w;

    await setDoc(
      doc(db, "users", user.uid),
      {

        name,

        goalType: goal,

        height: h,
        weight: w,

        startWeight: w,

        goalWeight:
          Number(goalWeight) || defaultGoalWeight,

        caloriesGoal:
          targets.cal,

        proteinGoal:
          targets.prot,

        onboardingCompleted: true

      },
      { merge: true }
    );

    // ✅ DAS IST DER FIX — displayName setzen
    await updateProfile(user, {
      displayName: name
    });

    router.push("/dashboard");

  };

  return (

    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black">

      <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl w-full max-w-md shadow-2xl">

        {/* Progress */}

        <div className="mb-6">

          <div className="text-white text-sm mb-1">

            Schritt {step} / 3

          </div>

          <div className="w-full bg-white/20 h-2 rounded">

            <div
              className="bg-green-500 h-2 rounded transition-all"
              style={{
                width: `${(step / 3) * 100}%`
              }}
            />

          </div>

        </div>

        {/* STEP 1 */}

        {step === 1 && (

          <div>

            <div className="text-white text-xl font-bold mb-4">

              Was ist dein Ziel?

            </div>

            <div className="space-y-3">

              <button
                onClick={() => {
                  setGoal("fat_loss");
                  next();
                }}
                className="w-full bg-white/10 p-3 rounded-xl text-white hover:bg-green-500 transition"
              >
                Fett verlieren
              </button>

              <button
                onClick={() => {
                  setGoal("maintain");
                  next();
                }}
                className="w-full bg-white/10 p-3 rounded-xl text-white hover:bg-green-500 transition"
              >
                Gewicht halten
              </button>

              <button
                onClick={() => {
                  setGoal("muscle_gain");
                  next();
                }}
                className="w-full bg-white/10 p-3 rounded-xl text-white hover:bg-green-500 transition"
              >
                Muskeln aufbauen
              </button>

              <button
                onClick={() => {
                  setGoal("health");
                  next();
                }}
                className="w-full bg-white/10 p-3 rounded-xl text-white hover:bg-green-500 transition"
              >
                Gesünder leben
              </button>

            </div>

          </div>

        )}

        {/* STEP 2 */}

        {step === 2 && (

          <div>

            <div className="text-white text-xl font-bold mb-4">

              Deine Körperdaten

            </div>

            <input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mb-3 p-3 rounded-xl bg-white/10 text-white"
            />

            <input
              placeholder="Größe (cm)"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full mb-3 p-3 rounded-xl bg-white/10 text-white"
            />

            <input
              placeholder="Gewicht (kg)"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full mb-3 p-3 rounded-xl bg-white/10 text-white"
            />

            <button
              onClick={next}
              className="w-full bg-green-500 p-3 rounded-xl text-white"
            >
              Weiter
            </button>

          </div>

        )}

        {/* STEP 3 */}

        {step === 3 && (

          <div>

            <div className="text-white text-xl font-bold mb-4">

              Zielgewicht

            </div>

            <input
              placeholder="Zielgewicht (optional)"
              value={goalWeight}
              onChange={(e) => setGoalWeight(e.target.value)}
              className="w-full mb-4 p-3 rounded-xl bg-white/10 text-white"
            />

            <button
              onClick={finish}
              className="w-full bg-green-500 p-3 rounded-xl text-white font-bold"
            >
              Fertig
            </button>

          </div>

        )}

      </div>

    </main>

  );

}