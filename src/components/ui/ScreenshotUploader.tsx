import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, X, Loader2, Save } from 'lucide-react'
import { getScreenshots, uploadScreenshot, deleteScreenshot } from '@/utils/screenshots'
import { Screenshot } from '@/types/journal'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'

interface ScreenshotWithUrl extends Screenshot {
  publicUrl: string
}

interface ScreenshotUploaderProps {
  tradeId?: string
  diaryEntryId?: string
  userId: string
  onUploadComplete?: () => void
}

export default function ScreenshotUploader({
  tradeId,
  diaryEntryId,
  userId,
  onUploadComplete
}: ScreenshotUploaderProps) {
  const [screenshots, setScreenshots] = useState<ScreenshotWithUrl[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadScreenshots = useCallback(async () => {
    if (!tradeId && !diaryEntryId) return
    setLoading(true)
    try {
      const fetched = await getScreenshots(tradeId, diaryEntryId)
      setScreenshots(fetched)
      
      // Initialize captions state
      const initialCaptions: Record<string, string> = {}
      fetched.forEach((s) => {
        initialCaptions[s.id] = s.caption || ''
      })
      setCaptions(initialCaptions)
    } catch (err) {
      console.error('Failed to load screenshots:', err)
    } finally {
      setLoading(false)
    }
  }, [tradeId, diaryEntryId])

  useEffect(() => {
    Promise.resolve().then(() => {
      loadScreenshots()
    })
  }, [loadScreenshots])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const processFiles = async (files: FileList) => {
    if (files.length === 0 || !userId) return
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadScreenshot(files[i], userId, tradeId, diaryEntryId)
      }
      await loadScreenshots()
      if (onUploadComplete) onUploadComplete()
    } catch (err) {
      console.error('Upload failed:', err)
      alert(err instanceof Error ? err.message : 'Failed to upload screenshot')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFiles(e.dataTransfer.files)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFiles(e.target.files)
    }
  }

  const handleDelete = async (id: string, storagePath: string) => {
    if (!confirm('Are you sure you want to delete this screenshot?')) return
    try {
      await deleteScreenshot(id, storagePath)
      setScreenshots(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete screenshot:', err)
    }
  }

  const handleCaptionChange = (id: string, value: string) => {
    setCaptions(prev => ({ ...prev, [id]: value }))
  }

  const handleSaveCaption = async (id: string) => {
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('screenshots')
        .update({ caption: captions[id] || null })
        .eq('id', id)
        
      if (error) throw error
    } catch (err) {
      console.error('Failed to update caption:', err)
      alert('Failed to save caption')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
        Screenshots & Charts
      </label>

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed var(--border-color)',
          borderColor: dragActive ? 'var(--primary)' : 'var(--border-color)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
          transition: 'all var(--transition-fast)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        {uploading ? (
          <>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Uploading & compressing...</span>
          </>
        ) : (
          <>
            <Upload size={32} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>
              Drag & drop charts here, or <span style={{ color: 'var(--primary)', fontWeight: 600 }}>browse</span>
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Supports PNG, JPG, GIF up to 10MB
            </span>
          </>
        )}
      </div>

      {/* Preview Gallery */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading screenshots...</span>
        </div>
      ) : screenshots.length > 0 ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gap: '16px',
          marginTop: '8px'
        }}>
          {screenshots.map((s) => (
            <div 
              key={s.id} 
              style={{
                position: 'relative',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Image Preview */}
              <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000' }}>
                <Image
                  src={s.publicUrl}
                  alt={s.caption || 'Screenshot'}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  style={{
                    objectFit: 'contain'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleDelete(s.id, s.storage_path)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Caption Input */}
              <div style={{ padding: '8px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Add a caption..."
                  value={captions[s.id] || ''}
                  onChange={(e) => handleCaptionChange(s.id, e.target.value)}
                  onBlur={() => handleSaveCaption(s.id)}
                  style={{
                    flex: 1,
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSaveCaption(s.id)}
                  style={{
                    padding: '4px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--primary-subtle, rgba(99, 102, 241, 0.1))',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Save caption"
                >
                  <Save size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
