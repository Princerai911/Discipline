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

    if (error) {
      toast.error('Failed to create objective: ' + error.message);
      return;
    }

    if (data) {
      setGoals([data[0], ...goals]);
      setNewGoalTitle('');
      setNewGoalDescription('');
      setIsAddingGoal(false);
      toast.success('Objective Created');
    }
  }

  async function deleteGoal(id) {
    if (confirm("Are you sure you want to delete this objective and all its habits?")) {
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (error) {
        toast.error('Failed to delete objective: ' + error.message);
      } else {
        setGoals(goals.filter(g => g.id !== id));
        toast.success('Objective Deleted');
      }
    }
  }

  // Task Methods
  async function addTask(goalId) {
    if (!newTaskTitle.trim() || !newTaskStartTime || !newTaskEndTime) {
      toast.error('Please enter Title, Start Time, and End Time.');
      return;
    }

    if (newTaskStartTime === newTaskEndTime) {
      toast.error('Start Time and End Time cannot be identical.');
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

    if (error) {
      toast.error('Failed to save habit: ' + error.message);
      return;
    }

    if (data) {
      setGoals(goals.map(g => {
        if (g.id === goalId) {
          return { ...g, tasks: [...(g.tasks || []), data[0]] };
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
    if (task.scheduled_time === task.end_time) {
      toast.error('Start Time and End Time cannot be identical.');
      return;
    }

    const { error } = await supabase
      .from('tasks')
      .update({ 
        title: task.title, 
        scheduled_time: task.scheduled_time, 
        end_time: task.end_time 
      })
      .eq('id', task.id);
    
    if (error) {
      toast.error('Failed to update habit: ' + error.message);
    } else {
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
      if (error) {
        toast.error('Failed to delete habit: ' + error.message);
      } else {
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

  return (
    <main className="animate-enter">
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <div>
          <h2 className="text-gradient-accent" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 900, letterSpacing: '-0.5px' }}>
            Master Plan
          </h2>
          <p style={{ color: 'var(--muted-foreground)', marginTop: '0.35rem', fontSize: '0.9rem' }}>
            Architect your high-level objectives and recurring daily habits.
          </p>
        </div>

        <button 
          onClick={() => setIsAddingGoal(!isAddingGoal)}
          className="premium-button"
          style={{ padding: '0.75rem 1.35rem', borderRadius: '12px' }}
        >
          {isAddingGoal ? 'Cancel' : '+ Define Objective'}
        </button>
      </div>

      {/* Expandable Add Objective Form */}
      {isAddingGoal && (
        <form onSubmit={addGoal} className="glass-panel" style={{
          padding: '1.75rem',
          marginBottom: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          border: '1px solid #cbd5e1',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)'
        }}>
          <div>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.2rem', fontWeight: 800 }}>New Strategic Objective</h3>
            <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
              Define what you want to conquer and reinforce with daily habits.
            </p>
          </div>

          <input 
            type="text" 
            className="premium-input"
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
            placeholder="Objective Title (e.g. Master Salesforce Architecture, Peak Physical Condition)"
            style={{ width: '100%', padding: '1rem' }}
          />

          <textarea 
            className="premium-input"
            value={newGoalDescription}
            onChange={(e) => setNewGoalDescription(e.target.value)}
            placeholder="Why does this matter? What is the standard of success? (Optional)"
            style={{ width: '100%', padding: '1rem', minHeight: '90px', resize: 'vertical' }}
          />

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setIsAddingGoal(false)}
              className="premium-button-secondary"
              style={{ padding: '0.75rem 1.25rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="premium-button"
              disabled={!newGoalTitle.trim()}
              style={{ padding: '0.75rem 1.5rem' }}
            >
              Commit Objective
            </button>
          </div>
        </form>
      )}

      {/* Objectives Responsive Grid */}
      {loading && <p style={{ color: 'var(--muted-foreground)', padding: '2rem 0' }}>Analyzing objectives...</p>}
      
      {!loading && goals.length === 0 && !isAddingGoal && (
        <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 800 }}>No Objectives Defined</h3>
          <p style={{ margin: '0 0 1.5rem 0', color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
            Create your first strategic objective to anchor your daily discipline habits.
          </p>
          <button
            onClick={() => setIsAddingGoal(true)}
            className="premium-button"
            style={{ padding: '0.75rem 1.5rem' }}
          >
            + Create Your First Objective
          </button>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))',
        gap: '1.75rem',
        alignItems: 'start'
      }}>
        {goals.map((goal, i) => (
          <div
            key={goal.id}
            className="glass-panel"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              animationDelay: `${i * 0.05}s`
            }}
          >
            {/* Delete Objective Icon */}
            <button 
              onClick={() => deleteGoal(goal.id)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Delete Objective"
            >
              ×
            </button>
            
            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.25rem', fontWeight: 800, paddingRight: '2.5rem' }}>
              {goal.title}
            </h3>

            {goal.description && (
              <p style={{ margin: '0 0 1.25rem 0', color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                {goal.description}
              </p>
            )}

            {/* Habits Section */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--card-border)', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
                  Daily Habits ({goal.tasks?.length || 0})
                </span>
                <button
                  onClick={() => setAddingTaskToGoal(addingTaskToGoal === goal.id ? null : goal.id)}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {addingTaskToGoal === goal.id ? 'Cancel' : '+ Add Habit'}
                </button>
              </div>

              {/* Add Habit Inline Form */}
              {addingTaskToGoal === goal.id && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                  background: '#f8fafc',
                  padding: '1.15rem',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <input
                    type="text"
                    className="premium-input"
                    placeholder="Habit Title (e.g. 50 Practice Questions)"
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    style={{ padding: '0.75rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>Start Time</label>
                      <input
                        type="time"
                        className="premium-input"
                        value={newTaskStartTime}
                        onChange={e => setNewTaskStartTime(e.target.value)}
                        style={{ padding: '0.6rem' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>End Time</label>
                      <input
                        type="time"
                        className="premium-input"
                        value={newTaskEndTime}
                        onChange={e => setNewTaskEndTime(e.target.value)}
                        style={{ padding: '0.6rem' }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => addTask(goal.id)}
                    className="premium-button"
                    style={{ padding: '0.75rem', borderRadius: '10px', marginTop: '0.25rem' }}
                  >
                    Save Routine
                  </button>
                </div>
              )}

              {/* Habits List */}
              {goal.tasks?.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', fontStyle: 'italic', margin: '0.5rem 0' }}>
                  No habits linked to this objective yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {goal.tasks?.map(task => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#f8fafc',
                        padding: '0.75rem 0.85rem',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        gap: '0.75rem'
                      }}
                    >
                      {editingTask?.id === task.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                          <input
                            type="text"
                            className="premium-input"
                            value={editingTask.title}
                            onChange={e => setEditingTask({...editingTask, title: e.target.value})}
                            style={{ padding: '0.5rem' }}
                          />
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="time"
                              className="premium-input"
                              value={editingTask.scheduled_time?.slice(0,5)}
                              onChange={e => setEditingTask({...editingTask, scheduled_time: `${e.target.value}:00`})}
                              style={{ padding: '0.5rem' }}
                            />
                            <input
                              type="time"
                              className="premium-input"
                              value={editingTask.end_time?.slice(0,5)}
                              onChange={e => setEditingTask({...editingTask, end_time: `${e.target.value}:00`})}
                              style={{ padding: '0.5rem' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => updateTask(editingTask)}
                              className="premium-button"
                              style={{ flex: 1, padding: '0.5rem', borderRadius: '8px' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingTask(null)}
                              className="premium-button-secondary"
                              style={{ flex: 1, padding: '0.5rem', borderRadius: '8px' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {task.title}
                            </p>
                            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                              {formatTime(task.scheduled_time)} &rarr; {formatTime(task.end_time)}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                            <button
                              onClick={() => setEditingTask(task)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--muted-foreground)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                padding: '0.3rem 0.5rem',
                                borderRadius: '6px'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteTask(task.id, goal.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                padding: '0.2rem 0.4rem',
                                borderRadius: '6px'
                              }}
                            >
                              ×
                            </button>
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
