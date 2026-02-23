"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";

export default function LoginPage() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const [usersCount, setUsersCount] = useState<number | null>(null);

  useEffect(() => {

    const ref =
      doc(db, "stats", "global");

    const unsub =
      onSnapshot(ref, (snap) => {

        if (!snap.exists()) {

          setUsersCount(0);
          return;

        }

        const n =
          snap.data()?.usersCount;

        setUsersCount(
          typeof n === "number" ? n : 0
        );

      }, () => {

        setUsersCount(null);

      });

    return () => unsub();

  }, []);

  // PROFIL ERSTELLEN
  const createUserProfile = async (
    user: any,
    extraData?: any
  ) => {

    const ref =
      doc(db, "users", user.uid);

    const snap =
      await getDoc(ref);

    if (!snap.exists()) {

      await setDoc(ref, {

        email: user.email,

        name:
          extraData?.name ||
          user.displayName ||
          "Athlet",

        height:
          Number(extraData?.height) || 180,

        weight:
          Number(extraData?.weight) || 80,

        belly: 90,

        startWeight:
          Number(extraData?.weight) || 80,

        goalWeight:
          Number(extraData?.weight)
            ? Number(extraData.weight) - 5
            : 75,

        caloriesGoal: 2200,
        proteinGoal: 180,

        xp: 0,
        level: 1,
        streak: 0,
        trainingCount: 0,

        createdAt:
          Date.now()

      });

    }

  };

  // EMAIL LOGIN / REGISTER
  const handleSubmit =
    async () => {

      if (!email || !password)
        return;

      setLoading(true);

      try {

        let result;

        if (isRegister) {

          result =
            await createUserWithEmailAndPassword(
              auth,
              email,
              password
            );

          await updateProfile(result.user, {
            displayName: "Athlet"
          });

          await createUserProfile(result.user);

        } else {

          result =
            await signInWithEmailAndPassword(
              auth,
              email,
              password
            );

          await createUserProfile(
            result.user
          );

        }

        if (isRegister) {

          router.push("/onboarding");

        } else {

          router.push("/dashboard");

        }

      } catch (err: any) {

        alert(err.message);

      }

      setLoading(false);

    };

  // GOOGLE LOGIN
  const handleGoogleLogin =
    async () => {

      try {

        setLoading(true);

        const provider =
          new GoogleAuthProvider();

        const result =
          await signInWithPopup(
            auth,
            provider
          );

        await createUserProfile(
          result.user
        );

        const ref =
          doc(db, "users", result.user.uid);

        const snap =
          await getDoc(ref);

        if (
          !snap.exists() ||
          !snap.data().onboardingComplete
        ) {

          router.push("/onboarding");

        } else {

          router.push("/dashboard");

        }

      } catch (err: any) {

        alert(err.message);

      }

      setLoading(false);

    };

  // ✅ FIX: RETURN hinzugefügt
  return (

    <main className="min-h-screen flex">

      {/* HERO */}

      <div className="hidden md:flex w-1/2 relative overflow-hidden">

        <img
          src="https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=1600"
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-br from-black/70 to-emerald-900/80" />

        <div className="relative z-10 flex flex-col justify-center p-16 text-white">

          <div className="text-5xl font-bold mb-4">
            Body-Reset
          </div>

          <div className="text-xl mb-6 text-emerald-300">
            Transformiere deinen Körper.
            Tracke deinen Fortschritt.
            Werde Elite.
          </div>

          <div className="space-y-3 text-emerald-200">

            <div>✔ Trainings Tracking</div>
            <div>✔ XP & Level System</div>
            <div>✔ Fortschritt Charts</div>
            <div>✔ Premium Fitness Plattform</div>

          </div>

        </div>

      </div>

      {/* LOGIN */}

      <div className="flex items-center justify-center w-full md:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">

        <div className="w-full max-w-md p-6">

          {/* LOGO */}

          <div className="text-center mb-8">

            <div className="text-5xl mb-2">
              💪
            </div>

            <div className="text-3xl font-bold text-white">
              Body-Reset
            </div>

            <div className="text-gray-400 text-sm">
              Premium Fitness System
            </div>

            <div className="text-emerald-300 text-xs mt-2">
              {usersCount === null ? (
                "—"
              ) : (
                <>
                  👥 {usersCount.toLocaleString("de-DE")} registrierte Nutzer
                </>
              )}
            </div>

          </div>

          {/* RABATT ZETTEL */}

<div className="relative mb-6">

  <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-5 rounded-2xl shadow-2xl rotate-[-1deg] border border-green-400/30">

    <div className="text-center">

      <div className="text-xs uppercase tracking-wider text-green-200 mb-1">
        Exklusives Angebot
      </div>

      <div className="text-lg text-green-200 line-through opacity-70">
        5,99 €
      </div>

      <div className="text-4xl font-black text-white drop-shadow-lg">
        0,00 €
      </div>

      <div className="text-xs text-green-100 mt-1">
        Kostenloser Zugang freigeschaltet
      </div>

    </div>

  </div>

  {/* Glow Effekt */}
  <div className="absolute inset-0 bg-green-500 blur-xl opacity-20 rounded-2xl"></div>

</div>

          {/* CARD */}

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-3xl shadow-2xl">

            <div className="text-white text-xl font-bold mb-4 text-center">

              {isRegister
                ? "Account erstellen"
                : "Anmelden"}

            </div>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e)=>
                setEmail(e.target.value)
              }
              className="w-full p-3 mb-3 rounded-xl bg-white/10 text-white border border-white/20"
            />

            <input
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={(e)=>
                setPassword(e.target.value)
              }
              className="w-full p-3 mb-4 rounded-xl bg-white/10 text-white border border-white/20"
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 p-3 rounded-xl text-white font-bold mb-3"
            >

              {loading
                ? "Lädt..."
                : isRegister
                ? "Registrieren"
                : "Anmelden"}

            </button>

            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white text-black p-3 rounded-xl font-bold flex items-center justify-center gap-3"
            >

              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                className="w-5 h-5"
              />

              Mit Google anmelden

            </button>

            <div
              onClick={() =>
                setIsRegister(!isRegister)
              }
              className="text-center text-sm text-gray-300 mt-4 cursor-pointer"
            >

              {isRegister
                ? "Bereits Account? Anmelden"
                : "Noch kein Account? Registrieren"}

            </div>

          </div>

        </div>

      </div>

    </main>

  );

}