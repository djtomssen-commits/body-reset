import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// bleiben importiert, wie bei dir
import SubscriptionGuard from "./components/SubscriptionGuard";
import Navbar from "./components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fitness App",
  description: "Track your progress",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        
        {/* Layout Wrapper */}
        <div className="min-h-screen flex flex-col">

          {/* Seiteninhalt */}
          <main className="flex-1">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-black/10 dark:border-white/10 py-4 mt-10">
            <div className="mx-auto max-w-5xl px-4 flex flex-wrap items-center justify-between gap-3 text-sm">

              <nav className="flex flex-wrap items-center gap-2">
                <a href="/impressum" className="opacity-80 hover:opacity-100 hover:underline">
                  Impressum
                </a>

                <span className="opacity-50">|</span>

                <a href="/datenschutz" className="opacity-80 hover:opacity-100 hover:underline">
                  Datenschutz
                </a>

                <span className="opacity-50">|</span>

                <a href="/agb" className="opacity-80 hover:opacity-100 hover:underline">
                  AGB
                </a>

                <span className="opacity-50">|</span>

                <a href="/widerruf" className="opacity-80 hover:opacity-100 hover:underline">
                  Widerruf
                </a>
              </nav>

              <div className="opacity-70">
                © {new Date().getFullYear()} Body-Reset
              </div>

            </div>
          </footer>

        </div>

      </body>
    </html>
  );
}