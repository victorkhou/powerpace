'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { C } from '@/lib/theme'

const NAV_ITEMS = [
  { href: '/today', label: 'today', icon: '⬡' },
  { href: '/schedule', label: 'plan', icon: '▦' },
  { href: '/weights', label: 'weights', icon: '↑' },
  { href: '/history', label: 'log', icon: '◷' },
  { href: '/analytics', label: 'charts', icon: '╱' },
  { href: '/coach', label: 'coach', icon: '◇' },
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
        backgroundColor: C.bg,
        borderTop: `1px solid ${C.border}`,
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
              color: active ? C.accentLift : C.mutedDark,
              minHeight: 44,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>{item.icon}</span>
            <span style={{
              fontSize: '0.6rem',
              letterSpacing: '0.03em',
              color: active ? C.accentLift : C.mutedDark,
            }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
