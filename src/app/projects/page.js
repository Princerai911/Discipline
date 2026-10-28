"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import toast from 'react-hot-toast';

const STORAGE_PROJECTS_KEY = 'discipline_projects_list';
const STORAGE_PROJECT_TASKS_KEY = 'discipline_project_tasks';
const STORAGE_ACTIVE_PROJECT_KEY = 'discipline_active_project_id';

const COLUMNS = [
  {
    id: 'todo',
    label: 'To Do',
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    badgeBg: '#ffedd5',
    icon: '📋'
  },
  {
    id: 'doing',
    label: 'Doing',
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
    badgeBg: '#e0f2fe',
    icon: '⚡'
  },
  {
    id: 'done',
    label: 'Done',
    color: '#059669',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    badgeBg: '#dcfce7',
    icon: '✅'
  },
  {
    id: 'trash',
    label: 'Trash',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    badgeBg: '#fee2e2',
    icon: '🗑️'
  }
];

const SUPABASE_SQL_SCRIPT = `-- ==============================================================================
-- DISCIPLINE APP - PROJECTS & KANBAN BOARD SCHEMA
-- ==============================================================================
-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Project Tasks Table (Kanban Board)
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  column_id text DEFAULT 'todo' NOT NULL, -- 'todo', 'doing', 'done', 'trash'
  priority text DEFAULT 'medium' NOT NULL, -- 'high', 'medium', 'low'
  tag text DEFAULT 'General',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- 4. Set Open Access Policies for anon users
DROP POLICY IF EXISTS "Enable all access for anon users on projects" ON public.projects;
CREATE POLICY "Enable all access for anon users on projects" ON public.projects
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon users on project_tasks" ON public.project_tasks;
CREATE POLICY "Enable all access for anon users on project_tasks" ON public.project_tasks
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_column ON public.project_tasks(column_id);`;

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [supabaseTableMissing, setSupabaseTableMissing] = useState(false);

  // Quick Add Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskColumn, setNewTaskColumn] = useState('todo');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskTag, setNewTaskTag] = useState('');

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [mobileActiveColumn, setMobileActiveColumn] = useState('all'); // 'all', 'todo', 'doing', 'done', 'trash'

  // Drag & Drop State
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Inline edit state
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Modals
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Local Storage Helpers
  const getLocalProjects = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_PROJECTS_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const saveLocalProjects = (updated) => {
    try {
      localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save projects locally:', e);
    }
  };

  const getLocalTasks = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_PROJECT_TASKS_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const saveLocalTasks = (updated) => {
    try {
      localStorage.setItem(STORAGE_PROJECT_TASKS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save tasks locally:', e);
    }
  };

  // Fetch Projects & Tasks from Supabase with LocalStorage fallback
  const fetchAllData = useCallback(async () => {
    setLoading(true);

    const localP = getLocalProjects();
    const localT = getLocalTasks();
    const storedActiveId = localStorage.getItem(STORAGE_ACTIVE_PROJECT_KEY);

    if (localP.length > 0) {
      setProjects(localP);
      setActiveProjectId(localP.some(p => p.id === storedActiveId) ? storedActiveId : localP[0].id);
    }
    if (localT.length > 0) {
      setTasks(localT);
    }

    if (isSupabaseConfigured) {
      setIsCloudSyncing(true);
      try {
        const [projRes, tasksRes] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: true }),
          supabase.from('project_tasks').select('*').order('created_at', { ascending: false })
        ]);

        if (projRes.error) {
          if (projRes.error.message?.includes('schema cache') || projRes.error.message?.includes('does not exist')) {
            setSupabaseTableMissing(true);
          }
        } else if (projRes.data) {
          setProjects(projRes.data);
          saveLocalProjects(projRes.data);
          if (projRes.data.length > 0) {
            const validActive = projRes.data.some(p => p.id === storedActiveId) ? storedActiveId : projRes.data[0].id;
            setActiveProjectId(validActive);
            localStorage.setItem(STORAGE_ACTIVE_PROJECT_KEY, validActive);
          } else {
            setActiveProjectId(null);
          }
        }

        if (tasksRes.error) {
          if (tasksRes.error.message?.includes('schema cache') || tasksRes.error.message?.includes('does not exist')) {
            setSupabaseTableMissing(true);
          }
        } else if (tasksRes.data) {
          // Normalise column field from Supabase (column_id -> column)
          const normalized = tasksRes.data.map(t => ({
            ...t,
            column: t.column_id || t.column || 'todo'
          }));
          setTasks(normalized);
          saveLocalTasks(normalized);
        }
      } catch (err) {
        console.warn('Supabase fetch error, fallback to local storage:', err);
      } finally {
        setIsCloudSyncing(false);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Current Active Project Object
  const activeProject = useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find(p => p.id === activeProjectId) || projects[0] || null;
  }, [projects, activeProjectId]);

  // Tasks belonging to active project
  const projectTasks = useMemo(() => {
    if (!activeProjectId) return [];
    return tasks.filter(t => (t.project_id === activeProjectId || t.projectId === activeProjectId));
  }, [tasks, activeProjectId]);

  // Filtered tasks by search & priority
  const filteredTasks = useMemo(() => {
    return projectTasks.filter(t => {
      const matchesSearch = !searchQuery.trim() || 
        (t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
        (t.tag && t.tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
      return matchesSearch && matchesPriority;
    });
  }, [projectTasks, searchQuery, filterPriority]);

  // Board Stats
  const stats = useMemo(() => {
    const total = projectTasks.filter(t => t.column !== 'trash').length;
    const todoCount = projectTasks.filter(t => t.column === 'todo').length;
    const doingCount = projectTasks.filter(t => t.column === 'doing').length;
    const doneCount = projectTasks.filter(t => t.column === 'done').length;
    const trashCount = projectTasks.filter(t => t.column === 'trash').length;
    const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    return { total, todoCount, doingCount, doneCount, trashCount, percent };
  }, [projectTasks]);

  // Switch Active Project
  const handleSelectProject = (projectId) => {
    setActiveProjectId(projectId);
    localStorage.setItem(STORAGE_ACTIVE_PROJECT_KEY, projectId);
  };

  // Add New Task
  const handleAddTask = async (e) => {
    if (e) e.preventDefault();
    if (!activeProjectId) {
      toast.error('Please create or select a project first!');
      setIsCreatingProject(true);
      return;
    }
    if (!newTaskTitle.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `task_${Date.now()}`;
    const newTask = {
      id: newId,
      project_id: activeProjectId,
      projectId: activeProjectId,
      title: newTaskTitle.trim(),
      column: newTaskColumn,
      column_id: newTaskColumn,
      priority: newTaskPriority,
      tag: newTaskTag.trim() || 'General',
      created_at: new Date().toISOString()
    };

    const updated = [newTask, ...tasks];
    setTasks(updated);
    saveLocalTasks(updated);
    setNewTaskTitle('');
    setNewTaskTag('');
    toast.success(`Task added to ${COLUMNS.find(c => c.id === newTaskColumn)?.label}!`);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('project_tasks').insert([{
          id: newTask.id,
          project_id: newTask.project_id,
          title: newTask.title,
          column_id: newTask.column,
          priority: newTask.priority,
          tag: newTask.tag
        }]);
      } catch (err) {
        console.warn('Cloud sync error inserting task:', err);
      }
    }
  };

  // Move Task Column
  const handleMoveTask = async (taskId, targetColumn) => {
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, column: targetColumn, column_id: targetColumn };
      }
      return t;
    });
    setTasks(updated);
    saveLocalTasks(updated);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('project_tasks').update({ column_id: targetColumn }).eq('id', taskId);
      } catch (err) {
        console.warn('Cloud sync error moving task:', err);
      }
    }
  };

  // Inline edit task title
  const handleSaveInlineEdit = async (taskId) => {
    if (!editingTitle.trim()) {
      setEditingTaskId(null);
      return;
    }
    const updated = tasks.map(t => t.id === taskId ? { ...t, title: editingTitle.trim() } : t);
    setTasks(updated);
    saveLocalTasks(updated);
    setEditingTaskId(null);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('project_tasks').update({ title: editingTitle.trim() }).eq('id', taskId);
      } catch (err) {
        console.warn('Cloud sync error editing task title:', err);
      }
    }
  };

  // Permanently Delete Single Task
  const handleDeleteTaskForever = async (taskId, taskTitle) => {
    if (!confirm(`Permanently delete "${taskTitle}"?`)) return;
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    saveLocalTasks(updated);
    toast.success(`Deleted "${taskTitle}"`);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('project_tasks').delete().eq('id', taskId);
      } catch (err) {
        console.warn('Cloud sync error deleting task:', err);
      }
    }
  };

  // Empty Trash Column
  const handleEmptyTrash = async () => {
    const trashTasks = projectTasks.filter(t => t.column === 'trash');
    if (trashTasks.length === 0) {
      toast('Trash is already empty');
      return;
    }
    if (!confirm(`Permanently delete all ${trashTasks.length} task(s) in Trash?`)) return;

    const updated = tasks.filter(t => !( (t.project_id === activeProjectId || t.projectId === activeProjectId) && t.column === 'trash'));
    setTasks(updated);
    saveLocalTasks(updated);
    toast.success('Trash emptied!');

    if (isSupabaseConfigured) {
      try {
        await supabase.from('project_tasks').delete().eq('project_id', activeProjectId).eq('column_id', 'trash');
      } catch (err) {
        console.warn('Cloud sync error emptying trash:', err);
      }
    }
  };

  // Restore All Tasks from Trash
  const handleRestoreAllTrash = async () => {
    const updated = tasks.map(t => {
      if ((t.project_id === activeProjectId || t.projectId === activeProjectId) && t.column === 'trash') {
        return { ...t, column: 'todo', column_id: 'todo' };
      }
      return t;
    });
    setTasks(updated);
    saveLocalTasks(updated);
    toast.success('Restored all trash tasks to To Do!');

    if (isSupabaseConfigured) {
      try {
        await supabase.from('project_tasks').update({ column_id: 'todo' }).eq('project_id', activeProjectId).eq('column_id', 'trash');
      } catch (err) {
        console.warn('Cloud sync error restoring trash:', err);
      }
    }
  };

  // Create Project
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `proj_${Date.now()}`;
    const newProj = {
      id: newId,
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || '',
      created_at: new Date().toISOString()
    };

    const updated = [...projects, newProj];
    setProjects(updated);
    saveLocalProjects(updated);
    setActiveProjectId(newProj.id);
    localStorage.setItem(STORAGE_ACTIVE_PROJECT_KEY, newProj.id);
    setNewProjectName('');
    setNewProjectDesc('');
    setIsCreatingProject(false);
    toast.success(`Project "${newProj.name}" created! 🚀`);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('projects').insert([{
          id: newProj.id,
          name: newProj.name,
          description: newProj.description
        }]);
      } catch (err) {
        console.warn('Cloud sync error inserting project:', err);
      }
    }
  };

  // Delete Current Project
  const handleDeleteProject = async (projectId, projectName) => {
    if (!confirm(`Are you sure you want to delete project "${projectName}" and all its tasks?`)) return;

    const updatedProjects = projects.filter(p => p.id !== projectId);
    setProjects(updatedProjects);
    saveLocalProjects(updatedProjects);

    const updatedTasks = tasks.filter(t => (t.project_id !== projectId && t.projectId !== projectId));
    setTasks(updatedTasks);
    saveLocalTasks(updatedTasks);

    const nextActive = updatedProjects[0]?.id || null;
    setActiveProjectId(nextActive);
    if (nextActive) {
      localStorage.setItem(STORAGE_ACTIVE_PROJECT_KEY, nextActive);
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_PROJECT_KEY);
    }

    toast.success(`Project "${projectName}" deleted`);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('projects').delete().eq('id', projectId);
      } catch (err) {
        console.warn('Cloud sync error deleting project:', err);
      }
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      handleMoveTask(taskId, targetColumnId);
      setDraggedTaskId(null);
    }
  };

  // Copy SQL script to clipboard
  const handleCopySql = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
      toast.success('Supabase SQL copied to clipboard! 📋');
    }
  };

  return (
    <main style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* ============================================================== */}
      {/* SUPABASE SQL NOTIFICATION / HELPER BANNER                      */}
      {/* ============================================================== */}
      {supabaseTableMissing && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
            <div>
              <strong style={{ color: '#1d4ed8', fontSize: '0.88rem', display: 'block' }}>
                Supabase Tables Setup Required
              </strong>
              <span style={{ fontSize: '0.78rem', color: '#3b82f6' }}>
                The <code>projects</code> and <code>project_tasks</code> tables need to be created in your Supabase database.
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowSqlModal(true)}
              className="premium-button"
              style={{ padding: '0.45rem 0.95rem', borderRadius: '8px', fontSize: '0.78rem' }}
            >
              📋 View / Copy Supabase SQL
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. TOP HEADER & PROJECT SELECTOR                                */}
      {/* ============================================================== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '1.25rem'
      }}>
        {/* Left: Title & Project Switcher */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🚀</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 className="text-gradient-accent" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 900, letterSpacing: '-0.5px' }}>
                  Projects & Kanban
                </h2>

                {projects.length > 0 && (
                  <select
                    value={activeProjectId || ''}
                    onChange={(e) => handleSelectProject(e.target.value)}
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1d4ed8',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>📁 {p.name}</option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => setIsCreatingProject(true)}
                  className="premium-button"
                  title="Create a new Project Board"
                  style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 800 }}
                >
                  + New Project
                </button>

                {activeProject && (
                  <button
                    onClick={() => handleDeleteProject(activeProject.id, activeProject.name)}
                    title="Delete current project"
                    style={{
                      background: 'transparent',
                      border: '1px solid #e2e8f0',
                      color: '#94a3b8',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fecaca'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                  >
                    🗑️ Delete Project
                  </button>
                )}
              </div>

              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
                {activeProject ? (activeProject.description || 'Custom agile Kanban board synced with Supabase') : 'Create a project to start managing tasks'}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Actions, SQL Button & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowSqlModal(true)}
            className="premium-button-secondary"
            title="View Supabase SQL schema code"
            style={{ padding: '0.45rem 0.95rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <span>⚡</span>
            <span>Supabase SQL</span>
          </button>

          <span style={{
            fontSize: '0.72rem',
            padding: '0.35rem 0.65rem',
            borderRadius: '999px',
            background: isSupabaseConfigured ? '#ecfdf5' : '#eff6ff',
            color: isSupabaseConfigured ? '#059669' : '#2563eb',
            border: `1px solid ${isSupabaseConfigured ? '#a7f3d0' : '#bfdbfe'}`,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}>
            <span>{isSupabaseConfigured ? '☁️' : '💾'}</span>
            <span>{isSupabaseConfigured ? (isCloudSyncing ? 'Syncing...' : 'Supabase Connected') : 'Local Storage'}</span>
          </span>

          {activeProject && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              background: '#ffffff',
              padding: '0.55rem 1rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Progress
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#059669' }}>
                    {stats.percent}%
                  </span>
                </div>
                <div style={{ width: '110px', height: '5px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${stats.percent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #2563eb 0%, #059669 100%)',
                    borderRadius: '999px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', borderLeft: '1px solid #e2e8f0', paddingLeft: '0.75rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>{stats.total}</span>
                  <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700 }}>TASKS</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '1rem', fontWeight: 900, color: '#059669' }}>{stats.doneCount}</span>
                  <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700 }}>DONE</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. EMPTY STATE: NO PROJECTS YET                                 */}
      {/* ============================================================== */}
      {!loading && projects.length === 0 && (
        <div className="glass-panel" style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          borderRadius: '20px',
          background: '#ffffff',
          boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <span style={{ fontSize: '3.5rem', display: 'block' }}>🚀</span>
          <h3 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>
            No Projects Created Yet
          </h3>
          <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.92rem', maxWidth: '480px' }}>
            Create your first project to start organizing tasks across your custom To Do, Doing, Done, and Trash pipeline.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => setIsCreatingProject(true)}
              className="premium-button"
              style={{ padding: '0.8rem 1.8rem', borderRadius: '12px', fontSize: '0.92rem', fontWeight: 800 }}
            >
              + Create Your First Project
            </button>
            <button
              onClick={() => setShowSqlModal(true)}
              className="premium-button-secondary"
              style={{ padding: '0.8rem 1.4rem', borderRadius: '12px', fontSize: '0.88rem', fontWeight: 700 }}
            >
              📋 View Supabase SQL Code
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. QUICK ADD TASK BAR (REAL USER TASKS, ZERO HARDCODING)       */}
      {/* ============================================================== */}
      {projects.length > 0 && (
        <form
          onSubmit={handleAddTask}
          className="glass-panel"
          style={{
            padding: '1.15rem 1.35rem',
            borderRadius: '16px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '1.15rem' }}>⚡</span>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                Add New Task in &ldquo;{activeProject?.name}&rdquo;
              </span>
            </div>

            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Press <kbd style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem' }}>Enter ↵</kbd> to add
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Task Title Input */}
            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="New Task... (Type task name)"
                className="premium-input"
                style={{
                  width: '100%',
                  padding: '0.7rem 1rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px'
                }}
              />
            </div>

            {/* Target Column Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>STAGE:</span>
              <select
                value={newTaskColumn}
                onChange={(e) => setNewTaskColumn(e.target.value)}
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="todo">📋 To Do</option>
                <option value="doing">⚡ Doing</option>
                <option value="done">✅ Done</option>
                <option value="trash">🗑️ Trash</option>
              </select>
            </div>

            {/* Priority Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>PRIORITY:</span>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            {/* Tag Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>TAG:</span>
              <input
                type="text"
                value={newTaskTag}
                onChange={(e) => setNewTaskTag(e.target.value)}
                placeholder="Tag (e.g. Dev, Design)"
                style={{
                  width: '120px',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>

            {/* Add Task Button */}
            <button
              type="submit"
              className="premium-button"
              style={{
                padding: '0.7rem 1.4rem',
                borderRadius: '10px',
                fontSize: '0.88rem',
                fontWeight: 800,
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
              }}
            >
              <span>+</span>
              <span>Add New Task</span>
            </button>
          </div>
        </form>
      )}

      {/* ============================================================== */}
      {/* 4. FILTERS & SEARCH                                            */}
      {/* ============================================================== */}
      {projects.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px', maxWidth: '380px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '0.45rem 0.85rem',
              width: '100%',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter tasks by name or tag..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.85rem',
                  color: '#0f172a',
                  width: '100%'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Priority Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>PRIORITY:</span>
            {['all', 'high', 'medium', 'low'].map(p => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  border: filterPriority === p ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                  background: filterPriority === p ? '#eff6ff' : '#ffffff',
                  color: filterPriority === p ? '#2563eb' : '#64748b',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Mobile Column View Switcher */}
          <div className="mobile-only" style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', width: '100%', paddingBottom: '0.25rem' }}>
            <button
              onClick={() => setMobileActiveColumn('all')}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                border: mobileActiveColumn === 'all' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                background: mobileActiveColumn === 'all' ? '#eff6ff' : '#ffffff',
                color: mobileActiveColumn === 'all' ? '#2563eb' : '#64748b',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              All Columns ({stats.total + stats.trashCount})
            </button>
            {COLUMNS.map(col => {
              const count = projectTasks.filter(t => t.column === col.id).length;
              const isColActive = mobileActiveColumn === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => setMobileActiveColumn(col.id)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '8px',
                    border: isColActive ? `1px solid ${col.border}` : '1px solid #e2e8f0',
                    background: isColActive ? col.bg : '#ffffff',
                    color: isColActive ? col.color : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {col.icon} {col.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. THE 4 KANBAN COLUMNS (TO DO, DOING, DONE, TRASH)             */}
      {/* ============================================================== */}
      {projects.length > 0 && (
        <div className="kanban-board-grid">
          {COLUMNS.map((col) => {
            if (mobileActiveColumn !== 'all' && mobileActiveColumn !== col.id) {
              return null;
            }

            const columnTasks = filteredTasks.filter(t => t.column === col.id);
            const isDragOver = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className="glass-panel"
                style={{
                  borderRadius: '16px',
                  background: isDragOver ? '#eff6ff' : '#f8fafc',
                  border: isDragOver ? '2px dashed #2563eb' : '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '560px',
                  transition: 'all 0.2s ease',
                  boxShadow: isDragOver ? '0 8px 24px rgba(37, 99, 235, 0.12)' : '0 2px 8px rgba(15, 23, 42, 0.03)',
                  overflow: 'hidden'
                }}
              >
                {/* Column Header */}
                <div style={{
                  padding: '0.9rem 1rem',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#ffffff',
                  borderTop: `4px solid ${col.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '1.05rem' }}>{col.icon}</span>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: 800,
                      color: col.color,
                      letterSpacing: '-0.3px'
                    }}>
                      {col.label}
                    </h3>

                    <span style={{
                      fontSize: '0.74rem',
                      background: col.bg,
                      color: col.color,
                      border: `1px solid ${col.border}`,
                      fontWeight: 800,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px'
                    }}>
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Column Header Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {col.id === 'trash' ? (
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {columnTasks.length > 0 && (
                          <>
                            <button
                              onClick={handleRestoreAllTrash}
                              title="Restore all items to To Do"
                              style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#2563eb',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Restore All
                            </button>
                            <button
                              onClick={handleEmptyTrash}
                              title="Empty all trash items permanently"
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          const title = prompt(`Add task to ${col.label}:`);
                          if (title && title.trim()) {
                            const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `task_${Date.now()}`;
                            const newTask = {
                              id: newId,
                              project_id: activeProjectId,
                              projectId: activeProjectId,
                              title: title.trim(),
                              column: col.id,
                              column_id: col.id,
                              priority: 'medium',
                              tag: 'General',
                              created_at: new Date().toISOString()
                            };
                            const updated = [newTask, ...tasks];
                            setTasks(updated);
                            saveLocalTasks(updated);

                            if (isSupabaseConfigured) {
                              try {
                                await supabase.from('project_tasks').insert([{
                                  id: newTask.id,
                                  project_id: newTask.project_id,
                                  title: newTask.title,
                                  column_id: newTask.column,
                                  priority: newTask.priority,
                                  tag: newTask.tag
                                }]);
                              } catch (err) {
                                console.warn('Cloud insert error:', err);
                              }
                            }
                          }
                        }}
                        title={`Add task directly into ${col.label}`}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          color: '#64748b',
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: 700
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = '#2563eb';
                          e.currentTarget.style.borderColor = '#bfdbfe';
                          e.currentTarget.style.background = '#eff6ff';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = '#64748b';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.background = '#f8fafc';
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>

                {/* Tasks List */}
                <div style={{
                  flex: 1,
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  overflowY: 'auto'
                }}>
                  {columnTasks.length === 0 ? (
                    <div style={{
                      padding: '2.5rem 1rem',
                      textAlign: 'center',
                      border: '1px dashed #cbd5e1',
                      borderRadius: '12px',
                      color: '#94a3b8',
                      background: '#ffffff'
                    }}>
                      <span style={{ fontSize: '1.6rem', display: 'block', marginBottom: '0.35rem', opacity: 0.6 }}>
                        {col.id === 'trash' ? '✨' : '📥'}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                        {col.id === 'trash' ? 'Trash is empty' : `No tasks in ${col.label}`}
                      </span>
                      {col.id !== 'trash' && (
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                          Drag tasks here or click + above
                        </span>
                      )}
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const isEditing = editingTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          style={{
                            background: '#ffffff',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            padding: '0.85rem 0.95rem',
                            cursor: 'grab',
                            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.55rem',
                            transition: 'all 0.15s ease',
                            position: 'relative'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.borderColor = '#93c5fd';
                            e.currentTarget.style.boxShadow = '0 8px 18px rgba(37, 99, 235, 0.08)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(15, 23, 42, 0.04)';
                          }}
                        >
                          {/* Task Badges & Drag Indicator */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '0.12rem 0.45rem',
                                borderRadius: '6px',
                                background: task.priority === 'high' ? '#fee2e2' : task.priority === 'medium' ? '#fef3c7' : '#ecfdf5',
                                color: task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#d97706' : '#059669',
                                border: `1px solid ${task.priority === 'high' ? '#fecaca' : task.priority === 'medium' ? '#fde68a' : '#a7f3d0'}`
                              }}>
                                {task.priority || 'medium'}
                              </span>

                              {task.tag && (
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.12rem 0.45rem',
                                  borderRadius: '6px',
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  border: '1px solid #e2e8f0'
                                }}>
                                  #{task.tag}
                                </span>
                              )}
                            </div>

                            <span style={{ color: '#cbd5e1', fontSize: '0.85rem', cursor: 'grab' }} title="Drag task">
                              ⋮⋮
                            </span>
                          </div>

                          {/* Task Title (Editable) */}
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineEdit(task.id);
                                  if (e.key === 'Escape') setEditingTaskId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.3rem 0.5rem',
                                  fontSize: '0.9rem',
                                  fontWeight: 700,
                                  border: '1px solid #2563eb',
                                  borderRadius: '6px',
                                  outline: 'none'
                                }}
                              />
                              <button
                                onClick={() => handleSaveInlineEdit(task.id)}
                                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '0 8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                ✓
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingTaskId(task.id);
                                setEditingTitle(task.title);
                              }}
                              title="Click to edit task title"
                              style={{
                                fontSize: '0.92rem',
                                fontWeight: 700,
                                color: col.id === 'done' ? '#64748b' : '#0f172a',
                                textDecoration: col.id === 'done' ? 'line-through' : 'none',
                                lineHeight: 1.4,
                                cursor: 'pointer',
                                padding: '0.1rem 0'
                              }}
                            >
                              {task.title}
                            </div>
                          )}

                          {/* Movement Controls & Delete */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderTop: '1px solid #f8fafc',
                            paddingTop: '0.45rem',
                            marginTop: '0.2rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              {col.id === 'todo' && (
                                <button
                                  onClick={() => handleMoveTask(task.id, 'doing')}
                                  title="Move to Doing"
                                  style={{
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    color: '#2563eb',
                                    borderRadius: '6px',
                                    padding: '2px 7px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Doing →
                                </button>
                              )}

                              {col.id === 'doing' && (
                                <>
                                  <button
                                    onClick={() => handleMoveTask(task.id, 'todo')}
                                    title="Move back to To Do"
                                    style={{
                                      background: '#fff7ed',
                                      border: '1px solid #fed7aa',
                                      color: '#ea580c',
                                      borderRadius: '6px',
                                      padding: '2px 6px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ← To Do
                                  </button>
                                  <button
                                    onClick={() => handleMoveTask(task.id, 'done')}
                                    title="Move to Done"
                                    style={{
                                      background: '#ecfdf5',
                                      border: '1px solid #a7f3d0',
                                      color: '#059669',
                                      borderRadius: '6px',
                                      padding: '2px 7px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Done →
                                  </button>
                                </>
                              )}

                              {col.id === 'done' && (
                                <button
                                  onClick={() => handleMoveTask(task.id, 'doing')}
                                  title="Move back to Doing"
                                  style={{
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    color: '#2563eb',
                                    borderRadius: '6px',
                                    padding: '2px 7px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  ← Doing
                                </button>
                              )}

                              {col.id === 'trash' && (
                                <button
                                  onClick={() => handleMoveTask(task.id, 'todo')}
                                  title="Restore task to To Do"
                                  style={{
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    color: '#2563eb',
                                    borderRadius: '6px',
                                    padding: '2px 7px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  ↩ Restore
                                </button>
                              )}
                            </div>

                            {col.id === 'trash' ? (
                              <button
                                onClick={() => handleDeleteTaskForever(task.id, task.title)}
                                title="Permanently delete task"
                                style={{
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626',
                                  borderRadius: '6px',
                                  padding: '2px 6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                ✕ Delete
                              </button>
                            ) : (
                              <button
                                onClick={() => handleMoveTask(task.id, 'trash')}
                                title="Move task to Trash"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  fontSize: '0.82rem',
                                  borderRadius: '4px'
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. CREATE NEW PROJECT MODAL                                     */}
      {/* ============================================================== */}
      {isCreatingProject && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <form
            onSubmit={handleCreateProject}
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
              borderRadius: '20px',
              background: '#ffffff',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.16)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🚀</span>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                  Create New Project
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingProject(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                PROJECT NAME:
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Website Redesign, Mobile App, Growth Roadmap..."
                className="premium-input"
                autoFocus
                style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.95rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                DESCRIPTION (OPTIONAL):
              </label>
              <textarea
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="Brief goal or deliverables for this project board..."
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  outline: 'none',
                  minHeight: '80px',
                  fontFamily: 'inherit',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsCreatingProject(false)}
                className="premium-button-secondary"
                style={{ padding: '0.65rem 1.25rem', borderRadius: '10px', fontWeight: 700 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="premium-button"
                style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', fontWeight: 800 }}
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. SUPABASE SQL CODE MODAL (USER CAN COPY & RUN IN SUPABASE)    */}
      {/* ============================================================== */}
      {showSqlModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              borderRadius: '20px',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <span style={{ fontSize: '1.5rem' }}>⚡</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                    Supabase SQL Setup Code
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', color: '#64748b', fontSize: '0.78rem' }}>
                    Run this SQL script in your Supabase SQL Editor to enable full cloud sync for Projects & Kanban tasks.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1rem',
              position: 'relative'
            }}>
              <button
                onClick={handleCopySql}
                className="premium-button"
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: 800
                }}
              >
                📋 Copy SQL
              </button>
              <pre style={{
                margin: 0,
                fontSize: '0.78rem',
                fontFamily: 'var(--font-geist-mono), Consolas, monospace',
                color: '#1e293b',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.5,
                maxHeight: '340px',
                overflowY: 'auto'
              }}>
                {SUPABASE_SQL_SCRIPT}
              </pre>
            </div>

            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              fontSize: '0.82rem',
              color: '#1d4ed8',
              lineHeight: 1.5
            }}>
              <strong>How to run in Supabase:</strong>
              <ol style={{ margin: '0.4rem 0 0 0', paddingLeft: '1.2rem' }}>
                <li>Open your <strong>Supabase Dashboard</strong></li>
                <li>Click <strong>SQL Editor</strong> in the left sidebar</li>
                <li>Click <strong>New Query</strong>, paste this code, and click <strong>Run</strong></li>
                <li>Refresh this page, and your projects and tasks will sync instantly!</li>
              </ol>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={handleCopySql}
                className="premium-button"
                style={{ padding: '0.65rem 1.4rem', borderRadius: '10px', fontWeight: 800 }}
              >
                Copy SQL Code
              </button>
              <button
                onClick={() => setShowSqlModal(false)}
                className="premium-button-secondary"
                style={{ padding: '0.65rem 1.25rem', borderRadius: '10px', fontWeight: 700 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
