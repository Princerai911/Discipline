"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { 
      href: '/', 
      label: 'Today', 
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )
    },
    { 
      href: '/goals', 
      label: 'Goals', 
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      )
    },
    { 
      href: '/projects', 
      label: 'Projects', 
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
          <path d="M15 3v18" />
        </svg>
      )
    },
    { 
      href: '/stats', 
      label: 'Stats', 
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      )
    },
    { 
      href: '/notes', 
      label: 'Notes', 
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="9" y1="7" x2="15" y2="7" />
          <line x1="9" y1="11" x2="15" y2="11" />
        </svg>
      )
    },
  ];

  return (
    <>
      {/* DESKTOP NAVIGATION (Visible on Laptops / Tablets >= 769px) */}
      <nav className="desktop-only" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        background: '#ffffff',
        padding: '0.35rem 0.5rem',
        borderRadius: '999px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)'
      }}>
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 1rem',
                borderRadius: '999px',
                color: isActive ? '#2563eb' : '#64748b',
                background: isActive ? '#eff6ff' : 'transparent',
                border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 700 : 600,
                fontSize: '0.875rem',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#0f172a';
                  e.currentTarget.style.background = '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: isActive ? '#2563eb' : 'inherit' }}>
                {link.icon}
              </span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* MOBILE BOTTOM DOCK (Visible on Phones <= 768px) */}
      <nav className="mobile-only" style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        right: '16px',
        maxWidth: '420px',
        margin: '0 auto',
        zIndex: 9990,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid #e2e8f0',
        borderRadius: '24px',
        boxShadow: '0 12px 36px rgba(15, 23, 42, 0.12)',
        padding: '0.5rem 0.75rem',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center'
      }}>
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '16px',
                color: isActive ? '#2563eb' : '#64748b',
                background: isActive ? '#eff6ff' : 'transparent',
                border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                textDecoration: 'none',
                flex: 1,
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              <span style={{ 
                display: 'flex', 
                alignItems: 'center', 
                color: isActive ? '#2563eb' : 'inherit',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.15s ease'
              }}>
                {link.icon}
              </span>
              <span style={{ 
                fontSize: '0.72rem', 
                fontWeight: isActive ? 800 : 600
              }}>
                {link.label}
              </span>
              {isActive && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '999px',
                  background: '#2563eb'
                }} />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
