'use client'

import { useEffect, useRef, useState } from 'react'
import { useTimerStore } from '@/store/timer-store'
import { useSessionStore } from '@/store/session-store'

type WakeLockSentinelLike = { release: () => Promise<void> } | null

export function RestTimerPill() {
  const endsAt = useTimerStore((s) => s.endsAt)
  const stop = useTimerStore((s) => s.stop)
  const sessionLogged = useSessionStore((s) => s.sessionLogged)

  const [now, setNow] = useState<number>(() => Date.now())
  const [zeroFlash, setZeroFlash] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinelLike>(null)
  const vibratedRef = useRef(false)
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tick every second while timer active
  useEffect(() => {
    if (endsAt == null) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [endsAt])

  // Reset one-shot state on every endsAt transition (number→number, number→null,
  // null→number). Keeps vibrate/flash/auto-clear scoped to the current timer.
  useEffect(() => {
    vibratedRef.current = false
    setZeroFlash(false)
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current)
      clearTimeoutRef.current = null
    }
  }, [endsAt])

  // Acquire wake lock on start, release on stop or transition
  useEffect(() => {
    if (endsAt == null) return

    let cancelled = false
    ;(async () => {
      try {
        const navAny = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
        }
        if (navAny.wakeLock?.request) {
          const sentinel = await navAny.wakeLock.request('screen')
          if (!cancelled) wakeLockRef.current = sentinel
          else if (sentinel) { try { await sentinel.release() } catch {} }
        }
      } catch {
        // wake lock unavailable or denied — ignore
      }
    })()

    return () => {
      cancelled = true
      const sentinel = wakeLockRef.current
      wakeLockRef.current = null
      if (sentinel) { try { sentinel.release().catch(() => {}) } catch {} }
    }
  }, [endsAt])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const sentinel = wakeLockRef.current
      wakeLockRef.current = null
      if (sentinel) { try { sentinel.release().catch(() => {}) } catch {} }
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current)
    }
  }, [])

  const remaining = endsAt == null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000))
  const atZero = endsAt != null && remaining === 0

  // At zero — vibrate + beep + flash + auto-clear
  useEffect(() => {
    if (!atZero || vibratedRef.current) return
    vibratedRef.current = true
    try {
      const navAny = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
      navAny.vibrate?.([200, 100, 200])
    } catch {}
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AC) {
        const ctx = new AC()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
        osc.start()
        osc.stop(ctx.currentTime + 0.55)
        setTimeout(() => { ctx.close().catch(() => {}) }, 700)
      }
    } catch {}
    setZeroFlash(true)
    // Release wake lock at zero
    const sentinel = wakeLockRef.current
    wakeLockRef.current = null
    if (sentinel) { try { sentinel.release().catch(() => {}) } catch {} }
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current)
    clearTimeoutRef.current = setTimeout(() => {
      stop()
    }, 5000)
    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current)
        clearTimeoutRef.current = null
      }
    }
  }, [atZero, stop])

  if (endsAt == null || sessionLogged) return null

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  // Color tier: green plenty of rest, yellow caution, orange almost up
  let accent = '#4aff91'
  if (remaining <= 10) accent = '#ff6b47'
  else if (remaining <= 30) accent = '#e8ff47'

  const flashing = atZero && zeroFlash

  return (
    <button
      type="button"
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Rest timer ${mm}:${ss} remaining, tap to dismiss`}
      onClick={() => stop()}
      style={{
        position: 'fixed',
        bottom: 132,
        left: 16,
        right: 16,
        height: 44,
        zIndex: 21,
        backgroundColor: flashing ? 'rgba(74,255,145,0.18)' : '#0f0f0f',
        border: `1px solid ${flashing ? '#4aff91' : accent}`,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        cursor: 'pointer',
        animation: flashing ? 'pp-pulse 0.8s ease-in-out infinite' : undefined,
      }}
    >
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '0.7rem',
          color: '#888',
          letterSpacing: '0.08em',
        }}
      >
        REST · tap to dismiss
      </span>
      <span
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '1.6rem',
          color: accent,
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}
      >
        {mm}:{ss}
      </span>
      <style jsx>{`
        @keyframes pp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </button>
  )
}
