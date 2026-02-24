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

  // COACH / ANALYSE / AUTOPILOT
  const [nutritionHistory, setNutritionHistory] = useState<any[]>([]);
  const [autopilot, setAutopilot] = useState(true);
  const [lastAutopilotRun, setLastAutopilotRun] = useState<string>("");

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

  const onTrackStatus = (
    g: GoalType,
    cal: number,
    calGoal: number,
    prot: number,
    protGoal: number
  ) => {

    // ✅ Noch nichts oder zu wenig getrackt
    if (cal < 10 && prot < 2) {
      return {
        label: "🟦 Noch keine Daten",
        hint: "Trag eine Mahlzeit ein – dann kann ich sagen, ob du auf Kurs bist."
      };
    }

    const protOk = prot >= protGoal * 0.9;

    if (g === "fat_loss") {
      if (cal <= calGoal && protOk) return { label: "✅ Auf Fettverlust-Kurs", hint: "Defizit passt + Protein passt." };
      if (cal <= calGoal && !protOk) return { label: "⚠️ Fast auf Kurs", hint: "Kalorien passen, Protein fehlt." };
      if (cal <= calGoal * 1.1) return { label: "⚠️ Neutral", hint: "Leicht drüber – heute wird’s eher Maintenance." };
      return { label: "❌ Nicht auf Kurs", hint: "Deutlich über dem Ziel – morgen wieder sauber." };
    }

    if (g === "muscle_gain") {
      if (cal >= calGoal * 0.95 && protOk) return { label: "✅ Auf Aufbau-Kurs", hint: "Energie + Protein passen." };
      if (!protOk) return { label: "⚠️ Aufbau bremst", hint: "Protein ist der Engpass." };
      return { label: "⚠️ Neutral", hint: "Für Aufbau fehlt Energie." };
    }

    if (g === "maintain") {
      const calOk = Math.abs(cal - calGoal) <= calGoal * 0.05;
      if (calOk && protOk) return { label: "✅ Stabil", hint: "Im Rahmen + Protein passt." };
      if (calOk && !protOk) return { label: "⚠️ Stabil, aber…", hint: "Protein etwas niedrig." };
      return { label: "⚠️ Schwankung", hint: "Kalorien sind heute deutlich weg vom Ziel." };
    }

    // health
    if (protOk && cal <= calGoal * 1.05) return { label: "✅ Gesund auf Kurs", hint: "Solide Basis heute." };
    if (!protOk) return { label: "⚠️ Gesund, aber…", hint: "Protein ist heute der Hebel." };
    return { label: "⚠️ Neutral", hint: "Etwas drüber – kein Drama." };
  };

  // Tagesbewertung (zielbasiert)
  const dailyCoachStatus = (
    g: GoalType,
    cal: number,
    calGoal: number,
    prot: number,
    protGoal: number
  ) => {

    // ✅ Noch nichts oder zu wenig getrackt
    if (cal < 10 && prot < 2) {
      return {
        label: "📝 Noch nichts getrackt",
        hint: "Trag deine erste Mahlzeit ein, dann bekommst du eine Bewertung."
      };
    }

    // Optional: Warnung wenn deutlich zu wenig gegessen
    if (cal < calGoal * 0.3) {
      return {
        label: "⚠️ Zu wenig gegessen",
        hint: "Zu wenig Energie kann Fettverlust und Muskelaufbau bremsen."
      };
    }

    const calDiff = cal - calGoal;
    const calOk = Math.abs(calDiff) <= calGoal * 0.05; // ±5%
    const protOk = prot >= protGoal * 0.9;

    if (g === "fat_loss") {
      if (cal <= calGoal && protOk)
        return {
          label: "✅ Optimal für Fettverlust",
          hint: "Perfektes Defizit und genug Protein."
        };

      if (cal <= calGoal && !protOk)
        return {
          label: "⚠️ Protein zu niedrig",
          hint: "Kalorien gut, aber mehr Protein beschleunigt Fettverlust."
        };

      return {
        label: "❌ Bremst Fettverlust",
        hint: "Du bist über deinem Kalorienziel."
      };
    }

    if (g === "muscle_gain") {
      if (cal >= calGoal * 0.95 && protOk)
        return {
          label: "✅ Optimal für Muskelaufbau",
          hint: "Genug Energie und Protein."
        };

      if (!protOk)
        return {
          label: "⚠️ Protein zu niedrig",
          hint: "Protein ist entscheidend für Muskelwachstum."
        };

      return {
        label: "⚠️ Zu wenig Kalorien",
        hint: "Für Muskelaufbau brauchst du mehr Energie."
      };
    }

    if (g === "maintain") {
      if (calOk && protOk)
        return {
          label: "✅ Perfekt stabil",
          hint: "Du hältst dein Gewicht optimal."
        };

      return {
        label: "⚠️ Leichte Abweichung",
        hint: "Du bist etwas außerhalb deines Zielbereichs."
      };
    }

    // health
    if (protOk)
      return {
        label: "✅ Gute Ernährung",
        hint: "Du bist auf einem gesunden Weg."
      };

    return {
      label: "⚠️ Mehr Protein empfohlen",
      hint: "Protein unterstützt Gesundheit und Muskeln."
    };

  };

  const behaviorAnalysis = (g: GoalType) => {

    // keine Daten -> keine Analyse
    if (!nutritionHistory || nutritionHistory.length === 0) {
      return {
        title: "Analyse",
        body: "Noch keine Historie – trag ein paar Tage ein, dann kann ich Muster erkennen."
      };
    }

    // letzte 7 Tage aggregieren
    const byDay: Record<string, { cal: number; prot: number }> = {};
    nutritionHistory.forEach((x:any) => {
      const day = String(x.date || "");
      if (!day) return;
      if (!byDay[day]) byDay[day] = { cal: 0, prot: 0 };
      byDay[day].cal += Number(x.calories || 0);
      byDay[day].prot += Number(x.protein || 0);
    });

    const days = Object.keys(byDay)
      .map(d => ({ d, t: new Date(d).getTime() }))
      .filter(x => !Number.isNaN(x.t))
      .sort((a,b)=>b.t-a.t)
      .slice(0,7)
      .map(x=>x.d);

    if (days.length === 0) {
      return {
        title: "Analyse",
        body: "Noch keine Historie – trag ein paar Tage ein, dann kann ich Muster erkennen."
      };
    }

    const calMet = days.filter(d => byDay[d].cal >= caloriesGoal * 0.95 && byDay[d].cal <= caloriesGoal * 1.05).length;
    const protMet = days.filter(d => byDay[d].prot >= proteinGoal * 0.9).length;

    const calRate = Math.round((calMet / days.length) * 100);
    const protRate = Math.round((protMet / days.length) * 100);

    let biggest = "Konsistenz";
    if (protRate < calRate) biggest = "Protein";
    if (calRate < protRate) biggest = "Kalorien";

    let body = `Letzte ${days.length} Tage: Kalorien-Ziel an ${calRate}% der Tage, Protein-Ziel an ${protRate}% der Tage.`;

    if (biggest === "Protein") {
      body += " Größter Hebel: Protein erhöhen.";
    } else if (biggest === "Kalorien") {
      body += " Größter Hebel: Kalorien stabiler treffen.";
    } else {
      body += " Stark: du bist ziemlich konstant.";
    }

    // kurze, ziel-spezifische Zusatzinfo
    if (g === "fat_loss" && calRate < 50) body += " Für Fettverlust ist das Defizit der wichtigste Faktor.";
    if (g === "muscle_gain" && protRate < 60) body += " Für Aufbau ist Protein dein Engpass.";
    if (g === "maintain" && calRate < 50) body += " Für Halten ist weniger Schwankung der Schlüssel.";

    return { title: "Analyse", body };
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
    let unsubNutritionAll:any;
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

          setAutopilot(data.autopilot !== undefined ? Boolean(data.autopilot) : true);
          setLastAutopilotRun(data.lastAutopilotRun || "");

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
            const d:any = doc.data();
            totalCalories += Number(d.calories || 0);
            totalProtein += Number(d.protein || 0);
          });
          setCalories(totalCalories);
          setProtein(totalProtein);
        });

        const qNutritionAll = query(collection(db,"nutrition"), where("userId","==",user.uid));
        unsubNutritionAll = onSnapshot(qNutritionAll,(snapshot)=>{
          const list:any[] = [];
          snapshot.forEach(doc=>{
            const d:any = doc.data();
            list.push({
              date: d.date,
              calories: Number(d.calories || 0),
              protein: Number(d.protein || 0),
            });
          });
          setNutritionHistory(list);
        });

        const qWeight = query(collection(db,"weight"), where("userId","==",user.uid));
        unsubWeight = onSnapshot(qWeight,(snapshot)=>{
          const list:any[] = [];
          snapshot.forEach(doc=>{
            const d:any = doc.data();
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
            const d:any = doc.data();
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
      if(unsubNutritionAll) unsubNutritionAll();
      if(unsubWeight) unsubWeight();
      if(unsubTraining) unsubTraining();
    };

  }, []);

  // AUTOPILOT: konservatives Feintuning (nur 1x pro Tag)
  useEffect(() => {

    const run = async () => {

      if (!userId) return;
      if (!goalType) return;
      if (!autopilot) return;

      // Schutz: nur 1x pro Tag
      if (lastAutopilotRun === todayStr) return;

      // nur wenn genug Gewichts-Historie
      if (!weightHistory || weightHistory.length < 6) return;

      // letzte ~14 Tage (über Date-String sortiert)
      const sorted = [...weightHistory].sort((a,b)=>new Date(a.date).getTime() - new Date(b.date).getTime());
      const recent = sorted.slice(-14);

      if (recent.length < 6) return;

      const first = Number(recent[0].weight);
      const last = Number(recent[recent.length - 1].weight);
      const change = last - first;

      // Plateau-Check (sehr konservativ)
      const plateau = Math.abs(change) < 0.2;

      if (!plateau) return;

      // Autopilot Regeln (klein, sicher)
      let newCalGoal = caloriesGoal;
      let newProtGoal = proteinGoal;

      if (goalType === "fat_loss") {
        newCalGoal = clamp(caloriesGoal - 150, 1400, 4000);
        newProtGoal = clamp(proteinGoal + 5, 90, 260);
      }

      if (goalType === "muscle_gain") {
        newCalGoal = clamp(caloriesGoal + 150, 1400, 4000);
        newProtGoal = clamp(proteinGoal + 5, 90, 260);
      }

      if (goalType === "maintain") {
        newProtGoal = clamp(proteinGoal + 5, 90, 260);
      }

      if (goalType === "health") {
        newProtGoal = clamp(proteinGoal + 5, 90, 260);
      }

      // nichts zu tun?
      if (newCalGoal === caloriesGoal && newProtGoal === proteinGoal) return;

      await updateDoc(doc(db, "users", userId), {
        caloriesGoal: newCalGoal,
        proteinGoal: newProtGoal,
        lastAutopilotRun: todayStr
      });

      setCaloriesGoal(newCalGoal);
      setProteinGoal(newProtGoal);
      setLastAutopilotRun(todayStr);

    };

    run();

  }, [userId, goalType, autopilot, lastAutopilotRun, todayStr, weightHistory, caloriesGoal, proteinGoal]);

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

          {/* ON TRACK */}
          {goalType && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
              <div className="flex justify-between items-center mb-2">
                <div className="font-bold">Heute</div>
                <div className="text-xs text-gray-400">
                  Ziel: {goalLabel(goalType)}
                </div>
              </div>

              {(() => {
                const s = onTrackStatus(goalType, calories, caloriesGoal, protein, proteinGoal);
                return (
                  <>
                    <div className="text-lg font-bold">{s.label}</div>
                    <div className="text-sm text-gray-400 mt-1">{s.hint}</div>
                  </>
                );
              })()}
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

          {/* ANALYSE */}
          {goalType && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
              {(() => {
                const a = behaviorAnalysis(goalType);
                return (
                  <>
                    <div className="font-bold mb-2">{a.title}</div>
                    <div className="text-sm text-gray-300">{a.body}</div>
                    {autopilot && (
                      <div className="text-xs text-gray-500 mt-3">
                        Autopilot: aktiv
                      </div>
                    )}
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