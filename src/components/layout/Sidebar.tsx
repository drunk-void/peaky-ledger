'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  Calendar,
  BookOpen,
  BookMarked,
  Database,
  Settings,
  LogOut
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export const Sidebar = () => {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Trade Log', href: '/trades', icon: TrendingUp },
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Diary', href: '/diary', icon: BookOpen },
    { name: 'Playbook', href: '/playbook', icon: BookMarked },
    { name: 'Sync & Import', href: '/import', icon: Database },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      style={{
        width: '260px',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        zIndex: 50,
      }}
    >
      {/* Brand logo section */}
      <div
        style={{
          padding: '24px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-input, 4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '16px',
          }}
        >
          PL
        </div>
        <div>
          <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.02em', display: 'block', color: 'var(--text-primary)' }}>
            Peaky Ledger
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Trading Companion
          </span>
        </div>
      </div>

      {/* Nav links section */}
      <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={isActive ? 'sidebar-link active' : 'sidebar-link'}
            >
              <Icon size={16} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer / Logout section */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={handleSignOut}
          className="sidebar-link"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            color: 'var(--danger)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
