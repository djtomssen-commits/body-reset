"use client"; 

import Navbar from "../../components/Navbar";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, getDocFromServer, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

type SubData = {
  streak?: number;
  lastLogin?: string;        // toDateString()
  lastBonusClaim?: string;   // toDateString()
  loginBonus?: number;
  guthaben?: number;
  startDate?: Timestamp;
  endDate?: Timestamp;
  isTrial?: boolean;
  isFreeMonth?: boolean;
};

export default function SubscriptionPage() {
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [streak, setStreak] = useState(0);
  const [loginBonus, setLoginBonus] = useState(0);
  const [guthaben, setGuthaben] = useState(0);
  const [subscription, setSubscription] = useState<SubData | null>(null);
  const [daysLeft, setDaysLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const paypalWrapRef = useRef<HTMLDivElement | null>(null);
  const paypalRenderedRef = useRef(false);

  // ✅ NEU: PayPal SDK ready Flag (damit render nicht zu früh passiert)
  const [paypalReady, setPaypalReady] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toDateString(), [today]);

  const isActive = useMemo(() => {
    if (!subscription?.endDate) return false;
    const end = subscription.endDate.toDate();
    return end.getTime() > Date.now();
  }, [subscription]);

  const calcDaysLeft = (endDate?: Timestamp) => {
    if (!endDate) return 0;
    const end = endDate.toDate();
    const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const syncDailyLogin = async (uid: string, data: SubData) => {
    // Wenn kein Abo aktiv: kein Streak-Update fürs Bonus-System
    if (!data.endDate || data.endDate.toDate().getTime() <= Date.now()) return data;

    const subRef = doc(db, "subscriptions", uid);

    const lastLogin = data.lastLogin || "";
    if (lastLogin === todayStr) return data; // schon heute gezählt

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    let newStreak = Number(data.streak || 0);
    if (lastLogin === yesterdayStr) newStreak += 1;
    else newStreak = 1;

    // Bonus-Display zurücksetzen (nicht auszahlen!)
    await updateDoc(subRef, {
      streak: newStreak,
      lastLogin: todayStr,
      loginBonus: 0,
    });

    return { ...data, streak: newStreak, lastLogin: todayStr, loginBonus: 0 };
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setErrorMsg("");
      setStatusMsg("");

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.uid);
      setUserName(user.displayName || "Athlet");

      try {
        // ✅ INIT sicher: Bearer Token (kein uid aus Body)
        const token = await user.getIdToken();
        const res = await fetch("/api/init-subscription", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          console.error("init-subscription failed:", res.status, json);
          setErrorMsg(`Init-Subscription fehlgeschlagen (${res.status}).`);
        }
      } catch (e: any) {
        console.error("init-subscription crashed:", e);
        setErrorMsg("Init-Subscription API Fehler (Network/Server).");
      }

      const subRef = doc(db, "subscriptions", user.uid);
      const subSnap = await getDocFromServer(subRef);

      if (subSnap.exists()) {
        let data = subSnap.data() as SubData;

        // 1x pro Tag Streak sauber hochzählen (nur wenn aktiv)
        try {
          data = await syncDailyLogin(user.uid, data);
        } catch {
          // Wenn Update fehlschlägt, lesen wir trotzdem weiter
        }

        setSubscription(data);
        setDaysLeft(calcDaysLeft(data.endDate));
        setStreak(Number(data.streak || 0));
        setLoginBonus(Number(data.loginBonus || 0));
        setGuthaben(Number(data.guthaben || 0));
      } else {
        setErrorMsg("Keine Subscription gefunden. Init-API hat nichts angelegt (oder ist fehlgeschlagen).");
        setStatusMsg("");
        setLoading(false);
        return;
      }

      setLoading(false);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ NEU: Wenn PayPal Script nach Navigation schon geladen ist, onLoad feuert evtl. nicht -> paypalReady setzen
  useEffect(() => {
    // @ts-ignore
    if (typeof window !== "undefined" && window.paypal) {
      setPaypalReady(true);
    }
  }, []);

  // ✅ NEU: Beim Unmount resetten, damit nach Seitenwechsel wieder gerendert werden kann
  useEffect(() => {
    return () => {
      paypalRenderedRef.current = false;
    };
  }, []);

  // PayPal Buttons rendern (einmalig)
  useEffect(() => {
    // ✅ NEU: erst rendern wenn SDK geladen ist
    if (!paypalReady) return;

    const run = async () => {
      if (!userId) return;
      const user = auth.currentUser;
      if (!user) return;

      // @ts-ignore
      if (!window.paypal) return;
      if (paypalRenderedRef.current) return;

      paypalRenderedRef.current = true;

      // ✅ NEU: Container leeren (wichtig nach Navigation/Remount)
      const el = document.getElementById("paypal-button-container");
      if (el) el.innerHTML = "";

      // @ts-ignore
      window.paypal
        .Buttons({
          createOrder: async () => {
            setErrorMsg("");
            setStatusMsg("");

            const token = await user.getIdToken();
            const res = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || "create-order failed");
            return json.orderId;
          },

          onApprove: async (data: any) => {
            setErrorMsg("");
            setStatusMsg("Zahlung wird bestätigt...");

            const token = await user.getIdToken();
            const res = await fetch("/api/paypal/capture-order", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ orderId: data.orderID }),
            });

            const json = await res.json();
            if (!json.ok) throw new Error(json.error || "capture failed");

            setStatusMsg("✅ Zahlung erfolgreich. Abo wird aktualisiert...");
            window.location.reload();
          },

          onError: (err: any) => {
            console.error("PayPal error:", err);
            setErrorMsg("PayPal Fehler – bitte erneut versuchen.");
          },
        })
        .render("#paypal-button-container");
    };

    run().catch((e) => {
      console.error(e);
      setErrorMsg(e?.message || "PayPal Setup fehlgeschlagen.");
    });
  }, [userId, paypalReady]);

  const canClaimBonus = useMemo(() => {
    if (!subscription) return false;
    if (!isActive) return false;
    if (subscription.lastBonusClaim === todayStr) return false; // heute schon geholt
    return Number(subscription.streak || 0) >= 7;
  }, [subscription, isActive, todayStr]);

  const handleLoginBonus = async () => {
    setErrorMsg("");
    setStatusMsg("");

    if (!userId) return;
    if (!subscription) return;

    if (!isActive) {
      setErrorMsg("Dein Abo ist abgelaufen – kein Bonus möglich.");
      return;
    }

    if (subscription.lastBonusClaim === todayStr) {
      setErrorMsg("Bonus für heute ist schon eingelöst.");
      return;
    }

    const currentStreak = Number(subscription.streak || 0);
    if (currentStreak < 7) {
      setErrorMsg(`Noch nicht bereit: Du bist bei Streak ${currentStreak}/7.`);
      return;
    }

    const subRef = doc(db, "subscriptions", userId);
    const bonus = 0.5;

    const newGuthaben = Number(subscription.guthaben || 0) + bonus;

    await updateDoc(subRef, {
      guthaben: newGuthaben,
      loginBonus: bonus,
      lastBonusClaim: todayStr,
      streak: 0,
    });

    const newSub: SubData = {
      ...subscription,
      guthaben: newGuthaben,
      loginBonus: bonus,
      lastBonusClaim: todayStr,
      streak: 0,
    };

    setSubscription(newSub);
    setGuthaben(newGuthaben);
    setLoginBonus(bonus);
    setStreak(0);
    setStatusMsg("✅ Bonus eingelöst: +0,50€");
  };

  // Button bleibt – startet/zeigt PayPal (kein DB-write!)
  const handleBuySubscription = async () => {
    setErrorMsg("");
    setStatusMsg("");

    if (!userId) return;

    // Scroll to PayPal
    paypalWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    setStatusMsg("👇 Bezahle jetzt mit PayPal (4,99€).");
  };

  // ✅ NEU: Mit Guthaben bezahlen (Server-Route macht Abzug + Verlängerung)
  const handlePayWithBalance = async () => {
    setErrorMsg("");
    setStatusMsg("");

    const user = auth.currentUser;
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/subscription/pay-with-balance", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setErrorMsg(json?.error || "Zahlung mit Guthaben fehlgeschlagen.");
        return;
      }

      setStatusMsg("✅ Mit Guthaben bezahlt. Abo verlängert.");
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Network/Server Fehler.");
    }
  };
  

  return (
    <div>
      {/* <Navbar /> */}

      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-white">
        {/* PayPal SDK */}
        <Script
          src={`https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=EUR&intent=capture`}
          strategy="afterInteractive"
          onLoad={() => setPaypalReady(true)}
        />

        <div className="w-full max-w-md mx-auto space-y-4">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-xl shadow-xl">
            <div className="font-bold text-lg mb-2">Monatsabo</div>

            {loading && <div>Lädt...</div>}

            {!loading && subscription ? (
              <>
                <div>
                  Aktiv: {subscription.startDate?.toDate().toLocaleDateString()} -{" "}
                  {subscription.endDate?.toDate().toLocaleDateString()}
                </div>

                <div>Restliche Tage: {daysLeft}</div>

                <div className="mt-2">
                  <div>Abo-Status: {isActive ? "✅ aktiv" : "❌ abgelaufen"}</div>
                  <div>Streak: {streak}</div>
                  <div>Login-Bonus heute: {loginBonus}€</div>
                  <div>Guthaben verfügbar: {Number(guthaben || 0).toFixed(2)}€</div>
                </div>

                {statusMsg && <div className="mt-3 text-green-300">{statusMsg}</div>}
                {errorMsg && <div className="mt-3 text-red-300">{errorMsg}</div>}

                <button
                  onClick={handleLoginBonus}
                  disabled={!canClaimBonus}
                  className={`mt-3 p-2 rounded w-full font-bold ${
                    canClaimBonus ? "bg-green-500" : "bg-white/10 border border-white/20 opacity-60"
                  }`}
                >
                  {canClaimBonus
                    ? "Bonus einlösen (+0,50€)"
                    : `Bonus erst ab Streak 7 (aktuell ${streak}/7)`}
                </button>
              </>
            ) : null}

            {!loading && !subscription && <div>Kein Abo aktiv</div>}

            {/* ✅ NEU: Guthaben-Button */}
            <button
              onClick={handlePayWithBalance}
              disabled={Number(guthaben || 0) < 4.99}
              className={`mt-3 p-3 rounded w-full font-bold ${
                Number(guthaben || 0) >= 4.99
                  ? "bg-emerald-500"
                  : "bg-white/10 border border-white/20 opacity-60"
              }`}
            >
              {Number(guthaben || 0) >= 4.99
                ? "Mit Guthaben bezahlen (4,99€)"
                : `Nicht genug Guthaben (du hast ${Number(guthaben || 0).toFixed(2)}€)`}
            </button>

            {/* Kaufen-Button bleibt, zeigt PayPal an */}
            <button
              onClick={handleBuySubscription}
              className="mt-4 bg-blue-500 p-3 rounded w-full font-bold flex items-center justify-center gap-2"
            >
              <span>Monatsabo kaufen (4,99€)</span>
              {/* PayPal Icon (SVG) */}
              <span className="inline-flex items-center">
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M18.6 39.8H9.9c-1.1 0-1.9-1-1.7-2.1L13 8.7c.1-.8.8-1.4 1.7-1.4h12.2c7.2 0 12 3.7 10.7 11.4-1.1 6.6-6.4 10.3-13.1 10.3h-4.2l-1.3 8.8c-.1 1-1 2-2.4 2z" fill="#003087"/>
                  <path d="M26.6 39.8h-6.7c-1.1 0-1.9-1-1.7-2.1l.2-1.3 1.9-12.4h5.8c6.7 0 12 3.7 13.1-10.3.3-1.7.2-3.3-.3-4.6 3 1.6 4.6 4.5 4 8.8-1.1 7.1-6.4 11-13 11h-2.9l-1.2 8.1c-.2 1.1.6 2.1 1.7 2.1z" fill="#009cde"/>
                </svg>
              </span>
            </button>

            {/* PayPal Checkout Bereich */}
            <div ref={paypalWrapRef} className="mt-4">
              <div className="text-sm opacity-80 mb-2">
                {isActive ? "Mit PayPal verlängern" : "Mit PayPal aktivieren"}
              </div>
              <div id="paypal-button-container" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}