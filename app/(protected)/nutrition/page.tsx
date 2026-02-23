"use client";

import Navbar from "../../components/Navbar";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  deleteDoc,
  doc
} from "firebase/firestore";

export default function NutritionPage() {

  const [meal, setMeal] = useState("");
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");

  const [calendarEntries, setCalendarEntries] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toDateString());

  const user = auth.currentUser;

  // HEUTIGE EINTRÄGE LADEN
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "nutrition"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, snapshot => {
      const data:any[] = [];
      snapshot.forEach(doc => data.push({ ...doc.data(), id: doc.id }));
      setCalendarEntries(data);
      setEntries(data.filter(e => e.date === new Date().toDateString()));
    });
    return () => unsubscribe();
  }, [user]);

  // KI ANALYSE + SPEICHERN
  const analyzeAndSave = async () => {
    if (!meal) return;
    setLoading(true);
    try {
      const res = await fetch("/api/analyze-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: meal })
      });
      const data = await res.json();
      const caloriesValue = Number(data.calories) || 0;
      const proteinValue = Number(data.protein) || 0;
      setCalories(caloriesValue);
      setProtein(proteinValue);
      await addDoc(collection(db, "nutrition"), {
        userId: user?.uid,
        meal: meal,
        calories: caloriesValue,
        protein: proteinValue,
        date: new Date().toDateString(),
        created: Timestamp.now()
      });
      setMeal("");
    } catch {
      alert("Fehler bei Analyse");
    }
    setLoading(false);
  };

  // MANUELLE EINGABE SPEICHERN
  const saveManualEntry = async () => {
    if (!meal) return;
    const caloriesValue = Number(manualCalories) || 0;
    const proteinValue = Number(manualProtein) || 0;
    try {
      await addDoc(collection(db, "nutrition"), {
        userId: user?.uid,
        meal: meal,
        calories: caloriesValue,
        protein: proteinValue,
        date: new Date().toDateString(),
        created: Timestamp.now()
      });
      setMeal("");
      setManualCalories("");
      setManualProtein("");
    } catch {
      alert("Fehler beim Speichern");
    }
  };

  const deleteEntry = async (id: string) => {
    await deleteDoc(doc(db, "nutrition", id));
  };

  const totalCalories = entries.reduce((sum, e) => sum + Number(e.calories || 0), 0);
  const totalProtein = entries.reduce((sum, e) => sum + Number(e.protein || 0), 0);

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const today = new Date().toDateString();

  const getEntriesForDate = (dateStr: string) => calendarEntries.filter(e => e.date === dateStr);

  const handleDayClick = (day: number) => {
    const date = new Date(new Date().getFullYear(), new Date().getMonth(), day).toDateString();
    setSelectedDate(date);
    setEntries(getEntriesForDate(date));
  };

  return (
    <div>
     
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex justify-center">
        <div className="w-full max-w-md p-4 space-y-4">

          {/* HEADER */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 rounded-2xl shadow-lg">
            <div className="text-sm opacity-80">Ernährung Tracking</div>
            <div className="text-2xl font-bold">KI erkennt automatisch</div>
          </div>

          {/* HEUTE TOTAL */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
            <div className="flex justify-between">
              <div>
                Kalorien
                <div className="text-xl font-bold">{totalCalories} kcal</div>
              </div>
              <div>
                Protein
                <div className="text-xl font-bold">{totalProtein} g</div>
              </div>
            </div>
          </div>

          {/* KI INPUT */}
          {selectedDate === today && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow space-y-3">
              <div className="font-bold">Mahlzeit eingeben (KI Analyse)</div>
              <textarea
                placeholder="z.B. 1 Teller Reis mit 200g Hähnchen"
                value={meal}
                onChange={(e) => setMeal(e.target.value)}
                className="w-full p-3 rounded bg-white/10 border border-white/20 text-white"
              />
              <button
                onClick={analyzeAndSave}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 p-3 rounded font-bold"
              >
                {loading ? "Analysiere..." : "Speichern mit KI"}
              </button>
            </div>
          )}

          {/* MANUELLE EINGABE */}
          {selectedDate === today && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow space-y-3">
              <div className="font-bold">Mahlzeit manuell eintragen</div>
              <input
                type="text"
                placeholder="Mahlzeit"
                value={meal}
                onChange={(e) => setMeal(e.target.value)}
                className="w-full p-2 rounded bg-white/10 border border-white/20 text-white"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Kalorien"
                  value={manualCalories}
                  onChange={(e) => setManualCalories(e.target.value)}
                  className="w-1/2 p-2 rounded bg-white/10 border border-white/20 text-white"
                />
                <input
                  type="number"
                  placeholder="Protein"
                  value={manualProtein}
                  onChange={(e) => setManualProtein(e.target.value)}
                  className="w-1/2 p-2 rounded bg-white/10 border border-white/20 text-white"
                />
              </div>
              <button
                onClick={saveManualEntry}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 p-3 rounded font-bold"
              >
                Speichern manuell
              </button>
            </div>
          )}

          {/* LETZTES ERGEBNIS */}
          {(calories > 0 || protein > 0) && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">
              <div className="font-bold mb-2">Letzte Analyse</div>
              <div>Kalorien: {calories} kcal</div>
              <div>Protein: {protein} g</div>
            </div>
          )}

          {/* KALENDER */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const date = new Date(new Date().getFullYear(), new Date().getMonth(), day).toDateString();
              const dayEntries = getEntriesForDate(date);
              const isToday = date === today;
              return (
                <div
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`p-2 text-center rounded cursor-pointer
                    ${isToday ? "bg-red-500 text-white" : "bg-white/10"} 
                  `}
                >
                  {day}
                  {dayEntries.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      {dayEntries.reduce((sum, e) => sum + Number(e.calories || 0), 0)} kcal
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* LISTE */}
          {entries.length > 0 && (
            <div className="space-y-2">
              <div className="font-bold">
                Mahlzeiten vom {selectedDate === today ? "heute" : selectedDate}
              </div>
              {[...entries].reverse().map((e, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-xl border border-white/20 p-3 rounded-xl flex justify-between items-center">
                  <div>
                    <div className="font-bold">{e.meal}</div>
                    <div className="text-sm text-gray-400">{e.calories} kcal • {e.protein} g Protein</div>
                  </div>
                  {e.date === today && (
                    <button
                      onClick={() => deleteEntry(e.id)}
                      className="text-red-500 font-bold ml-2"
                    >
                      Löschen
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* HEUTIGE WERTE UNTEN */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow mt-4">
            <div className="font-bold mb-2">Heute gesamt</div>
            <div>Kalorien: {totalCalories} kcal</div>
            <div>Protein: {totalProtein} g</div>
          </div>

        </div>
      </main>
    </div>
  );

}