"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const handleAuth = async (e, isSignUp) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);

    let result;
    if (isSignUp) {
      result = await supabase.auth.signUp({ email, password });
      if (!result.error) setMsg("Account created! You are now logging in...");
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }

    if (result.error) {
      setError(result.error.message);
    }
    
    setLoading(false);
  };

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
      minHeight: '80vh', padding: '2rem' 
    }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-1px', margin: '0 0 1rem 0' }}>
          Discipline
        </h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '1.1rem' }}>
          Your private execution engine.
        </p>
      </div>

      <form className="glass-panel" style={{ padding: '2.5rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {error && <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontSize: '0.9rem' }}>{error}</div>}
        {msg && <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: '8px', fontSize: '0.9rem' }}>{msg}</div>}
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>Email</label>
          <input 
            type="email" 
            className="premium-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '1rem', borderRadius: '12px' }}
            required
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>Password</label>
          <input 
            type="password" 
            className="premium-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '1rem', borderRadius: '12px' }}
            required
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <button 
            onClick={(e) => handleAuth(e, false)}
            disabled={loading}
            className="premium-button"
            style={{ padding: '1rem', borderRadius: '12px', border: 'none', fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer' }}
          >
            {loading ? 'Authenticating...' : 'Enter Console'}
          </button>
          
          <button 
            onClick={(e) => handleAuth(e, true)}
            disabled={loading}
            style={{ 
              padding: '1rem', borderRadius: '12px', background: 'transparent', 
              border: '1px solid var(--card-border)', color: 'var(--foreground)', 
              fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' 
            }}
          >
            Create Private Account
          </button>
        </div>
      </form>
    </div>
  );
}
