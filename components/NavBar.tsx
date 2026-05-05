'use client'

import Link from 'next/link'
import { Zap, User, LogOut } from 'lucide-react'

interface NavBarProps {
  user: { username?: string; email?: string; points: number }
  onLogout: () => void
}

export default function NavBar({ user, onLogout }: NavBarProps) {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(15,15,26,0.9)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(99,102,241,0.15)',
      padding: '0 24px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', height: 60, gap: 24 }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'white',
            fontFamily: 'monospace',
          }}>
            PP
          </div>
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>
            PixPoints
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { href: '/', label: '素材库' },
            { href: '/topup', label: '充值' },
          ].map(link => (
            <Link key={link.href} href={link.href} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Points badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 999,
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.2)',
          }}>
            <Zap size={14} color="#fbbf24" />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fbbf24' }}>
              {user.points.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>积分</span>
          </div>

          {/* User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={14} color="#64748b" />
            <span style={{ fontSize: 13, color: '#94a3b8', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(user.username || user.email || '')}
            </span>
          </div>

          <button
            onClick={onLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', borderRadius: 8, border: '1px solid #2a2a3e',
              background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer',
            }}
          >
            <LogOut size={12} /> 退出
          </button>
        </div>
      </div>
    </nav>
  )
}
