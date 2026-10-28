"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export default function StatsPage() {
  const [completions, setCompletions] = useState({});
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(null);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchStats = useCallback(async () => {
    setLoading(true);
    
    // Fetch start date (first goal created)
    const { data: firstGoal } = await supabase
      .from('goals')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
      
    if (firstGoal && firstGoal.created_at) {
      const offset = new Date(firstGoal.created_at).getTimezoneOffset();
      const localStartStr = new Date(new Date(firstGoal.created_at).getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
      setStartDate(localStartStr);
    }

    // Fetch completions to accurately calculate streak and heat
    const { data } = await supabase
      .from('task_completions')
      .select('date')
      .eq('status', 'completed')
      .order('date', { ascending: true });

    if (data) {
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
      const localTodayStr = new Date(today.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
      
      const yesterdayDate = new Date(today);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const localYesterdayStr = new Date(yesterdayDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

      if (dates.length > 0) {
        let tempStreak = 1;
        max = 1;
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1]);
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
            const prev = new Date(dates[i - 1]);
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
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, currentDate]);

  // Calendar Logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarDays.push({ dayNumber: i, dateStr: dStr });
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const validDaysForMax = calendarDays.filter(d => d !== null);
  const maxCompletions = Math.max(...validDaysForMax.map(d => completions[d.dateStr] || 0), 1);

  const todayLocal = new Date();
  const offset = todayLocal.getTimezoneOffset();
  const localTodayStr = new Date(todayLocal.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

  const getColorForPercentage = (count, max, dateStr) => {
    const isPast = dateStr < localTodayStr;
    const isToday = dateStr === localTodayStr;
    const isAfterStart = startDate && dateStr >= startDate;

    if (isPast) {
      if (!count || count === 0) {
        return isAfterStart ? '#ef4444' : '#f1f5f9';
      }
      const percentage = count / max;
      if (percentage >= 0.8) return '#10b981';
      if (percentage >= 0.5) return '#2563eb';
      return '#ef4444';
    }

    if (isToday) {
      if (!count || count === 0) {
        return '#dbeafe';
      }
      const percentage = count / max;
      if (percentage >= 0.8) return '#10b981';
      if (percentage >= 0.5) return '#2563eb';
      return '#3b82f6';
    }

    return '#f8fafc'; 
  };

  // Month summary metrics
  const totalMonthCompletions = validDaysForMax.reduce((acc, d) => acc + (completions[d.dateStr] || 0), 0);
  const activeDaysCount = validDaysForMax.filter(d => (completions[d.dateStr] || 0) > 0).length;

  return (
    <main className="animate-enter">
      {/* Title */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 className="text-gradient-accent" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 900, letterSpacing: '-0.5px' }}>
          Consistency Analytics
        </h2>
        <p style={{ color: 'var(--muted-foreground)', marginTop: '0.35rem', fontSize: '0.9rem' }}>
          Evaluate your relentless daily execution and habit frequency.
        </p>
      </div>

      {/* Top Metrics Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem'
      }}>
        <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          {currentStreak > 1 && (
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '3rem', opacity: 0.15 }}>🔥</div>
          )}
          <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Current Streak
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.35rem' }}>
            <span className={currentStreak > 0 ? "text-gradient-fire" : ""} style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>
              {currentStreak}
            </span>
            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', fontWeight: 600 }}>days</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Longest Streak
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, color: '#2563eb' }}>
              {longestStreak}
            </span>
            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', fontWeight: 600 }}>days</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Active Days ({monthNames[month].slice(0,3)})
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, color: '#38bdf8' }}>
              {activeDaysCount}
            </span>
            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', fontWeight: 600 }}>/ {daysInMonth}</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Completions ({monthNames[month].slice(0,3)})
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, color: '#10b981' }}>
              {totalMonthCompletions}
            </span>
            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', fontWeight: 600 }}>habits</span>
          </div>
        </div>
      </div>

      {/* Responsive 2-Column Grid: Calendar & Bar Chart */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
        gap: '2rem',
        alignItems: 'start'
      }}>
        
        {/* ============================================================== */}
        {/* COLUMN 1: MONTHLY CALENDAR HEATMAP                             */}
        {/* ============================================================== */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          {/* Calendar Header with Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <button
              onClick={prevMonth}
              className="premium-button-secondary"
              style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
            >
              &larr; Prev
            </button>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              {monthNames[month]} {year}
            </h3>
            <button
              onClick={nextMonth}
              className="premium-button-secondary"
              style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}
            >
              Next &rarr;
            </button>
          </div>
          
          {loading ? (
            <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: '3rem 0' }}>Analyzing history...</p>
          ) : (
            <div>
              {/* Day of Week Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {dayHeaders.map((day, index) => (
                  <div key={index} style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                {calendarDays.map((item, index) => {
                  if (!item) {
                    return <div key={`empty-${index}`} style={{ aspectRatio: '1' }} />;
                  }
                  
                  const count = completions[item.dateStr] || 0;
                  const bgColor = getColorForPercentage(count, maxCompletions, item.dateStr);
                  const isFailed = bgColor === '#ef4444';
                  const isToday = item.dateStr === localTodayStr;
                  const hasActivity = count > 0 || isFailed || isToday;
                  
                  return (
                    <div 
                      key={item.dateStr}
                      title={`${item.dateStr}: ${count} habits completed`}
                      style={{
                        aspectRatio: '1', 
                        background: bgColor, 
                        borderRadius: '10px',
                        border: isToday ? '2px solid #2563eb' : '1px solid #e2e8f0', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: isToday ? '0 0 12px rgba(37, 99, 235, 0.25)' : 'none', 
                        transition: 'all 0.2s ease',
                        color: (count > 0 || isFailed) ? '#ffffff' : (isToday ? '#2563eb' : '#64748b'),
                        fontWeight: isToday ? 900 : (hasActivity ? 700 : 500),
                        fontSize: '0.85rem',
                        cursor: 'default'
                      }}
                    >
                      {item.dayNumber}
                    </div>
                  );
                })}
              </div>

              {/* Heatmap Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981' }} /> 80%+ Target
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#2563eb' }} /> 50%+ Target
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6' }} /> Today Active
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ef4444' }} /> Missed Day
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* COLUMN 2: MONTHLY OUTPUT BAR CHART & VELOCITY                 */}
        {/* ============================================================== */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem', fontWeight: 800 }}>
            Daily Output Volume
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
            Habits completed each day across {monthNames[month]}.
          </p>
          
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '4px',
            height: '180px',
            width: '100%',
            overflowX: 'auto',
            paddingBottom: '0.5rem'
          }}>
            {validDaysForMax.map((item) => {
              const count = completions[item.dateStr] || 0;
              const bgColor = getColorForPercentage(count, maxCompletions, item.dateStr);
              const isFailed = bgColor === '#ef4444' && count === 0;
              const isToday = item.dateStr === localTodayStr;
              const heightPercentage = count > 0 ? (count / maxCompletions) * 100 : (isFailed || isToday ? 6 : 2);

              return (
                <div key={`chart-${item.dateStr}`} style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '12px' }}>
                  <div 
                    title={`${item.dateStr}: ${count} habits`}
                    style={{ 
                      width: '100%', 
                      height: `${heightPercentage}%`, 
                      background: (count > 0 || isFailed || isToday) ? bgColor : '#e2e8f0',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease, background 0.3s ease',
                      boxShadow: count > 0 && isToday ? `0 0 10px ${bgColor}60` : 'none'
                    }}
                  />
                </div>
              );
            })}
          </div>
          
          {/* Chart Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.65rem' }}>
            <span>Day 1</span>
            <span>Day {Math.round(daysInMonth / 2)}</span>
            <span>Day {daysInMonth}</span>
          </div>

          {/* Performance Protocol Insight */}
          <div style={{
            marginTop: '2rem',
            padding: '1.25rem',
            borderRadius: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
              Execution Tip
            </h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
              Momentum compounds quadratically. Missing one day reduces streak confidence by 30%; missing two resets habit wiring. Protect your chain.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
