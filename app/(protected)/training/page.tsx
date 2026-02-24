"use client";

import Navbar from "../../components/Navbar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "../../lib/firebase";
import { updateStreak } from "../../lib/streak";
import { checkBadges } from "../../lib/badges";

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  getDoc,
  updateDoc
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

export default function TrainingPage() {

  const router = useRouter();

  const [userId, setUserId] = useState("");

  const [allExercises, setAllExercises] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);

  const [selectedMuscle, setSelectedMuscle] =
    useState<string | null>(null);

  const [selectedExercise, setSelectedExercise] =
    useState<any>(null);

  const [favorites, setFavorites] =
    useState<any>({});

  const [weight, setWeight] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [badgePopup, setBadgePopup] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [customName, setCustomName] = useState("");
  const [customWeight, setCustomWeight] = useState("");
  const [customSets, setCustomSets] = useState("");
  const [customReps, setCustomReps] = useState("");

  const [customDistance, setCustomDistance] = useState("");
  const [customTime, setCustomTime] = useState("");

  const [isCardio, setIsCardio] = useState(false);

  const calculateXP = (exerciseName: string, newWeight: number) => {

    const list =
      history.filter(h =>
        h.exercise === exerciseName
      );

    if (list.length === 0)
      return 10;

    const best =
      Math.max(
        ...list.map(h => Number(h.weight) || 0)
      );

    if (newWeight > best * 1.2)
      return 10;

    const improvement =
      newWeight - best;

    let xp = 10;

    if (improvement > 0)
      xp += Math.min(improvement * 5, 20);

    xp = Math.min(xp, 30);

    return Math.round(xp);

  };

  const parseTimeToSeconds = (t: string) => {
    if (!t) return 0;
    const parts = t.split(":").map(p => Number(p));
    if (parts.some(n => Number.isNaN(n))) return 0;

    if (parts.length === 2) {
      const [m, s] = parts;
      return m * 60 + s;
    }

    if (parts.length === 3) {
      const [h, m, s] = parts;
      return h * 3600 + m * 60 + s;
    }

    return 0;
  };

  const calculateCardioXP = (exerciseName: string, distanceKm: number, timeStr: string) => {
    const timeSec = parseTimeToSeconds(timeStr);

    const list =
      history.filter(h =>
        h.exercise === exerciseName && h.isCardio
      );

    // Basis: wenn erstes Mal
    if (list.length === 0) return 10;

    let bestDistance = 0;
    let bestPace = Infinity; // sec/km (kleiner ist besser)

    list.forEach(h => {
      const d = Number(h.distance) || 0;
      const ts = parseTimeToSeconds(String(h.time || ""));
      if (d > bestDistance) bestDistance = d;
      if (d > 0 && ts > 0) {
        const pace = ts / d;
        if (pace < bestPace) bestPace = pace;
      }
    });

    let xp = 10;

    // Distanz-Verbesserung
    if (distanceKm > bestDistance) {
      const diff = distanceKm - bestDistance;
      xp += Math.min(diff * 8, 15); // bis +15
    }

    // Pace-Verbesserung (wenn Zeit vorhanden)
    if (distanceKm > 0 && timeSec > 0 && bestPace !== Infinity) {
      const pace = timeSec / distanceKm;
      const improvement = bestPace - pace; // positiv = schneller
      if (improvement > 0) {
        // pro 10 sec/km schneller -> +1 XP (max +10)
        xp += Math.min(improvement / 10, 10);
      }
    }

    xp = Math.min(xp, 30);

    return Math.round(xp);
  };

  const getExerciseStats = (exerciseName: string) => {

    const list =
      history
        .filter(h =>
          h.exercise === exerciseName &&
          h.weight !== undefined &&
          h.weight !== null
        )
        .sort((a, b) =>
          a.createdAt - b.createdAt
        );

    if (list.length === 0)
      return null;

    const weights =
      list.map(h =>
        Number(h.weight) || 0
      );

    const latestWeight =
      weights[weights.length - 1];

    const bestWeight =
      Math.max(...weights);

    let previousBest = 0;

    if (weights.length > 1) {

      previousBest =
        Math.max(
          ...weights.slice(0, -1)
        );

    }

    const improvement =
      latestWeight - previousBest;

    return {

      latestWeight,
      bestWeight,
      improvement:
        improvement > 0
          ? improvement
          : 0,

      count: weights.length,

      hasImprovement:
        improvement > 0

    };

  };

  const muscles = [

    { name: "⭐ Favoriten", key: "favorites" },
    { name: "Brust", key: "chest" },
    { name: "Rücken", key: "back" },
    { name: "Beine", key: "legs" },
    { name: "Schultern", key: "shoulders" },
    { name: "Arme", key: "biceps" },
    { name: "Bauch", key: "abdominals" }

  ];

  useEffect(() => {

    let unsubTraining = () => {};

    const unsubAuth =
      onAuthStateChanged(auth, async (user) => {

        if (!user) {

          router.push("/login");
          return;

        }

        setUserId(user.uid);

        const qTraining =
          query(
            collection(db, "training"),
            where("userId", "==", user.uid)
          );

        unsubTraining =
          onSnapshot(qTraining, (snapshot) => {

            const list: any[] = [];

            snapshot.forEach(doc => {

              list.push({
                id: doc.id,
                ...doc.data()
              });

            });

            list.sort(
              (a, b) => b.createdAt - a.createdAt
            );

            setHistory(list);

          });

        const qFav =
          query(
            collection(db, "favorites"),
            where("userId", "==", user.uid)
          );

        onSnapshot(qFav, (snapshot) => {

          const favMap: any = {};

          snapshot.forEach(doc => {

            favMap[
              doc.data().exercise
            ] = doc.id;

          });

          setFavorites(favMap);

        });

      });

    return () => {

      unsubAuth();

      if (unsubTraining)
        unsubTraining();

    };

  }, []);

  useEffect(() => {

    fetch("/exercises.json")
      .then(res => res.json())
      .then(data => setAllExercises(data));

  }, []);

  const addXP = async (amount: number) => {

    if (!userId) return;

    const userRef =
      doc(db, "users", userId);

    const snap =
      await getDoc(userRef);

    if (!snap.exists()) return;

    const currentXP =
      snap.data().xp || 0;

    await updateDoc(userRef, {

      xp: currentXP + amount

    });

  };

  const incrementTrainingCount = async () => {

    if (!userId) return;

    const userRef =
      doc(db, "users", userId);

    const snap =
      await getDoc(userRef);

    if (!snap.exists()) return;

    const current =
      snap.data().trainingCount || 0;

    await updateDoc(userRef, {

      trainingCount: current + 1

    });

  };

  const selectMuscle =
    (muscle: string) => {

      if (muscle === "favorites") {

        const favExercises =
          allExercises.filter(ex =>
            favorites[ex.name]
          );

        setExercises(favExercises);

        setSelectedMuscle("favorites");

        return;

      }

      const filtered =
        allExercises.filter(ex =>
          ex.primaryMuscles.includes(muscle)
        );

      const sorted = [

        ...filtered.filter(ex =>
          favorites[ex.name]
        ),

        ...filtered.filter(ex =>
          !favorites[ex.name]
        )

      ];

      setExercises(sorted);

      setSelectedMuscle(muscle);

    };

  const toggleFavorite =
    async (exerciseName: string) => {

      if (favorites[exerciseName]) {

        await deleteDoc(
          doc(
            db,
            "favorites",
            favorites[exerciseName]
          )
        );

      } else {

        await addDoc(
          collection(db, "favorites"),
          {
            userId,
            exercise: exerciseName
          }
        );

      }

    };

  const saveTraining =
    async () => {

      await addDoc(
        collection(db, "training"),
        {

          userId,

          exercise:
            selectedExercise.name,

          weight:
            Number(weight) || 0,

          sets:
            Number(sets) || 0,

          reps:
            Number(reps) || 0,

          date:
            new Date().toDateString(),

          createdAt:
            Date.now()

        }
      );

      const earnedXP =
        calculateXP(
          selectedExercise.name,
          Number(weight)
        );

      await addXP(earnedXP);

      await incrementTrainingCount();
      await updateStreak(userId);

      const newBadges =
        await checkBadges(userId);

      if (newBadges.length > 0) {

        setBadgePopup(newBadges[0]);

        setTimeout(() => {
          setBadgePopup(null);
        }, 3000);

      }

      setSelectedExercise(null);
      setWeight("");
      setSets("");
      setReps("");

    };
  const saveCustomTraining = async () => {

    if (!customName) {
      alert("Übung eingeben");
      return;
    }

    await addDoc(
      collection(db, "training"),
      {

        userId,

        exercise: customName,

        weight:
          isCardio
            ? 0
            : Number(customWeight) || 0,

        sets:
          isCardio
            ? 0
            : Number(customSets) || 0,

        reps:
          isCardio
            ? 0
            : Number(customReps) || 0,

        distance:
          isCardio
            ? Number(customDistance) || 0
            : 0,

        time:
          isCardio
            ? customTime
            : "",

        isCardio,

        date:
          new Date().toDateString(),

        createdAt:
          Date.now()

      }
    );

    const earnedXP =
      isCardio
        ? calculateCardioXP(
            customName,
            Number(customDistance) || 0,
            customTime
          )
        : calculateXP(
            customName,
            Number(customWeight) || 0
          );

    await addXP(earnedXP);
    await incrementTrainingCount();
    await updateStreak(userId);

    setCustomName("");
    setCustomWeight("");
    setCustomSets("");
    setCustomReps("");
    setCustomDistance("");
    setCustomTime("");

  };
  return (

    <div>

      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex justify-center">

        <div className="w-full max-w-md p-4 space-y-4">

          {!selectedMuscle && (

            <div className="space-y-3">

              {/* CUSTOM TRAINING */}
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow space-y-3">

                <div className="font-bold text-white">
                  Eigenes Training eintragen
                </div>

                <input
                  placeholder="Übung (z.B. Bankdrücken, Joggen)"
                  value={customName}
                  onChange={(e)=>setCustomName(e.target.value)}
                  className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
                />

                <div className="flex gap-2">

                  <button
                    onClick={()=>setIsCardio(false)}
                    className={`flex-1 p-2 rounded ${
                      !isCardio ? "bg-green-600" : "bg-white/10"
                    }`}
                  >
                    Kraft
                  </button>

                  <button
                    onClick={()=>setIsCardio(true)}
                    className={`flex-1 p-2 rounded ${
                      isCardio ? "bg-green-600" : "bg-white/10"
                    }`}
                  >
                    Cardio
                  </button>

                </div>

                {!isCardio && (
                  <>
                    <input
                      placeholder="Gewicht (kg)"
                      value={customWeight}
                      onChange={(e)=>setCustomWeight(e.target.value)}
                      className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
                    />

                    <input
                      placeholder="Sätze"
                      value={customSets}
                      onChange={(e)=>setCustomSets(e.target.value)}
                      className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
                    />

                    <input
                      placeholder="Wiederholungen"
                      value={customReps}
                      onChange={(e)=>setCustomReps(e.target.value)}
                      className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
                    />
                  </>
                )}

                {isCardio && (
                  <>
                    <input
                      placeholder="Distanz (km)"
                      value={customDistance}
                      onChange={(e)=>setCustomDistance(e.target.value)}
                      className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
                    />

                    <input
                      placeholder="Zeit (z.B. 25:00)"
                      value={customTime}
                      onChange={(e)=>setCustomTime(e.target.value)}
                      className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
                    />
                  </>
                )}

                <button
                  onClick={saveCustomTraining}
                  className="w-full bg-green-600 p-3 rounded font-bold"
                >
                  Training speichern
                </button>

              </div>

              {/* MUSKELGRUPPEN */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 rounded-2xl shadow-lg">

                <div className="text-sm opacity-80">
                  Training
                </div>

                <div className="text-2xl font-bold">
                  Muskelgruppe wählen
                </div>

              </div>

              <div className="grid grid-cols-2 gap-3">

                {muscles.map(m => (

                  <div
                    key={m.key}
                    onClick={() => selectMuscle(m.key)}
                    className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow text-center font-bold hover:bg-white/20 transition cursor-pointer"
                  >
                    {m.name}
                  </div>

                ))}

              </div>

            </div>

          )}

          {selectedMuscle && (

            <div>

              <button
                onClick={() =>
                  setSelectedMuscle(null)
                }
                className="mb-4 text-green-400 font-bold"
              >
                ← Zurück
              </button>

              <div className="grid grid-cols-2 gap-3">

                {exercises.map((exercise, i) => (

                  <div
                    key={i}
                    className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl shadow overflow-hidden relative"
                  >

                    <div
                      onClick={() =>
                        toggleFavorite(
                          exercise.name
                        )
                      }
                      className="absolute top-2 right-2 text-xl cursor-pointer"
                    >
                      {favorites[exercise.name]
                        ? "★"
                        : "☆"}
                    </div>

                    <div
                      onClick={() =>
                        setSelectedExercise(
                          exercise
                        )
                      }
                    >

                      <div className="aspect-square">

                        <img
                          src={
                            "/exercises/" +
                            exercise.images[0]
                          }
                          className="w-full h-full object-cover"
                        />

                      </div>

                      <div className="p-3 text-center">

                        <div className="text-sm font-bold">
                          {exercise.name}
                        </div>

                      </div>

                    </div>

                  </div>

                ))}

              </div>

            </div>

          )}

        </div>

        {/* TRAINING MODAL */}
        {selectedExercise && (

          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

            <div className="bg-slate-900 border border-white/20 p-6 rounded-2xl w-80 shadow-xl">

              <div className="font-bold mb-3 text-white">
                {selectedExercise.name}
              </div>

              <input
                placeholder="Gewicht (kg)"
                value={weight}
                onChange={(e)=>setWeight(e.target.value)}
                className="w-full p-3 mb-2 rounded bg-white/10 border border-white/20 text-white"
              />

              <input
                placeholder="Sätze"
                value={sets}
                onChange={(e)=>setSets(e.target.value)}
                className="w-full p-3 mb-2 rounded bg-white/10 border border-white/20 text-white"
              />

              <input
                placeholder="Wiederholungen"
                value={reps}
                onChange={(e)=>setReps(e.target.value)}
                className="w-full p-3 mb-3 rounded bg-white/10 border border-white/20 text-white"
              />

              <button
                onClick={saveTraining}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 p-3 rounded font-bold mb-2"
              >
                Training speichern
              </button>

              <button
                onClick={()=>setSelectedExercise(null)}
                className="w-full bg-white/10 p-3 rounded border border-white/20"
              >
                Abbrechen
              </button>

            </div>

          </div>

        )}

        {/* VERLAUF */}
        {history.length > 0 && (

          <div className="mt-6">

            <div className="text-xl font-bold mb-3">
              Dein Fortschritt
            </div>

            <div className="space-y-2">

              {history.slice(0,5).map(item => {

                const stats =
                  getExerciseStats(item.exercise);

                return (

                  <div
                    key={item.id}
                    className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-xl"
                  >

                    <div className="font-bold">
                      {item.exercise}
                    </div>

                    <div className="text-sm text-gray-300">

                      {item.isCardio ? (
                        <>
                          {item.distance} km • {item.time}
                        </>
                      ) : (
                        <>
                          {item.weight} kg • {item.sets} Sätze • {item.reps} Wdh
                        </>
                      )}

                    </div>

                    {!item.isCardio && stats && (

                      <div className="mt-2 text-xs space-y-1">

                        <div>
                          🏆 Bestwert: {stats.bestWeight} kg
                        </div>

                        <div>
                          📈 Verbesserung: +{stats.improvement} kg
                        </div>

                        <div>
                          🔁 Trainings: {stats.count}
                        </div>

                      </div>

                    )}

                    {item.isCardio && (

                      <div className="mt-2 text-xs space-y-1">

                        <div>
                          🏃 Distanz: {item.distance} km
                        </div>

                        <div>
                          ⏱ Zeit: {item.time}
                        </div>

                      </div>

                    )}

                  </div>

                );

              })}

            </div>

            {/* BUTTON HIER — außerhalb der map */}
            {history.length > 10 && (

              <div className="text-center pt-4">

                <button
                  onClick={()=>router.push("/training-history")}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl text-sm"
                >
                  Alle anzeigen →
                </button>

              </div>

            )}

          </div>

        )}

        {/* BADGE POPUP */}
        {badgePopup && (

          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">

            <div className="bg-slate-900 border border-white/20 shadow-xl rounded-2xl p-6 text-center animate-bounce">

              <div className="text-4xl mb-2">
                🏆
              </div>

              <div className="font-bold text-lg">
                Neues Abzeichen!
              </div>

              <div className="mt-1 text-green-400 font-bold">

                {badgePopup === "training_10" && "🏋️ 10 Trainings"}
                {badgePopup === "streak_7" && "🔥 7 Tage Streak"}
                {badgePopup === "level_5" && "💪 Level 5 erreicht"}
                {badgePopup === "minus_5kg" && "📉 5kg verloren"}

              </div>

            </div>

          </div>

        )}

      </main>

    </div>

  );

}