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

  // We calculate maxCompletions globally for the month so the calendar can use it for percentages
  const validDaysForMax = calendarDays.filter(d => d !== null);
  const maxCompletions = Math.max(...validDaysForMax.map(d => completions[d.dateStr] || 0), 1);

  const getColorForPercentage = (count, max) => {
    if (!count || count === 0) return 'rgba(255, 255, 255, 0.02)'; 
    const percentage = count / max;
    if (percentage >= 0.8) return '#10b981'; // Emerald Green
    if (percentage >= 0.5) return '#8b5cf6'; // Purple
    return '#ef4444'; // Red
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
                const bgColor = getColorForPercentage(count, maxCompletions);
                const hasActivity = count > 0;
                
                // Highlight today
                const isToday = new Date().toISOString().split('T')[0] === item.dateStr;

                return (
                  <div 
                    key={item.dateStr}
                    title={`${item.dateStr}: ${count} tasks completed`}
                    style={{
                      aspectRatio: '1', 
                      background: bgColor, 
                      borderRadius: '8px',
                      border: isToday ? '2px solid white' : '1px solid rgba(255,255,255,0.05)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      boxShadow: hasActivity ? `0 0 12px ${bgColor}40` : 'none', 
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

      {/* Monthly Output Bar Chart */}
      {!loading && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '4rem' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', fontWeight: 700 }}>Monthly Output</h3>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '150px', width: '100%', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {(() => {
              const validDays = calendarDays.filter(d => d !== null);

              return validDays.map((item) => {
                const count = completions[item.dateStr] || 0;
                const heightPercentage = count > 0 ? (count / maxCompletions) * 100 : 2; // 2% minimum height so it's visible
                const bgColor = getColorForPercentage(count, maxCompletions);
                const isToday = new Date().toISOString().split('T')[0] === item.dateStr;

                return (
                  <div key={`chart-${item.dateStr}`} style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '15px' }}>
                    <div 
                      title={`${item.dateStr}: ${count} tasks`}
                      style={{ 
                        width: '100%', 
                        height: `${heightPercentage}%`, 
                        background: count > 0 ? bgColor : 'rgba(255,255,255,0.05)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease, background 0.3s ease',
                        boxShadow: count > 0 && isToday ? `0 0 10px ${bgColor}60` : 'none'
                      }}
                    ></div>
                  </div>
                );
              });
            })()}
          </div>
          
          {/* Chart X-Axis Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.5rem' }}>
            <span>1st</span>
            <span>15th</span>
            <span>{daysInMonth}th</span>
          </div>
        </div>
      )}
    </main>
  );
}
