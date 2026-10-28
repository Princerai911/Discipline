"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import InstallButton from '@/components/InstallButton';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [filter, setFilter] = useState('all');

  // Focus Engine State
  const [focusTask, setFocusTask] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const timerRef = useRef(null);
  const lastFetchDateRef = useRef(null);
  const targetEndTimeRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const todayLocal = new Date();
    const offset = todayLocal.getTimezoneOffset();
    const todayStr = new Date(todayLocal.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

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
      const localYesterdayStr = new Date(yesterdayDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

      if (dates.length > 0) {
        const lastActiveDate = dates[dates.length - 1];
        if (lastActiveDate === todayStr || lastActiveDate === localYesterdayStr) {
          current = 1;
          for (let i = dates.length - 1; i > 0; i--) {
            const curr = new Date(dates[i]);
            const prev = new Date(dates[i - 1]);
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
        completion_status: statusMap[t.id] || 'pending'
      }));
      setTasks(mappedTasks);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    const todayLocal = new Date();
    const offset = todayLocal.getTimezoneOffset();
    lastFetchDateRef.current = new Date(todayLocal.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    fetchData();
    
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
              toast.success('Offline execution synchronized!');
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

    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow - now;
    const midnightTimeout = setTimeout(() => {
      window.location.reload();
    }, msUntilMidnight);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentLocal = new Date();
        const currentOffset = currentLocal.getTimezoneOffset();
        const currentStr = new Date(currentLocal.getTime() - (currentOffset * 60 * 1000)).toISOString().split('T')[0];
        
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
  }, [fetchData]);

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        const remaining = Math.round((targetEndTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          setTimeLeft(0);
          setTimerActive(false);
          setTimerFinished(true);
          clearInterval(timerRef.current);
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

  function calculateDurationSeconds(start, end) {
    if (!start || !end) return 25 * 60;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMins < 0) diffMins += 24 * 60;
    return diffMins * 60;
  }

  const startFocus = (task) => {
    if (focusTask && focusTask.id !== task.id) {
      toast.error(`Complete or quit '${focusTask.title}' before engaging a new objective!`, { duration: 4000 });
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
    
    localStorage.setItem('active_focus_session', JSON.stringify({ task, targetEndTime }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuit = async () => {
    if (confirm("Are you sure you want to abort? This marks the habit as failed for today.")) {
      clearInterval(timerRef.current);
      setTimerActive(false);
      
      const todayLocal = new Date();
      const offset = todayLocal.getTimezoneOffset();
      const todayStr = new Date(todayLocal.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

      const item = { task_id: focusTask.id, date: todayStr, status: 'quit' };
      
      if (!navigator.onLine) {
        const existing = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
        localStorage.setItem('offline_sync_queue', JSON.stringify([...existing, item]));
        toast.error('Task aborted offline. Will sync when connection restores.');
      } else {
        const { error } = await supabase.from('task_completions').insert([item]);
        if (error) {
          const existing = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
          localStorage.setItem('offline_sync_queue', JSON.stringify([...existing, item]));
          toast.error('Network drop. Saved locally for sync.');
        } else {
          toast.error('Task Aborted.');
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
    const todayStr = new Date(todayLocal.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    const item = { task_id: focusTask.id, date: todayStr, status: 'completed' };

    if (!navigator.onLine) {
      const existing = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
      localStorage.setItem('offline_sync_queue', JSON.stringify([...existing, item]));
      toast.success('Recorded offline! Will sync automatically.');
    } else {
      const { error } = await supabase.from('task_completions').insert([item]);
      if (error) {
        const existing = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
        localStorage.setItem('offline_sync_queue', JSON.stringify([...existing, item]));
        toast.success('Recorded locally! Will sync when connection stabilizes.');
      } else {
        toast.success('Objective Completed. Outstanding execution.');
      }
    }
    
    localStorage.removeItem('active_focus_session');
    setTasks(tasks.map(t => t.id === focusTask.id ? { ...t, completion_status: 'completed' } : t));
    setFocusTask(null);
    fetchData();
  };

  function formatTimer(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function formatTime(timeString) {
    if (!timeString) return '';
    const [h, m] = timeString.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
  }

  // Progress metrics
  const totalCount = tasks.length;
  const completedCount = tasks.filter(t => t.completion_status === 'completed').length;
  const quitCount = tasks.filter(t => t.completion_status === 'quit').length;
  const pendingCount = tasks.filter(t => t.completion_status === 'pending').length;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  let progressColor = '#2563eb';
  if (totalCount > 0) {
    if (progress >= 80) progressColor = '#059669';
    else if (progress >= 50) progressColor = '#2563eb';
    else if (quitCount > 0) progressColor = '#dc2626';
  }

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const filteredTasks = tasks.filter(t => {
    if (filter === 'pending') return t.completion_status === 'pending';
    if (filter === 'completed') return t.completion_status === 'completed';
    return true;
  });

  return (
    <main className="animate-enter">
      <InstallButton />

      {/* Responsive Dashboard Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
        gap: '2rem',
        alignItems: 'start'
      }}>
        
        {/* COLUMN 1: FOCUS ENGINE & DAILY EXECUTION CHECKLIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', minWidth: 0 }}>
          
          {/* Active Focus Hero Card */}
          {focusTask && (
            <div className="glass-panel" style={{
              padding: '2rem 1.75rem',
              border: '1px solid #bfdbfe',
              boxShadow: '0 8px 30px rgba(37, 99, 235, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: timerFinished ? '#059669' : 'linear-gradient(90deg, #2563eb, #0284c7)'
              }} />

              <span style={{
                fontSize: '0.8rem',
                color: timerFinished ? '#059669' : '#2563eb',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                fontWeight: 800,
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <span>{timerFinished ? '✓' : '⚡'}</span>
                <span>{timerFinished ? 'Protocol Completed' : 'Deep Focus Active'}</span>
              </span>

              <h2 style={{
                margin: '0 0 0.35rem 0',
                fontSize: '1.65rem',
                fontWeight: 900,
                color: '#0f172a',
                textAlign: 'center',
                letterSpacing: '-0.5px'
              }}>
                {focusTask.title}
              </h2>

              <p style={{ margin: '0 0 1.75rem 0', fontSize: '0.875rem', color: '#64748b' }}>
                Objective: <span style={{ color: '#0f172a', fontWeight: 600 }}>{focusTask.goals?.title || 'General'}</span>
              </p>

              {/* Countdown Digits */}
              <div style={{
                fontSize: 'clamp(3.5rem, 8vw, 4.75rem)',
                fontWeight: 900,
                fontFamily: 'monospace',
                lineHeight: 1,
                marginBottom: '2rem',
                color: timerFinished ? '#059669' : '#0f172a',
                letterSpacing: '-2px'
              }}>
                {formatTimer(timeLeft)}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '420px', flexWrap: 'wrap' }}>
                {timerFinished ? (
                  <button
                    onClick={handleComplete}
                    className="premium-button"
                    style={{
                      flex: 1,
                      padding: '1rem',
                      fontSize: '1.05rem',
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    }}
                  >
                    ✓ Mark Completed
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
                      style={{ flex: 1, minWidth: '130px', padding: '0.9rem' }}
                    >
                      {timerActive ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={handleQuit}
                      className="danger-button"
                      style={{ flex: 1, minWidth: '130px', padding: '0.9rem' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Abort Task
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Execution Checklist Section */}
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', margin: '0 0 0.25rem 0', fontWeight: 800, color: '#0f172a' }}>
                  Execution Protocol
                </h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                  {quitCount > 0 ? `${quitCount} failed today. Stay focused.` : 'Daily routines in strict order.'}
                </p>
              </div>

              {/* Filter Tabs */}
              <div style={{
                display: 'flex',
                gap: '0.25rem',
                background: '#f1f5f9',
                padding: '0.25rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                {['all', 'pending', 'completed'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    style={{
                      background: filter === tab ? '#ffffff' : 'transparent',
                      color: filter === tab ? '#2563eb' : '#64748b',
                      border: filter === tab ? '1px solid #cbd5e1' : '1px solid transparent',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      boxShadow: filter === tab ? '0 1px 3px rgba(15,23,42,0.06)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Tasks List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {loading && <p style={{ color: '#64748b', padding: '1rem 0' }}>Loading protocol...</p>}
              
              {!loading && tasks.length === 0 && (
                <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.8 }}>🎯</div>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>No Habits Configured</p>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                    Go to the <strong>Goals</strong> tab to define your daily execution routines.
                  </p>
                </div>
              )}

              {filteredTasks.map((task) => {
                const isCompleted = task.completion_status === 'completed';
                const isQuit = task.completion_status === 'quit';

                return (
                  <div
                    key={task.id}
                    className="glass-panel-interactive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1.15rem 1.25rem',
                      borderRadius: '12px',
                      background: isQuit 
                        ? '#fef2f2' 
                        : (isCompleted ? '#f0fdf4' : '#ffffff'),
                      border: isQuit 
                        ? '1px solid #fecaca' 
                        : (isCompleted ? '1px solid #bbf7d0' : '1px solid #e2e8f0'),
                      opacity: (isCompleted || isQuit) ? 0.75 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Time Badge */}
                    {task.scheduled_time && (
                      <div style={{
                        background: '#f8fafc',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: '68px',
                        flexShrink: 0,
                        border: '1px solid #e2e8f0'
                      }}>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          color: isQuit ? '#dc2626' : (isCompleted ? '#059669' : '#2563eb')
                        }}>
                          {formatTime(task.scheduled_time).split(' ')[0]}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700 }}>
                          {formatTime(task.scheduled_time).split(' ')[1]}
                        </span>
                      </div>
                    )}

                    {/* Task Title & Goal Badge */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: '1rem',
                        textDecoration: (isCompleted || isQuit) ? 'line-through' : 'none',
                        color: isQuit ? '#dc2626' : (isCompleted ? '#64748b' : '#0f172a'),
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {task.title}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                        <span style={{
                          background: '#f1f5f9',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          color: '#475569',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          border: '1px solid #e2e8f0'
                        }}>
                          {task.goals?.title || 'General'}
                        </span>
                        {task.end_time && (
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            until {formatTime(task.end_time)}
                          </span>
                        )}
                        {isQuit && <span style={{ color: '#dc2626', fontSize: '0.72rem', fontWeight: 800 }}>FAILED</span>}
                        {isCompleted && <span style={{ color: '#059669', fontSize: '0.72rem', fontWeight: 800 }}>COMPLETED</span>}
                      </div>
                    </div>

                    {/* Action Trigger */}
                    <div>
                      {task.completion_status === 'pending' && (
                        <>
                          {focusTask?.id === task.id ? (
                            <span style={{
                              color: '#2563eb',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              padding: '0.5rem 0.85rem',
                              borderRadius: '8px',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe'
                            }}>
                              ⚡ IN PROGRESS
                            </span>
                          ) : focusTask && focusTask.id !== task.id ? (
                            <button
                              onClick={() => startFocus(task)}
                              style={{
                                padding: '0.55rem 0.85rem',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                color: '#94a3b8'
                              }}
                              title="Finish active focus first"
                            >
                              🔒 LOCKED
                            </button>
                          ) : (
                            <button
                              onClick={() => startFocus(task)}
                              className="premium-button"
                              style={{
                                padding: '0.55rem 1.15rem',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                fontWeight: 800
                              }}
                            >
                              ENGAGE
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMN 2: ANALYTICS, PROGRESS GAUGE & DISCIPLINE PILLARS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
            
            {/* Streak Card */}
            <div className="glass-panel" style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {currentStreak > 1 && (
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  fontSize: '4.5rem',
                  opacity: 0.1,
                  userSelect: 'none'
                }}>
                  🔥
                </div>
              )}
              <span style={{
                fontSize: '0.72rem',
                color: '#64748b',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Current Streak
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.4rem' }}>
                <span className={currentStreak > 0 ? "text-gradient-fire" : ""} style={{
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  lineHeight: 1,
                  color: currentStreak > 0 ? '#ea580c' : '#0f172a'
                }}>
                  {currentStreak}
                </span>
                <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
                  days
                </span>
              </div>
              <span style={{
                marginTop: '0.6rem',
                fontSize: '0.72rem',
                color: currentStreak >= 7 ? '#059669' : (currentStreak > 0 ? '#ea580c' : '#64748b'),
                fontWeight: 700
              }}>
                {currentStreak >= 30 ? '👑 Master Level' : (currentStreak >= 7 ? '⚡ High Momentum' : (currentStreak > 0 ? '🔥 Streak Active' : 'Build momentum today'))}
              </span>
            </div>

            {/* Circular Gauge Card */}
            <div className="glass-panel" style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ position: 'relative', width: '84px', height: '84px' }}>
                <svg style={{ transform: 'rotate(-90deg)', width: '84px', height: '84px', overflow: 'visible' }}>
                  <circle cx="42" cy="42" r={radius} stroke="#f1f5f9" strokeWidth="8" fill="none" />
                  <circle
                    cx="42"
                    cy="42"
                    r={radius}
                    stroke={progressColor}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 900, color: progressColor, lineHeight: 1 }}>
                    {progress}%
                  </span>
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, marginTop: '0.65rem' }}>
                {completedCount} / {totalCount} Done
              </span>
            </div>
          </div>

          {/* Daily Performance Brief */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              Protocol Status
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>Total Objectives</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{totalCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>Remaining Today</span>
                <span style={{ fontWeight: 700, color: pendingCount > 0 ? '#2563eb' : '#64748b' }}>
                  {pendingCount}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>Discipline Breaches</span>
                <span style={{ fontWeight: 700, color: quitCount > 0 ? '#dc2626' : '#059669' }}>
                  {quitCount}
                </span>
              </div>
            </div>
          </div>

          {/* Focus Philosophy */}
          <div className="glass-panel" style={{
            padding: '1.5rem',
            background: '#eff6ff',
            border: '1px solid #bfdbfe'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Core Philosophy
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.6 }}>
              &ldquo;We don&rsquo;t rise to the level of our expectations, we fall to the level of our training.&rdquo; Execute every routine without negotiation.
            </p>
          </div>

        </div>

      </div>
    </main>
  );
}
