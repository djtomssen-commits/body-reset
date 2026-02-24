"use client";

import Navbar from "../../components/Navbar";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

import { auth, db } from "../../lib/firebase";

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

export default function Dashboard() {

  const router = useRouter();

  const todayStr = new Date().toDateString();

  // USER
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");

  // XP / LEVEL
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [loginBonusBalance, setLoginBonusBalance] = useState(0);

  // BODY
  const [weight, setWeight] = useState(80);
  const [height, setHeight] = useState(180);
  const [belly, setBelly] = useState(90);

  const [startWeight, setStartWeight] = useState(80);
  const [goalWeight, setGoalWeight] = useState(75);

  // NUTRITION
  const [calories, setCalories] = useState(0);
  const [caloriesGoal, setCaloriesGoal] = useState(2200);

  const [protein, setProtein] = useState(0);
  const [proteinGoal, setProteinGoal] = useState(180);

  // WEIGHT HISTORY
  const [weightHistory, setWeightHistory] = useState<any[]>([]);

  // TRAINING PROGRESS HISTORY
  const [trainingProgressHistory, setTrainingProgressHistory] = useState<any[]>([]);

  // CALCULATED
  const [bmi, setBmi] = useState(0);
  const [kfa, setKfa] = useState(0);
  const [progress, setProgress] = useState(0);

  // GOAL ENGINE
  type GoalType = "fat_loss" | "muscle_gain" | "maintain" | "health";
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [showGoalPick, setShowGoalPick] = useState(false);

  const levelProgress = xp % 100;

  const caloriesPercent = Math.min((calories / caloriesGoal) * 100, 100);
  const proteinPercent = Math.min((protein / proteinGoal) * 100, 100);

  const goalLabel = (g: GoalType) => {
    if (g === "fat_loss") return "Fett verlieren";
    if (g === "muscle_gain") return "Muskeln aufbauen";
    if (g === "maintain") return "Gewicht halten";
    return "Gesünder leben";
  };

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
    } else if (g === "muscle_gain") {
      cal = tdee + 250;
      prot = 1.8 * kg;
    } else if (g === "maintain") {
      cal = tdee;
      prot = 1.6 * kg;
    } else if (g === "health") {
      cal = tdee - 250;
      prot = 1.6 * kg;
    }

    // harte Grenzen, damit nix absurd wird
    cal = clamp(Math.round(cal), 1400, 4000);
    prot = clamp(Math.round(prot), 90, 260);

    return { cal, prot };
  };

  // Tagesbewertung (zielbasiert)
  const dailyCoachStatus = (g: GoalType, cal: number, calGoal: number, prot: number, protGoal: number) => {
    const calDiff = cal - calGoal;
    const calOk = Math.abs(calDiff) <= calGoal * 0.05; // ±5%
    const protOk = prot >= protGoal * 0.9;

    if (g === "fat_loss") {
      if (cal <= calGoal && protOk) return { label: "✅ Optimal für Fettverlust", hint: "Kalorien im Ziel + Protein passt." };
      if (cal <= calGoal && !protOk) return { label: "⚠️ Fast gut", hint: "Kalorien ok, aber Protein ist zu niedrig." };
      return { label: "❌ Bremst Fortschritt", hint: "Du liegst über deinem Fettverlust-Ziel." };
    }

    if (g === "muscle_gain") {
      if (cal >= calGoal * 0.95 && protOk) return { label: "✅ Optimal für Aufbau", hint: "Genug Energie + Protein passt." };
      if (!protOk) return { label: "⚠️ Aufbau gebremst", hint: "Protein ist zu niedrig." };
      return { label: "⚠️ Eher zu wenig", hint: "Für Aufbau fehlen Kalorien." };
    }

    if (g === "maintain") {
      if (calOk && protOk) return { label: "✅ Stabil & sauber", hint: "Im Rahmen + Protein passt." };
      if (calOk && !protOk) return { label: "⚠️ Ok, aber Protein fehlt", hint: "Stabil, aber Protein ist zu niedrig." };
      return { label: "⚠️ Außerhalb vom Rahmen", hint: "Zu weit weg vom Ziel-Kalorienbereich." };
    }

    // health
    if (cal <= calGoal * 1.05 && protOk) return { label: "✅ Sehr solide", hint: "Gute Basis heute." };
    if (!protOk) return { label: "⚠️ Protein fehlt", hint: "Gesund ja, aber Protein ist zu niedrig." };
    return { label: "⚠️ Etwas drüber", hint: "Nicht schlimm, aber du bist über dem Tagesziel." };
  };

  const etaToGoalDays = (g: GoalType, currentKg: number, targetKg: number) => {
    const diff = targetKg - currentKg;

    // Nur sinnvoll für Ziele mit Gewicht
    if (g === "maintain" || g === "health") return null;
    if (diff === 0) return 0;

    // Konservative Raten (kg/Woche)
    // Fettverlust: ~0.5% Körpergewicht/Woche
    // Aufbau: ~0.25% Körpergewicht/Woche
    const weekly =
      g === "fat_loss"
        ? Math.max(0.25, (currentKg * 0.005))
        : Math.max(0.15, (currentKg * 0.0025));

    const weeks = Math.abs(diff) / weekly;
    return Math.ceil(weeks * 7);
  };

  const saveGoal = async (g: GoalType) => {
    if (!userId) return;

    const targets = recommendTargets(g, weight, height);

    // user doc updaten (oder anlegen)
    const ref = doc(db, "users", userId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      await updateDoc(ref, {
        goalType: g,
        caloriesGoal: targets.cal,
        proteinGoal: targets.prot,
      });
    } else {
      await setDoc(ref, {
        goalType: g,
        caloriesGoal: targets.cal,
        proteinGoal: targets.prot,
        weight,
        height,
        belly,
        startWeight,
        goalWeight,
        xp,
      });
    }

    setGoalType(g);
    setCaloriesGoal(targets.cal);
    setProteinGoal(targets.prot);
    setShowGoalPick(false);
  };

  // AUTH + LOAD DATA + LOGIN BONUS
  useEffect(() => {

    let unsubNutrition:any;
    let unsubWeight:any;
    let unsubTraining:any;

    const unsubAuth =
      onAuthStateChanged(auth, async (user) => {

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.uid);
        setUserName(user.displayName || "Athlet");

        // --- LOGIN BONUS CHECK ---
        // ✅ FIX: Kein Zugriff mehr auf "loginBonus" Collection (nicht in Rules erlaubt)
        // Stattdessen: Abo-Daten aus "subscriptions/{uid}" lesen (ist erlaubt)
        try {
          const token = await user.getIdToken();
          await fetch("/api/init-subscription", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch {
          // init darf nicht alles killen
        }

        const subRef = doc(db, "subscriptions", user.uid);
        const subSnap = await getDoc(subRef);

        if (subSnap.exists()) {
          const subData:any = subSnap.data();
          setStreak(Number(subData.streak || 0));
          setLoginBonusBalance(Number(subData.guthaben || 0));
        } else {
          setStreak(0);
          setLoginBonusBalance(0);
        }
        // --- ENDE LOGIN BONUS ---

        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data:any = snap.data();
          setXp(data.xp || 0);
          setWeight(data.weight || 80);
          setHeight(data.height || 180);
          setBelly(data.belly || 90);
          setStartWeight(data.startWeight || 80);
          setGoalWeight(data.goalWeight || 75);
          setCaloriesGoal(data.caloriesGoal || 2200);
          setProteinGoal(data.proteinGoal || 180);

          const g: GoalType | undefined = data.goalType;
          if (g) {
            setGoalType(g);
            setShowGoalPick(false);
          } else {
            setGoalType(null);
            setShowGoalPick(true);
          }
        } else {
          setShowGoalPick(true);
        }

        const qNutrition = query(collection(db,"nutrition"), where("userId","==",user.uid), where("date","==",todayStr));
        unsubNutrition = onSnapshot(qNutrition,(snapshot)=>{
          let totalCalories = 0;
          let totalProtein = 0;
          snapshot.forEach(doc=>{
            const d = doc.data();
            totalCalories += Number(d.calories || 0);
            totalProtein += Number(d.protein || 0);
          });
          setCalories(totalCalories);
          setProtein(totalProtein);
        });

        const qWeight = query(collection(db,"weight"), where("userId","==",user.uid));
        unsubWeight = onSnapshot(qWeight,(snapshot)=>{
          const list:any[] = [];
          snapshot.forEach(doc=>{
            const d = doc.data();
            list.push({
              date: new Date(d.date).toLocaleDateString(),
              weight: Number(d.weight)
            });
          });
          list.sort((a,b)=>new Date(a.date).getTime() - new Date(b.date).getTime());
          setWeightHistory(list);
        });

        const qTraining = query(collection(db,"training"), where("userId","==",user.uid));
        unsubTraining = onSnapshot(qTraining,(snapshot)=>{
          const all:any[] = [];
          snapshot.forEach(doc=>{
            const d = doc.data();
            if (!d.isCardio && d.weight > 0) {
              all.push({
                date: new Date(d.createdAt).toLocaleDateString(),
                weight: Number(d.weight),
                createdAt: d.createdAt
              });
            }
          });
          all.sort((a,b)=>a.createdAt - b.createdAt);
          let best = 0;
          const progress = all.map(entry=>{
            if (entry.weight > best) best = entry.weight;
            return { date: entry.date, weight: best };
          });
          setTrainingProgressHistory(progress);
        });

      });

    return () => {
      unsubAuth();
      if(unsubNutrition) unsubNutrition();
      if(unsubWeight) unsubWeight();
      if(unsubTraining) unsubTraining();
    };

  }, []);

  useEffect(()=>{
    const bmiValue = weight / ((height/100)*(height/100));
    setBmi(Number(bmiValue.toFixed(1)));
    const kfaValue = ((belly*0.74)-(weight*0.082)-44.74)/ weight * 100;
    setKfa(Number(kfaValue.toFixed(1)));
    const total = startWeight - goalWeight;
    const current = startWeight - weight;
    const percent = total === 0 ? 0 : (current/total)*100;
    setProgress(Math.max(0,Math.min(100,percent)));
    setLevel(Math.floor(xp/100)+1);
  },[weight,height,belly,xp]);

  const getStatus = () => {
    if (kfa < 12) return "Elite";
    if (kfa < 15) return "Sehr fit";
    if (kfa < 18) return "Fit";
    if (kfa < 22) return "Normal";
    return "Verbesserbar";
  };

  return (
    <div>
      
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-20 text-white">
        <div className="max-w-md mx-auto p-4 space-y-4">

          {/* HERO */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-lg">
            <div className="text-sm opacity-80">
              Willkommen zurück
            </div>

            <div className="text-2xl font-bold">
              {userName}
            </div>

            <div className="mt-4">

              <div className="flex justify-between text-sm">

                <div>
                  Level {level}
                </div>

                <div>
                  {xp} XP
                </div>

              </div>

              <div className="w-full bg-white/30 h-3 rounded mt-1">
                <div
                  className="bg-white h-3 rounded"
                  style={{ width: levelProgress+"%" }}
                />
              </div>

            </div>

          </div>

          {/* GOAL PICKER */}
          {showGoalPick && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
              <div className="font-bold mb-2">Wähle dein Ziel</div>
              <div className="text-sm text-gray-400 mb-4">
                Danach setzt die App automatisch deine Kalorien- und Protein-Ziele.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => saveGoal("fat_loss")}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-3 text-left"
                >
                  <div className="font-bold">🔥 Fett verlieren</div>
                  <div className="text-xs text-gray-400">Defizit + mehr Protein</div>
                </button>

                <button
                  onClick={() => saveGoal("muscle_gain")}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-3 text-left"
                >
                  <div className="font-bold">💪 Muskelaufbau</div>
                  <div className="text-xs text-gray-400">leichtes Plus + Protein</div>
                </button>

                <button
                  onClick={() => saveGoal("maintain")}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-3 text-left"
                >
                  <div className="font-bold">⚖️ Halten</div>
                  <div className="text-xs text-gray-400">stabil & sauber</div>
                </button>

                <button
                  onClick={() => saveGoal("health")}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-3 text-left"
                >
                  <div className="font-bold">🫀 Gesund</div>
                  <div className="text-xs text-gray-400">leichtes Defizit</div>
                </button>
              </div>
            </div>
          )}

          {/* COACH STATUS */}
          {goalType && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
              <div className="flex justify-between items-center mb-2">
                <div className="font-bold">Dein Tages-Coach</div>
                <div className="text-xs text-gray-400">
                  Ziel: {goalLabel(goalType)}
                </div>
              </div>

              {(() => {
                const s = dailyCoachStatus(goalType, calories, caloriesGoal, protein, proteinGoal);
                return (
                  <>
                    <div className="text-lg font-bold">{s.label}</div>
                    <div className="text-sm text-gray-400 mt-1">{s.hint}</div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ETA / PROGNOSE */}
          {goalType && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
              <div className="font-bold mb-1">Prognose</div>
              <div className="text-sm text-gray-400 mb-3">
                (Konservativ geschätzt – je nach Konsistenz schneller/langsamer)
              </div>

              {(() => {
                const days = etaToGoalDays(goalType, weight, goalWeight);
                if (days === null) {
                  return <div className="text-sm text-gray-300">Für dieses Ziel gibt’s keine Zielgewicht-ETA.</div>;
                }
                if (days === 0) {
                  return <div className="text-lg font-bold">✅ Zielgewicht erreicht</div>;
                }
                const etaDate = new Date();
                etaDate.setDate(etaDate.getDate() + days);

                return (
                  <>
                    <div className="text-lg font-bold">
                      ~{days} Tage bis {goalWeight} kg
                    </div>
                    <div className="text-sm text-gray-400">
                      Voraussichtlich um: {etaDate.toLocaleDateString()}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* STATS */}
          <div className="grid grid-cols-2 gap-3">

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow text-white">
              <div className="text-xs text-gray-400">
                🔥 Streak
              </div>
              <div className="text-2xl font-bold text-orange-500">
                {streak}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow text-white">
              <div className="text-xs text-gray-400">
                Status
              </div>
              <div className="text-lg font-bold">
                {getStatus()}
              </div>
              <div className="text-xs text-gray-500">
                {kfa}% KFA
              </div>
            </div>

          </div>

          {/* LOGIN BONUS BALANCE */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow text-white mt-3">
            <div className="text-xs text-gray-400">🎁 Login Bonus Guthaben</div>
            <div className="text-2xl font-bold text-green-400">
              {loginBonusBalance.toFixed(2)} €
            </div>
            {streak === 7 && (
              <div className="text-xs text-yellow-300">
                Herzlichen Glückwunsch! Du hast den 7-Tage Bonus erreicht.
              </div>
            )}
          </div>

          {/* PROGRESS */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
            <div className="font-bold mb-2">
              Fortschritt
            </div>
            <div className="text-sm text-gray-400">
              {startWeight}kg → {goalWeight}kg
            </div>
            <div className="w-full bg-gray-700 h-4 rounded mt-2">
              <div
                className="bg-gradient-to-r from-green-400 to-emerald-500 h-4 rounded"
                style={{ width: progress+"%" }}
              />
            </div>
          </div>

          {/* CALORIES */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
            <div className="flex justify-between mb-2">
              <div className="font-bold">
                Kalorien
              </div>
              <div className="text-sm text-gray-400">
                {calories}/{caloriesGoal}
              </div>
            </div>
            <div className="w-full bg-gray-700 h-3 rounded">
              <div
                className="bg-gradient-to-r from-green-400 to-emerald-500 h-3 rounded"
                style={{ width: caloriesPercent+"%" }}
              />
            </div>
          </div>

          {/* PROTEIN */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
            <div className="flex justify-between mb-2">
              <div className="font-bold">
                Protein
              </div>
              <div className="text-sm text-gray-400">
                {protein}/{proteinGoal} g
              </div>
            </div>
            <div className="w-full bg-gray-700 h-3 rounded">
              <div
                className="bg-gradient-to-r from-blue-400 to-cyan-500 h-3 rounded"
                style={{ width: proteinPercent+"%" }}
              />
            </div>
          </div>

          {/* WEIGHT CHART */}
          {weightHistory.length > 0 && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
              <div className="font-bold mb-3">
                Gewichtsverlauf
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightHistory}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="date"/>
                    <YAxis/>
                    <Tooltip/>
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#22c55e"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TRAINING PROGRESS CHART */}
          {trainingProgressHistory.length > 0 && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
              <div className="font-bold mb-3">
                Kraft Fortschritt
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trainingProgressHistory}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="date"/>
                    <YAxis/>
                    <Tooltip/>
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#22c55e"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );

}