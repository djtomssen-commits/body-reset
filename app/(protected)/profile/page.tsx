"use client";

import Navbar from "../../components/Navbar";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "../../lib/firebase";

import {
  doc,
  setDoc,
  getDoc
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

export default function Profile() {

  const router = useRouter();

  const [userId, setUserId] = useState("");

  // Ziel
  const [goal, setGoal] = useState("lose");
  const [autoMode, setAutoMode] = useState(true);

  // Körperdaten
  const [height, setHeight] = useState(180);
  const [weight, setWeight] = useState(80);
  const [belly, setBelly] = useState(0); // FIX: kein 90 mehr

  const [startWeight, setStartWeight] = useState(80);
  const [goalWeight, setGoalWeight] = useState(75);

  // Ernährung
  const [caloriesGoal, setCaloriesGoal] = useState(2200);
  const [proteinGoal, setProteinGoal] = useState(180);

  // XP & Level
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);

  // Abzeichen
  const [badges, setBadges] = useState<string[]>([]);

  // Berechnete Werte
  const [bmi, setBmi] = useState(0);
  const [kfa, setKfa] = useState(0);
  const [progress, setProgress] = useState(0);

  // Automatische Kalorienberechnung
  useEffect(() => {

    if (!autoMode) return;

    const age = 30;

    const bmr =
      10 * weight +
      6.25 * height -
      5 * age +
      5;

    const maintenance =
      bmr * 1.4;

    let calories = maintenance;

    if (goal === "lose")
      calories -= 300;

    if (goal === "gain")
      calories += 250;

    const protein =
      goal === "lose"
        ? weight * 2.2
        : weight * 2.0;

    setCaloriesGoal(
      Math.round(calories)
    );

    setProteinGoal(
      Math.round(protein)
    );

  }, [goal, height, weight, autoMode]);

  // Körperberechnungen
  useEffect(() => {

    const bmiValue =
      weight /
      ((height / 100) *
      (height / 100));

    setBmi(
      Number(bmiValue).toFixed(1)
    );

    const kfaValue =
      belly > 0
        ? ((belly * 0.74) -
          (weight * 0.082) -
          44.74) / weight * 100
        : 0;

    setKfa(
      Number(kfaValue).toFixed(1)
    );

    const total =
      startWeight - goalWeight;

    const current =
      startWeight - weight;

    const percent =
      (current / total) * 100;

    setProgress(
      Math.max(0,
      Math.min(100, percent))
    );

    setLevel(
      Math.floor(xp / 100) + 1
    );

  }, [
    height,
    weight,
    belly,
    startWeight,
    goalWeight,
    xp
  ]);

  // Laden
  useEffect(() => {

    const unsub =
      onAuthStateChanged(auth, async (user) => {

        if (!user) {

          router.push("/login");
          return;

        }

        setUserId(user.uid);

        const snap =
          await getDoc(
            doc(db, "users", user.uid)
          );

        if (snap.exists()) {

          const data = snap.data();

          setGoal(data.goal || "lose");

          setHeight(data.height || 180);
          setWeight(data.weight || 80);

          // FIX: kein automatisches 90
          setBelly(
            data.belly !== undefined
              ? data.belly
              : 0
          );

          setStartWeight(
            data.startWeight ||
            data.weight ||
            80
          );

          setGoalWeight(
            data.goalWeight || 75
          );

          setCaloriesGoal(
            data.caloriesGoal || 2200
          );

          setProteinGoal(
            data.proteinGoal || 180
          );

          setXp(data.xp || 0);

          setBadges(data.badges || []);

        }

      });

    return () => unsub();

  }, []);

  // Speichern
  const save = async () => {

    await setDoc(
      doc(db, "users", userId),
      {
        goal,
        height,
        weight,
        belly,
        startWeight,
        goalWeight,
        caloriesGoal,
        proteinGoal,
        xp
      },
      { merge: true }
    );

    alert("Profil gespeichert");

  };

  const getStatus = () => {

    if (kfa < 12) return "Elite";
    if (kfa < 15) return "Sehr fit";
    if (kfa < 18) return "Fit";
    if (kfa < 22) return "Normal";
    if (kfa < 26) return "Erhöht";

    return "Hoch";

  };

  return (

    <div>

      

      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-white">

        <div className="w-full max-w-md mx-auto space-y-4">

          {/* Status */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow-xl">

            <div className="font-bold text-lg mb-2">
              Körperstatus
            </div>

            <div>BMI: {bmi}</div>
            <div>KFA: {belly > 0 ? `${kfa}%` : "-"}</div>
            <div>Status: {getStatus()}</div>

          </div>

          {/* Fortschritt */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow-xl">

            <div className="font-bold mb-2">
              Fortschritt
            </div>

            <div className="mb-2">
              {startWeight}kg → {goalWeight}kg
            </div>

            <div className="w-full bg-white/20 h-4 rounded">

              <div
                className="bg-green-500 h-4 rounded"
                style={{
                  width: progress + "%"
                }}
              />

            </div>

            <div className="mt-1">
              {progress.toFixed(0)}%
            </div>

          </div>

          {/* Ziel */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow-xl">

            <div className="font-bold mb-2">
              Dein Ziel
            </div>

            <select
  value={goal}
  onChange={(e)=>
    setGoal(e.target.value)
  }
  className="border border-white/20 bg-slate-900 text-white p-2 w-full rounded"
>

              <option value="lose" className="bg-slate-900 text-white">
  Fett verlieren
</option>

<option value="maintain" className="bg-slate-900 text-white">
  Muskel erhalten
</option>

<option value="gain" className="bg-slate-900 text-white">
  Muskel aufbauen
</option>

            </select>

            <div className="flex items-center gap-2 mt-2">

              <input
                type="checkbox"
                checked={autoMode}
                onChange={() =>
                  setAutoMode(!autoMode)
                }
              />

              <span className="text-sm">
                Automatisch berechnen
              </span>

            </div>

          </div>

          {/* Körperdaten */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow-xl space-y-3">

            <div className="font-bold">
              Körperdaten
            </div>

            <label className="text-sm">
              Größe (cm)
            </label>

            <input
              value={height}
              onChange={(e)=>
                setHeight(Number(e.target.value))
              }
              className="bg-white/10 border border-white/20 p-2 w-full rounded"
            />

            <label className="text-sm">
              Gewicht (kg)
            </label>

            <input
              value={weight}
              onChange={(e)=>
                setWeight(Number(e.target.value))
              }
              className="bg-white/10 border border-white/20 p-2 w-full rounded"
            />

            <label className="text-sm">
              Bauchumfang (cm)
            </label>

            <input
              value={belly}
              onChange={(e)=>
                setBelly(Number(e.target.value))
              }
              className="bg-white/10 border border-white/20 p-2 w-full rounded"
            />

            <label className="text-sm">
              Startgewicht (kg)
            </label>

            <input
              value={startWeight}
              onChange={(e)=>
                setStartWeight(Number(e.target.value))
              }
              className="bg-white/10 border border-white/20 p-2 w-full rounded"
            />

            <label className="text-sm">
              Zielgewicht (kg)
            </label>

            <input
              value={goalWeight}
              onChange={(e)=>
                setGoalWeight(Number(e.target.value))
              }
              className="bg-white/10 border border-white/20 p-2 w-full rounded"
            />

          </div>

          {/* Speichern */}
          <button
            onClick={save}
            className="bg-green-600 hover:bg-green-500 text-white p-4 w-full rounded-xl font-bold shadow-lg"
          >

            Profil speichern

          </button>

        </div>

      </main>

    </div>

  );

}