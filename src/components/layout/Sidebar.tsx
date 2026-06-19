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
      className="glassmorphism"
      style={{
        width: '260px',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
        zIndex: 50,
      }}
    >
      {/* Brand logo section */}
      <div
        style={{
          padding: '24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '18px',
          }}
        >
          PL
        </div>
        <div>
          <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.025em', display: 'block' }}>
            Peaky Ledger
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Trading Companion
          </span>
        </div>
      </div>

      {/* Nav links section */}
      <nav style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '14px',
                textDecoration: 'none',
                transition: 'all var(--transition-fast)',
              }}
              className={isActive ? '' : 'btn-secondary-hover'}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer / Logout section */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '12px 16px',
            borderRadius: '8px',
            color: 'var(--danger)',
            backgroundColor: 'transparent',
            border: 'none',
            fontWeight: 500,
            fontSize: '14px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background var(--transition-fast)',
          }}
          className="btn-ghost"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
