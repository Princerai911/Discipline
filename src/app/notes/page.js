"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import toast from 'react-hot-toast';

const STORAGE_FOLDERS_KEY = 'discipline_notebook_folders';
const STORAGE_NOTES_KEY = 'discipline_notebook_notes';
const STORAGE_ACTIVE_NOTE_KEY = 'discipline_active_note_id';
const STORAGE_SELECTED_FOLDER_KEY = 'discipline_selected_folder_id';

export default function NotesNotebookPage() {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null); // null = Folder Directory View, or folder.id = Notepad View
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Active note in Notepad
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [activeContent, setActiveContent] = useState('');
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [notepadSize, setNotepadSize] = useState('standard'); // 'compact', 'standard', 'wide', 'full'

  // Text stats
  const [stats, setStats] = useState({ line: 1, col: 1, chars: 0, words: 0 });

  // New folder modal
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Sub-notes sidebar state
  const [subNoteSearch, setSubNoteSearch] = useState('');
  const [mobileSubNotesView, setMobileSubNotesView] = useState('editor'); // 'list' | 'editor'

  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Local Storage Helpers
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

  const getLocalNotes = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_NOTES_KEY) || '[]');
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

  // Update line/col/char stats
  const updateStats = (text, cursorPos = 0) => {
    if (!text) {
      setStats({ line: 1, col: 1, chars: 0, words: 0 });
      return;
    }
    const textUpToCursor = text.substring(0, cursorPos);
    const lines = textUpToCursor.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    const chars = text.length;
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    setStats({ line, col, chars, words });
  };

  // Safely activate a note
  const activateNote = (note) => {
    if (!note) {
      setActiveNoteId(null);
      setActiveTitle('');
      setActiveContent('');
      setActiveFolderId(null);
      updateStats('');
      return;
    }
    setActiveNoteId(note.id);
    setActiveTitle(note.title || 'Untitled');
    setActiveContent(note.content || '');
    setActiveFolderId(note.folder_id || null);
    updateStats(note.content || '', (note.content || '').length);
    localStorage.setItem(STORAGE_ACTIVE_NOTE_KEY, note.id);
  };

  // Fetch all folders and notes
  const fetchAllData = useCallback(async () => {
    setLoading(true);

    const localF = getLocalFolders();
    const localN = getLocalNotes();
    if (localF.length > 0) setFolders(localF);
    if (localN.length > 0) setNotes(localN);

    // Initial folder selection starts on folder directory (null) as requested
    setSelectedFolderId(null);

    const storedActiveId = localStorage.getItem(STORAGE_ACTIVE_NOTE_KEY);
    const initialNote = localN.find(n => n.id === storedActiveId) || localN[0] || null;
    if (initialNote) {
      activateNote(initialNote);
    }

    if (isSupabaseConfigured) {
      setIsCloudSyncing(true);
      try {
        const [foldersRes, notesRes] = await Promise.all([
          supabase.from('notebook_folders').select('*').order('created_at', { ascending: false }),
          supabase.from('notes').select('*').order('created_at', { ascending: false })
        ]);

        if (foldersRes.data && foldersRes.data.length > 0) {
          setFolders(foldersRes.data);
          saveLocalFolders(foldersRes.data);
        }

        if (notesRes.data && notesRes.data.length > 0) {
          setNotes(notesRes.data);
          saveLocalNotes(notesRes.data);

          const targetNote = notesRes.data.find(n => n.id === storedActiveId) || notesRes.data[0];
          if (targetNote) {
            activateNote(targetNote);
          }
        }
      } catch (err) {
        console.warn('Supabase fetch error, using local data:', err);
      } finally {
        setIsCloudSyncing(false);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Notes belonging to the selected folder
  const folderNotes = useMemo(() => {
    if (!selectedFolderId) return [];
    return notes.filter(n => n.folder_id === selectedFolderId);
  }, [notes, selectedFolderId]);

  // Filtered sub-notes based on search
  const filteredFolderNotes = useMemo(() => {
    if (!subNoteSearch.trim()) return folderNotes;
    const q = subNoteSearch.toLowerCase();
    return folderNotes.filter(n =>
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.content && n.content.toLowerCase().includes(q))
    );
  }, [folderNotes, subNoteSearch]);

  // Active folder object
  const currentFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return folders.find(f => f.id === selectedFolderId) || null;
  }, [folders, selectedFolderId]);

  // Handle selecting a folder (null = directory view, string = open folder notepad)
  const handleSelectFolder = (folderId) => {
    setSelectedFolderId(folderId);
    setMobileSubNotesView('editor');
    if (folderId) {
      localStorage.setItem(STORAGE_SELECTED_FOLDER_KEY, folderId);
      const subNotes = notes.filter(n => n.folder_id === folderId);
      if (subNotes.length > 0) {
        const alreadyActiveInFolder = subNotes.find(n => n.id === activeNoteId);
        activateNote(alreadyActiveInFolder || subNotes[0]);
      } else {
        setActiveNoteId(null);
        setActiveTitle('');
        setActiveContent('');
        setActiveFolderId(folderId);
        updateStats('');
      }
    } else {
      localStorage.removeItem(STORAGE_SELECTED_FOLDER_KEY);
      setActiveNoteId(null);
      setActiveTitle('');
      setActiveContent('');
      setActiveFolderId(null);
      updateStats('');
    }
  };

  // Immediate save helper
  const saveImmediately = (noteId, title, content, folderId) => {
    const updated = notes.map(n => n.id === noteId ? { ...n, title, content, folder_id: folderId } : n);
    setNotes(updated);
    saveLocalNotes(updated);

    if (isSupabaseConfigured) {
      supabase.from('notes').update({ title, content, folder_id: folderId }).eq('id', noteId).then();
    }
    setSaveStatus('Saved');
  };

  // Content change with auto-save
  const handleContentChange = (e) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    setActiveContent(newContent);
    updateStats(newContent, cursorPos);
    setSaveStatus('Saving...');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (activeNoteId) {
        saveImmediately(activeNoteId, activeTitle, newContent, activeFolderId);
      }
    }, 350);
  };

  // Title change
  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setActiveTitle(newTitle);
    setSaveStatus('Saving...');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (activeNoteId) {
        saveImmediately(activeNoteId, newTitle, activeContent, activeFolderId);
      }
    }, 350);
  };

  // Re-assign sub-note to a different folder
  const handleChangeNoteFolder = (targetFolderId) => {
    setActiveFolderId(targetFolderId);
    if (activeNoteId) {
      saveImmediately(activeNoteId, activeTitle, activeContent, targetFolderId);
      const targetFolder = folders.find(f => f.id === targetFolderId);
      toast.success(`Moved to folder "${targetFolder ? targetFolder.name : 'Unassigned'}"`);
    }
  };

  // Add New Sub-Note inside the currently selected folder
  const handleAddSubNote = async (targetFolderId = null) => {
    const folderToUse = targetFolderId || selectedFolderId || (folders[0]?.id || null);
    if (!folderToUse) {
      toast.error('Please create or select a folder first!');
      setIsCreatingFolder(true);
      return;
    }
    const folderObj = folders.find(f => f.id === folderToUse);
    const folderLabel = folderObj ? folderObj.name : 'Folder';

    const countInFolder = notes.filter(n => n.folder_id === folderToUse).length;
    const title = prompt(`Enter title for new sub-note in folder "${folderLabel}":`, `Sub-note ${countInFolder + 1}`);
    if (!title || !title.trim()) return;

    const newNote = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `note_${Date.now()}`,
      folder_id: folderToUse,
      title: title.trim(),
      content: '',
      created_at: new Date().toISOString()
    };

    const updated = [newNote, ...notes];
    setNotes(updated);
    saveLocalNotes(updated);

    if (selectedFolderId !== folderToUse) {
      setSelectedFolderId(folderToUse);
      localStorage.setItem(STORAGE_SELECTED_FOLDER_KEY, folderToUse);
    }

    activateNote(newNote);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('notes').insert([{
          id: newNote.id,
          folder_id: newNote.folder_id,
          title: newNote.title,
          content: ''
        }]);
      } catch (err) {
        console.warn('Cloud sync error creating sub-note:', err);
      }
    }

    toast.success(`Sub-note "${newNote.title}" created in ${folderLabel}! 📝`);
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.focus();
    }, 50);
  };

  // Close / Delete Tab
  const handleDeleteNote = async (noteId, title, e) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    const updated = notes.filter(n => n.id !== noteId);
    setNotes(updated);
    saveLocalNotes(updated);

    if (activeNoteId === noteId) {
      const remainingFolderNotes = updated.filter(n => n.folder_id === selectedFolderId);
      activateNote(remainingFolderNotes[0] || null);
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('notes').delete().eq('id', noteId);
      } catch (err) {
        console.warn('Cloud delete error:', err);
      }
    }
    toast.success('Sub-note deleted');
  };

  // Create New Folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newFolder = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `folder_${Date.now()}`,
      name: newFolderName.trim(),
      created_at: new Date().toISOString()
    };

    const updated = [newFolder, ...folders];
    setFolders(updated);
    saveLocalFolders(updated);
    setNewFolderName('');
    setIsCreatingFolder(false);
    toast.success(`Folder "${newFolder.name}" created! 📁`);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('notebook_folders').insert([{ id: newFolder.id, name: newFolder.name }]);
      } catch (err) {
        console.warn('Cloud folder insert error:', err);
      }
    }

    // Immediately open this newly created folder into its Notepad
    handleSelectFolder(newFolder.id);
  };

  // Delete Folder
  const handleDeleteFolder = async (folderId, folderName, e) => {
    if (e) e.stopPropagation();
    if (!confirm(`Delete folder "${folderName}" and all its sub-notes?`)) return;

    const updatedFolders = folders.filter(f => f.id !== folderId);
    setFolders(updatedFolders);
    saveLocalFolders(updatedFolders);

    const updatedNotes = notes.filter(n => n.folder_id !== folderId);
    setNotes(updatedNotes);
    saveLocalNotes(updatedNotes);

    if (selectedFolderId === folderId) {
      handleSelectFolder(null);
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('notebook_folders').delete().eq('id', folderId);
      } catch (err) {
        console.warn('Cloud folder delete error:', err);
      }
    }
    toast.success(`Folder "${folderName}" deleted`);
  };

  // Formatting helpers
  const insertFormatting = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = activeContent.substring(start, end);
    const replacement = prefix + selected + suffix;

    const nextContent = activeContent.substring(0, start) + replacement + activeContent.substring(end);
    setActiveContent(nextContent);
    updateStats(nextContent, start + prefix.length);
    saveImmediately(activeNoteId, activeTitle, nextContent, activeFolderId);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 50);
  };

  // Copy active text
  const handleCopyText = async () => {
    if (!activeContent) {
      toast.error('Note is empty');
      return;
    }
    try {
      await navigator.clipboard.writeText(activeContent);
      toast.success('Note copied to clipboard! 📋');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = activeContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast.success('Note copied! 📋');
    }
  };

  // Pop-Out Window for Zoom / YouTube
  const handlePopOutWindow = () => {
    const width = 540;
    const height = 660;
    const left = window.screen.width - width - 40;
    const top = 60;
    window.open(
      '/notes/float',
      'DisciplineNotepadFloating',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`
    );
  };

  const getNotepadWidth = () => {
    if (notepadSize === 'compact') return '540px';
    if (notepadSize === 'standard') return '860px';
    if (notepadSize === 'wide') return '1100px';
    return '100%';
  };

  return (
    <main className="animate-enter" style={{ width: '100%' }}>
      
      {/* ============================================================== */}
      {/* 1. TOP HEADER (DYNAMIC: DIRECTORY VS INSIDE FOLDER)            */}
      {/* ============================================================== */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.75rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Title or Breadcrumb */}
        <div>
          {!selectedFolderId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '2rem' }}>📁</span>
              <div>
                <h2 className="text-gradient-accent" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 900, letterSpacing: '-0.5px' }}>
                  Notebooks & Folders
                </h2>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--muted-foreground)', fontSize: '0.88rem' }}>
                  Select a notebook folder below to open its notepad and write sub-notes.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleSelectFolder(null)}
                className="premium-button-secondary"
                title="Back to All Folders"
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: '#0f172a'
                }}
              >
                <span>←</span>
                <span>All Folders</span>
              </button>

              <span style={{ color: '#cbd5e1', fontSize: '1.1rem' }}>/</span>

              {/* Folder Selector Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '1.35rem' }}>📁</span>
                <select
                  value={selectedFolderId}
                  onChange={(e) => handleSelectFolder(e.target.value)}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1d4ed8',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 800,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>📁 {f.name}</option>
                  ))}
                </select>

                <span style={{
                  fontSize: '0.75rem',
                  background: '#f1f5f9',
                  color: '#64748b',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '999px',
                  fontWeight: 700
                }}>
                  {folderNotes.length} {folderNotes.length === 1 ? 'sub-note' : 'sub-notes'}
                </span>

                {/* Mobile Toggle Button */}
                <button
                  onClick={() => setMobileSubNotesView(v => v === 'list' ? 'editor' : 'list')}
                  className="mobile-only"
                  style={{
                    background: mobileSubNotesView === 'list' ? '#2563eb' : '#eff6ff',
                    color: mobileSubNotesView === 'list' ? '#ffffff' : '#2563eb',
                    border: '1px solid #bfdbfe',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {mobileSubNotesView === 'list' ? '📝 Editor' : `📋 Sub-Notes (${folderNotes.length})`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {!selectedFolderId && (
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="premium-button"
              title="Create a new notebook folder (e.g. prince, rohit, paragi)"
              style={{
                padding: '0.6rem 1.15rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 800
              }}
            >
              <span>+</span>
              <span>New Folder</span>
            </button>
          )}

          {selectedFolderId && (
            <button
              onClick={() => handleAddSubNote(selectedFolderId)}
              className="premium-button"
              title={`Add new sub-note in folder "${currentFolder?.name}"`}
              style={{
                padding: '0.55rem 1.15rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 800
              }}
            >
              <span>+</span>
              <span>Add Sub-Note</span>
            </button>
          )}

          {selectedFolderId && (
            <button
              onClick={handlePopOutWindow}
              className="desktop-only premium-button-secondary"
              title="Pop out standalone floating notepad to keep over Zoom calls or YouTube"
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              <span>Float Over Screen</span>
            </button>
          )}

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
            <span>{isSupabaseConfigured ? (isCloudSyncing ? 'Syncing...' : 'Cloud Synced') : 'Local Storage'}</span>
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. STAGE 1: FOLDER DIRECTORY (FIRST SHOW THE FOLDERS)           */}
      {/* ============================================================== */}
      {!selectedFolderId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          
          {/* Create New Folder Inline Card */}
          {isCreatingFolder && (
            <form onSubmit={handleCreateFolder} className="glass-panel" style={{
              padding: '1.5rem 1.75rem',
              borderRadius: '16px',
              border: '2px solid #2563eb',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 10px 28px rgba(37, 99, 235, 0.12)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>📁</span>
                <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  Create New Notebook Folder
                </h4>
              </div>
              <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
                Enter a folder name (e.g. <strong>prince</strong>, <strong>rohit</strong>, <strong>paragi</strong>, or <strong>salesforce</strong>):
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="premium-input"
                  placeholder="Folder name (e.g. prince, rohit, paragi...)"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  autoFocus
                  style={{ flex: 1, minWidth: '220px', padding: '0.75rem 1rem', fontSize: '0.95rem' }}
                />
                <button
                  type="submit"
                  className="premium-button"
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '10px' }}
                >
                  Create & Open
                </button>
                <button
                  type="button"
                  onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                  className="premium-button-secondary"
                  style={{ padding: '0.75rem 1.25rem', borderRadius: '10px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Folders Cards Grid */}
          {folders.length === 0 ? (
            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: '16px', background: '#ffffff' }}>
              <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '1rem' }}>📁</span>
              <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '1.35rem', color: '#0f172a' }}>
                No Notebook Folders Created Yet
              </h3>
              <p style={{ margin: '0 0 1.5rem 0', color: 'var(--muted-foreground)', fontSize: '0.92rem' }}>
                Create your first folder like &quot;prince&quot;, &quot;rohit&quot;, or &quot;paragi&quot; to open the notepad and write sub-notes.
              </p>
              <button
                onClick={() => setIsCreatingFolder(true)}
                className="premium-button"
                style={{ padding: '0.75rem 1.75rem', borderRadius: '10px' }}
              >
                + Create Your First Folder
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
              gap: '1.35rem'
            }}>
              {folders.map(folder => {
                const subNotes = notes.filter(n => n.folder_id === folder.id);
                return (
                  <div
                    key={folder.id}
                    onClick={() => handleSelectFolder(folder.id)}
                    className="glass-panel"
                    style={{
                      padding: '1.5rem',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '200px',
                      position: 'relative',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.borderColor = '#93c5fd';
                      e.currentTarget.style.boxShadow = '0 12px 28px rgba(37, 99, 235, 0.12)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.04)';
                    }}
                  >
                    <div>
                      {/* Folder Card Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.6rem'
                        }}>
                          📁
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            background: '#f1f5f9',
                            color: '#2563eb',
                            fontWeight: 700,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            border: '1px solid #e2e8f0'
                          }}>
                            {subNotes.length} {subNotes.length === 1 ? 'sub-note' : 'sub-notes'}
                          </span>
                          <button
                            onClick={(e) => handleDeleteFolder(folder.id, folder.name, e)}
                            title={`Delete folder "${folder.name}"`}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '0.2rem 0.45rem',
                              borderRadius: '6px',
                              fontSize: '1.2rem',
                              lineHeight: 1
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {/* Folder Title */}
                      <h3 style={{
                        margin: '1.1rem 0 0.35rem 0',
                        fontSize: '1.3rem',
                        fontWeight: 800,
                        color: '#0f172a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {folder.name}
                      </h3>

                      {/* Sub-notes preview snippet */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.65rem' }}>
                        {subNotes.length === 0 ? (
                          <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            Empty folder — click to start writing
                          </span>
                        ) : (
                          subNotes.slice(0, 3).map(sn => (
                            <span key={sn.id} style={{
                              fontSize: '0.8rem',
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}>
                              <span style={{ fontSize: '0.85rem' }}>📄</span>
                              <span>{sn.title || 'Untitled'}</span>
                            </span>
                          ))
                        )}
                        {subNotes.length > 3 && (
                          <span style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 700 }}>
                            +{subNotes.length - 3} more sub-notes...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Bottom CTA */}
                    <div style={{
                      marginTop: '1.25rem',
                      paddingTop: '0.85rem',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: '#2563eb',
                      fontSize: '0.85rem',
                      fontWeight: 800
                    }}>
                      <span>Open Folder & Notepad</span>
                      <span>→</span>
                    </div>
                  </div>
                );
              })}

              {/* Add New Folder Card Button */}
              <div
                onClick={() => setIsCreatingFolder(true)}
                style={{
                  borderRadius: '16px',
                  border: '2px dashed #cbd5e1',
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem 1.5rem',
                  cursor: 'pointer',
                  minHeight: '200px',
                  transition: 'all 0.2s ease',
                  color: '#64748b'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.background = '#eff6ff';
                  e.currentTarget.style.color = '#2563eb';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                <span style={{ fontSize: '2.2rem', marginBottom: '0.35rem' }}>+</span>
                <span style={{ fontWeight: 800, fontSize: '1rem' }}>Add New Folder</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.2rem' }}>e.g. prince, rohit, paragi</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. STAGE 2: NOTEPAD SHOWS FOR SELECTED FOLDER                   */}
      {/* ============================================================== */}
      {selectedFolderId && (
        <div
          className="glass-panel subnotes-workspace-container"
          style={{
            width: '100%',
            maxWidth: getNotepadWidth(),
            margin: '0 auto',
            minHeight: '720px',
            height: '750px',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
            overflow: 'hidden',
            background: '#ffffff',
            position: 'relative'
          }}
        >
          {/* ========================================================== */}
          {/* LEFT SIDEBAR: SUB-NOTES LIST (TITLES & PREVIEWS)           */}
          {/* ========================================================== */}
          <div
            className={`subnotes-sidebar ${mobileSubNotesView === 'list' ? 'mobile-visible' : 'mobile-hidden'}`}
            style={{
              width: '280px',
              minWidth: '260px',
              maxWidth: '320px',
              background: '#f8fafc',
              borderRight: '1px solid #e2e8f0',
              flexDirection: 'column',
              flexShrink: 0
            }}
          >
            {/* Sidebar Top Header */}
            <div style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '1.1rem' }}>📁</span>
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                  {currentFolder ? currentFolder.name : 'Folder'}
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  background: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  fontWeight: 700
                }}>
                  {folderNotes.length}
                </span>
              </div>

              {/* Add Sub-note Button in Sidebar */}
              <button
                onClick={() => handleAddSubNote(selectedFolderId)}
                title="Create new sub-note"
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
                }}
              >
                <span>+</span>
                <span>Note</span>
              </button>
            </div>

            {/* Search Filter for Sub-notes */}
            {folderNotes.length > 2 && (
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  padding: '0.3rem 0.6rem',
                  gap: '0.4rem'
                }}>
                  <span style={{ fontSize: '0.78rem', opacity: 0.6 }}>🔍</span>
                  <input
                    type="text"
                    value={subNoteSearch}
                    onChange={e => setSubNoteSearch(e.target.value)}
                    placeholder="Search sub-notes..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: '0.8rem',
                      color: '#0f172a',
                      width: '100%'
                    }}
                  />
                  {subNoteSearch && (
                    <button
                      onClick={() => setSubNoteSearch('')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem', padding: 0 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Sub-Notes Vertical List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.65rem 0.6rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}>
              {folderNotes.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
                  <span style={{ fontSize: '2.2rem', display: 'block', marginBottom: '0.5rem' }}>📄</span>
                  <p style={{ fontSize: '0.85rem', margin: '0 0 0.85rem 0', fontWeight: 600 }}>
                    No sub-notes in this folder yet
                  </p>
                  <button
                    onClick={() => handleAddSubNote(selectedFolderId)}
                    className="premium-button"
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', borderRadius: '8px' }}
                  >
                    + Add First Sub-Note
                  </button>
                </div>
              ) : filteredFolderNotes.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                  No sub-notes match &quot;{subNoteSearch}&quot;
                </div>
              ) : (
                filteredFolderNotes.map((note) => {
                  const isActive = activeNoteId === note.id;
                  const snippet = (note.content || '').trim().replace(/\n/g, ' ').slice(0, 50);

                  return (
                    <div
                      key={note.id}
                      onClick={() => {
                        activateNote(note);
                        setMobileSubNotesView('editor');
                      }}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '10px',
                        background: isActive ? '#ffffff' : 'transparent',
                        border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                        borderLeft: isActive ? '4px solid #2563eb' : '4px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.08)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem'
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                        }
                      }}
                    >
                      {/* Sub-note Title Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>📄</span>
                          <span style={{
                            fontSize: '0.86rem',
                            fontWeight: isActive ? 800 : 600,
                            color: isActive ? '#1d4ed8' : '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {note.title || 'Untitled'}
                          </span>
                        </div>

                        {/* Delete Sub-Note */}
                        <button
                          onClick={(e) => handleDeleteNote(note.id, note.title, e)}
                          title="Delete sub-note"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            fontSize: '0.9rem',
                            lineHeight: 1,
                            borderRadius: '4px',
                            flexShrink: 0
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                        >
                          ×
                        </button>
                      </div>

                      {/* Snippet Preview */}
                      <div style={{
                        fontSize: '0.74rem',
                        color: isActive ? '#3b82f6' : '#64748b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        paddingLeft: '1.3rem'
                      }}>
                        {snippet || 'Empty note...'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom button to Add Sub-note */}
            {folderNotes.length > 0 && (
              <div style={{ padding: '0.6rem 0.75rem', borderTop: '1px solid #e2e8f0', background: '#ffffff' }}>
                <button
                  onClick={() => handleAddSubNote(selectedFolderId)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#eff6ff',
                    border: '1px dashed #bfdbfe',
                    borderRadius: '8px',
                    color: '#2563eb',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
                  onMouseLeave={e => e.currentTarget.style.background = '#eff6ff'}
                >
                  <span>+</span>
                  <span>Add Sub-Note</span>
                </button>
              </div>
            )}
          </div>

          {/* ========================================================== */}
          {/* RIGHT SIDE: NOTEPAD EDITOR CANVAS                          */}
          {/* ========================================================== */}
          <div
            className={`subnotes-editor-pane ${mobileSubNotesView === 'editor' ? 'mobile-visible' : 'mobile-hidden'}`}
            style={{
              flex: 1,
              flexDirection: 'column',
              minWidth: 0,
              background: '#ffffff'
            }}
          >
            {/* Notepad Editor Toolbar (Title & Tools) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.55rem 1rem',
              background: '#ffffff',
              borderBottom: '1px solid #f1f5f9',
              gap: '0.75rem',
              flexShrink: 0,
              flexWrap: 'wrap'
            }}>
              {/* Note Title & Folder Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '220px' }}>
                {/* Mobile Button to View Sub-Notes Sidebar */}
                <button
                  onClick={() => setMobileSubNotesView('list')}
                  className="mobile-only"
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ← Notes ({folderNotes.length})
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Folder:
                  </span>
                  <select
                    value={activeFolderId || selectedFolderId || ''}
                    onChange={(e) => handleChangeNoteFolder(e.target.value || null)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>📁 {f.name}</option>
                    ))}
                  </select>
                </div>

                <span style={{ color: '#cbd5e1' }}>|</span>

                {/* Sub-note Title Input */}
                <input
                  type="text"
                  value={activeTitle}
                  onChange={handleTitleChange}
                  placeholder="Sub-note Title..."
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#0f172a',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    flex: 1,
                    minWidth: '120px'
                  }}
                />

                <span style={{
                  fontSize: '0.7rem',
                  color: saveStatus === 'Saved' ? '#059669' : '#d97706',
                  background: saveStatus === 'Saved' ? '#ecfdf5' : '#fef3c7',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px',
                  fontWeight: 700
                }}>
                  {saveStatus}
                </span>
              </div>

              {/* Quick Formatting Tools */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => insertFormatting('# ')}
                  title="Heading 1"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  H1
                </button>
                <button
                  onClick={() => insertFormatting('**', '**')}
                  title="Bold"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  B
                </button>
                <button
                  onClick={() => insertFormatting('- ')}
                  title="Bullet List"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  • List
                </button>
                <button
                  onClick={() => insertFormatting('- [ ] ')}
                  title="Checkbox Todo"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  [✓] Todo
                </button>
                <button
                  onClick={() => insertFormatting('```\n', '\n```')}
                  title="Code Block"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  &lt;/&gt;
                </button>

                {/* One-Click Copy */}
                <button
                  onClick={handleCopyText}
                  className="premium-button"
                  title="Copy All Text to Clipboard"
                  style={{
                    padding: '3px 10px',
                    borderRadius: '5px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb'
                  }}
                >
                  📋 Copy
                </button>

                {/* Size Presets */}
                <div style={{
                  display: 'flex',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  padding: '2px',
                  marginLeft: '0.4rem',
                  border: '1px solid #e2e8f0'
                }}>
                  <button onClick={() => setNotepadSize('compact')} style={{ background: notepadSize === 'compact' ? '#2563eb' : 'transparent', border: 'none', color: notepadSize === 'compact' ? '#ffffff' : '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>S</button>
                  <button onClick={() => setNotepadSize('standard')} style={{ background: notepadSize === 'standard' ? '#2563eb' : 'transparent', border: 'none', color: notepadSize === 'standard' ? '#ffffff' : '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>M</button>
                  <button onClick={() => setNotepadSize('wide')} style={{ background: notepadSize === 'wide' ? '#2563eb' : 'transparent', border: 'none', color: notepadSize === 'wide' ? '#ffffff' : '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>L</button>
                  <button onClick={() => setNotepadSize('full')} style={{ background: notepadSize === 'full' ? '#2563eb' : 'transparent', border: 'none', color: notepadSize === 'full' ? '#ffffff' : '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Max</button>
                </div>
              </div>
            </div>

            {/* Main Editor Textarea */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {activeNoteId ? (
                <textarea
                  ref={textareaRef}
                  value={activeContent}
                  onChange={handleContentChange}
                  onKeyUp={(e) => updateStats(activeContent, e.target.selectionStart)}
                  onClick={(e) => updateStats(activeContent, e.target.selectionStart)}
                  placeholder={`Write sub-note text for ${activeTitle || 'this note'}... Type or paste directly.`}
                  style={{
                    flex: 1,
                    width: '100%',
                    height: '100%',
                    background: '#ffffff',
                    border: 'none',
                    outline: 'none',
                    color: '#0f172a',
                    fontFamily: 'var(--font-geist-mono), Consolas, "Courier New", monospace',
                    fontSize: '0.94rem',
                    lineHeight: 1.65,
                    padding: '1.25rem',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem',
                  textAlign: 'center'
                }}>
                  <span style={{ fontSize: '3rem', opacity: 0.6, marginBottom: '0.75rem' }}>📝</span>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '1.25rem', color: '#0f172a' }}>
                    No Sub-Note Selected in {currentFolder ? currentFolder.name : 'this folder'}
                  </h3>
                  <p style={{ margin: '0 0 1.5rem 0', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
                    Select a sub-note from the left side, or create a new one below.
                  </p>
                  <button
                    onClick={() => handleAddSubNote(selectedFolderId)}
                    className="premium-button"
                    style={{ padding: '0.75rem 1.5rem', borderRadius: '12px' }}
                  >
                    + Create Sub-Note in {currentFolder?.name || 'Folder'}
                  </button>
                </div>
              )}
            </div>

            {/* Footer Status Bar */}
            <div style={{
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              padding: '0.4rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.72rem',
              color: 'var(--muted-foreground)',
              fontWeight: 600,
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <span>Ln {stats.line}, Col {stats.col}</span>
                <span>{stats.chars} characters</span>
                <span>{stats.words} words</span>
              </div>

              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <span>Folder: <strong style={{ color: '#0f172a' }}>{currentFolder ? currentFolder.name : 'Folder'}</strong></span>
                <span>UTF-8</span>
                <span style={{ color: saveStatus === 'Saved' ? '#059669' : '#d97706', fontWeight: 700 }}>
                  {saveStatus} ✓
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
