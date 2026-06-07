export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      exercises: {
        Row: {
          id: string
          increment_lbs: number | null
          is_auto_volume: boolean
          is_run: boolean
          name: string
          parent_key: string | null
          progression_type: string
          reps: number
          sets: number
          sort_order: number
          weight_key: string | null
          workout_day_id: string
        }
        Insert: {
          id?: string
          increment_lbs?: number | null
          is_auto_volume?: boolean
          is_run?: boolean
          name: string
          parent_key?: string | null
          progression_type: string
          reps?: number
          sets?: number
          sort_order?: number
          weight_key?: string | null
          workout_day_id: string
        }
        Update: {
          id?: string
          increment_lbs?: number | null
          is_auto_volume?: boolean
          is_run?: boolean
          name?: string
          parent_key?: string | null
          progression_type?: string
          reps?: number
          sets?: number
          sort_order?: number
          weight_key?: string | null
          workout_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bodyweight: number | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          bodyweight?: number | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          bodyweight?: number | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          current_week: number
          deload_week: number | null
          friday_alt: string
          id: string
          is_active: boolean
          name: string
          user_id: string
          volume_pct: number
          week_number: number
          week_type: string
        }
        Insert: {
          created_at?: string
          current_week?: number
          deload_week?: number | null
          friday_alt?: string
          id?: string
          is_active?: boolean
          name: string
          user_id: string
          volume_pct?: number
          week_number?: number
          week_type?: string
        }
        Update: {
          created_at?: string
          current_week?: number
          deload_week?: number | null
          friday_alt?: string
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
          volume_pct?: number
          week_number?: number
          week_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      run_logs: {
        Row: {
          duration_minutes: number | null
          exercise_id: string
          id: string
          notes: string | null
          pace_actual: string | null
          pace_target: string | null
          rounds_completed: number | null
          rounds_target: number | null
          session_id: string
        }
        Insert: {
          duration_minutes?: number | null
          exercise_id: string
          id?: string
          notes?: string | null
          pace_actual?: string | null
          pace_target?: string | null
          rounds_completed?: number | null
          rounds_target?: number | null
          session_id: string
        }
        Update: {
          duration_minutes?: number | null
          exercise_id?: string
          id?: string
          notes?: string | null
          pace_actual?: string | null
          pace_target?: string | null
          rounds_completed?: number | null
          rounds_target?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_overrides: {
        Row: {
          created_at: string
          date: string
          id: string
          program_id: string
          workout_day_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          program_id: string
          workout_day_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          program_id?: string
          workout_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_overrides_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
      }
      session_sets: {
        Row: {
          completed: boolean
          exercise_id: string
          id: string
          reps_actual: number | null
          reps_target: number
          session_id: string
          set_number: number
          weight_lbs: number | null
        }
        Insert: {
          completed?: boolean
          exercise_id: string
          id?: string
          reps_actual?: number | null
          reps_target: number
          session_id: string
          set_number: number
          weight_lbs?: number | null
        }
        Update: {
          completed?: boolean
          exercise_id?: string
          id?: string
          reps_actual?: number | null
          reps_target?: number
          session_id?: string
          set_number?: number
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          date: string
          friday_alt: string | null
          id: string
          logged_at: string
          notes: string | null
          program_id: string
          rpe: number | null
          status: string
          volume_lbs: number | null
          week_number: number
          week_type: string
          weight_snapshot: Json | null
          workout_day_id: string
        }
        Insert: {
          date: string
          friday_alt?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          program_id: string
          rpe?: number | null
          status: string
          volume_lbs?: number | null
          week_number?: number
          week_type?: string
          weight_snapshot?: Json | null
          workout_day_id: string
        }
        Update: {
          date?: string
          friday_alt?: string | null
          id?: string
          logged_at?: string
          notes?: string | null
          program_id?: string
          rpe?: number | null
          status?: string
          volume_lbs?: number | null
          week_number?: number
          week_type?: string
          weight_snapshot?: Json | null
          workout_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
      }
      training_log: {
        Row: {
          changes: Json | null
          created_at: string | null
          date: string
          exercises: Json | null
          id: string
          name: string | null
          notes: string | null
          run_pace: Json | null
          type: string | null
          volume: number | null
          week: number | null
        }
        Insert: {
          changes?: Json | null
          created_at?: string | null
          date: string
          exercises?: Json | null
          id?: string
          name?: string | null
          notes?: string | null
          run_pace?: Json | null
          type?: string | null
          volume?: number | null
          week?: number | null
        }
        Update: {
          changes?: Json | null
          created_at?: string | null
          date?: string
          exercises?: Json | null
          id?: string
          name?: string | null
          notes?: string | null
          run_pace?: Json | null
          type?: string | null
          volume?: number | null
          week?: number | null
        }
        Relationships: []
      }
      training_state: {
        Row: {
          bodyweight: number | null
          id: string
          progress: Json | null
          updated_at: string | null
          week: number | null
          weights: Json | null
        }
        Insert: {
          bodyweight?: number | null
          id?: string
          progress?: Json | null
          updated_at?: string | null
          week?: number | null
          weights?: Json | null
        }
        Update: {
          bodyweight?: number | null
          id?: string
          progress?: Json | null
          updated_at?: string | null
          week?: number | null
          weights?: Json | null
        }
        Relationships: []
      }
      weight_history: {
        Row: {
          change_reason: string
          created_at: string
          failures_at_change: number
          id: string
          program_id: string
          session_id: string | null
          weight_after: number
          weight_before: number
          weight_key: string
        }
        Insert: {
          change_reason: string
          created_at?: string
          failures_at_change?: number
          id?: string
          program_id: string
          session_id?: string | null
          weight_after: number
          weight_before: number
          weight_key: string
        }
        Update: {
          change_reason?: string
          created_at?: string
          failures_at_change?: number
          id?: string
          program_id?: string
          session_id?: string | null
          weight_after?: number
          weight_before?: number
          weight_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "weight_history_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      working_weights: {
        Row: {
          failures: number
          id: string
          key: string
          pr_lbs: number | null
          program_id: string
          streak: number
          updated_at: string
          weight_lbs: number
        }
        Insert: {
          failures?: number
          id?: string
          key: string
          pr_lbs?: number | null
          program_id: string
          streak?: number
          updated_at?: string
          weight_lbs: number
        }
        Update: {
          failures?: number
          id?: string
          key?: string
          pr_lbs?: number | null
          program_id?: string
          streak?: number
          updated_at?: string
          weight_lbs?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_weights_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_days: {
        Row: {
          day_of_week: number
          id: string
          is_volume: boolean
          name: string
          program_id: string
          tag: string | null
          type: string
          variant: string | null
          week_type: string
        }
        Insert: {
          day_of_week: number
          id?: string
          is_volume?: boolean
          name: string
          program_id: string
          tag?: string | null
          type: string
          variant?: string | null
          week_type?: string
        }
        Update: {
          day_of_week?: number
          id?: string
          is_volume?: boolean
          name?: string
          program_id?: string
          tag?: string | null
          type?: string
          variant?: string | null
          week_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_days_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_session: {
        Args: { payload: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ── Convenience row types ──────────────────────────────────────────────────
// The generated schema widens Postgres CHECK-constraint columns to bare
// `string`. We re-narrow those domains here so the UI keeps its precise unions
// while inserts/joins still resolve against the generated relational metadata.
type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

export type WeekType = 'A' | 'B'
export type WorkoutWeekType = 'A' | 'B' | 'both'
export type WorkoutType = 'lift' | 'run' | 'combo' | 'rest'
export type ProgressionType = 'linear' | 'auto' | 'bodyweight' | 'run'
export type SessionStatus = 'completed' | 'partial' | 'skipped' | 'undone'
export type ChangeReason = 'progression' | 'failure_hold' | 'failure_reset' | 'manual' | 'deload'
export type Variant = 'A1' | 'A2' | null

export type Profile = Row<'profiles'>
export type Program = Omit<Row<'programs'>, 'week_type'> & { week_type: WeekType }
export type WorkoutDay = Omit<Row<'workout_days'>, 'week_type' | 'type' | 'variant'> & {
  week_type: WorkoutWeekType
  type: WorkoutType
  variant: Variant
}
export type Exercise = Omit<Row<'exercises'>, 'progression_type'> & { progression_type: ProgressionType }
export type WorkingWeight = Row<'working_weights'>
export type Session = Omit<Row<'sessions'>, 'week_type' | 'status'> & {
  week_type: WeekType
  status: SessionStatus
}
export type SessionSet = Row<'session_sets'>
export type RunLog = Row<'run_logs'>
export type WeightHistory = Omit<Row<'weight_history'>, 'change_reason'> & { change_reason: ChangeReason }
export type ScheduleOverride = Row<'schedule_overrides'>
