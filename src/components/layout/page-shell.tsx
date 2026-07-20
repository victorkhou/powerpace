'use client'

import { C, FONT } from '@/lib/theme'

/**
 * Shared page scaffold components. Previously the loading screen (6× verbatim),
 * sticky header (5×), and empty-state paragraph (5×) were copy-pasted across
 * every (app) page with zero variance.
 */

export function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: FONT.mono, color: C.muted, fontSize: '0.8rem' }}>loading...</span>
    </div>
  )
}

export function PageHeader({ title, accent = C.accentLift, children }: {
  title: string
  accent?: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ padding: '20px 16px 14px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, backgroundColor: C.bg, zIndex: 10 }}>
      <h1 style={{ fontFamily: FONT.heading, fontSize: '2rem', color: accent, letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
        {title}
      </h1>
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: FONT.mono, color: C.mutedDark, fontSize: '0.8rem', textAlign: 'center', paddingTop: 40 }}>
      {children}
    </p>
  )
}
