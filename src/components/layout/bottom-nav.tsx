'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/today', label: 'today', icon: '⬡' },
  { href: '/schedule', label: 'plan', icon: '▦' },
  { href: '/weights', label: 'weights', icon: '↑' },
  { href: '/history', label: 'log', icon: '◷' },
  { href: '/analytics', label: 'charts', icon: '╱' },
  { href: '/settings', label: 'config', icon: '⚙' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0d0d0d',
        borderTop: '1px solid #181818',
        display: 'flex',
        zIndex: 30,
        height: 56,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              textDecoration: 'none',
              color: active ? '#e8ff47' : '#444',
              minHeight: 44,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>{item.icon}</span>
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.6rem',
              letterSpacing: '0.03em',
              color: active ? '#e8ff47' : '#444',
            }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
