"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function StatsPage() {
  const [completions, setCompletions] = useState({});
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    
    // Fetch all completions for accurate streak calculation
    const { data } = await supabase
      .from('task_completions')
      .select('date')
      .order('date', { ascending: true });

    if (data) {
      // Group by date
      const counts = data.reduce((acc, curr) => {
        acc[curr.date] = (acc[curr.date] || 0) + 1;
        return acc;
      }, {});
      setCompletions(counts);

      // Calculate Streaks
      const dates = Object.keys(counts).sort();
      let current = 0;
      let max = 0;
      
      const today = new Date();
      const offset = today.getTimezoneOffset();
      const localTodayStr = new Date(today.getTime() - (offset*60*1000)).toISOString().split('T')[0];
      
      const yesterdayDate = new Date(today);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const localYesterdayStr = new Date(yesterdayDate.getTime() - (offset*60*1000)).toISOString().split('T')[0];

      if (dates.length > 0) {
        let tempStreak = 1;
        max = 1;
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i-1]);
          const curr = new Date(dates[i]);
          const diffDays = Math.round(Math.abs((curr - prev) / (24 * 60 * 60 * 1000)));
          
          if (diffDays === 1) {
            tempStreak++;
            if (tempStreak > max) max = tempStreak;
          } else {
            tempStreak = 1;
          }
        }
        
        // Determine current streak
        const lastActiveDate = dates[dates.length - 1];
        if (lastActiveDate === localTodayStr || lastActiveDate === localYesterdayStr) {
          // Calculate backwards from last active date
          current = 1;
          for (let i = dates.length - 1; i > 0; i--) {
            const curr = new Date(dates[i]);
            const prev = new Date(dates[i-1]);
            const diffDays = Math.round(Math.abs((curr - prev) / (24 * 60 * 60 * 1000)));
            if (diffDays === 1) {
              current++;
            } else {
              break;
            }
          }
        }
      }

      setCurrentStreak(current);
      setLongestStreak(max);
    }
    setLoading(false);
  }

  const heatmapDays = [];
  const today = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset*60*1000)).toISOString().split('T')[0];
    
    heatmapDays.push({
      dateStr: localDate,
      dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' })
    });
  }

  const dayHeaders = heatmapDays.slice(0, 7).map(d => d.dayOfWeek);

  const getOpacityForCount = (count) => {
    if (!count || count === 0) return 0.1; 
    if (count === 1) return 0.4;
    if (count <= 3) return 0.7;
    return 1; 
  };

  return (
    <main className="animate-enter">
      <div style={{ marginBottom: '2rem' }}>
        <h2 className="text-gradient-accent" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800 }}>Consistency</h2>
        <p style={{ color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>Track your daily discipline.</p>
      </div>

      {/* Gamification Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          {currentStreak > 2 && (
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '3rem', opacity: 0.2 }}>🔥</div>
          )}
          <p style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: currentStreak > 0 ? '#fb923c' : 'var(--foreground)' }}>
            {currentStreak}
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', margin: '0.5rem 0 0 0', fontWeight: 600 }}>
            Current Streak (Days)
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
            {longestStreak}
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', margin: '0.5rem 0 0 0', fontWeight: 600 }}>
            Longest Streak
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Last 4 Weeks</h3>
        
        {loading ? (
          <p style={{ color: 'var(--muted-foreground)' }}>Loading data...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
            {dayHeaders.map((day, index) => (
              <div key={index} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: '0.5rem' }}>{day}</div>
            ))}
            {heatmapDays.map((item) => {
              const count = completions[item.dateStr] || 0;
              const opacity = getOpacityForCount(count);
              return (
                <div 
                  key={item.dateStr}
                  title={`${item.dateStr}: ${count} tasks completed`}
                  style={{
                    aspectRatio: '1', background: `rgba(139, 92, 246, ${opacity})`, borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: count > 3 ? '0 0 8px var(--primary-glow)' : 'none', transition: 'all 0.2s', cursor: 'pointer'
                  }}
                >
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
