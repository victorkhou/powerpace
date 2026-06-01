'use client'

import { useEffect, useState } from 'react'
import { RPE_COLOR } from '@/lib/rpe'
import { LIFT_LABELS } from '@/lib/progression'
type SessionRow = {
  id: string
  date: string
  week: number
  status: string
  notes: string | null
  volume_lbs: number | null
  rpe: number | null
  workout_day: { name: string; type: string; tag: string | null } | null
}

type PREntry = {
  key: string
  pr_lbs: number
  streak: number
  failures: number
}

const STATUS_COLOR: Record<string, string> = {
  completed: '#4aff91',
  partial: '#f0a500',
  skipped: '#555',
  undone: '#333',
}

export default function HistoryPage() {
  const [tab, setTab] = useState<'log' | 'prs'>('log')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [prs, setPrs] = useState<PREntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [sessRes, prsRes] = await Promise.all([
        fetch('/api/history/sessions'),
        fetch('/api/history/prs'),
      ])
      if (sessRes.ok) setSessions(await sessRes.json())
      if (prsRes.ok) setPrs(await prsRes.json())
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'DM Mono', monospace", color: '#666', fontSize: '0.8rem' }}>loading...</span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', paddingBottom: 72 }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #181818', position: 'sticky', top: 0, backgroundColor: '#0d0d0d', zIndex: 10 }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: '#e8ff47', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
          HISTORY
        </h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => setTab('log')}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: `1px solid ${tab === 'log' ? '#e8ff47' : '#333'}`,
              backgroundColor: tab === 'log' ? '#e8ff47' : '#111',
              color: tab === 'log' ? '#000' : '#666',
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.7rem',
              cursor: 'pointer',
              minHeight: 44,
            }}
          >sessions</button>
          <button
            onClick={() => setTab('prs')}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: `1px solid ${tab === 'prs' ? '#e8ff47' : '#333'}`,
              backgroundColor: tab === 'prs' ? '#e8ff47' : '#111',
              color: tab === 'prs' ? '#000' : '#666',
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.7rem',
              cursor: 'pointer',
              minHeight: 44,
            }}
          >PRs</button>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {tab === 'log' && (
          sessions.length === 0 ? (
            <p style={{ fontFamily: "'DM Mono', monospace", color: '#444', fontSize: '0.8rem', textAlign: 'center', paddingTop: 40 }}>
              No sessions logged yet.
            </p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #181818',
                  borderRadius: 4,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', color: '#d0d0d0' }}>
                        {s.workout_day?.name ?? 'Workout'}
                      </span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', color: STATUS_COLOR[s.status] ?? '#555', border: `1px solid ${STATUS_COLOR[s.status] ?? '#333'}`, borderRadius: 3, padding: '1px 4px' }}>
                        {s.status}
                      </span>
                      {s.rpe != null && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', color: RPE_COLOR(s.rpe), border: `1px solid ${RPE_COLOR(s.rpe)}`, borderRadius: 3, padding: '1px 4px' }}>
                          RPE {s.rpe}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: '#555', marginTop: 3 }}>
                      {s.date} · week {s.week}
                      {s.workout_day?.tag && <span> · {s.workout_day.tag}</span>}
                    </div>
                    {s.notes && (
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: '#444', fontStyle: 'italic', marginTop: 4 }}>
                        {s.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    {s.volume_lbs != null && s.volume_lbs > 0 && (
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', color: '#d0d0d0', lineHeight: 1 }}>
                        {Math.round(s.volume_lbs).toLocaleString()}
                      </div>
                    )}
                    {s.volume_lbs != null && s.volume_lbs > 0 && (
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', color: '#555' }}>lbs</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )
        )}

        {tab === 'prs' && (
          prs.length === 0 ? (
            <p style={{ fontFamily: "'DM Mono', monospace", color: '#444', fontSize: '0.8rem', textAlign: 'center', paddingTop: 40 }}>
              No PRs yet.
            </p>
          ) : (
            prs.map((pr) => (
              <div
                key={pr.key}
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #181818',
                  borderRadius: 4,
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', color: '#d0d0d0' }}>
                    {LIFT_LABELS[pr.key] ?? pr.key}
                  </span>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    {pr.streak > 0 && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: '#4aff91' }}>
                        streak {pr.streak}
                      </span>
                    )}
                    {pr.failures > 0 && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: '#f0a500' }}>
                        {pr.failures} fail{pr.failures > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: '#4aff91', lineHeight: 1 }}>
                    {pr.pr_lbs}
                  </span>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', color: '#555' }}>lbs</div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}
