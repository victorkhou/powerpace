'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  onSkip: () => void
  onLogPartial: () => void
  onClose: () => void
}

export function PartialConfirmModal({ open, onSkip, onLogPartial, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        style={{
          backgroundColor: '#0f0f0f',
          border: '1px solid #181818',
          color: '#d0d0d0',
          maxWidth: 360,
          fontFamily: "'DM Mono', monospace",
        }}
      >
        <DialogTitle
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '1.4rem',
            color: '#f0a500',
            letterSpacing: '0.05em',
          }}
        >
          INCOMPLETE SETS
        </DialogTitle>

        <p style={{ fontSize: '0.75rem', color: '#888', margin: '10px 0 16px' }}>
          Not all sets are checked off. How do you want to log this session?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button
            onClick={onSkip}
            style={{
              backgroundColor: '#111',
              border: '1px solid #333',
              color: '#d0d0d0',
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.75rem',
              height: 44,
            }}
          >
            skip (no penalty)
          </Button>
          <Button
            onClick={onLogPartial}
            style={{
              backgroundColor: '#f0a500',
              color: '#000',
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.75rem',
              fontWeight: 600,
              height: 44,
            }}
          >
            log partial (counts failures)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
