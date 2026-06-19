'use client'

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { getPlaybookEntries, createPlaybookEntry, updatePlaybookEntry, deletePlaybookEntry } from '@/utils/supabase/queries'
import { PlaybookEntry } from '@/types/journal'
import { Plus, Trash2, Edit3, BookMarked } from 'lucide-react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

// Simple Editor Toolbar Component
const EditorToolbar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null

  return (
    <div style={{ display: 'flex', gap: '8px', padding: '8px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface-hover)', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        style={{ fontWeight: editor.isActive('bold') ? 'bold' : 'normal', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: 'none', background: editor.isActive('bold') ? 'var(--primary)' : 'transparent', color: editor.isActive('bold') ? '#fff' : 'var(--text-primary)' }}
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        style={{ fontStyle: editor.isActive('italic') ? 'italic' : 'normal', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: 'none', background: editor.isActive('italic') ? 'var(--primary)' : 'transparent', color: editor.isActive('italic') ? '#fff' : 'var(--text-primary)' }}
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        style={{ padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: 'none', background: editor.isActive('heading', { level: 2 }) ? 'var(--primary)' : 'transparent', color: editor.isActive('heading', { level: 2 }) ? '#fff' : 'var(--text-primary)' }}
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        style={{ padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', border: 'none', background: editor.isActive('bulletList') ? 'var(--primary)' : 'transparent', color: editor.isActive('bulletList') ? '#fff' : 'var(--text-primary)' }}
      >
        Bullet List
      </button>
    </div>
  )
}

export default function PlaybookPage() {
  const [entries, setEntries] = useState<PlaybookEntry[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<PlaybookEntry | null>(null)
  
  // Form states
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  
  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
  })

  const fetchEntries = async () => {
    try {
      const data = await getPlaybookEntries()
      setEntries(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchEntries()
    })
  }, [])

  const handleOpenAdd = () => {
    setSelectedEntry(null)
    setTitle('')
    setTags('')
    editor?.commands.setContent('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (entry: PlaybookEntry) => {
    setSelectedEntry(entry)
    setTitle(entry.title)
    setTags(entry.tags.join(', '))
    editor?.commands.setContent(entry.content || '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const contentHtml = editor?.getHTML() || ''
    const tagsArr = tags.split(',').map((t) => t.trim()).filter(Boolean)

    try {
      if (selectedEntry) {
        await updatePlaybookEntry(selectedEntry.id, {
          title,
          content: contentHtml,
          tags: tagsArr,
        })
      } else {
        await createPlaybookEntry({
          title,
          content: contentHtml,
          tags: tagsArr,
        })
      }
      setIsModalOpen(false)
      fetchEntries()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this setup?')) return
    try {
      await deletePlaybookEntry(id)
      fetchEntries()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em' }}>Playbook</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Document setups, execution rules, and strategies
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAdd} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} />
          <span>Add Setup</span>
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>Loading playbook setups...</div>
      ) : entries.length === 0 ? (
        <Card style={{ padding: '60px 24px', textAlign: 'center' }}>
          <BookMarked size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', strokeWidth: 1.5 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>No Setups Documented</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
            Create custom setup sheets with rules, criteria, and execution checklists.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {entries.map((entry) => (
            <Card key={entry.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{entry.title}</h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => handleOpenEdit(entry)} className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto' }}>
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleDelete(entry.id)} className="btn btn-ghost" style={{ padding: '4px', minWidth: 'auto', color: 'var(--danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '8px 0' }}>
                  {entry.tags.map((t, idx) => (
                    <span key={idx} style={{ fontSize: '11px', backgroundColor: 'var(--bg-surface-hover)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                      {t}
                    </span>
                  ))}
                </div>
                <div 
                  className="tiptap-content"
                  style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '12px', maxHeight: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  dangerouslySetInnerHTML={{ __html: entry.content || '' }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedEntry ? 'Edit Setup' : 'New Setup'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Input
            id="title"
            label="Setup Name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. 5-Min Opening Range Breakout"
          />

          <Input
            id="tags"
            label="Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Breakout, Momentum, F&O"
          />

          {/* TipTap Rich Editor */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <EditorToolbar editor={editor} />
            <div style={{ minHeight: '200px', padding: '12px', outline: 'none', color: 'var(--text-primary)', backgroundColor: 'var(--bg-surface)' }}>
              <EditorContent editor={editor} style={{ outline: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Setup
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
