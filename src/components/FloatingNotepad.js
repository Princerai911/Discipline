"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import toast from 'react-hot-toast';

const STORAGE_NOTES_KEY = 'discipline_notebook_notes';
const STORAGE_FOLDERS_KEY = 'discipline_notebook_folders';
const STORAGE_OPEN_TABS_KEY = 'discipline_notepad_open_tabs';
const STORAGE_ACTIVE_TAB_KEY = 'discipline_notepad_active_tab';

export default function FloatingNotepad() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [sizePreset, setSizePreset] = useState('medium');
  const [customSize, setCustomSize] = useState({ width: 540, height: 580 });
  
  // Folders & Notes state
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [openTabIds, setOpenTabIds] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [activeContent, setActiveContent] = useState('');
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('Saved');
  
  // Text stats
  const [stats, setStats] = useState({ lines: 1, words: 0, chars: 0 });

  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Load folders & notes
  const loadData = useCallback(async () => {
    try {
      const localF = JSON.parse(localStorage.getItem(STORAGE_FOLDERS_KEY) || '[]');
      const localNotes = JSON.parse(localStorage.getItem(STORAGE_NOTES_KEY) || '[]');
      let storedOpenTabs = JSON.parse(localStorage.getItem(STORAGE_OPEN_TABS_KEY) || '[]');
      let storedActiveId = localStorage.getItem(STORAGE_ACTIVE_TAB_KEY);

      if (localF.length > 0) setFolders(localF);
      if (localNotes.length > 0) {
        setNotes(localNotes);
        if (storedOpenTabs.length === 0) {
          storedOpenTabs = localNotes.map(n => n.id);
        }
        if (!storedActiveId || !localNotes.some(n => n.id === storedActiveId)) {
          storedActiveId = storedOpenTabs[0] || localNotes[0].id;
        }
      }

      setOpenTabIds(storedOpenTabs);
      setActiveNoteId(storedActiveId);

      const activeNote = (localNotes.length > 0 ? localNotes : []).find(n => n.id === storedActiveId);
      if (activeNote) {
        setActiveTitle(activeNote.title || 'Untitled');
        setActiveContent(activeNote.content || '');
        setActiveFolderId(activeNote.folder_id || null);
        updateStats(activeNote.content || '');
      }

      if (isSupabaseConfigured) {
        const [fRes, nRes] = await Promise.all([
          supabase.from('notebook_folders').select('*').order('created_at', { ascending: false }),
          supabase.from('notes').select('*').order('created_at', { ascending: false })
        ]);
        if (fRes.data) setFolders(fRes.data);
        if (nRes.data && nRes.data.length > 0) {
          setNotes(nRes.data);
          const activeSup = nRes.data.find(n => n.id === storedActiveId) || nRes.data[0];
          if (activeSup) {
            setActiveNoteId(activeSup.id);
            setActiveTitle(activeSup.title || 'Untitled');
            setActiveContent(activeSup.content || '');
            setActiveFolderId(activeSup.folder_id || null);
            updateStats(activeSup.content || '');
          }
        }
      }
    } catch (e) {
      console.error('Failed to load notes in floating notepad:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.altKey && e.key.toLowerCase() === 'n') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const updateStats = (text) => {
    const lines = text ? text.split('\n').length : 1;
    const trimmed = text ? text.trim() : '';
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text ? text.length : 0;
    setStats({ lines, words, chars });
  };

  const handleSelectTab = (noteId) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setActiveNoteId(note.id);
      setActiveTitle(note.title || 'Untitled');
      setActiveContent(note.content || '');
      setActiveFolderId(note.folder_id || null);
      updateStats(note.content || '');
      localStorage.setItem(STORAGE_ACTIVE_TAB_KEY, note.id);
    }
  };

  const handleAddNewTab = () => {
    const currentFolder = folders.find(f => f.id === activeFolderId);
    const folderName = currentFolder ? currentFolder.name : 'Unfiled';
    const title = prompt(`Enter title for new sub-note in "${folderName}":`, `Sub-note ${notes.length + 1}`);
    if (!title || !title.trim()) return;

    const newNote = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `note_${Date.now()}`,
      folder_id: activeFolderId,
      title: title.trim(),
      content: '',
      created_at: new Date().toISOString()
    };

    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(updatedNotes));

    const updatedTabs = [...openTabIds, newNote.id];
    setOpenTabIds(updatedTabs);
    localStorage.setItem(STORAGE_OPEN_TABS_KEY, JSON.stringify(updatedTabs));

    setActiveNoteId(newNote.id);
    setActiveTitle(newNote.title);
    setActiveContent('');
    setActiveFolderId(newNote.folder_id);
    updateStats('');
    localStorage.setItem(STORAGE_ACTIVE_TAB_KEY, newNote.id);

    if (isSupabaseConfigured) {
      supabase.from('notes').insert([{ id: newNote.id, folder_id: newNote.folder_id, title: newNote.title, content: '' }]).then();
    }
    toast.success(`Tab "${newNote.title}" created!`);
  };

  const handleCloseTab = (tabId, e) => {
    e.stopPropagation();
    const updatedTabs = openTabIds.filter(id => id !== tabId);
    setOpenTabIds(updatedTabs);
    localStorage.setItem(STORAGE_OPEN_TABS_KEY, JSON.stringify(updatedTabs));

    if (activeNoteId === tabId) {
      const nextId = updatedTabs[updatedTabs.length - 1] || null;
      if (nextId) {
        handleSelectTab(nextId);
      } else {
        setActiveNoteId(null);
        setActiveTitle('');
        setActiveContent('');
        setActiveFolderId(null);
      }
    }
  };

  const saveImmediately = (noteId, title, content, folderId) => {
    const updated = notes.map(n => n.id === noteId ? { ...n, title, content, folder_id: folderId } : n);
    setNotes(updated);
    localStorage.setItem(STORAGE_NOTES_KEY, JSON.stringify(updated));

    if (isSupabaseConfigured) {
      supabase.from('notes').update({ title, content, folder_id: folderId }).eq('id', noteId).then();
    }
    setSaveStatus('Saved');
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setActiveContent(newContent);
    updateStats(newContent);
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

  const handleChangeFolder = (targetFolderId) => {
    setActiveFolderId(targetFolderId);
    if (activeNoteId) {
      saveImmediately(activeNoteId, activeTitle, activeContent, targetFolderId);
      toast.success('Folder updated');
    }
  };

  const insertFormatting = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = activeContent.substring(start, end);
    const replacement = prefix + selected + suffix;

    const nextContent = activeContent.substring(0, start) + replacement + activeContent.substring(end);
    setActiveContent(nextContent);
    updateStats(nextContent);
    saveImmediately(activeNoteId, activeTitle, nextContent, activeFolderId);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 50);
  };

  const handleCopyNote = async () => {
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

  const getDimensions = () => {
    if (sizePreset === 'small') return { width: '400px', height: '460px' };
    if (sizePreset === 'medium') return { width: '560px', height: '600px' };
    if (sizePreset === 'large') return { width: '760px', height: '700px' };
    return { width: `${customSize.width}px`, height: `${customSize.height}px` };
  };

  const dim = getDimensions();

  return (
    <>
      {/* FLOATING QUICK TRIGGER BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Quick Screen Notepad (Alt + N)"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1.25rem',
            borderRadius: '999px',
            background: '#2563eb',
            color: '#ffffff',
            border: '1px solid #1d4ed8',
            boxShadow: '0 6px 22px rgba(37, 99, 235, 0.35)',
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 28px rgba(37, 99, 235, 0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 6px 22px rgba(37, 99, 235, 0.35)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <line x1="9" y1="7" x2="15" y2="7"/>
            <line x1="9" y1="11" x2="15" y2="11"/>
          </svg>
          <span>Screen Notepad</span>
          <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.2)', padding: '0.15rem 0.45rem', borderRadius: '6px' }}>
            Alt+N
          </span>
        </button>
      )}

      {/* FLOATING RESIZABLE NOTEPAD WINDOW */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: isMinimized ? '16px' : '24px',
            right: isMinimized ? '16px' : '24px',
            width: isMinimized ? '340px' : dim.width,
            height: isMinimized ? '48px' : dim.height,
            minWidth: '340px',
            minHeight: isMinimized ? '48px' : '320px',
            maxWidth: '96vw',
            maxHeight: '92vh',
            zIndex: 9999,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '16px',
            boxShadow: '0 16px 48px rgba(15, 23, 42, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            resize: isMinimized ? 'none' : 'both',
            transition: 'width 0.2s ease, height 0.2s ease'
          }}
        >
          {/* Top Window Bar */}
          <div style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '0.55rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>🗒️</span>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>
                Screen Notepad
              </span>
              <span style={{
                fontSize: '0.68rem',
                color: saveStatus === 'Saved' ? '#059669' : '#d97706',
                background: saveStatus === 'Saved' ? '#ecfdf5' : '#fef3c7',
                padding: '0.1rem 0.45rem',
                borderRadius: '6px',
                fontWeight: 700
              }}>
                {saveStatus}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {!isMinimized && (
                <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px', marginRight: '0.25rem' }}>
                  <button onClick={() => setSizePreset('small')} style={{ background: sizePreset === 'small' ? '#2563eb' : 'transparent', border: 'none', color: sizePreset === 'small' ? '#ffffff' : '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>S</button>
                  <button onClick={() => setSizePreset('medium')} style={{ background: sizePreset === 'medium' ? '#2563eb' : 'transparent', border: 'none', color: sizePreset === 'medium' ? '#ffffff' : '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>M</button>
                  <button onClick={() => setSizePreset('large')} style={{ background: sizePreset === 'large' ? '#2563eb' : 'transparent', border: 'none', color: sizePreset === 'large' ? '#ffffff' : '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>L</button>
                </div>
              )}

              <button
                onClick={handlePopOutWindow}
                title="Pop out standalone window"
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <span>↗</span>
                <span>Float</span>
              </button>

              <button onClick={() => setIsMinimized(!isMinimized)} style={{ background: 'transparent', border: 'none', color: '#64748b', padding: '4px 6px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>
                {isMinimized ? '□' : '−'}
              </button>
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: '4px 6px', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>
                ×
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Tabs Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                overflowX: 'auto',
                padding: '0.35rem 0.5rem 0 0.5rem',
                gap: '0.35rem',
                flexShrink: 0
              }}>
                {openTabIds.map((tabId) => {
                  const note = notes.find(n => n.id === tabId);
                  if (!note) return null;
                  const isActive = activeNoteId === tabId;

                  return (
                    <div
                      key={tabId}
                      onClick={() => handleSelectTab(tabId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.45rem 0.85rem',
                        background: isActive ? '#ffffff' : 'transparent',
                        borderTop: isActive ? '2px solid #2563eb' : '2px solid transparent',
                        borderRadius: '8px 8px 0 0',
                        color: isActive ? '#0f172a' : '#64748b',
                        fontSize: '0.8rem',
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        borderRight: isActive ? '1px solid #e2e8f0' : '1px solid transparent',
                        borderLeft: isActive ? '1px solid #e2e8f0' : '1px solid transparent'
                      }}
                    >
                      <span>📄</span>
                      <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {note.title || 'Untitled'}
                      </span>
                      <button
                        onClick={(e) => handleCloseTab(tabId, e)}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px', fontSize: '0.85rem' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={handleAddNewTab}
                  title="New Tab (+)"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    flexShrink: 0,
                    marginBottom: '2px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                >
                  +
                </button>
              </div>

              {/* Toolbar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.4rem 0.85rem',
                background: '#ffffff',
                borderBottom: '1px solid #f1f5f9',
                gap: '0.5rem',
                flexWrap: 'wrap',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '160px' }}>
                  <select
                    value={activeFolderId || ''}
                    onChange={(e) => handleChangeFolder(e.target.value || null)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '5px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">(Unfiled)</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>📁 {f.name}</option>
                    ))}
                  </select>

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
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      flex: 1,
                      minWidth: '100px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button onClick={() => insertFormatting('# ')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>H1</button>
                  <button onClick={() => insertFormatting('**', '**')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>B</button>
                  <button onClick={() => insertFormatting('- ')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>• List</button>
                  <button onClick={() => insertFormatting('- [ ] ')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>[✓] Todo</button>
                  <button onClick={() => insertFormatting('```\n', '\n```')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>&lt;/&gt;</button>
                  
                  <button
                    onClick={handleCopyNote}
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#2563eb',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              {/* Main Textarea */}
              <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <textarea
                  ref={textareaRef}
                  value={activeContent}
                  onChange={handleContentChange}
                  placeholder="Type notes here..."
                  style={{
                    flex: 1,
                    width: '100%',
                    height: '100%',
                    background: '#ffffff',
                    border: 'none',
                    outline: 'none',
                    color: '#0f172a',
                    fontFamily: 'var(--font-geist-mono), Consolas, "Courier New", monospace',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    padding: '1rem',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Status Bar */}
              <div style={{
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                padding: '0.35rem 0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.72rem',
                color: '#64748b',
                fontWeight: 600,
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <span>Ln {stats.lines}</span>
                  <span>{stats.words} words</span>
                  <span>{stats.chars} chars</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span>UTF-8</span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>Auto-Saved ✓</span>
                  <span style={{ cursor: 'se-resize', opacity: 0.6 }}>⤡</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
