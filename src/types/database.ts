export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          bodyweight: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          bodyweight?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          bodyweight?: number | null
          updated_at?: string
        }
      }
      programs: {
        Row: {
          id: string
          user_id: string
          name: string
          week_number: number
          week_type: 'A' | 'B'
          friday_alt: 'A1' | 'A2'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          week_number?: number
          week_type?: 'A' | 'B'
          friday_alt?: 'A1' | 'A2'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          user_id?: string
          name?: string
          week_number?: number
          week_type?: 'A' | 'B'
          friday_alt?: 'A1' | 'A2'
          is_active?: boolean
        }
      }
      workout_days: {
        Row: {
          id: string
          program_id: string
          day_of_week: number
          week_type: 'A' | 'B' | 'both'
          variant: string | null
          is_volume: boolean
          name: string
          type: 'lift' | 'run' | 'combo' | 'rest'
          tag: string | null
        }
        Insert: {
          id?: string
          program_id: string
          day_of_week: number
          week_type: 'A' | 'B' | 'both'
          variant?: string | null
          is_volume?: boolean
          name: string
          type: 'lift' | 'run' | 'combo' | 'rest'
          tag?: string | null
        }
        Update: {
          name?: string
          type?: 'lift' | 'run' | 'combo' | 'rest'
          tag?: string | null
          is_volume?: boolean
        }
      }
      exercises: {
        Row: {
          id: string
          workout_day_id: string
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
        Insert: {
          id?: string
          workout_day_id: string
          name: string
          sets?: number
          reps?: number
          weight_key?: string | null
          progression_type: 'linear' | 'auto' | 'bodyweight' | 'run'
          increment_lbs?: number | null
          is_auto_volume?: boolean
          parent_key?: string | null
          is_run?: boolean
          sort_order?: number
        }
        Update: {
          name?: string
          sets?: number
          reps?: number
          weight_key?: string | null
          progression_type?: 'linear' | 'auto' | 'bodyweight' | 'run'
          increment_lbs?: number | null
          is_auto_volume?: boolean
          parent_key?: string | null
          is_run?: boolean
          sort_order?: number
        }
      }
      working_weights: {
        Row: {
          id: string
          program_id: string
          key: string
          weight_lbs: number
          failures: number
          streak: number
          pr_lbs: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          program_id: string
          key: string
          weight_lbs: number
          failures?: number
          streak?: number
          pr_lbs?: number | null
          updated_at?: string
        }
        Update: {
          weight_lbs?: number
          failures?: number
          streak?: number
          pr_lbs?: number | null
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          program_id: string
          workout_day_id: string
          date: string
          week_number: number
          week_type: 'A' | 'B'
          friday_alt: string | null
          status: 'completed' | 'partial' | 'skipped' | 'undone'
          notes: string | null
          volume_lbs: number | null
          weight_snapshot: Json | null
          logged_at: string
          rpe: number | null
        }
        Insert: {
          id?: string
          program_id: string
          workout_day_id: string
          date: string
          week_number: number
          week_type: 'A' | 'B'
          friday_alt?: string | null
          status: 'completed' | 'partial' | 'skipped' | 'undone'
          notes?: string | null
          volume_lbs?: number | null
          weight_snapshot?: Json | null
          logged_at?: string
          rpe?: number | null
        }
        Update: {
          status?: 'completed' | 'partial' | 'skipped' | 'undone'
          notes?: string | null
          volume_lbs?: number | null
          weight_snapshot?: Json | null
          rpe?: number | null
        }
      }
      session_sets: {
        Row: {
          id: string
          session_id: string
          exercise_id: string
          set_number: number
          completed: boolean
          weight_lbs: number | null
          reps_target: number
          reps_actual: number | null
        }
        Insert: {
          id?: string
          session_id: string
          exercise_id: string
          set_number: number
          completed: boolean
          weight_lbs?: number | null
          reps_target: number
          reps_actual?: number | null
        }
        Update: {
          completed?: boolean
          reps_actual?: number | null
        }
      }
      run_logs: {
        Row: {
          id: string
          session_id: string
          exercise_id: string
          pace_actual: string | null
          pace_target: string | null
          duration_minutes: number | null
          rounds_completed: number | null
          rounds_target: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          session_id: string
          exercise_id: string
          pace_actual?: string | null
          pace_target?: string | null
          duration_minutes?: number | null
          rounds_completed?: number | null
          rounds_target?: number | null
          notes?: string | null
        }
        Update: {
          pace_actual?: string | null
          rounds_completed?: number | null
          notes?: string | null
        }
      }
      weight_history: {
        Row: {
          id: string
          program_id: string
          session_id: string | null
          weight_key: string
          weight_before: number
          weight_after: number
          change_reason: 'progression' | 'failure_hold' | 'failure_reset' | 'manual' | 'deload'
          failures_at_change: number
          created_at: string
        }
        Insert: {
          id?: string
          program_id: string
          session_id?: string | null
          weight_key: string
          weight_before: number
          weight_after: number
          change_reason: 'progression' | 'failure_hold' | 'failure_reset' | 'manual' | 'deload'
          failures_at_change: number
          created_at?: string
        }
        Update: never
      }
    }
  }
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Program = Database['public']['Tables']['programs']['Row']
export type WorkoutDay = Database['public']['Tables']['workout_days']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']
export type WorkingWeight = Database['public']['Tables']['working_weights']['Row']
export type Session = Database['public']['Tables']['sessions']['Row']
export type SessionSet = Database['public']['Tables']['session_sets']['Row']
export type RunLog = Database['public']['Tables']['run_logs']['Row']
export type WeightHistory = Database['public']['Tables']['weight_history']['Row']
