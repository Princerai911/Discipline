"use client";

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection Restored!');
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(245, 158, 11, 0.5)',
      boxShadow: '0 8px 32px rgba(245, 158, 11, 0.25)',
      borderRadius: '999px',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      padding: '0.6rem 1.25rem',
      width: '90%',
      maxWidth: '420px',
      color: '#fde68a',
      fontSize: '0.85rem',
      fontWeight: 700,
      textAlign: 'center'
    }}>
      <span style={{ fontSize: '1rem' }}>⚡</span>
      <span>Offline Mode: Timers running locally.</span>
    </div>
  );
}
