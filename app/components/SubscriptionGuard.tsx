"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";

export default function SubscriptionGuard({ children }: any) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      // Diese Seiten sind IMMER erlaubt
      if (pathname === "/subscription" || pathname === "/login" || pathname === "/onboarding") {
        setLoading(false);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));

      if (!userSnap.exists() || !userSnap.data()?.onboardingCompleted) {
        router.push("/onboarding");
        return;
      }

      const subSnap = await getDoc(doc(db, "subscriptions", user.uid));

      if (!subSnap.exists()) {
        router.push("/subscription");
        return;
      }

      const data = subSnap.data();
      const endDate = data.endDate?.toDate();

      if (!endDate || new Date() > endDate) {
        router.push("/subscription");
        return;
      }

      setLoading(false);
    });

    return () => unsub();
  }, [pathname]);

  if (loading) return null;

  return children;
}