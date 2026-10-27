"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import toast from 'react-hot-toast';

// Local storage keys
const STORAGE_FOLDERS_KEY = 'discipline_notebook_folders';
const STORAGE_NOTES_KEY = 'discipline_notebook_notes';

export default function NotesNotebookPage() {
  // Navigation / View Hierarchy State
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null); // null = Level 1 (All Folders); Folder object = Level 2 (Inside Folder)
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Folder Creation State
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Note Creation State
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  // Note Editing State
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // Search Filter State
  const [searchQuery, setSearchQuery] = useState('');

  // Helpers for Local Storage
  const getLocalFolders = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_FOLDERS_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const saveLocalFolders = (updatedFolders) => {
    try {
      localStorage.setItem(STORAGE_FOLDERS_KEY, JSON.stringify(updatedFolders));
    } catch (e) {
      console.error('Failed to save folders locally:', e);
    }
  };

  const getLocalNotes = (folderId = null) => {
    try {
      const allNotes = JSON.parse(localStorage.getItem(STORAGE_NOTES_KEY) || '[]');
      if (folderId) {
        return allNotes.filter(n => n.folder_id === folderId);
      }
      return allNotes;
    } catch {
      return [];
    }
  };

  const saveLocalNotes = (updatedNotes) => {
    try {
      localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(updatedNotes));
    } catch (e) {
      console.error('Failed to save notes locally:', e);
    }
  };

  // Load Folders on Mount (Instant from localStorage, then background sync with Supabase if configured)
  useEffect(() => {
    fetchFolders();
  }, []);

  async function fetchFolders() {
    setLoading(true);

    // 1. Immediately load from localStorage for zero latency
    const local = getLocalFolders();
    if (local && local.length > 0) {
      setFolders(local);
    }

    // 2. If Supabase is configured with real credentials, sync from cloud
    if (isSupabaseConfigured) {
      setIsCloudSyncing(true);
      try {
        const { data: cloudFolders, error } = await supabase
          .from('notebook_folders')
          .select('*, notes(count)')
          .order('created_at', { ascending: false });

        if (!error && cloudFolders) {
          const formatted = cloudFolders.map(f => ({
            id: f.id,
            name: f.name,
            created_at: f.created_at,
            note_count: f.notes ? (f.notes[0]?.count || 0) : 0
          }));
          setFolders(formatted);
          saveLocalFolders(formatted);
        }
      } catch (err) {
        console.warn('Supabase cloud fetch bypassed, using local folders:', err);
      } finally {
        setIsCloudSyncing(false);
      }
    }

    setLoading(false);
  }

  // Fetch Notes inside the Selected Folder
  async function fetchNotesForFolder(folderId) {
    setLoading(true);

    // 1. Load locally first
    const localNotes = getLocalNotes(folderId);
    setNotes(localNotes);

    // 2. If cloud is configured, query Supabase
    if (isSupabaseConfigured) {
      try {
        const { data: cloudNotes, error } = await supabase
          .from('notes')
          .select('*')
          .eq('folder_id', folderId)
          .order('created_at', { ascending: false });

        if (!error && cloudNotes) {
          setNotes(cloudNotes);
          // Merge with local storage
          const allLocal = getLocalNotes().filter(n => n.folder_id !== folderId);
          saveLocalNotes([...allLocal, ...cloudNotes]);
        }
      } catch (err) {
        console.warn('Supabase notes fetch error, using local notes:', err);
      }
    }

    setLoading(false);
  }

  // --- Folder Actions ---
  async function handleCreateFolder(e) {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      toast.error('Please enter a folder title');
      return;
    }

    const newFolder = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `folder_${Date.now()}`,
      name: trimmed,
      created_at: new Date().toISOString(),
      note_count: 0
    };

    // 1. Save locally immediately
    const updated = [newFolder, ...folders];
    setFolders(updated);
    saveLocalFolders(updated);
    setNewFolderName('');
    setIsCreatingFolder(false);
    toast.success(`Folder '${newFolder.name}' created! 📁`);

    // 2. Background sync to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('notebook_folders')
          .insert([{ id: newFolder.id, name: newFolder.name }]);
      } catch (err) {
        console.warn('Cloud sync queued locally for folder:', err);
      }
    }
  }

  async function handleDeleteFolder(folderId, folderName, e) {
    e.stopPropagation(); // prevent opening the folder
    if (!confirm(`Are you sure you want to delete the folder "${folderName}" and all its sub-notes?`)) {
      return;
    }

    // 1. Remove locally
    const updatedFolders = folders.filter(f => f.id !== folderId);
    setFolders(updatedFolders);
    saveLocalFolders(updatedFolders);

    // Remove sub-notes of this folder
    const remainingNotes = getLocalNotes().filter(n => n.folder_id !== folderId);
    saveLocalNotes(remainingNotes);

    if (selectedFolder?.id === folderId) {
      setSelectedFolder(null);
    }
    toast.success(`Deleted folder "${folderName}"`);

    // 2. Background sync delete to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('notebook_folders')
          .delete()
          .eq('id', folderId);
      } catch (err) {
        console.warn('Cloud sync error deleting folder:', err);
      }
    }
  }

  function handleOpenFolder(folder) {
    setSelectedFolder(folder);
    setSearchQuery('');
    setIsCreatingNote(false);
    setEditingNoteId(null);
    fetchNotesForFolder(folder.id);
  }

  // --- Note Actions ---
  async function handleCreateNote(e) {
    e.preventDefault();
    if (!newNoteTitle.trim()) {
      toast.error('Please provide a note title');
      return;
    }
    if (!newNoteContent.trim()) {
      toast.error('Please enter some content for the note');
      return;
    }

    const newNote = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `note_${Date.now()}`,
      folder_id: selectedFolder.id,
      title: newNoteTitle.trim(),
      content: newNoteContent.trim(),
      created_at: new Date().toISOString()
    };

    // 1. Save locally immediately
    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);

    const allLocalNotes = [newNote, ...getLocalNotes().filter(n => n.id !== newNote.id)];
    saveLocalNotes(allLocalNotes);

    // Update folder note count
    const updatedFolders = folders.map(f => 
      f.id === selectedFolder.id ? { ...f, note_count: (f.note_count || 0) + 1 } : f
    );
    setFolders(updatedFolders);
    saveLocalFolders(updatedFolders);

    setNewNoteTitle('');
    setNewNoteContent('');
    setIsCreatingNote(false);
    toast.success('Sub-note saved! 📄');

    // 2. Background sync to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('notes')
          .insert([{
            id: newNote.id,
            folder_id: newNote.folder_id,
            title: newNote.title,
            content: newNote.content
          }]);
      } catch (err) {
        console.warn('Cloud sync queued locally for note:', err);
      }
    }
  }

  async function handleUpdateNote(noteId) {
    if (!editTitle.trim()) {
      toast.error('Title cannot be empty');
      return;
    }
    if (!editContent.trim()) {
      toast.error('Content cannot be empty');
      return;
    }

    // 1. Update locally
    const updatedNotes = notes.map(n => 
      n.id === noteId ? { ...n, title: editTitle.trim(), content: editContent.trim() } : n
    );
    setNotes(updatedNotes);

    const allLocalNotes = getLocalNotes().map(n => 
      n.id === noteId ? { ...n, title: editTitle.trim(), content: editContent.trim() } : n
    );
    saveLocalNotes(allLocalNotes);
    setEditingNoteId(null);
    toast.success('Note updated!');

    // 2. Background sync update to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('notes')
          .update({
            title: editTitle.trim(),
            content: editContent.trim()
          })
          .eq('id', noteId);
      } catch (err) {
        console.warn('Cloud sync error updating note:', err);
      }
    }
  }

  async function handleDeleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this sub-note?')) return;

    // 1. Delete locally
    const updatedNotes = notes.filter(n => n.id !== noteId);
    setNotes(updatedNotes);

    const allLocalNotes = getLocalNotes().filter(n => n.id !== noteId);
    saveLocalNotes(allLocalNotes);

    // Decrement folder note count
    const updatedFolders = folders.map(f => 
      f.id === selectedFolder.id ? { ...f, note_count: Math.max(0, (f.note_count || 1) - 1) } : f
    );
    setFolders(updatedFolders);
    saveLocalFolders(updatedFolders);

    toast.success('Sub-note deleted');

    // 2. Background sync delete to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('notes')
          .delete()
          .eq('id', noteId);
      } catch (err) {
        console.warn('Cloud sync error deleting note:', err);
      }
    }
  }

  // Copy to Clipboard Action
  const handleCopyText = async (text, title) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied "${title || 'Note'}" text to clipboard! 📋`, {
        style: {
          background: 'var(--card)',
          color: 'var(--foreground)',
          border: '1px solid var(--primary)',
        }
      });
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success(`Copied "${title || 'Note'}" text! 📋`);
    }
  };

  // Filter notes in active folder by search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter(n => 
      (n.title && n.title.toLowerCase().includes(query)) ||
      (n.content && n.content.toLowerCase().includes(query))
    );
  }, [notes, searchQuery]);

  return (
    <main className="animate-enter">
      {/* Storage Mode Status Indicator */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <span style={{
          fontSize: '0.75rem',
          padding: '0.25rem 0.65rem',
          borderRadius: '999px',
          background: isSupabaseConfigured ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)',
          color: isSupabaseConfigured ? '#34d399' : '#c4b5fd',
          border: `1px solid ${isSupabaseConfigured ? 'rgba(16, 185, 129, 0.25)' : 'rgba(139, 92, 246, 0.25)'}`,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem'
        }}>
          <span>{isSupabaseConfigured ? '☁️' : '💾'}</span>
          <span>{isSupabaseConfigured ? (isCloudSyncing ? 'Syncing...' : 'Cloud Synced') : 'Local Storage Active'}</span>
        </span>
      </div>

      {/* ========================================================= */}
      {/* LEVEL 1: ALL FOLDERS VIEW                                 */}
      {/* ========================================================= */}
      {!selectedFolder && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h2 className="text-gradient-accent" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800 }}>Notebooks</h2>
              <p style={{ color: 'var(--muted-foreground)', marginTop: '0.35rem', fontSize: '0.9rem' }}>
                Organize your knowledge, cheat sheets, and protocols into folders.
              </p>
            </div>

            <button
              onClick={() => setIsCreatingFolder(!isCreatingFolder)}
              className="premium-button"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.25rem', borderRadius: '12px', border: 'none',
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
                <line x1="12" y1="10" x2="12" y2="16"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
              </svg>
              {isCreatingFolder ? 'Close' : 'Create Folder'}
            </button>
          </div>

          {/* Folder Creator Form */}
          {isCreatingFolder && (
            <form onSubmit={handleCreateFolder} className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>New Notebook Folder</h3>
              <input
                type="text"
                className="premium-input"
                placeholder="Folder title (e.g. Salesforce, Discipline, Backend Architecture...)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                style={{ width: '100%', padding: '0.9rem 1.1rem', borderRadius: '10px', fontSize: '1rem' }}
              />
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                  style={{
                    padding: '0.75rem 1.25rem', borderRadius: '10px',
                    background: 'transparent', border: '1px solid var(--card-border)',
                    color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 600
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="premium-button"
                  disabled={!newFolderName.trim()}
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  Save Folder
                </button>
              </div>
            </form>
          )}

          {/* Folders List / Grid */}
          {loading && folders.length === 0 && <p style={{ color: 'var(--muted-foreground)' }}>Loading notebook folders...</p>}

          {!loading && folders.length === 0 && !isCreatingFolder && (
            <div className="glass-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.8 }}>📁</div>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '1.2rem', color: 'var(--foreground)' }}>
                No Notebook Folders Yet
              </p>
              <p style={{ margin: '0 0 1.5rem 0', color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
                Create your first folder (like <strong>Salesforce</strong> or <strong>Discipline</strong>) to start storing notes.
              </p>
              <button
                onClick={() => setIsCreatingFolder(true)}
                className="premium-button"
                style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                + Create Your First Folder
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {folders.map((folder, i) => (
              <div
                key={folder.id}
                onClick={() => handleOpenFolder(folder)}
                className="glass-panel"
                style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  animationDelay: `${i * 0.05}s`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--card-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '12px',
                    background: 'rgba(139, 92, 246, 0.12)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--primary)', flexShrink: 0
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      {folder.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                      <span style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        padding: '0.15rem 0.5rem', borderRadius: '6px',
                        fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 600
                      }}>
                        {folder.note_count || 0} {folder.note_count === 1 ? 'sub-note' : 'sub-notes'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(folder.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={(e) => handleDeleteFolder(folder.id, folder.name, e)}
                    title="Delete folder and its notes"
                    style={{
                      background: 'transparent', border: 'none',
                      color: 'var(--muted-foreground)', cursor: 'pointer',
                      padding: '0.5rem', borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>

                  <div style={{ color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* LEVEL 2: INSIDE SPECIFIC FOLDER VIEW                      */}
      {/* ========================================================= */}
      {selectedFolder && (
        <div>
          {/* Breadcrumb / Top Navigation Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <button
              onClick={() => setSelectedFolder(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--card-border)',
                color: 'var(--foreground)',
                padding: '0.5rem 1rem', borderRadius: '999px',
                cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              Back to Folders
            </button>

            <button
              onClick={() => setIsCreatingNote(!isCreatingNote)}
              className="premium-button"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.65rem 1.25rem', borderRadius: '10px', border: 'none',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              {isCreatingNote ? 'Cancel' : 'New Sub-Note'}
            </button>
          </div>

          {/* Folder Header */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>📁</span>
              <h2 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800, color: 'var(--foreground)' }}>
                {selectedFolder.name}
              </h2>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
              {notes.length} {notes.length === 1 ? 'sub-note' : 'sub-notes'} stored in this folder.
            </p>
          </div>

          {/* Search Bar */}
          {notes.length > 0 && (
            <div style={{ position: 'relative', marginBottom: '1.75rem' }}>
              <input
                type="text"
                className="premium-input"
                placeholder={`Search sub-notes inside ${selectedFolder.name}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '0.8rem 1rem 0.8rem 2.5rem',
                  borderRadius: '10px', fontSize: '0.9rem'
                }}
              />
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }}
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          )}

          {/* New Sub-Note Form */}
          {isCreatingNote && (
            <form onSubmit={handleCreateNote} className="glass-panel" style={{
              padding: '1.5rem', marginBottom: '2rem',
              display: 'flex', flexDirection: 'column', gap: '1rem',
              border: '1px solid var(--primary)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                Add Sub-Note to {selectedFolder.name}
              </h3>
              
              <input
                type="text"
                className="premium-input"
                placeholder="Note Title (e.g. Apex Trigger Handler, Morning Routine, Deployment Checklist...)"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                autoFocus
                style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.95rem' }}
              />

              <textarea
                className="premium-input"
                placeholder="Write or copy-paste text, instructions, code snippets, or notes here..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                style={{
                  width: '100%', padding: '1rem', borderRadius: '10px',
                  fontSize: '0.95rem', minHeight: '140px', resize: 'vertical',
                  fontFamily: 'monospace, sans-serif', lineHeight: 1.5
                }}
              />

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setIsCreatingNote(false); setNewNoteTitle(''); setNewNoteContent(''); }}
                  style={{
                    padding: '0.75rem 1.25rem', borderRadius: '10px',
                    background: 'transparent', border: '1px solid var(--card-border)',
                    color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 600
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="premium-button"
                  disabled={!newNoteTitle.trim() || !newNoteContent.trim()}
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  Save Sub-Note
                </button>
              </div>
            </form>
          )}

          {/* Sub-Notes List */}
          {loading && notes.length === 0 && <p style={{ color: 'var(--muted-foreground)' }}>Loading sub-notes...</p>}

          {!loading && filteredNotes.length === 0 && (
            <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.7 }}>📄</div>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '1.1rem', color: 'var(--foreground)' }}>
                {searchQuery ? 'No matching sub-notes found' : 'This folder is empty'}
              </p>
              <p style={{ margin: '0 0 1.25rem 0', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
                {searchQuery ? 'Try a different search query' : `Write or paste your first note into ${selectedFolder.name}.`}
              </p>
              {!searchQuery && !isCreatingNote && (
                <button
                  onClick={() => setIsCreatingNote(true)}
                  className="premium-button"
                  style={{ padding: '0.7rem 1.25rem', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Add First Sub-Note
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredNotes.map((note) => {
              const isEditing = editingNoteId === note.id;
              const dateObj = new Date(note.created_at);
              const dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const timeFormatted = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

              return (
                <div key={note.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
                  {isEditing ? (
                    // Inline Edit Mode
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <input
                        type="text"
                        className="premium-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.95rem' }}
                      />
                      <textarea
                        className="premium-input"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        style={{
                          width: '100%', padding: '0.85rem', borderRadius: '8px',
                          fontSize: '0.9rem', minHeight: '120px', resize: 'vertical',
                          fontFamily: 'monospace, sans-serif'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          style={{
                            padding: '0.5rem 1rem', borderRadius: '8px',
                            background: 'transparent', border: '1px solid var(--card-border)',
                            color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: '0.85rem'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateNote(note.id)}
                          className="premium-button"
                          style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                        >
                          Update Note
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Normal Note Display Mode
                    <>
                      {/* Top Header of Note */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem', gap: '1rem' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--foreground)' }}>
                            {note.title || 'Untitled Note'}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem', display: 'block' }}>
                            {dateFormatted} • {timeFormatted}
                          </span>
                        </div>

                        {/* Edit & Delete Actions */}
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditTitle(note.title || '');
                              setEditContent(note.content || '');
                            }}
                            title="Edit Note"
                            style={{
                              background: 'transparent', border: 'none',
                              color: 'var(--muted-foreground)', cursor: 'pointer',
                              padding: '0.35rem', borderRadius: '6px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            title="Delete Note"
                            style={{
                              background: 'transparent', border: 'none',
                              color: 'var(--muted-foreground)', cursor: 'pointer',
                              padding: '0.35rem', borderRadius: '6px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Content Box (Text / Snippet) */}
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '10px',
                        padding: '1rem',
                        marginBottom: '1rem',
                        maxHeight: '380px',
                        overflowY: 'auto'
                      }}>
                        <pre style={{
                          margin: 0,
                          color: '#e2e8f0',
                          fontSize: '0.88rem',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily: 'var(--font-geist-mono), monospace'
                        }}>
                          {note.content}
                        </pre>
                      </div>

                      {/* Footer Toolbar: Dedicated One-Click "Copy Text" button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          onClick={() => handleCopyText(note.content, note.title)}
                          style={{
                            background: 'rgba(139, 92, 246, 0.12)',
                            border: '1px solid rgba(139, 92, 246, 0.35)',
                            color: '#c4b5fd',
                            padding: '0.55rem 1rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--primary)';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.boxShadow = '0 0 14px var(--primary-glow)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.12)';
                            e.currentTarget.style.color = '#c4b5fd';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                          </svg>
                          Copy Text
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
