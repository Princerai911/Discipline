"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(0);

  // Focus Engine State
  const [focusTask, setFocusTask] = useState(null); // The task object currently being focused
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchData();
    return () => clearInterval(timerRef.current);
  }, []);

  // Timer logic
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerActive) {
      clearInterval(timerRef.current);
      setTimerActive(false);
      setTimerFinished(true);
      // Play a sound
      if (typeof window !== 'undefined') {
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(e => console.log(e));
      }
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive, timeLeft]);

  async function fetchData() {
    setLoading(true);
    const todayLocal = new Date();
    const offset = todayLocal.getTimezoneOffset()
    const todayStr = new Date(todayLocal.getTime() - (offset*60*1000)).toISOString().split('T')[0]

    // 1. Fetch Streak
    const { data: allCompletions } = await supabase
      .from('task_completions')
      .select('date, status')
      .eq('status', 'completed')
      .order('date', { ascending: true });
    
    if (allCompletions) {
      const counts = allCompletions.reduce((acc, curr) => {
        acc[curr.date] = (acc[curr.date] || 0) + 1;
        return acc;
      }, {});
      const dates = Object.keys(counts).sort();
      let current = 0;
      const yesterdayDate = new Date(todayLocal);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const localYesterdayStr = new Date(yesterdayDate.getTime() - (offset*60*1000)).toISOString().split('T')[0];

      if (dates.length > 0) {
        const lastActiveDate = dates[dates.length - 1];
        if (lastActiveDate === todayStr || lastActiveDate === localYesterdayStr) {
          current = 1;
          for (let i = dates.length - 1; i > 0; i--) {
            const curr = new Date(dates[i]);
            const prev = new Date(dates[i-1]);
            const diffDays = Math.round(Math.abs((curr - prev) / (24 * 60 * 60 * 1000)));
            if (diffDays === 1) current++; else break;
          }
        }
      }
      setCurrentStreak(current);
    }

    // 2. Fetch Tasks and Today's Status
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*, goals(title)')
      .order('scheduled_time', { ascending: true, nullsFirst: false });

    const { data: todayStatusData } = await supabase
      .from('task_completions')
      .select('task_id, status')
      .eq('date', todayStr);

    const statusMap = {};
    if (todayStatusData) {
      todayStatusData.forEach(c => { statusMap[c.task_id] = c.status; });
    }

    if (tasksData) {
      const mappedTasks = tasksData.map(t => ({
        ...t,
        completion_status: statusMap[t.id] || 'pending' // pending, completed, quit
      }));
      setTasks(mappedTasks);
    }
    
    setLoading(false);
  }

  function calculateDurationSeconds(start, end) {
    if (!start || !end) return 25 * 60; // fallback to 25 mins if no times set
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMins < 0) diffMins += 24 * 60; // wrap around midnight
    return diffMins * 60;
  }

  const startFocus = (task) => {
    setFocusTask(task);
    const seconds = calculateDurationSeconds(task.scheduled_time, task.end_time);
    setTimeLeft(seconds);
    setTimerActive(true);
    setTimerFinished(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuit = async () => {
    if (confirm("Are you sure you want to quit? This will mark the task as failed for today and break your perfection.")) {
      clearInterval(timerRef.current);
      setTimerActive(false);
      
      const todayLocal = new Date();
      const offset = todayLocal.getTimezoneOffset();
      const todayStr = new Date(todayLocal.getTime() - (offset*60*1000)).toISOString().split('T')[0];

      // Update DB
      await supabase.from('task_completions').insert([{ task_id: focusTask.id, date: todayStr, status: 'quit' }]);
      
      // Update UI
      setTasks(tasks.map(t => t.id === focusTask.id ? { ...t, completion_status: 'quit' } : t));
      setFocusTask(null);
    }
  };

  const handleComplete = async () => {
    const todayLocal = new Date();
    const offset = todayLocal.getTimezoneOffset();
    const todayStr = new Date(todayLocal.getTime() - (offset*60*1000)).toISOString().split('T')[0];

    // Update DB
    await supabase.from('task_completions').insert([{ task_id: focusTask.id, date: todayStr, status: 'completed' }]);
    
    // Update UI
    setTasks(tasks.map(t => t.id === focusTask.id ? { ...t, completion_status: 'completed' } : t));
    
    // Re-calculate streak optimistically if it was 0 and this is the first task done today
    if (currentStreak === 0) setCurrentStreak(1);
    
    setFocusTask(null);
    setTimerFinished(false);
  };

  const formatTimer = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  function formatTime(timeString) {
    if (!timeString) return null;
    const [h, m] = timeString.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
  }

  // Progress calculations
  const totalCount = tasks.length;
  const completedCount = tasks.filter(t => t.completion_status === 'completed').length;
  const quitCount = tasks.filter(t => t.completion_status === 'quit').length;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <main className="animate-enter">
      
      {/* Dynamic Focus Engine */}
      {focusTask && (
        <div className="glass-panel" style={{ 
          padding: '2rem 1.5rem', marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', 
          border: '1px solid var(--primary)',
          boxShadow: timerActive ? '0 0 30px var(--primary-glow)' : 'none',
          transition: 'all 0.3s'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 800 }}>
            {timerFinished ? 'Objective Complete' : 'Deep Focus Active'}
          </h3>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '1.5rem', color: 'var(--foreground)', textAlign: 'center' }}>
            {focusTask.title}
          </p>
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
            Goal: {focusTask.goals?.title || 'Unknown'}
          </p>
          
          <div style={{ fontSize: '4rem', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1, marginBottom: '2rem', color: timerFinished ? 'var(--success)' : 'var(--foreground)' }}>
            {formatTimer(timeLeft)}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            {timerFinished ? (
              <button 
                onClick={handleComplete}
                className="premium-button"
                style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '1.1rem', background: 'var(--success)', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' }}
              >
                Mark Completed
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setTimerActive(!timerActive)}
                  className="premium-button"
                  style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800 }}
                >
                  {timerActive ? 'Pause' : 'Resume'}
                </button>
                <button 
                  onClick={handleQuit}
                  style={{ 
                    flex: 1, padding: '1rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontWeight: 800 
                  }}
                >
                  Quit
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Gamification Banner */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          {currentStreak > 2 && (
            <div style={{ position: 'absolute', top: '-20px', right: '-15px', fontSize: '5rem', opacity: 0.1 }}>🔥</div>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Current Streak</span>
          <span style={{ fontSize: '2.5rem', fontWeight: 800, color: currentStreak > 0 ? '#fb923c' : 'var(--foreground)', lineHeight: 1, marginTop: '0.5rem' }}>
            {currentStreak} <span style={{ fontSize: '1rem' }}>days</span>
          </span>
        </div>
        
        <div className="glass-panel" style={{ width: '120px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '60px', height: '60px' }}>
            <svg style={{ transform: 'rotate(-90deg)', width: '60px', height: '60px', overflow: 'visible' }}>
              <circle cx="30" cy="30" r="26" stroke="var(--card-border)" strokeWidth="6" fill="none" />
              <circle 
                cx="30" cy="30" r="26" 
                stroke="var(--primary)" 
                strokeWidth="6" fill="none" 
                strokeDasharray={2 * Math.PI * 26}
                strokeDashoffset={(2 * Math.PI * 26) - (progress / 100) * (2 * Math.PI * 26)}
                style={{ transition: 'stroke-dashoffset 1s ease' }}
                strokeLinecap="round"
              />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{progress}%</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1.5rem', margin: '0 0 0.25rem 0', fontWeight: 800 }}>Execution Phase</h3>
          <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
            {quitCount > 0 ? `${quitCount} failures today. Don't quit.` : 'Stay focused. No cheating allowed.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading && <p style={{ color: 'var(--muted-foreground)' }}>Loading protocol...</p>}
        
        {!loading && tasks.length === 0 && (
          <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '1.1rem' }}>
              Your execution protocol is empty.
              <br/><span style={{ fontSize: '0.9rem', opacity: 0.7 }}>Go to the Goals page to plan your habits.</span>
            </p>
          </div>
        )}

        {tasks.map((task, i) => {
          const isCompleted = task.completion_status === 'completed';
          const isQuit = task.completion_status === 'quit';
          
          return (
            <div 
              key={task.id} 
              className="glass-panel"
              style={{
                display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem', 
                transition: 'all 0.2s ease',
                opacity: (isCompleted || isQuit) ? 0.6 : 1,
                border: isQuit ? '1px solid rgba(239, 68, 68, 0.3)' : (isCompleted ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--card-border)'),
                animationDelay: `${i * 0.05}s`,
              }}
            >
              {task.scheduled_time && (
                <div style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  padding: '0.5rem', borderRadius: '8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  minWidth: '60px'
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isQuit ? '#ef4444' : (isCompleted ? 'var(--success)' : 'var(--primary)') }}>
                    {formatTime(task.scheduled_time).split(' ')[0]}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                    {formatTime(task.scheduled_time).split(' ')[1]}
                  </span>
                </div>
              )}
              
              <div style={{ flex: 1 }}>
                <p style={{ 
                  margin: 0, fontWeight: 600, fontSize: '1.05rem',
                  textDecoration: (isCompleted || isQuit) ? 'line-through' : 'none',
                  color: isQuit ? '#ef4444' : (isCompleted ? 'var(--muted-foreground)' : 'var(--foreground)')
                }}>
                  {task.title}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <span style={{ 
                    background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', 
                    borderRadius: '4px', fontSize: '0.7rem', color: '#ddd', fontWeight: 600, textTransform: 'uppercase'
                  }}>
                    {task.goals?.title || 'Unknown'}
                  </span>
                  {isQuit && <span style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Failed</span>}
                  {isCompleted && <span style={{ color: 'var(--success)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Success</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {task.completion_status === 'pending' && (!focusTask || focusTask.id !== task.id) && (
                  <button 
                    onClick={() => startFocus(task)}
                    className="premium-button"
                    style={{ padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', border: 'none' }}
                  >
                    FOCUS
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
