'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import type { WorkoutDay, Exercise } from '@/types/database'
import { WeekSwap } from '@/components/schedule/week-swap'
import { activeProgramQuery } from '@/lib/date'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TYPE_COLOR: Record<string, string> = {
  lift: '#e8ff47',
  run: '#47c8ff',
  combo: '#c47fff',
  rest: '#333',
}

type DayWithExercises = WorkoutDay & { exercises: Exercise[] }

export default function SchedulePage() {
  const { activeProgram, setActiveProgram } = useAppStore()
  const [viewWeek, setViewWeek] = useState<'A' | 'B'>('A')
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [days, setDays] = useState<DayWithExercises[]>([])
  const [loading, setLoading] = useState(true)

  const program = activeProgram?.program
  const weights = activeProgram?.weights ?? {}
  const todayDow = new Date().getDay()

  useEffect(() => {
    if (program?.week_type) setViewWeek(program.week_type)
  }, [program?.week_type])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch('/api/schedule')
      if (res.ok) {
        const data = await res.json()
        setDays(data.days)
      }
      setLoading(false)
    }
    load()
  }, [])

  // After a swap, refresh the cached active program so the Today page reflects
  // the new resolved workout for the current date.
  const handleSwapChanged = useCallback(async () => {
    const res = await fetch(`/api/programs/active${activeProgramQuery()}`)
    if (res.ok) setActiveProgram(await res.json())
  }, [setActiveProgram])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'DM Mono', monospace", color: '#666', fontSize: '0.8rem' }}>loading...</span>
      </div>
    )
  }

  // Filter days for the viewed week type
  const visibleDays = days.filter((d) => d.week_type === 'both' || d.week_type === viewWeek)
  // In Week A, both Tuesday and Friday have A1/A2 variants
  const variantDays = viewWeek === 'A'
    ? days.filter((d) => (d.day_of_week === 2 || d.day_of_week === 5) && d.week_type === 'A' && d.variant !== null)
    : []
  const nonVariantDays = visibleDays.filter((d) => d.variant === null)
  const displayDays = [
    ...nonVariantDays.filter((d) => !((d.day_of_week === 2 || d.day_of_week === 5) && viewWeek === 'A')),
    ...variantDays,
  ].sort((a, b) => {
    const order = [1, 2, 3, 4, 5, 6, 0]
    const oi = order.indexOf(a.day_of_week) * 10 + (a.variant === 'A2' ? 1 : 0)
    const oj = order.indexOf(b.day_of_week) * 10 + (b.variant === 'A2' ? 1 : 0)
    return oi - oj
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', paddingBottom: 72 }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #181818', position: 'sticky', top: 0, backgroundColor: '#0d0d0d', zIndex: 10 }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: '#e8ff47', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
          SCHEDULE
        </h1>

        {/* A/B toggle */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          {(['A', 'B'] as const).map((wt) => (
            <button
              key={wt}
              onClick={() => setViewWeek(wt)}
              style={{
                padding: '8px 20px',
                borderRadius: 4,
                border: `1px solid ${viewWeek === wt ? (wt === 'A' ? '#e8ff47' : '#47c8ff') : '#333'}`,
                backgroundColor: viewWeek === wt ? (wt === 'A' ? '#e8ff47' : '#47c8ff') : '#111',
                color: viewWeek === wt ? '#000' : '#555',
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.8rem',
                fontWeight: viewWeek === wt ? 600 : 400,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              Week {wt}
            </button>
          ))}
        </div>
      </div>

      {/* This-week swap */}
      <div style={{ paddingTop: 12 }}>
        <WeekSwap onChanged={handleSwapChanged} />
      </div>

      {/* Day cards */}
      <div style={{ padding: '12px 16px 0' }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: '#444', marginBottom: 10, lineHeight: 1.4 }}>
          recurring template (Week {viewWeek}). this-week swaps above override individual dates without changing the template.
        </p>
        {displayDays.map((day) => {
          const isToday = day.day_of_week === todayDow && viewWeek === program?.week_type
          const isExpanded = expandedDay === day.id
          const accent = TYPE_COLOR[day.type] ?? '#444'

          const volColor = day.is_volume ? '#47c8ff' : '#e8ff47'
          const isLiftDay = day.type === 'lift' || day.type === 'combo'
          return (
            <div
              key={day.id}
              style={{
                marginBottom: 8,
                border: `1px solid ${isToday ? accent : '#181818'}`,
                borderLeft: isLiftDay ? `3px solid ${volColor}` : `1px solid ${isToday ? accent : '#181818'}`,
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setExpandedDay(isExpanded ? null : day.id)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: isToday ? 'rgba(232,255,71,0.04)' : '#0f0f0f',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: '#555', minWidth: 28 }}>
                      {DAY_NAMES[day.day_of_week]}
                    </span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.85rem', fontWeight: 500, color: '#d0d0d0' }}>
                      {day.name}
                    </span>
                    {day.variant && (
                      <span style={{ fontSize: '0.6rem', fontFamily: "'DM Mono', monospace", color: '#c47fff', border: '1px solid #c47fff', borderRadius: 3, padding: '1px 5px' }}>
                        {day.variant}
                      </span>
                    )}
                    {isLiftDay && (
                      <span style={{ fontSize: '0.55rem', fontFamily: "'DM Mono', monospace", color: volColor, border: `1px solid ${volColor}`, borderRadius: 3, padding: '1px 5px', letterSpacing: '0.05em' }}>
                        {day.is_volume ? 'VOL' : 'INT'}
                      </span>
                    )}
                    {isToday && (
                      <span style={{ fontSize: '0.6rem', fontFamily: "'DM Mono', monospace", color: accent, border: `1px solid ${accent}`, borderRadius: 3, padding: '1px 5px' }}>
                        today
                      </span>
                    )}
                  </div>
                  {day.tag && (
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: '#555', marginTop: 2, marginLeft: 36 }}>
                      {day.tag}
                    </div>
                  )}
                </div>
                <span style={{ color: '#444', fontSize: '0.7rem', fontFamily: "'DM Mono', monospace" }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </button>

              {isExpanded && day.type !== 'rest' && (
                <div style={{ backgroundColor: '#080808', borderTop: '1px solid #181818', padding: '10px 14px' }}>
                  {day.exercises.length === 0 ? (
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#444' }}>No exercises.</p>
                  ) : (
                    day.exercises.map((ex) => {
                      const w = ex.weight_key ? weights[ex.weight_key] : null
                      return (
                        <div key={ex.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #141414' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', color: '#d0d0d0' }}>
                                {ex.name}
                              </span>
                              {ex.is_auto_volume && (
                                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: '#47c8ff', marginTop: 2 }}>
                                  auto @ 87.5%
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                              {w && (
                                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', fontWeight: 500, color: '#d0d0d0' }}>
                                  {w.weight_lbs} lbs
                                </div>
                              )}
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: '#555', marginTop: 1 }}>
                                {ex.sets}×{ex.reps}
                              </div>
                              {ex.progression_type === 'auto' && (
                                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: '#555' }}>auto</div>
                              )}
                              {ex.progression_type === 'bodyweight' && (
                                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: '#555' }}>BW</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {isExpanded && day.type === 'rest' && (
                <div style={{ backgroundColor: '#080808', borderTop: '1px solid #181818', padding: '12px 14px' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#444' }}>
                    rest & recovery
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
