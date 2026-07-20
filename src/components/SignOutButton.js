"use client";

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <button 
      onClick={handleSignOut}
      style={{ 
        background: 'transparent', border: 'none', color: '#ef4444', 
        fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', marginLeft: '0.5rem' 
      }}
    >
      Quit
    </button>
  );
}
