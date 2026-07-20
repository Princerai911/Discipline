"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  
  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    setLoading(true);
    const { data } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setNotes(data);
    setLoading(false);
  }

  async function addNote(e) {
    e.preventDefault();
    if (!newNote.trim()) return;

    const { data, error } = await supabase
      .from('notes')
      .insert([{ content: newNote }])
      .select('*');

    if (!error && data) {
      setNotes([data[0], ...notes]);
      setNewNote('');
    }
  }

  async function deleteNote(id) {
    if (confirm("Delete this reflection?")) {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (!error) {
        setNotes(notes.filter(n => n.id !== id));
      }
    }
  }

  return (
    <main className="animate-enter">
      <div style={{ marginBottom: '2rem' }}>
        <h2 className="text-gradient-accent" style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800 }}>Daily Journal</h2>
        <p style={{ color: 'var(--muted-foreground)', marginTop: '0.5rem', lineHeight: 1.5 }}>
          Clear your mind. Reflect on what went well today, and what you will improve tomorrow.
        </p>
      </div>

      <form onSubmit={addNote} className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <textarea 
          className="premium-input"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="I crushed my morning routine, but got distracted after lunch..."
          style={{ width: '100%', padding: '1.25rem', borderRadius: '12px', fontSize: '1rem', minHeight: '120px', resize: 'vertical' }}
        />
        <button 
          type="submit"
          className="premium-button"
          disabled={!newNote.trim()}
          style={{ padding: '1rem', fontWeight: 700, borderRadius: '12px', border: 'none', cursor: 'pointer', alignSelf: 'flex-end' }}
        >
          Save Reflection
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem 0', fontWeight: 700 }}>Past Entries</h3>
        
        {loading && <p style={{ color: 'var(--muted-foreground)' }}>Loading thoughts...</p>}
        
        {!loading && notes.length === 0 && (
          <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '1.1rem' }}>
              Your journal is empty.
              <br/><span style={{ fontSize: '0.9rem', opacity: 0.7 }}>Write your first reflection above.</span>
            </p>
          </div>
        )}
        
        {notes.map((note, i) => {
          const dateObj = new Date(note.created_at);
          const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          
          return (
            <div key={note.id} className="glass-panel" style={{
              padding: '1.5rem', position: 'relative',
              animationDelay: `${i * 0.1}s`
            }}>
              <button 
                onClick={() => deleteNote(note.id)}
                style={{
                  position: 'absolute', top: '1rem', right: '1rem',
                  background: 'transparent', color: 'var(--muted-foreground)', 
                  border: 'none', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem'
                }}
              >
                ×
              </button>
              
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', marginBottom: '1rem' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem' }}>{dateStr}</span>
                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>{timeStr}</span>
              </div>
              
              <p style={{ margin: 0, color: 'var(--foreground)', fontSize: '1rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {note.content}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
