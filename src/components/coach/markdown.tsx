'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { C, FONT } from '@/lib/theme'

/**
 * Renders coach answers as markdown.
 *
 * The coach emits real markdown — bold weights (**157.5 lbs**), bulleted
 * takeaways, and GFM tables comparing lifts — which previously showed as literal
 * asterisks and pipe characters. remark-gfm is required for the tables.
 *
 * Every element is styled inline to match the app's dark theme (Tailwind's
 * preflight strips list markers and table borders, and prose defaults would
 * clash with the mono/Bebas type scale). Sizes are relative to the 0.73rem
 * bubble text so a table doesn't tower over the surrounding copy.
 */

// Shared cell styling for the table renderers below.
const cell: React.CSSProperties = {
  border: `1px solid ${C.border}`,
  padding: '4px 7px',
  textAlign: 'left',
  verticalAlign: 'top',
}

const components: Components = {
  // Paragraphs: tighten spacing so multi-paragraph answers stay compact, and
  // drop the trailing margin so the bubble doesn't gain dead space at the end.
  p: ({ children }) => <p style={{ margin: '0 0 0.6em' }}>{children}</p>,

  strong: ({ children }) => (
    <strong style={{ color: C.accentLift, fontWeight: 600 }}>{children}</strong>
  ),
  em: ({ children }) => <em style={{ color: C.text, fontStyle: 'italic' }}>{children}</em>,

  // Tailwind preflight removes list markers; restore them explicitly.
  ul: ({ children }) => (
    <ul style={{ margin: '0 0 0.6em', paddingLeft: '1.1em', listStyle: 'disc' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: '0 0 0.6em', paddingLeft: '1.2em', listStyle: 'decimal' }}>{children}</ol>
  ),
  li: ({ children }) => <li style={{ margin: '0.15em 0' }}>{children}</li>,

  // Coach answers are short; h1-h3 would be oversized (and would inherit Bebas
  // from globals.css). Render headings as emphasized lines instead.
  h1: ({ children }) => <div style={{ color: C.accentLift, fontWeight: 600, margin: '0.5em 0 0.3em' }}>{children}</div>,
  h2: ({ children }) => <div style={{ color: C.accentLift, fontWeight: 600, margin: '0.5em 0 0.3em' }}>{children}</div>,
  h3: ({ children }) => <div style={{ color: C.accentLift, fontWeight: 600, margin: '0.5em 0 0.3em' }}>{children}</div>,

  // Tables can exceed the bubble on a phone — wrap so they scroll horizontally
  // instead of forcing the whole message wider.
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '0 0 0.6em', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.95em', width: 'auto' }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ ...cell, color: C.muted, fontWeight: 600, backgroundColor: C.bg, whiteSpace: 'nowrap' }}>
      {children}
    </th>
  ),
  td: ({ children }) => <td style={cell}>{children}</td>,

  code: ({ children }) => (
    <code
      style={{
        fontFamily: FONT.mono,
        backgroundColor: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 3,
        padding: '0 3px',
        fontSize: '0.95em',
      }}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre
      style={{
        backgroundColor: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        padding: '8px 10px',
        overflowX: 'auto',
        margin: '0 0 0.6em',
        fontSize: '0.95em',
      }}
    >
      {children}
    </pre>
  ),

  // Links open in a new tab; noreferrer since the target is model-generated.
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: C.accentRun, textDecoration: 'underline' }}
    >
      {children}
    </a>
  ),

  hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '0.7em 0' }} />,
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: `2px solid ${C.border}`, paddingLeft: 8, margin: '0 0 0.6em', color: C.muted }}>
      {children}
    </blockquote>
  ),
}

export function CoachMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
