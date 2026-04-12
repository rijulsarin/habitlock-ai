import * as SQLite from 'expo-sqlite';
import { CheckIn, Habit, MissAttribution, ConsistencyRate, ObstaclePlan, ContextModel, ContextMode } from '../types';

const db = SQLite.openDatabaseSync('habitlock.db');

export function initDB() {
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      identity_frame TEXT NOT NULL,
      cue TEXT NOT NULL,
      behavior TEXT NOT NULL,
      context_constraints TEXT NOT NULL DEFAULT '[]',
      obstacle_plans TEXT NOT NULL DEFAULT '[]',
      target_frequency_times INTEGER NOT NULL DEFAULT 1,
      target_frequency_per TEXT NOT NULL DEFAULT 'day',
      segment_hint TEXT NOT NULL DEFAULT 'striver',
      created_at TEXT NOT NULL,
      cue_time TEXT,
      notification_cue_id TEXT,
      notification_miss_id TEXT
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('completed', 'missed', 'skipped')),
      miss_cause_type TEXT,
      miss_user_report TEXT,
      miss_plan_repair TEXT,
      miss_applied INTEGER DEFAULT 0,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_checkins_habit_id ON checkins(habit_id);
    CREATE INDEX IF NOT EXISTS idx_checkins_timestamp ON checkins(timestamp);

    CREATE TABLE IF NOT EXISTS user_prefs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS context_model (
      id INTEGER PRIMARY KEY DEFAULT 1,
      mode TEXT NOT NULL DEFAULT 'baseline',
      mode_until TEXT,
      active_habit_adjustments TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT ''
    );
  `);

  // Migration guard: add columns for users who installed before these were added
  const habitCols = db
    .getAllSync<{ name: string }>(`PRAGMA table_info(habits)`)
    .map((r) => r.name);
  if (!habitCols.includes('cue_time'))
    db.execSync('ALTER TABLE habits ADD COLUMN cue_time TEXT');
  if (!habitCols.includes('notification_cue_id'))
    db.execSync('ALTER TABLE habits ADD COLUMN notification_cue_id TEXT');
  if (!habitCols.includes('notification_miss_id'))
    db.execSync('ALTER TABLE habits ADD COLUMN notification_miss_id TEXT');
  if (!habitCols.includes('minimum_behavior'))
    db.execSync('ALTER TABLE habits ADD COLUMN minimum_behavior TEXT');
}

// --- Habits ---

export function insertHabit(habit: Habit): void {
  db.runSync(
    `INSERT INTO habits (
      id, name, identity_frame, cue, behavior,
      context_constraints, obstacle_plans,
      target_frequency_times, target_frequency_per,
      segment_hint, created_at, minimum_behavior
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      habit.id,
      habit.name,
      habit.identity_frame,
      habit.cue,
      habit.behavior,
      JSON.stringify(habit.context_constraints),
      JSON.stringify(habit.obstacle_plans),
      habit.target_frequency.times,
      habit.target_frequency.per,
      habit.segment_hint,
      habit.created_at,
      habit.minimum_behavior ?? null,
    ]
  );
}

export function getAllHabits(): Habit[] {
  const rows = db.getAllSync<any>('SELECT * FROM habits ORDER BY created_at ASC');
  return rows.map(rowToHabit);
}

export function getHabitById(id: string): Habit | null {
  const row = db.getFirstSync<any>('SELECT * FROM habits WHERE id = ?', [id]);
  return row ? rowToHabit(row) : null;
}

export function deleteHabit(id: string): void {
  db.runSync('DELETE FROM habits WHERE id = ?', [id]);
}

export function updateHabitCueTime(id: string, cueTime: string): void {
  db.runSync('UPDATE habits SET cue_time = ? WHERE id = ?', [cueTime, id]);
}

// --- User Prefs ---

export function getPref(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM user_prefs WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setPref(key: string, value: string): void {
  db.runSync('INSERT OR REPLACE INTO user_prefs (key, value) VALUES (?, ?)', [key, value]);
}

// --- Context Model ---

export function getContextModel(): ContextModel {
  const row = db.getFirstSync<{
    mode: string;
    mode_until: string | null;
    active_habit_adjustments: string;
    updated_at: string;
  }>('SELECT * FROM context_model WHERE id = 1');

  if (!row) {
    return {
      mode: 'baseline',
      mode_until: null,
      active_habit_adjustments: {},
      updated_at: new Date().toISOString(),
    };
  }

  return {
    mode: row.mode as ContextMode,
    mode_until: row.mode_until ?? null,
    active_habit_adjustments: JSON.parse(row.active_habit_adjustments),
    updated_at: row.updated_at,
  };
}

export function setContextMode(mode: ContextMode, modeUntil: string | null): void {
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO context_model (id, mode, mode_until, active_habit_adjustments, updated_at)
     VALUES (1, ?, ?, '{}', ?)
     ON CONFLICT(id) DO UPDATE SET mode = ?, mode_until = ?, active_habit_adjustments = '{}', updated_at = ?`,
    [mode, modeUntil, now, mode, modeUntil, now]
  );
}

export function setHabitAdjustments(adjustments: Record<string, import('../types').HabitAdjustment>): void {
  db.runSync(
    'UPDATE context_model SET active_habit_adjustments = ? WHERE id = 1',
    [JSON.stringify(adjustments)]
  );
}

export function clearContextMode(): void {
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO context_model (id, mode, mode_until, active_habit_adjustments, updated_at)
     VALUES (1, 'baseline', NULL, '{}', ?)
     ON CONFLICT(id) DO UPDATE SET mode = 'baseline', mode_until = NULL, active_habit_adjustments = '{}', updated_at = ?`,
    [now, now]
  );
}

export function updateHabitObstaclePlans(id: string, plans: ObstaclePlan[]): void {
  db.runSync('UPDATE habits SET obstacle_plans = ? WHERE id = ?', [JSON.stringify(plans), id]);
}

/** Full habit edit — call after user saves changes on the edit screen. */
export function updateHabit(
  id: string,
  fields: { name?: string; cue?: string; behavior?: string; cue_time?: string | null }
): void {
  const sets: string[] = [];
  const values: any[] = [];
  if (fields.name !== undefined) { sets.push('name = ?'); values.push(fields.name); }
  if (fields.cue !== undefined) { sets.push('cue = ?'); values.push(fields.cue); }
  if (fields.behavior !== undefined) { sets.push('behavior = ?'); values.push(fields.behavior); }
  if (fields.cue_time !== undefined) { sets.push('cue_time = ?'); values.push(fields.cue_time); }
  if (sets.length === 0) return;
  values.push(id);
  db.runSync(`UPDATE habits SET ${sets.join(', ')} WHERE id = ?`, values);
}

/**
 * Apply an accepted plan repair from miss attribution.
 * Extracts the new cue/behavior from the plan_repair text and writes it to the habit.
 * The LLM extraction is done in the attribution pattern — this just persists the result.
 */
export function applyPlanRepair(
  habitId: string,
  newCue: string,
  newBehavior: string
): void {
  db.runSync(
    'UPDATE habits SET cue = ?, behavior = ? WHERE id = ?',
    [newCue, newBehavior, habitId]
  );
}

export function updateHabitNotificationIds(
  id: string,
  cueNotifId: string,
  missNotifId: string
): void {
  db.runSync(
    'UPDATE habits SET notification_cue_id = ?, notification_miss_id = ? WHERE id = ?',
    [cueNotifId, missNotifId, id]
  );
}

// --- CheckIns ---

export function insertCheckIn(checkIn: CheckIn): void {
  const attr = checkIn.miss_attribution;
  db.runSync(
    `INSERT INTO checkins (
      id, habit_id, timestamp, status,
      miss_cause_type, miss_user_report, miss_plan_repair, miss_applied,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      checkIn.id,
      checkIn.habit_id,
      checkIn.timestamp,
      checkIn.status,
      attr?.cause_type ?? null,
      attr?.user_report ?? null,
      attr?.plan_repair ?? null,
      attr?.applied ? 1 : 0,
      checkIn.notes ?? null,
    ]
  );
}

export function getCheckInsForHabit(habitId: string, limitDays = 21): CheckIn[] {
  const since = new Date();
  since.setDate(since.getDate() - limitDays);
  const rows = db.getAllSync<any>(
    `SELECT * FROM checkins
     WHERE habit_id = ? AND timestamp >= ?
     ORDER BY timestamp DESC`,
    [habitId, since.toISOString()]
  );
  return rows.map(rowToCheckIn);
}

/** Returns check-ins for a habit from Monday of the current week through now. */
export function getCheckInsThisWeek(habitId: string): CheckIn[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon…6=Sat
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  const rows = db.getAllSync<any>(
    'SELECT * FROM checkins WHERE habit_id = ? AND timestamp >= ? ORDER BY timestamp DESC',
    [habitId, monday.toISOString()]
  );
  return rows.map(rowToCheckIn);
}

export function getLastCheckIn(habitId: string): CheckIn | null {
  const row = db.getFirstSync<any>(
    'SELECT * FROM checkins WHERE habit_id = ? ORDER BY timestamp DESC LIMIT 1',
    [habitId]
  );
  return row ? rowToCheckIn(row) : null;
}

// Update the miss_applied flag after user accepts a plan repair
export function markPlanRepairApplied(checkInId: string): void {
  db.runSync('UPDATE checkins SET miss_applied = 1 WHERE id = ?', [checkInId]);
}

// Update the attribution fields on an existing missed check-in
export function updateCheckInAttribution(
  checkInId: string,
  attr: { cause_type: string; user_report: string; plan_repair: string }
): void {
  db.runSync(
    `UPDATE checkins
     SET miss_cause_type = ?, miss_user_report = ?, miss_plan_repair = ?, miss_applied = 0
     WHERE id = ?`,
    [attr.cause_type, attr.user_report, attr.plan_repair, checkInId]
  );
}

// --- Consistency rate (computed, not stored) ---

export function getConsistencyRate(habitId: string): ConsistencyRate {
  const WINDOW = 21;
  const habit = getHabitById(habitId);
  const checkins = getCheckInsForHabit(habitId, WINDOW);

  const completions = checkins.filter((c) => c.status === 'completed').length;

  // Expected occurrences over window based on target_frequency
  let expected = WINDOW;
  if (habit && habit.target_frequency.per === 'week') {
    expected = Math.round((WINDOW / 7) * habit.target_frequency.times);
  }
  expected = Math.max(expected, 1);

  const rate = Math.min(completions / expected, 1);
  const label = `${completions} of ${expected} ${habit?.target_frequency.per === 'week' ? 'sessions' : 'days'}`;

  return { habit_id: habitId, window_days: WINDOW, completions, expected, rate, label };
}

// --- Row mappers ---

function rowToHabit(row: any): Habit {
  return {
    id: row.id,
    name: row.name,
    identity_frame: row.identity_frame,
    cue: row.cue,
    behavior: row.behavior,
    context_constraints: JSON.parse(row.context_constraints),
    obstacle_plans: JSON.parse(row.obstacle_plans),
    target_frequency: {
      times: row.target_frequency_times,
      per: row.target_frequency_per,
    },
    segment_hint: row.segment_hint,
    created_at: row.created_at,
    cue_time: row.cue_time ?? undefined,
    notification_cue_id: row.notification_cue_id ?? undefined,
    notification_miss_id: row.notification_miss_id ?? undefined,
    minimum_behavior: row.minimum_behavior ?? undefined,
  };
}

function rowToCheckIn(row: any): CheckIn {
  const checkin: CheckIn = {
    id: row.id,
    habit_id: row.habit_id,
    timestamp: row.timestamp,
    status: row.status,
    notes: row.notes ?? undefined,
  };
  if (row.miss_cause_type) {
    checkin.miss_attribution = {
      cause_type: row.miss_cause_type,
      user_report: row.miss_user_report,
      plan_repair: row.miss_plan_repair,
      applied: row.miss_applied === 1,
    };
  }
  return checkin;
}
