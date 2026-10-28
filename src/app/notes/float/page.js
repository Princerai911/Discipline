"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

const STORAGE_NOTES_KEY = 'discipline_notebook_notes';
const STORAGE_FOLDERS_KEY = 'discipline_notebook_folders';
const STORAGE_OPEN_TABS_KEY = 'discipline_notepad_open_tabs';
const STORAGE_ACTIVE_TAB_KEY = 'discipline_notepad_active_tab';

export default function FloatNotepadPage() {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('all');
  const [notes, setNotes] = useState([]);
  const [openTabIds, setOpenTabIds] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [activeTitle, setActiveTitle] = useState('');
  const [activeContent, setActiveContent] = useState('');
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [stats, setStats] = useState({ lines: 1, words: 0, chars: 0 });

  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

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

      const active = (localNotes.length > 0 ? localNotes : []).find(n => n.id === storedActiveId);
      if (active) {
        setActiveTitle(active.title || 'Untitled');
        setActiveContent(active.content || '');
        setActiveFolderId(active.folder_id || null);
        updateStats(active.content || '');
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
      console.error('Failed to load notes in float window:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    const currentFolder = folders.find(f => f.id === selectedFolderId);
    const folderName = currentFolder ? currentFolder.name : 'Unfiled';
    const title = prompt(`Enter title for new sub-note under folder "${folderName}":`, `Sub-note ${notes.length + 1}`);
    if (!title || !title.trim()) return;

    const newNote = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `note_${Date.now()}`,
      folder_id: selectedFolderId === 'all' ? (folders[0]?.id || null) : selectedFolderId,
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
    toast.success(`Sub-note "${newNote.title}" created!`);
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

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      color: '#0f172a',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Toaster position="bottom-center" />

      {/* 1. TOP TAB BAR (WINDOWS NOTEPAD TABS) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        overflowX: 'auto',
        padding: '0.4rem 0.5rem 0 0.5rem',
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
                gap: '0.45rem',
                padding: '0.5rem 0.95rem',
                background: isActive ? '#ffffff' : 'transparent',
                borderTop: isActive ? '2px solid #2563eb' : '2px solid transparent',
                borderRadius: '8px 8px 0 0',
                color: isActive ? '#0f172a' : '#64748b',
                fontSize: '0.82rem',
                fontWeight: isActive ? 800 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                borderRight: isActive ? '1px solid #e2e8f0' : '1px solid transparent',
                borderLeft: isActive ? '1px solid #e2e8f0' : '1px solid transparent'
              }}
            >
              <span style={{ fontSize: '0.9rem' }}>📄</span>
              <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {note.title || 'Untitled'}
              </span>
              <button
                onClick={(e) => handleCloseTab(tabId, e)}
                title="Close Tab"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: '0.9rem',
                  lineHeight: 1
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                ×
              </button>
            </div>
          );
        })}

        {/* Add Tab Button */}
        <button
          onClick={handleAddNewTab}
          title="New Tab (+)"
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#0f172a',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.1rem',
            flexShrink: 0,
            marginBottom: '2px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
          onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
        >
          +
        </button>
      </div>

      {/* 2. TOOLBAR WITH FOLDER SELECTOR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.45rem 1rem',
        background: '#ffffff',
        borderBottom: '1px solid #f1f5f9',
        gap: '0.5rem',
        flexShrink: 0,
        flexWrap: 'wrap'
      }}>
        {/* Folder Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '180px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Folder:</span>
          <select
            value={activeFolderId || ''}
            onChange={(e) => handleChangeFolder(e.target.value || null)}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
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

          {/* Title Input */}
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
              fontSize: '0.92rem',
              flex: 1,
              minWidth: '100px'
            }}
          />
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => insertFormatting('# ')}
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
          >
            H1
          </button>
          <button
            onClick={() => insertFormatting('**', '**')}
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
          >
            B
          </button>
          <button
            onClick={() => insertFormatting('- ')}
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
          >
            • List
          </button>
          <button
            onClick={() => insertFormatting('- [ ] ')}
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
          >
            [✓] Todo
          </button>
          <button
            onClick={() => insertFormatting('```\n', '\n```')}
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
          >
            &lt;/&gt;
          </button>

          <button
            onClick={handleCopyNote}
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#2563eb',
              padding: '3px 10px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            📋 Copy All
          </button>
        </div>
      </div>

      {/* 3. MAIN EDITOR AREA */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <textarea
          ref={textareaRef}
          value={activeContent}
          onChange={handleContentChange}
          placeholder="Take notes during Zoom meetings or YouTube videos here..."
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            background: '#ffffff',
            border: 'none',
            outline: 'none',
            color: '#0f172a',
            fontFamily: 'var(--font-geist-mono), Consolas, "Courier New", monospace',
            fontSize: '0.92rem',
            lineHeight: 1.65,
            padding: '1.25rem',
            resize: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* 4. FOOTER STATUS BAR */}
      <div style={{
        background: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        padding: '0.35rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.72rem',
        color: '#64748b',
        fontWeight: 600,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          <span>Ln {stats.lines}</span>
          <span>{stats.words} words</span>
          <span>{stats.chars} characters</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>UTF-8</span>
          <span style={{ color: '#059669', fontWeight: 700 }}>Auto-Synced ✓</span>
        </div>
      </div>
    </div>
  );
}
