'use client'

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getDiaryEntry, upsertDiaryEntry } from '@/utils/supabase/queries'
import { DiaryEntry } from '@/types/journal'
import { format } from 'date-fns'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Save, Calendar as CalendarIcon, Smile, ShieldAlert } from 'lucide-react'

export default function DiaryPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [mood, setMood] = useState<'great' | 'good' | 'neutral' | 'bad' | 'terrible' | ''>('')
  const [rating, setRating] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
  })

  useEffect(() => {
    const fetchEntry = async () => {
      setLoading(true)
      setMessage('')
      try {
        const entry = await getDiaryEntry(selectedDate)
        if (entry) {
          setMood(entry.mood || '')
          setRating(entry.day_rating || '')
          editor?.commands.setContent(entry.content || '')
        } else {
          setMood('')
          setRating('')
          editor?.commands.setContent('')
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchEntry()
  }, [selectedDate, editor])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await upsertDiaryEntry({
        date: selectedDate,
        content: editor?.getHTML() || '',
        mood: mood || null,
        day_rating: rating ? Number(rating) : null,
      })
      setMessage('Journal entry saved successfully! 🎉')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error(err)
      setMessage('Failed to save entry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const moods: { label: string; value: 'great' | 'good' | 'neutral' | 'bad' | 'terrible' }[] = [
    { label: '🏆 Great', value: 'great' },
    { label: '🙂 Good', value: 'good' },
    { label: '😐 Neutral', value: 'neutral' },
    { label: '🤕 Bad', value: 'bad' },
    { label: '🤬 Terrible', value: 'terrible' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      {/* Title Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em' }}>Diary</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Reflect on your psychological triggers and track trading consistency
          </p>
        </div>
        
        {/* Date Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'var(--bg-surface)' }}>
          <CalendarIcon size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '0', fontSize: '14px', outline: 'none', width: '130px', fontWeight: 600 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>Loading diary entry...</div>
      ) : (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '32px' }}>
          
          {/* Mood and Rating */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            
            {/* Mood selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label>How was your trading mindset today?</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {moods.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMood(m.value)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: mood === m.value ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: mood === m.value ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface)',
                      color: mood === m.value ? 'var(--primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Performance Rating */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label>Rate today's execution quality (1-5)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    onClick={() => setRating(val)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      border: rating === val ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: rating === val ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface)',
                      color: rating === val ? 'var(--primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Editor toolbar placeholder style */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <label>Today's Reflections & Learnings</label>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              {/* Rich editor toolbar */}
              <div style={{ display: 'flex', gap: '8px', padding: '8px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface-hover)' }}>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  style={{ fontWeight: editor?.isActive('bold') ? 'bold' : 'normal', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-primary)' }}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  style={{ fontStyle: editor?.isActive('italic') ? 'italic' : 'normal', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-primary)' }}
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  style={{ padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-primary)' }}
                >
                  H2
                </button>
              </div>
              <div style={{ minHeight: '260px', padding: '16px', outline: 'none', color: 'var(--text-primary)', backgroundColor: 'var(--bg-surface)' }}>
                <EditorContent editor={editor} style={{ outline: 'none' }} />
              </div>
            </div>
          </div>

          {/* Save Button & messages */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--success)', fontWeight: 600 }}>{message}</span>
            <Button variant="primary" loading={saving} onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={16} />
              <span>Save Entry</span>
            </Button>
          </div>

        </Card>
      )}
    </div>
  )
}
