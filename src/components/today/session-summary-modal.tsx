'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { ChangeEntry } from '@/app/api/sessions/log/route'
import { Button } from '@/components/ui/button'
import { RpePicker } from '@/components/today/rpe-picker'
import { LIFT_LABELS } from '@/lib/progression'

type Props = {
  open: boolean
  changes: ChangeEntry[]
  onUndo: () => void
  onDone: () => void
  undoing: boolean
  sessionId?: string
  rpe?: number | null
  onRpeChange?: (v: number | null) => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  up: { label: '↑ up', color: '#4aff91' },
  down: { label: '↓ reset', color: '#ff6b47' },
  hold: { label: '— hold', color: '#f0a500' },
  deload: { label: 'deload', color: '#ff8c47' },
}

export function SessionSummaryModal({ open, changes, onUndo, onDone, undoing, sessionId, rpe, onRpeChange }: Props) {
  const progressableChanges = changes.filter((c) => LIFT_LABELS[c.key])
  const showRpe = !!sessionId && !!onRpeChange

  return (
    <Dialog open={open}>
      <DialogContent
        style={{
          backgroundColor: '#0f0f0f',
          border: '1px solid #181818',
          color: '#d0d0d0',
          maxWidth: 400,
        }}
        showCloseButton={false}
      >
        <DialogTitle
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '1.8rem',
            color: '#e8ff47',
            letterSpacing: '0.05em',
          }}
        >
          SESSION LOGGED
        </DialogTitle>

        {showRpe && (
          <div style={{ marginTop: 12 }}>
            <RpePicker
              value={rpe ?? null}
              onChange={(v) => {
                if (!onRpeChange) return
                onRpeChange(v)
              }}
              disabled={undoing}
            />
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          {progressableChanges.length === 0 ? (
            <p style={{ color: '#666', fontSize: '0.75rem' }}>No weight changes this session.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {progressableChanges.map((c) => {
                const s = STATUS_LABELS[c.status] ?? { label: c.status, color: '#666' }
                return (
                  <div
                    key={c.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      backgroundColor: '#111',
                      borderRadius: 4,
                      border: '1px solid #222',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#d0d0d0' }}>
                        {LIFT_LABELS[c.key] ?? c.key}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#666', marginTop: 2 }}>
                        {c.from} → {c.to} lbs
                        {c.isPR && (
                          <span style={{ color: '#4aff91', marginLeft: 6 }}>★ PR</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: s.color, fontWeight: 500 }}>
                        {s.label}
                      </div>
                      {c.streak != null && c.streak > 0 && (
                        <div style={{ fontSize: '0.6rem', color: '#e8ff47', marginTop: 1 }}>
                          {c.streak} streak
                        </div>
                      )}
                      {c.failures != null && c.failures > 0 && (
                        <div style={{ fontSize: '0.6rem', color: '#f0a500', marginTop: 1 }}>
                          {c.failures}× missed
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button
            onClick={onUndo}
            disabled={undoing}
            style={{
              flex: 1,
              backgroundColor: '#111',
              border: '1px solid #333',
              color: '#ff6b47',
              fontSize: '0.75rem',
              height: 44,
            }}
          >
            {undoing ? 'undoing...' : 'undo'}
          </Button>
          <Button
            onClick={onDone}
            style={{
              flex: 2,
              backgroundColor: '#e8ff47',
              color: '#000',
              fontSize: '0.8rem',
              fontWeight: 600,
              height: 44,
            }}
          >
            done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
