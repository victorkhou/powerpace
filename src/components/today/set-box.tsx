'use client'

type SetBoxProps = {
  setNumber: number
  completed: boolean
  disabled?: boolean
  onToggle: () => void
}

export function SetBox({ setNumber, completed, disabled, onToggle }: SetBoxProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-label={`Set ${setNumber} ${completed ? 'completed' : 'incomplete'}`}
      style={{
        width: 38,
        height: 38,
        minWidth: 44,
        minHeight: 44,
        borderRadius: 6,
        border: `1px solid ${completed ? '#4aff91' : '#333'}`,
        backgroundColor: completed ? 'rgba(74,255,145,0.15)' : '#111',
        color: completed ? '#4aff91' : '#555',
        fontSize: '0.75rem',
        fontFamily: "'DM Mono', monospace",
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
        WebkitTapHighlightColor: 'transparent',
        transition: 'background-color 0.1s, border-color 0.1s',
      }}
    >
      {completed ? '✓' : setNumber}
    </button>
  )
}
