"use client";

import { usePathname } from 'next/navigation';
import Navigation from "@/components/Navigation";
import FloatingNotepad from "@/components/FloatingNotepad";
import OfflineBanner from "@/components/OfflineBanner";
import { Toaster } from "react-hot-toast";

export default function AppShell({ children }) {
  const pathname = usePathname();
  const isFloatPage = pathname === '/notes/float';

  // Standalone floating window for Zoom/YouTube multitasking
  if (isFloatPage) {
    return (
      <>
        {children}
        <Toaster position="bottom-center" />
      </>
    );
  }

  return (
    <>
      <div className="app-container">
        {/* Top Brand Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 0 2rem 0',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '2rem',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          {/* Logo & Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.12)',
              color: '#2563eb'
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '1.45rem',
                fontWeight: 900,
                letterSpacing: '-0.5px',
                lineHeight: 1.1,
                color: '#0f172a'
              }}>
                DISCIPLINE
              </h1>
              <p style={{
                margin: 0,
                fontSize: '0.72rem',
                color: '#64748b',
                fontWeight: 600,
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                High Performance Protocol
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <Navigation />

          {/* Cloud Status & Quick Popout Shortcut */}
          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => {
                const width = 540;
                const height = 660;
                const left = window.screen.width - width - 40;
                const top = 60;
                window.open(
                  '/notes/float',
                  'DisciplineFloatingNotepad',
                  `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
                );
              }}
              className="premium-button-secondary"
              title="Open Standalone Floating Notepad for Zoom/YouTube"
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              <span>↗</span>
              <span>Pop-Out Notepad</span>
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '999px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#059669'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '999px',
                background: '#059669',
                boxShadow: '0 0 6px rgba(5, 150, 105, 0.4)',
                display: 'inline-block'
              }} />
              <span>Cloud Connected</span>
            </div>
          </div>
        </header>

        {/* Main Application Page Content */}
        {children}
      </div>

      {/* Global Floating Screen Notepad Widget */}
      <FloatingNotepad />

      {/* Global Notifications & Offline Banner */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
          }
        }}
      />
      <OfflineBanner />
    </>
  );
}
