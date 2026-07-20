'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { LIFT_LABELS } from '@/lib/progression'
import { LoadingScreen } from '@/components/layout/page-shell'

type VolumePoint = { date: string; week: number; volume: number }
type ProgressionPoint = { key: string; weight: number; reason: string; date: string }

const LIFT_COLORS: Record<string, string> = {
  squat: '#e8ff47',
  bench: '#47c8ff',
  deadlift: '#ff6b47',
  ohp: '#c47fff',
  cgbp: '#4aff91',
  row: '#f0a500',
  rdl: '#ff8c47',
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<'volume' | 'lifts'>('volume')
  const [volume, setVolume] = useState<VolumePoint[]>([])
  const [progression, setProgression] = useState<ProgressionPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLift, setSelectedLift] = useState<string>('squat')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [volRes, progRes] = await Promise.all([
        fetch('/api/analytics/volume'),
        fetch('/api/analytics/progression'),
      ])
      if (volRes.ok) setVolume(await volRes.json())
      if (progRes.ok) setProgression(await progRes.json())
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <LoadingScreen />
  }

  const liftData = progression
    .filter((p) => p.key === selectedLift)
    .map((p) => ({ date: p.date.split('T')[0], weight: p.weight }))

  const availableLifts = [...new Set(progression.map((p) => p.key))]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', paddingBottom: 72 }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #181818', position: 'sticky', top: 0, backgroundColor: '#0d0d0d', zIndex: 10 }}>
        <h1 style={{ fontSize: '2rem', color: '#e8ff47', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
          ANALYTICS
        </h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => setTab('volume')}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: `1px solid ${tab === 'volume' ? '#e8ff47' : '#333'}`,
              backgroundColor: tab === 'volume' ? '#e8ff47' : '#111',
              color: tab === 'volume' ? '#000' : '#666',
              fontSize: '0.7rem',
              cursor: 'pointer',
              minHeight: 44,
            }}
          >volume</button>
          <button
            onClick={() => setTab('lifts')}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: `1px solid ${tab === 'lifts' ? '#e8ff47' : '#333'}`,
              backgroundColor: tab === 'lifts' ? '#e8ff47' : '#111',
              color: tab === 'lifts' ? '#000' : '#666',
              fontSize: '0.7rem',
              cursor: 'pointer',
              minHeight: 44,
            }}
          >lifts</button>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {tab === 'volume' && (
          volume.length === 0 ? (
            <p style={{ color: '#444', fontSize: '0.8rem', textAlign: 'center', paddingTop: 40 }}>
              Log some sessions to see volume data.
            </p>
          ) : (
            <div>
              <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: 12 }}>
                total volume per session (lbs)
              </div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volume} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#555', fontSize: 10, fontFamily: 'DM Mono' }}
                      tickFormatter={(d: string) => d.slice(5)}
                      stroke="#222"
                    />
                    <YAxis
                      tick={{ fill: '#555', fontSize: 10, fontFamily: 'DM Mono' }}
                      stroke="#222"
                      width={45}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f0f0f', border: '1px solid #333', fontFamily: 'DM Mono', fontSize: '0.7rem' }}
                      labelStyle={{ color: '#666' }}
                      itemStyle={{ color: '#e8ff47' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="volume"
                      stroke="#e8ff47"
                      strokeWidth={2}
                      dot={{ fill: '#e8ff47', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        )}

        {tab === 'lifts' && (
          <div>
            {/* Lift selector */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {availableLifts.map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedLift(key)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 4,
                    border: `1px solid ${selectedLift === key ? (LIFT_COLORS[key] ?? '#e8ff47') : '#333'}`,
                    backgroundColor: selectedLift === key ? 'rgba(232,255,71,0.08)' : '#111',
                    color: selectedLift === key ? (LIFT_COLORS[key] ?? '#e8ff47') : '#555',
                          fontSize: '0.65rem',
                    cursor: 'pointer',
                    minHeight: 36,
                  }}
                >
                  {LIFT_LABELS[key] ?? key}
                </button>
              ))}
            </div>

            {liftData.length === 0 ? (
              <p style={{ color: '#444', fontSize: '0.8rem', textAlign: 'center', paddingTop: 40 }}>
                No progression data for {LIFT_LABELS[selectedLift] ?? selectedLift} yet.
              </p>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={liftData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#555', fontSize: 10, fontFamily: 'DM Mono' }}
                      tickFormatter={(d: string) => d.slice(5)}
                      stroke="#222"
                    />
                    <YAxis
                      tick={{ fill: '#555', fontSize: 10, fontFamily: 'DM Mono' }}
                      stroke="#222"
                      width={45}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f0f0f', border: '1px solid #333', fontFamily: 'DM Mono', fontSize: '0.7rem' }}
                      labelStyle={{ color: '#666' }}
                      itemStyle={{ color: LIFT_COLORS[selectedLift] ?? '#e8ff47' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke={LIFT_COLORS[selectedLift] ?? '#e8ff47'}
                      strokeWidth={2}
                      dot={{ fill: LIFT_COLORS[selectedLift] ?? '#e8ff47', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
