# Power + Pace

A strength-training tracker built with Next.js and Supabase. Implements Texas Method–style linear progression with automatic weight management, session logging, and performance history.

## Features

- **Today** — Log workouts with per-set tracking, rest timers, and RPE rating
- **History** — Browse past sessions; tap to expand and see reps/weights for every set
- **Weights** — View and manually adjust current working weights
- **PRs** — Track personal records, streaks, and failure counts per lift
- **Schedule** — See upcoming workout days and weekly structure
- **Analytics** — Volume trends and progression insights
- **Settings** — Configure programs, volume multiplier, and preferences

## Progression Engine

- Linear progression on compound lifts (squat, bench, OHP, deadlift, row, etc.)
- Auto-derived volume weights (configurable percentage of intensity weight)
- 3-failure reset with 5% deload, rounded to increment
- Streak and PR tracking per lift

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: Supabase (Postgres + Auth + RLS)
- **State**: Zustand (session store with localStorage persistence)
- **Styling**: Inline styles with DM Mono + Bebas Neue fonts

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Requires a `.env.local` with Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
