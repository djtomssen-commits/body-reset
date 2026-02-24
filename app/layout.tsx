import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// SubscriptionGuard und Navbar bleiben importierbar, aber werden hier NICHT benutzt
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
        <div className="appShell">
          <main className="appMain">{children}</main>

          <footer className="appFooter">
            <div className="footerInner">
              <nav className="footerLinks" aria-label="Rechtliches">
                <a href="/impressum">Impressum</a>
                <span className="sep">|</span>
                <a href="/datenschutz">Datenschutz</a>
                <span className="sep">|</span>
                <a href="/agb">AGB</a>
                <span className="sep">|</span>
                <a href="/widerruf">Widerruf</a>
              </nav>

              <div className="footerMeta">
                © {new Date().getFullYear()} Fitness App
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}