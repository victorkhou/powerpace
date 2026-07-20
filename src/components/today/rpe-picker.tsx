'use client'

import { RPE_COLOR } from '@/lib/rpe'

type Props = {
  value: number | null
  onChange: (v: number | null) => void
  disabled?: boolean
}

export function RpePicker({ value, onChange, disabled }: Props) {
  return (
    <div role="group" aria-label="Rate of Perceived Exertion">
      <div
        style={{
          fontSize: '0.65rem',
          color: '#888',
          letterSpacing: '0.04em',
          marginBottom: 8,
        }}
      >
        how did it feel? (optional)
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const selected = value === n
          const color = RPE_COLOR(n)
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`RPE ${n}`}
              onClick={() => onChange(selected ? null : n)}
              style={{
                width: 44,
                height: 44,
                minWidth: 44,
                minHeight: 44,
                backgroundColor: selected ? color : '#0f0f0f',
                border: `1px solid ${selected ? color : '#181818'}`,
                borderRadius: 4,
                color: selected ? '#000' : '#888',
                  fontSize: '0.8rem',
                fontWeight: selected ? 600 : 400,
                cursor: disabled ? 'default' : 'pointer',
                padding: 0,
                transition: 'background-color 0.12s, color 0.12s, border-color 0.12s',
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
