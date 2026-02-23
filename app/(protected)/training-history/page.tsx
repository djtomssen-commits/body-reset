"use client";

import Navbar from "../../components/Navbar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "../../lib/firebase";

import {
  collection,
  query,
  where,
  onSnapshot
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

export default function TrainingHistoryPage() {

  const router = useRouter();

  const [history, setHistory] = useState<any[]>([]);

  useEffect(()=>{

    let unsub:any;

    const unsubAuth =
      onAuthStateChanged(auth,(user)=>{

        if(!user){
          router.push("/login");
          return;
        }

        const q =
          query(
            collection(db,"training"),
            where("userId","==",user.uid)
          );

        unsub =
          onSnapshot(q,(snapshot)=>{

            const list:any[]=[];

            snapshot.forEach(doc=>{
              list.push({
                id: doc.id,
                ...doc.data()
              });
            });

            list.sort(
              (a,b)=>b.createdAt-a.createdAt
            );

            setHistory(list);

          });

      });

    return ()=>{
      unsubAuth();
      if(unsub) unsub();
    };

  },[]);

  return(

    <div>

      <Navbar/>

      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex justify-center">

        <div className="w-full max-w-md p-4">

          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 rounded-2xl shadow-lg mb-4">

            <div className="text-sm opacity-80">
              Training
            </div>

            <div className="text-2xl font-bold">
              Komplette Historie
            </div>

          </div>

          <div className="space-y-2">

            {history.map(item=>(

              <div
                key={item.id}
                className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-xl"
              >

                <div className="font-bold">
                  {item.exercise}
                </div>

                {!item.isCardio && (

                  <div className="text-sm text-gray-300">

                    {item.weight} kg • {item.sets} Sätze • {item.reps} Wdh

                  </div>

                )}

                {item.isCardio && (

                  <div className="text-sm text-gray-300">

                    {item.distance} km • {item.time}

                  </div>

                )}

                <div className="text-xs text-gray-500 mt-1">

                  {item.date}

                </div>

              </div>

            ))}

          </div>

        </div>

      </main>

    </div>

  );

}