"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import InstallButton from '@/components/InstallButton';
import toast from 'react-hot-toast';

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
  const lastFetchDateRef = useRef(null);
  const targetEndTimeRef = useRef(null);

  useEffect(() => {
    const todayLocal = new Date();
    const offset = todayLocal.getTimezoneOffset();
    lastFetchDateRef.current = new Date(todayLocal.getTime() - (offset*60*1000)).toISOString().split('T')[0];

    fetchData();
    
    // Restore active focus session from localStorage (resilient across network loss and reloads)
    const savedSession = localStorage.getItem('active_focus_session');
    if (savedSession) {
      try {
        const { task, targetEndTime } = JSON.parse(savedSession);
        const remaining = Math.round((targetEndTime - Date.now()) / 1000);
        setFocusTask(task);
        targetEndTimeRef.current = targetEndTime;
        if (remaining <= 0) {
          setTimeLeft(0);
          setTimerActive(false);
          setTimerFinished(true);
        } else {
          setTimeLeft(remaining);
          setTimerActive(true);
          setTimerFinished(false);
        }
      } catch (e) {
        console.error('Failed to restore offline timer session:', e);
      }
    }

    // Automatically synchronize any tasks completed or quit while offline
    const syncOfflineCompletions = async () => {
      if (typeof window === 'undefined' || !navigator.onLine) return;
      const queueStr = localStorage.getItem('offline_sync_queue');
      if (queueStr) {
        try {
          const queue = JSON.parse(queueStr);
          if (queue && queue.length > 0) {
            const { error } = await supabase.from('task_completions').insert(queue);
            if (!error) {
              localStorage.removeItem('offline_sync_queue');
              toast.success('Offline execution data synchronized with server!');
              fetchData();
            }
          }
        } catch (e) {
          console.error('Failed to process offline queue:', e);
        }
      }
    };

    syncOfflineCompletions();
    window.addEventListener('online', syncOfflineCompletions);

    // Auto-refresh at midnight (for active tabs)
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow - now;
    const midnightTimeout = setTimeout(() => {
      window.location.reload();
    }, msUntilMidnight);

    // Wake-up check (for mobile devices where background tabs sleep)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentLocal = new Date();
        const currentOffset = currentLocal.getTimezoneOffset();
        const currentStr = new Date(currentLocal.getTime() - (currentOffset*60*1000)).toISOString().split('T')[0];
        
        if (lastFetchDateRef.current && lastFetchDateRef.current !== currentStr) {
          window.location.reload();
        } else {
          syncOfflineCompletions();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(midnightTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', syncOfflineCompletions);
    };
  }, []);

  // Timer logic
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        const remaining = Math.round((targetEndTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          setTimeLeft(0);
          setTimerActive(false);
          setTimerFinished(true);
          clearInterval(timerRef.current);
          // Play a sound
          if (typeof window !== 'undefined') {
            new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(e => console.log(e));
          }
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive]);

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
    if (focusTask && focusTask.id !== task.id) {
      toast.error(`You must complete or quit '${focusTask.title}' before engaging a new objective!`, { duration: 4000 });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setFocusTask(task);
    const seconds = calculateDurationSeconds(task.scheduled_time, task.end_time);
    setTimeLeft(seconds);
    const targetEndTime = Date.now() + (seconds * 1000);
    targetEndTimeRef.current = targetEndTime;
    setTimerActive(true);
    setTimerFinished(false);
    
    // Persist active session in localStorage to survive offline reloads
    localStorage.setItem('active_focus_session', JSON.stringify({ task, targetEndTime }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuit = async () => {
    if (confirm("Are you sure you want to quit? This will mark the task as failed for today and break your perfection.")) {
      clearInterval(timerRef.current);
      setTimerActive(false);
      
      const todayLocal = new Date();
      const offset = todayLocal.getTimezoneOffset();
      const todayStr = new Date(todayLocal.getTime() - (offset*60*1000)).toISOString().split('T')[0];

      const item = { task_id: focusTask.id, date: todayStr, status: 'quit' };
      
      if (!navigator.onLine) {
        // Save to offline queue if internet is down
        const existing = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
        localStorage.setItem('offline_sync_queue', JSON.stringify([...existing, item]));
        toast.error('Task Failed offline! Will synchronize automatically when connection restores.');
      } else {
        const { error } = await supabase.from('task_completions').insert([item]);
        if (error) {
          // Fallback to offline queue if server drop occurs
          const existing = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
          localStorage.setItem('offline_sync_queue', JSON.stringify([...existing, item]));
          toast.error('Network drop detected. Saved failed task locally for sync.');
        } else {
          toast.error('Task Failed. Discipline Broken.');
        }
      }
      
      localStorage.removeItem('active_focus_session');
      setTasks(tasks.map(t => t.id === focusTask.id ? { ...t, completion_status: 'quit' } : t));
      setFocusTask(null);
    }
  };

  const handleComplete = async () => {
    const todayLocal = new Date();
    const offset = todayLocal.getTimezoneOffset();
    const todayStr = new Date(todayLocal.getTime() - (offset*60*1000)).toISOString().split('T')[0];

    const item = { task_id: focusTask.id, date: todayStr, status: 'completed' };

    if (!navigator.onLine) {
      // Save to offline queue if internet is down
      const existing = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
      localStorage.setItem('offline_sync_queue', JSON.stringify([...existing, item]));
      toast.success('Recorded offline! Will synchronize automatically when internet restores.');
    } else {
      const { error } = await supabase.from('task_completions').insert([item]);
      if (error) {
        // Fallback to offline queue if server communication fails
        const existing = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
        localStorage.setItem('offline_sync_queue', JSON.stringify([...existing, item]));
        toast.success('Recorded locally! Will sync when connection stabilizes.');
      } else {
        toast.success('Objective Completed. Good work.');
      }
    }
    
    localStorage.removeItem('active_focus_session');
    setTasks(tasks.map(t => t.id === focusTask.id ? { ...t, completion_status: 'completed' } : t));
    
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

  let progressColor = 'var(--primary)';
  if (totalCount > 0) {
    if (progress >= 80) progressColor = '#10b981'; // Green
    else if (progress >= 50) progressColor = '#8b5cf6'; // Purple
    else if (quitCount > 0) progressColor = '#ef4444'; // Red if broken discipline
    else progressColor = 'var(--primary)'; // Default
  }

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <main className="animate-enter">
      <InstallButton />
      
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
                  onClick={() => {
                    if (timerActive) {
                      setTimerActive(false);
                    } else {
                      targetEndTimeRef.current = Date.now() + (timeLeft * 1000);
                      setTimerActive(true);
                    }
                  }}
                  className="premium-button"
                  style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800 }}
                >
                  {timerActive ? 'Pause' : 'Resume'}
                <button 
                  onClick={handleQuit}
                  className="danger-button"
                  style={{ 
                    flex: 1, padding: '1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                  Abort / Quit
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
                stroke={progressColor} 
                strokeWidth="6" fill="none" 
                strokeDasharray={2 * Math.PI * 26}
                strokeDashoffset={(2 * Math.PI * 26) - (progress / 100) * (2 * Math.PI * 26)}
                style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.3s ease' }}
                strokeLinecap="round"
              />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: progressColor }}>{progress}%</span>
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
                {task.completion_status === 'pending' && (
                  <>
                    {/* Case 1: This task is currently active */}
                    {focusTask?.id === task.id && (
                      <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        ⚡ ACTIVE
                      </span>
                    )}

                    {/* Case 2: Another task is active - lock this objective */}
                    {focusTask && focusTask.id !== task.id && (
                      <button 
                        onClick={() => startFocus(task)}
                        style={{ 
                          padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.75rem', 
                          fontWeight: 800, cursor: 'pointer', border: '1px solid var(--card-border)', 
                          background: 'rgba(255,255,255,0.05)', color: 'var(--muted-foreground)',
                          display: 'flex', alignItems: 'center', gap: '0.3rem'
                        }}
                        title="Complete or quit current focus first"
                      >
                        🔒 LOCKED
                      </button>
                    )}

                    {/* Case 3: No task active - ready for focus */}
                    {!focusTask && (
                      <button 
                        onClick={() => startFocus(task)}
                        className="premium-button"
                        style={{ padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', border: 'none' }}
                      >
                        FOCUS
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
