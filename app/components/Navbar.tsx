"use client";

import { useRouter, usePathname } from "next/navigation";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useEffect, useState } from "react";

export default function Navbar() {

  const router = useRouter();
  const pathname = usePathname();

  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAuthed(!!user);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Während Auth lädt: nichts anzeigen (sonst flackert die Navbar kurz)
  if (authLoading) return null;

  // Nicht eingeloggt: Navbar komplett ausblenden
  if (!isAuthed) return null;

  // Optional: selbst wenn eingeloggt, Login-Seite ohne Navbar
  if (pathname === "/login") return null;

  const logout = async () => {

    await signOut(auth);

    router.push("/login");

  };

  const linkStyle = (path: string) =>
    `px-4 py-2 rounded-xl cursor-pointer transition font-semibold ${
      pathname === path
        ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
        : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white border border-white/10"
    }`;

  return (

    <div className="w-full bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-white/10 p-4 flex gap-2 justify-center flex-wrap shadow-xl">

      <div
        onClick={() => router.push("/dashboard")}
        className={linkStyle("/dashboard")}
      >
        Dashboard
      </div>

      <div
        onClick={() => router.push("/nutrition")}
        className={linkStyle("/nutrition")}
      >
        Ernährung
      </div>

      <div
        onClick={() => router.push("/training")}
        className={linkStyle("/training")}
      >
        Training
      </div>

      <div
        onClick={() => router.push("/weight")}
        className={linkStyle("/weight")}
      >
        Gewicht
      </div>

      <div
        onClick={() => router.push("/subscription")}
        className={linkStyle("/subscription")}
      >
        ABO
      </div>

      <div
        onClick={() => router.push("/profile")}
        className={linkStyle("/profile")}
      >
        Profil
      </div>

      <div
        onClick={logout}
        className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white cursor-pointer font-semibold shadow-lg hover:scale-[1.05] active:scale-95 transition"
      >
        Logout
      </div>

    </div>

  );

}