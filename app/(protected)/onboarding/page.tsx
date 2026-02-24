"use client";

import Navbar from "../../components/Navbar";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "../../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth"; // ✅ HINZUGEFÜGT

export default function OnboardingPage() {

  const router = useRouter();

  const user = auth.currentUser;

  const [step, setStep] = useState(1);

  const [goal, setGoal] = useState("lose");
  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");

  const next = () => setStep(step + 1);
  const back = () => setStep(step - 1);

  const finish = async () => {

    if (!user) return;

    const h = Number(height);
    const w = Number(weight);

    // Kalorien automatisch berechnen
    const bmr =
      10 * w +
      6.25 * h -
      5 * 30 +
      5;

    let calories =
      bmr * 1.4;

    if (goal === "lose")
      calories -= 300;

    if (goal === "gain")
      calories += 250;

    const protein =
      goal === "lose"
        ? w * 2.2
        : w * 2;

    await updateDoc(
      doc(db, "users", user.uid),
      {

        name,

        goal,

        height: h,
        weight: w,

        startWeight: w,

        goalWeight:
          Number(goalWeight) || w - 5,

        caloriesGoal:
          Math.round(calories),

        proteinGoal:
          Math.round(protein),

        onboardingCompleted: true

      }
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
                onClick={()=>{
                  setGoal("lose");
                  next();
                }}
                className="w-full bg-white/10 p-3 rounded-xl text-white hover:bg-green-500 transition"
              >
                Fett verlieren
              </button>

              <button
                onClick={()=>{
                  setGoal("maintain");
                  next();
                }}
                className="w-full bg-white/10 p-3 rounded-xl text-white hover:bg-green-500 transition"
              >
                Muskeln erhalten
              </button>

              <button
                onClick={()=>{
                  setGoal("gain");
                  next();
                }}
                className="w-full bg-white/10 p-3 rounded-xl text-white hover:bg-green-500 transition"
              >
                Muskeln aufbauen
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
              onChange={(e)=>setName(e.target.value)}
              className="w-full mb-3 p-3 rounded-xl bg-white/10 text-white"
            />

            <input
              placeholder="Größe (cm)"
              value={height}
              onChange={(e)=>setHeight(e.target.value)}
              className="w-full mb-3 p-3 rounded-xl bg-white/10 text-white"
            />

            <input
              placeholder="Gewicht (kg)"
              value={weight}
              onChange={(e)=>setWeight(e.target.value)}
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
              onChange={(e)=>setGoalWeight(e.target.value)}
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