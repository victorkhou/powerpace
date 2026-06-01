'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { calcPlates, DEFAULT_BAR_LBS, DEFAULT_PLATES } from '@/lib/plates'

type Props = {
  weightLbs: number
  barLbs?: number
  open: boolean
  onClose: () => void
  label?: string
}

const PLATE_COLORS: Record<string, string> = {
  '45': '#ff6b47',
  '35': '#f0a500',
  '25': '#e8ff47',
  '10': '#47c8ff',
  '5': '#4aff91',
  '2.5': '#666',
}

function plateColor(p: number): string {
  return PLATE_COLORS[String(p)] ?? '#666'
}

export function PlateCalculatorSheet({ weightLbs, barLbs = DEFAULT_BAR_LBS, open, onClose, label }: Props) {
  const result = calcPlates(weightLbs, barLbs)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 50,
          }}
        />
        <DialogPrimitive.Popup
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'calc(100% - 32px)',
            maxWidth: 380,
            backgroundColor: '#0f0f0f',
            border: '1px solid #181818',
            borderRadius: 6,
            padding: '18px 18px 16px',
            zIndex: 51,
            outline: 'none',
          }}
        >
          {/* Header */}
          {label && (
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '0.65rem',
                color: '#666',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 4,
              }}
            >
              {label}
            </div>
          )}
          <DialogPrimitive.Title
            aria-label={`${label ? label + ' ' : ''}plate calculator for ${weightLbs} lbs target on ${barLbs} lb bar`}
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '2rem',
              color: '#e8ff47',
              letterSpacing: '0.05em',
              lineHeight: 1,
              margin: 0,
            }}
          >
            {weightLbs} LBS · {barLbs} BAR
          </DialogPrimitive.Title>

          {/* Body */}
          <div style={{ marginTop: 16 }}>
            {result.belowBar ? (
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '0.8rem',
                  color: '#f0a500',
                }}
              >
                target ({weightLbs}) is below bar weight ({barLbs}). use a lighter bar or dumbbells.
              </div>
            ) : result.plates.length === 0 && result.exact ? (
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '0.8rem',
                  color: '#d0d0d0',
                }}
              >
                bar only — no plates needed.
              </div>
            ) : result.plates.length === 0 ? (
              (() => {
                const minPlate = Math.min(...DEFAULT_PLATES)
                const below = Math.floor((weightLbs - barLbs) / (2 * minPlate)) * 2 * minPlate + barLbs
                const above = below + 2 * minPlate
                return (
                  <>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: '0.7rem',
                        color: '#f0a500',
                      }}
                    >
                      approximately off by {result.remainder} lb total — closest match with available plates.
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: '0.65rem',
                        color: '#888',
                        marginTop: 4,
                      }}
                    >
                      closest reachable: {below} or {above} lbs
                    </div>
                  </>
                )
              })()
            ) : (
              <>
                {/* Plate chips */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  {result.plates.map((p, i) => {
                    const c = plateColor(p)
                    return (
                      <span
                        key={`${p}-${i}`}
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: '0.8rem',
                          color: c,
                          border: `1px solid ${c}`,
                          borderRadius: 4,
                          padding: '4px 8px',
                          minWidth: 38,
                          minHeight: 32,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {p}
                      </span>
                    )
                  })}
                </div>

                {/* Sum line */}
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '0.75rem',
                    color: '#d0d0d0',
                    marginBottom: result.exact ? 0 : 8,
                  }}
                >
                  <span style={{ color: '#666' }}>per side: </span>
                  {result.plates.join(' + ')}
                  <span style={{ color: '#666' }}> = {result.perSide} lb</span>
                </div>

                {!result.exact && (
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: '0.7rem',
                      color: '#f0a500',
                      marginTop: 6,
                    }}
                  >
                    approximately off by {result.remainder} lb total — closest match with available plates.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              marginTop: 18,
              width: '100%',
              minHeight: 44,
              backgroundColor: '#181818',
              border: '1px solid #333',
              borderRadius: 4,
              color: '#d0d0d0',
              fontFamily: "'DM Mono', monospace",
              fontSize: '0.75rem',
              cursor: 'pointer',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            close
          </button>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
