"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function StatsPage() {
  const [completions, setCompletions] = useState({});
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchStats();
  }, [currentDate]);

  async function fetchStats() {
    setLoading(true);
    
    // Fetch completions to accurately calculate streak and heat
    const { data } = await supabase
      .from('task_completions')
      .select('date')
      .eq('status', 'completed') // ONLY completed tasks count!
      .order('date', { ascending: true });

    if (data) {
      // Group by date (how many tasks completed per day)
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

  // --- Calendar Logic ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get the first day of the month (0 = Sunday, 1 = Monday)
  const firstDay = new Date(year, month, 1).getDay();
  // Get number of days in this month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create an array representing the calendar grid slots
  const calendarDays = [];
  
  // Empty slots before the 1st of the month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  
  // The actual days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    // Construct local YYYY-MM-DD string safely avoiding timezone shifts
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarDays.push({ dayNumber: i, dateStr: dStr });
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getOpacityForCount = (count) => {
    if (!count || count === 0) return 0; 
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
            Current Streak
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

      {/* Monthly Calendar View */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Calendar Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button onClick={prevMonth} style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--foreground)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
            &larr;
          </button>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, textAlign: 'center' }}>
            {monthNames[month]} {year}
          </h3>
          <button onClick={nextMonth} style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--foreground)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
            &rarr;
          </button>
        </div>
        
        {loading ? (
          <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: '2rem 0' }}>Analyzing history...</p>
        ) : (
          <div>
            {/* Days of week header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {dayHeaders.map((day, index) => (
                <div key={index} style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 700 }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
              {calendarDays.map((item, index) => {
                if (!item) {
                  return <div key={`empty-${index}`} style={{ aspectRatio: '1' }}></div>;
                }
                
                const count = completions[item.dateStr] || 0;
                const opacity = getOpacityForCount(count);
                const hasActivity = count > 0;
                
                // Highlight today
                const isToday = new Date().toISOString().split('T')[0] === item.dateStr;

                return (
                  <div 
                    key={item.dateStr}
                    title={`${item.dateStr}: ${count} tasks completed`}
                    style={{
                      aspectRatio: '1', 
                      background: hasActivity ? `rgba(139, 92, 246, ${opacity})` : 'rgba(255, 255, 255, 0.02)', 
                      borderRadius: '8px',
                      border: isToday ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      boxShadow: count > 3 ? '0 0 12px var(--primary-glow)' : 'none', 
                      transition: 'all 0.2s',
                      color: hasActivity ? 'white' : 'var(--muted-foreground)',
                      fontWeight: isToday ? 800 : (hasActivity ? 700 : 500),
                      fontSize: '0.9rem'
                    }}
                  >
                    {item.dayNumber}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
