"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Goal State
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDescription, setNewGoalDescription] = useState('');
  const [isAddingGoal, setIsAddingGoal] = useState(false);

  // Task State
  const [addingTaskToGoal, setAddingTaskToGoal] = useState(null); // Goal ID
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStartTime, setNewTaskStartTime] = useState('');
  const [newTaskEndTime, setNewTaskEndTime] = useState('');

  // Edit Task State
  const [editingTask, setEditingTask] = useState(null);

  useEffect(() => {
    fetchGoals();
  }, []);

  async function fetchGoals() {
    setLoading(true);
    const { data } = await supabase
      .from('goals')
      .select('*, tasks(*)')
      .order('created_at', { ascending: false });
    
    if (data) setGoals(data);
    setLoading(false);
  }

  // Goal Methods
  async function addGoal(e) {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    const { data, error } = await supabase
      .from('goals')
      .insert([{ title: newGoalTitle, description: newGoalDescription }])
      .select('*, tasks(*)');

    if (!error && data) {
      setGoals([data[0], ...goals]);
      setNewGoalTitle('');
      setNewGoalDescription('');
      setIsAddingGoal(false);
      toast.success('Objective Created');
    }
  }

  async function deleteGoal(id) {
    if (confirm("Are you sure you want to delete this goal and all its tasks?")) {
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (!error) {
        setGoals(goals.filter(g => g.id !== id));
        toast.success('Objective Deleted');
      }
    }
  }

  // Task Methods
  async function addTask(goalId) {
    if (!newTaskTitle.trim() || !newTaskStartTime || !newTaskEndTime) {
      toast.error('Please fill out Title, Start Time, and End Time.');
      return;
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ 
        goal_id: goalId, 
        title: newTaskTitle, 
        scheduled_time: `${newTaskStartTime}:00`, 
        end_time: `${newTaskEndTime}:00` 
      }])
      .select('*');

    if (!error && data) {
      setGoals(goals.map(g => {
        if (g.id === goalId) {
          return { ...g, tasks: [...g.tasks, data[0]] };
        }
        return g;
      }));
      setAddingTaskToGoal(null);
      setNewTaskTitle('');
      setNewTaskStartTime('');
      setNewTaskEndTime('');
      toast.success('Habit Added');
    }
  }

  async function updateTask(task) {
    const { error } = await supabase
      .from('tasks')
      .update({ 
        title: task.title, 
        scheduled_time: task.scheduled_time, 
        end_time: task.end_time 
      })
      .eq('id', task.id);
    
    if (!error) {
      setGoals(goals.map(g => {
        if (g.id === task.goal_id) {
          return { ...g, tasks: g.tasks.map(t => t.id === task.id ? task : t) };
        }
        return g;
      }));
      setEditingTask(null);
      toast.success('Habit Updated');
    }
  }

  async function deleteTask(taskId, goalId) {
    if (confirm("Delete this habit?")) {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (!error) {
        setGoals(goals.map(g => {
          if (g.id === goalId) return { ...g, tasks: g.tasks.filter(t => t.id !== taskId) };
          return g;
        }));
        toast.success('Habit Deleted');
      }
    }
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
  }

  function getAlarmIntent(title, timeStr) {
    if (!timeStr) return '#';
    const [h, m] = timeStr.split(':');
    const message = encodeURIComponent(`Discipline: ${title}`);
    return `intent://#Intent;action=android.intent.action.SET_ALARM;S.android.intent.extra.alarm.MESSAGE=${message};i.android.intent.extra.alarm.HOUR=${h};i.android.intent.extra.alarm.MINUTES=${m};B.android.intent.extra.alarm.SKIP_UI=false;scheme=android;end`;
  }

  return (
    <main className="animate-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="text-gradient-accent" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800 }}>Master Plan</h2>
        <button 
          onClick={() => setIsAddingGoal(!isAddingGoal)}
          className="premium-button"
          style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          {isAddingGoal ? 'Cancel' : '+ Define Goal'}
        </button>
      </div>

      {isAddingGoal && (
        <form onSubmit={addGoal} className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700 }}>New Objective</h3>
          <input 
            type="text" 
            className="premium-input"
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
            placeholder="Objective Title"
            style={{ width: '100%', padding: '1rem', borderRadius: '12px' }}
          />
          <textarea 
            className="premium-input"
            value={newGoalDescription}
            onChange={(e) => setNewGoalDescription(e.target.value)}
            placeholder="Why does this matter? (Optional)"
            style={{ width: '100%', padding: '1rem', borderRadius: '12px', minHeight: '80px', resize: 'vertical' }}
          />
          <button type="submit" className="premium-button" disabled={!newGoalTitle.trim()} style={{ padding: '1rem', fontWeight: 700, borderRadius: '12px', border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}>
            Commit to Goal
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loading && <p style={{ color: 'var(--muted-foreground)' }}>Analyzing objectives...</p>}
        {!loading && goals.length === 0 && (
          <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '1.1rem' }}>No objectives defined yet.</p>
          </div>
        )}
        
        {goals.map((goal, i) => (
          <div key={goal.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative', animationDelay: `${i * 0.1}s` }}>
            <button 
              onClick={() => deleteGoal(goal.id)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', color: '#ef4444', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              ×
            </button>
            
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700, paddingRight: '2rem' }}>{goal.title}</h3>
            {goal.description && (
              <p style={{ margin: '0 0 1.5rem 0', color: 'var(--muted-foreground)', fontSize: '0.95rem' }}>{goal.description}</p>
            )}

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--card-border)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Daily Habits</h4>
                <button onClick={() => setAddingTaskToGoal(addingTaskToGoal === goal.id ? null : goal.id)} style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                  + Add Habit
                </button>
              </div>

              {addingTaskToGoal === goal.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                  <input type="text" className="premium-input" placeholder="Task Title" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px' }} />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}><label style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Start Time</label><input type="time" className="premium-input" value={newTaskStartTime} onChange={e => setNewTaskStartTime(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px' }} /></div>
                    <div style={{ flex: 1 }}><label style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>End Time</label><input type="time" className="premium-input" value={newTaskEndTime} onChange={e => setNewTaskEndTime(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px' }} /></div>
                  </div>
                  <button onClick={() => addTask(goal.id)} className="premium-button" style={{ padding: '0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, marginTop: '0.5rem' }}>Save Habit</button>
                </div>
              )}

              {goal.tasks?.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No habits defined.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {goal.tasks?.map(task => (
                    <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px' }}>
                      {editingTask?.id === task.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                          <input type="text" className="premium-input" value={editingTask.title} onChange={e => setEditingTask({...editingTask, title: e.target.value})} style={{ padding: '0.5rem', borderRadius: '6px' }} />
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input type="time" className="premium-input" value={editingTask.scheduled_time?.slice(0,5)} onChange={e => setEditingTask({...editingTask, scheduled_time: `${e.target.value}:00`})} style={{ padding: '0.5rem', borderRadius: '6px' }} />
                            <input type="time" className="premium-input" value={editingTask.end_time?.slice(0,5)} onChange={e => setEditingTask({...editingTask, end_time: `${e.target.value}:00`})} style={{ padding: '0.5rem', borderRadius: '6px' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => updateTask(editingTask)} className="premium-button" style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                            <button onClick={() => setEditingTask(null)} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'white', cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{task.title}</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--primary)' }}>
                              {formatTime(task.scheduled_time)} - {formatTime(task.end_time)}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <a 
                              href={getAlarmIntent(task.title, task.scheduled_time)}
                              title="Set Phone Alarm"
                              style={{ textDecoration: 'none', padding: '0 0.5rem', cursor: 'pointer' }}
                            >
                              ⏰
                            </a>
                            <button onClick={() => setEditingTask(task)} style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => deleteTask(task.id, goal.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
