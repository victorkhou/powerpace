export type ExerciseSeed = {
  name: string
  sets: number
  reps: number
  weight_key: string | null
  progression_type: 'linear' | 'auto' | 'bodyweight' | 'run'
  increment_lbs: number | null
  is_auto_volume: boolean
  parent_key: string | null
  is_run: boolean
  sort_order: number
}

export type DaySeed = {
  day_of_week: number
  week_type: 'A' | 'B' | 'both'
  variant: string | null
  is_volume: boolean
  name: string
  type: 'lift' | 'run' | 'combo' | 'rest'
  tag: string | null
  exercises: ExerciseSeed[]
}

export const SEED_DAYS: DaySeed[] = [
  // Monday — Legs Volume (both weeks)
  {
    day_of_week: 1, week_type: 'both', variant: null, is_volume: true,
    name: 'Legs Volume', type: 'lift', tag: 'Squat 5×5 @ 87.5%',
    exercises: [
      { name: 'Back Squat', sets: 5, reps: 5, weight_key: 'squatVol', progression_type: 'auto', increment_lbs: null, is_auto_volume: true, parent_key: 'squat', is_run: false, sort_order: 0 },
      { name: 'RDL', sets: 3, reps: 5, weight_key: 'rdl', progression_type: 'linear', increment_lbs: 2.5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 1 },
      { name: 'Good Mornings', sets: 3, reps: 8, weight_key: 'goodMornings', progression_type: 'linear', increment_lbs: 2.5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 2 },
    ],
  },
  // Tuesday Week A — Push Volume A1 (Flat Bench leads)
  {
    day_of_week: 2, week_type: 'A', variant: 'A1', is_volume: true,
    name: 'Push Volume', type: 'lift', tag: 'Bench 5×5 @ 87.5%',
    exercises: [
      { name: 'Flat Bench', sets: 5, reps: 5, weight_key: 'benchVol', progression_type: 'auto', increment_lbs: null, is_auto_volume: true, parent_key: 'bench', is_run: false, sort_order: 0 },
      { name: 'OHP', sets: 5, reps: 5, weight_key: 'ohpVol', progression_type: 'auto', increment_lbs: null, is_auto_volume: true, parent_key: 'ohp', is_run: false, sort_order: 1 },
      { name: 'CGBP', sets: 3, reps: 8, weight_key: 'cgbp', progression_type: 'linear', increment_lbs: 2.5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 2 },
      { name: 'Dips', sets: 2, reps: 10, weight_key: null, progression_type: 'bodyweight', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 3 },
    ],
  },
  // Tuesday Week A — Push Volume A2 (Incline Bench leads)
  {
    day_of_week: 2, week_type: 'A', variant: 'A2', is_volume: true,
    name: 'Push Volume', type: 'lift', tag: 'Incline 5×5 @ 87.5%',
    exercises: [
      { name: 'Incline Bench', sets: 5, reps: 5, weight_key: 'inclineVol', progression_type: 'auto', increment_lbs: null, is_auto_volume: true, parent_key: 'incline', is_run: false, sort_order: 0 },
      { name: 'OHP', sets: 5, reps: 5, weight_key: 'ohpVol', progression_type: 'auto', increment_lbs: null, is_auto_volume: true, parent_key: 'ohp', is_run: false, sort_order: 1 },
      { name: 'CGBP', sets: 3, reps: 8, weight_key: 'cgbp', progression_type: 'linear', increment_lbs: 2.5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 2 },
      { name: 'Dips', sets: 2, reps: 10, weight_key: null, progression_type: 'bodyweight', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 3 },
    ],
  },
  // Tuesday Week B — Pull Volume
  {
    day_of_week: 2, week_type: 'B', variant: null, is_volume: true,
    name: 'Pull Volume', type: 'lift', tag: 'Row 5×5 @ 87.5%',
    exercises: [
      { name: 'Deadlift', sets: 3, reps: 5, weight_key: 'deadlift', progression_type: 'linear', increment_lbs: 5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 0 },
      { name: 'Barbell Row', sets: 5, reps: 5, weight_key: 'rowVol', progression_type: 'auto', increment_lbs: null, is_auto_volume: true, parent_key: 'row', is_run: false, sort_order: 1 },
      { name: 'Pull-ups', sets: 2, reps: 8, weight_key: null, progression_type: 'bodyweight', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 2 },
    ],
  },
  // Wednesday Week A — Pull Volume + Easy Jog
  {
    day_of_week: 3, week_type: 'A', variant: null, is_volume: true,
    name: 'Pull Volume + Easy Jog', type: 'combo', tag: 'Row 5×5 @ 87.5%',
    exercises: [
      { name: 'Deadlift', sets: 3, reps: 5, weight_key: 'deadlift', progression_type: 'linear', increment_lbs: 5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 0 },
      { name: 'Barbell Row', sets: 5, reps: 5, weight_key: 'rowVol', progression_type: 'auto', increment_lbs: null, is_auto_volume: true, parent_key: 'row', is_run: false, sort_order: 1 },
      { name: 'Pull-ups', sets: 2, reps: 8, weight_key: null, progression_type: 'bodyweight', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 2 },
      { name: 'Easy Jog', sets: 1, reps: 1, weight_key: null, progression_type: 'run', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: true, sort_order: 3 },
    ],
  },
  // Wednesday Week B — Push Volume + Easy Jog
  {
    day_of_week: 3, week_type: 'B', variant: null, is_volume: true,
    name: 'Push Volume + Easy Jog', type: 'combo', tag: 'Bench 5×5 @ 87.5%',
    exercises: [
      { name: 'Flat Bench', sets: 5, reps: 5, weight_key: 'benchVol', progression_type: 'auto', increment_lbs: null, is_auto_volume: true, parent_key: 'bench', is_run: false, sort_order: 0 },
      { name: 'OHP', sets: 5, reps: 5, weight_key: 'ohpVol', progression_type: 'auto', increment_lbs: null, is_auto_volume: true, parent_key: 'ohp', is_run: false, sort_order: 1 },
      { name: 'CGBP', sets: 3, reps: 8, weight_key: 'cgbp', progression_type: 'linear', increment_lbs: 2.5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 2 },
      { name: 'Dips', sets: 2, reps: 10, weight_key: null, progression_type: 'bodyweight', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 3 },
      { name: 'Easy Jog', sets: 1, reps: 1, weight_key: null, progression_type: 'run', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: true, sort_order: 4 },
    ],
  },
  // Thursday — Legs Intensity (both weeks)
  {
    day_of_week: 4, week_type: 'both', variant: null, is_volume: false,
    name: 'Legs Intensity', type: 'lift', tag: 'Squat + RDL 3×5',
    exercises: [
      { name: 'Back Squat', sets: 3, reps: 5, weight_key: 'squat', progression_type: 'linear', increment_lbs: 5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 0 },
      { name: 'RDL', sets: 3, reps: 5, weight_key: 'rdl', progression_type: 'linear', increment_lbs: 2.5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 1 },
    ],
  },
  // Friday Week A — Push Intensity A1 (Flat Bench)
  {
    day_of_week: 5, week_type: 'A', variant: 'A1', is_volume: false,
    name: 'Push Intensity', type: 'lift', tag: 'Bench 3×5 PR',
    exercises: [
      { name: 'Flat Bench', sets: 3, reps: 5, weight_key: 'bench', progression_type: 'linear', increment_lbs: 5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 0 },
      { name: 'OHP', sets: 3, reps: 5, weight_key: 'ohp', progression_type: 'linear', increment_lbs: 5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 1 },
      { name: 'CGBP', sets: 3, reps: 8, weight_key: 'cgbp', progression_type: 'linear', increment_lbs: 2.5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 2 },
      { name: 'Dips', sets: 2, reps: 8, weight_key: null, progression_type: 'bodyweight', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 3 },
    ],
  },
  // Friday Week A — Push Intensity A2 (Incline Bench)
  {
    day_of_week: 5, week_type: 'A', variant: 'A2', is_volume: false,
    name: 'Push Intensity', type: 'lift', tag: 'Incline 3×5 PR',
    exercises: [
      { name: 'Incline Bench', sets: 3, reps: 5, weight_key: 'incline', progression_type: 'linear', increment_lbs: 5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 0 },
      { name: 'OHP', sets: 3, reps: 5, weight_key: 'ohp', progression_type: 'linear', increment_lbs: 5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 1 },
      { name: 'CGBP', sets: 3, reps: 8, weight_key: 'cgbp', progression_type: 'linear', increment_lbs: 2.5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 2 },
      { name: 'Dips', sets: 2, reps: 8, weight_key: null, progression_type: 'bodyweight', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 3 },
    ],
  },
  // Friday Week B — Pull Intensity
  {
    day_of_week: 5, week_type: 'B', variant: null, is_volume: false,
    name: 'Pull Intensity', type: 'lift', tag: 'DL + Row 3×5',
    exercises: [
      { name: 'Deadlift', sets: 3, reps: 5, weight_key: 'deadlift', progression_type: 'linear', increment_lbs: 5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 0 },
      { name: 'Barbell Row', sets: 3, reps: 5, weight_key: 'row', progression_type: 'linear', increment_lbs: 5, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 1 },
      { name: 'Pull-ups', sets: 2, reps: 8, weight_key: null, progression_type: 'bodyweight', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 2 },
    ],
  },
  // Saturday — Distance Jog (both, optional)
  {
    day_of_week: 6, week_type: 'both', variant: null, is_volume: false,
    name: 'Distance Jog', type: 'run', tag: 'Optional',
    exercises: [
      { name: 'Walk warm-up', sets: 1, reps: 1, weight_key: null, progression_type: 'run', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 0 },
      { name: 'Distance Jog', sets: 1, reps: 1, weight_key: null, progression_type: 'run', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: true, sort_order: 1 },
      { name: 'Walk cool-down', sets: 1, reps: 1, weight_key: null, progression_type: 'run', increment_lbs: null, is_auto_volume: false, parent_key: null, is_run: false, sort_order: 2 },
    ],
  },
  // Sunday — Rest (both)
  {
    day_of_week: 0, week_type: 'both', variant: null, is_volume: false,
    name: 'Rest', type: 'rest', tag: 'Recovery',
    exercises: [],
  },
]

const STARTING_WEIGHTS: Array<{ key: string; weight_lbs: number }> = [
  { key: 'squat', weight_lbs: 220 },
  { key: 'squatVol', weight_lbs: 195 },     // round(220 * 0.875 / 5) * 5 = 195
  { key: 'rdl', weight_lbs: 115 },
  { key: 'goodMornings', weight_lbs: 45 },
  { key: 'bench', weight_lbs: 157.5 },
  { key: 'benchVol', weight_lbs: 137.5 },   // round(157.5 * 0.875 / 2.5) * 2.5 = 137.5
  { key: 'incline', weight_lbs: 145 },
  { key: 'inclineVol', weight_lbs: 127.5 }, // round(145 * 0.875 / 2.5) * 2.5 = 127.5
  { key: 'ohp', weight_lbs: 107.5 },
  { key: 'ohpVol', weight_lbs: 95 },        // round(107.5 * 0.875 / 2.5) * 2.5 = 95
  { key: 'cgbp', weight_lbs: 100 },
  { key: 'row', weight_lbs: 120 },
  { key: 'rowVol', weight_lbs: 105 },       // round(120 * 0.875 / 5) * 5 = 105
  { key: 'deadlift', weight_lbs: 220 },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedProgram(supabase: any, userId: string): Promise<string> {
  const { data: program, error: pErr } = await supabase
    .from('programs')
    .insert({
      user_id: userId,
      name: 'Power + Pace v4 (Texas Method)',
      week_number: 1,
      week_type: 'A',
      friday_alt: 'A1',
      is_active: true,
    })
    .select()
    .single()

  if (pErr || !program) throw new Error(`Failed to create program: ${pErr?.message}`)
  const programId = program.id

  for (const day of SEED_DAYS) {
    const { data: dayRow, error: dErr } = await supabase
      .from('workout_days')
      .insert({
        program_id: programId,
        day_of_week: day.day_of_week,
        week_type: day.week_type,
        variant: day.variant,
        is_volume: day.is_volume,
        name: day.name,
        type: day.type,
        tag: day.tag,
      })
      .select()
      .single()

    if (dErr || !dayRow) throw new Error(`Failed to create day: ${dErr?.message}`)

    if (day.exercises.length > 0) {
      const { error: eErr } = await supabase.from('exercises').insert(
        day.exercises.map((ex) => ({
          workout_day_id: dayRow.id,
          ...ex,
        }))
      )
      if (eErr) throw new Error(`Failed to create exercises: ${eErr.message}`)
    }
  }

  const { error: wErr } = await supabase.from('working_weights').insert(
    STARTING_WEIGHTS.map((w) => ({
      program_id: programId,
      key: w.key,
      weight_lbs: w.weight_lbs,
      failures: 0,
      streak: 0,
      pr_lbs: w.weight_lbs,
    }))
  )
  if (wErr) throw new Error(`Failed to create weights: ${wErr.message}`)

  return programId
}
