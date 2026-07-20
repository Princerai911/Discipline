import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import SignOutButton from "@/components/SignOutButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Discipline Tracker",
  description: "Premium goal and task tracking",
  manifest: "/manifest.json",
  themeColor: "#8b5cf6",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Discipline",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div className="mobile-container">
          <header style={{ 
            display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', 
            padding: '1rem 0 2rem 0', borderBottom: '1px solid var(--card-border)', marginBottom: '2rem'
          }}>
            <h1 className="text-gradient" style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
              Discipline
            </h1>
            <nav style={{ display: 'flex', gap: '0.75rem', background: 'var(--card)', padding: '0.75rem 1rem', borderRadius: '999px', border: '1px solid var(--card-border)', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '350px' }}>
              <a href="/" style={{ color: 'var(--foreground)', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>Today</a>
              <a href="/goals" style={{ color: 'var(--muted-foreground)', textDecoration: 'none', fontWeight: 500, fontSize: '0.85rem' }}>Goals</a>
              <a href="/stats" style={{ color: 'var(--muted-foreground)', textDecoration: 'none', fontWeight: 500, fontSize: '0.85rem' }}>Stats</a>
              <a href="/notes" style={{ color: 'var(--muted-foreground)', textDecoration: 'none', fontWeight: 500, fontSize: '0.85rem' }}>Notes</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
