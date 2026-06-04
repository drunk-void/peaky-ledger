'use client'

import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      // Prevent scrolling on the body when open
      document.body.style.overflow = 'hidden'
      dialog.showModal()
    } else {
      document.body.style.overflow = ''
      dialog.close()
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Handle closing via Esc key natively
  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      className="glassmorphism animate-fade-in"
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '0',
        maxWidth: '560px',
        width: 'calc(100% - 32px)',
        margin: 'auto',
        boxShadow: 'var(--shadow-lg)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {title && <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{title}</h3>}
        <button
          onClick={onClose}
          className="btn btn-ghost"
          aria-label="Close modal"
          style={{ padding: '6px', borderRadius: '50%', minWidth: 'auto' }}
        >
          <X size={18} />
        </button>
      </div>
      <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '70vh' }}>
        {children}
      </div>
    </dialog>
  )
}
