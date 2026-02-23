"use client";

import Navbar from "../../components/Navbar";
import { useState, useEffect } from "react";
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
  addDoc,
  collection,
  query,
  where,
  onSnapshot
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

export default function Weight() {

  const router = useRouter();

  const [userId, setUserId] = useState("");

  const [weight, setWeight] = useState("");

  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {

    let unsubWeight = () => {};

    const unsubAuth =
      onAuthStateChanged(auth, (user) => {

        if (!user) {

          router.push("/login");
          return;

        }

        setUserId(user.uid);

        const q =
          query(
            collection(db, "weight"),
            where("userId", "==", user.uid)
          );

        unsubWeight =
          onSnapshot(q, (snapshot) => {

            const list: any[] = [];

            snapshot.forEach(doc => {

              const d = doc.data();

              list.push({
                weight: d.weight,
                date: new Date(d.date).toLocaleDateString(),
                createdAt: d.createdAt
              });

            });

            list.sort(
              (a, b) =>
                a.createdAt - b.createdAt
            );

            setEntries(list);

          });

      });

    return () => {

      unsubAuth();

      if (unsubWeight)
        unsubWeight();

    };

  }, []);

  const saveWeight = async () => {

    if (!weight || !userId) return;

    await addDoc(
      collection(db, "weight"),
      {
        userId,
        weight: Number(weight),
        date: new Date().toISOString(),
        createdAt: Date.now()
      }
    );

    setWeight("");

  };

  const startWeight =
    entries.length > 0
      ? entries[0].weight
      : 0;

  const currentWeight =
    entries.length > 0
      ? entries[entries.length - 1].weight
      : 0;

  const change =
    (currentWeight - startWeight).toFixed(1);

  const isGain =
    Number(change) > 0;

  return (

    <div>

    

      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex justify-center">

        <div className="w-full max-w-md p-4 space-y-4">

          {/* HEADER */}

          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-2xl shadow-lg">

            <div className="text-sm opacity-80">
              Gewicht Tracking
            </div>

            <div className="text-2xl font-bold">
              Fortschritt verfolgen
            </div>

          </div>

          {/* INPUT */}

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow space-y-3">

            <input
              value={weight}
              onChange={(e) =>
                setWeight(e.target.value)
              }
              placeholder="Gewicht in kg"
              type="number"
              className="bg-white/10 border border-white/20 text-white p-3 rounded w-full outline-none"
            />

            <button
              onClick={saveWeight}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-[1.02] active:scale-95 transition text-white p-3 rounded w-full font-bold shadow-lg"
            >
              Gewicht speichern
            </button>

          </div>

          {/* STATS */}

          {entries.length > 0 && (

            <div className="grid grid-cols-3 gap-3">

              <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow">

                <div className="text-xs text-gray-400">
                  Start
                </div>

                <div className="text-lg font-bold">
                  {startWeight} kg
                </div>

              </div>

              <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow">

                <div className="text-xs text-gray-400">
                  Aktuell
                </div>

                <div className="text-lg font-bold">
                  {currentWeight} kg
                </div>

              </div>

              <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow">

                <div className="text-xs text-gray-400">
                  Veränderung
                </div>

                <div className={`text-lg font-bold ${
                  isGain
                    ? "text-red-400"
                    : "text-green-400"
                }`}>
                  {change} kg
                </div>

              </div>

            </div>

          )}

          {/* CHART */}

          {entries.length > 0 && (

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow">

              <div className="font-bold mb-3">
                Gewichtsverlauf
              </div>

              <div className="h-64">

                <ResponsiveContainer width="100%" height="100%">

                  <LineChart data={entries}>

                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />

                    <XAxis dataKey="date" stroke="#94a3b8" />

                    <YAxis stroke="#94a3b8" />

                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#22c55e"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />

                  </LineChart>

                </ResponsiveContainer>

              </div>

            </div>

          )}

          {/* HISTORY */}

          {entries.length > 0 && (

            <div className="space-y-2">

              <div className="font-bold">
                Verlauf
              </div>

              {[...entries]
                .reverse()
                .map((entry, i) => (

                <div
                  key={i}
                  className="bg-white/10 backdrop-blur-xl border border-white/20 p-3 rounded-xl shadow flex justify-between"
                >

                  <div className="font-bold">
                    {entry.weight} kg
                  </div>

                  <div className="text-sm text-gray-400">
                    {entry.date}
                  </div>

                </div>

              ))}

            </div>

          )}

        </div>

      </main>

    </div>

  );

}