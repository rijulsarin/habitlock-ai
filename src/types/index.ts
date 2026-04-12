// Core domain types — match the data model in CLAUDE.md exactly.
// Do not simplify these to name + frequency. The richness here enables the LLM layer.

export type UserSegment = 'striver' | 'restarter' | 'designer' | 'context_collapsed';

export type ContextMode =
  | 'baseline'
  | 'travel'
  | 'high_stress'
  | 'schedule_disrupted'
  | 'low_energy_period';

export type MissCauseType =
  | 'wrong_cue'
  | 'high_friction'
  | 'context_shift'
  | 'competing_priority'
  | 'energy_state'
  | 'forgotten';

export type CheckInStatus = 'completed' | 'missed' | 'skipped';

export interface ObstaclePlan {
  id: string;
  obstacle: string;
  if_then_response: string;
  trigger_contexts: string[]; // contexts where this obstacle is likely
}

export interface Habit {
  id: string;
  name: string;
  identity_frame: string;       // "someone who protects their mental clarity"
  cue: string;                  // "when I sit down with my second cup of coffee"
  behavior: string;             // "I will close my laptop and open the meditation app"
  context_constraints: string[]; // ["weekday", "home", "not traveling"]
  obstacle_plans: ObstaclePlan[];
  target_frequency: {
    times: number;
    per: 'day' | 'week';
  };
  segment_hint: UserSegment;
  created_at: string;           // ISO timestamp
  cue_time?: string;            // "HH:MM" — when the cue typically fires, for scheduling notifications
  notification_cue_id?: string; // Expo notification ID for the cue reminder
  notification_miss_id?: string; // Expo notification ID for the miss-check follow-up
  minimum_behavior?: string;    // Emergency Brake — stripped-down version for hard days
}

export interface MissAttribution {
  cause_type: MissCauseType;
  user_report: string;          // raw text from attribution conversation
  plan_repair: string;          // specific plan adjustment from LLM
  applied: boolean;
}

export interface CheckIn {
  id: string;
  habit_id: string;
  timestamp: string;            // ISO timestamp
  status: CheckInStatus;
  miss_attribution?: MissAttribution;
  notes?: string;
}

// Derived — not stored, computed from CheckIn events
export interface ConsistencyRate {
  habit_id: string;
  window_days: number;          // always 21
  completions: number;
  expected: number;
  rate: number;                 // 0–1
  label: string;                // "14 of 18 days" formatted for display
}

export interface ContextModel {
  mode: ContextMode;
  mode_until: string | null; // ISO timestamp or null
  active_habit_adjustments: Record<string, HabitAdjustment>; // habit_id → adjustment
  updated_at: string;
}

export interface HabitAdjustment {
  adjusted_cue: string;
  adjusted_behavior: string;
  note: string; // why this adjustment was proposed
}

// LLM conversation message shape
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
