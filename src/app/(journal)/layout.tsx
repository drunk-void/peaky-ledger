import React from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Header />
        <main style={{ marginLeft: '260px', padding: '32px', flex: 1, backgroundColor: 'var(--bg-app)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
