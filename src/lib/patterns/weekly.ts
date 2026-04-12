/**
 * Pattern 3 (weekly variant): Weekly Summary Narrative
 *
 * Generates a short identity-framed reflection on the user's week across
 * all habits. Segment-calibrated tone. Non-blocking — screen renders
 * without it and updates when the call resolves.
 *
 * Never uses the word "streak." Never shame-frames a miss.
 * A mixed or poor week gets compassion-forward framing, not a penalty.
 */

import { chat } from '../llm';
import { Habit, UserSegment } from '../../types';

export interface WeekHabitStat {
  habit: Habit;
  completionsThisWeek: number;
  expectedThisWeek: number;
  missesThisWeek: number;
}

const SYSTEM_BY_SEGMENT: Record<UserSegment, string> = {
  striver:
    'Be autonomy-supporting and data-forward. Acknowledge specific progress without over-celebrating. Frame identity as earned through consistency, not perfection.',
  restarter:
    'Be compassion-forward. Normalize imperfection. Emphasize that any progress is meaningful and that a mixed week is data, not failure. Never imply shame.',
  designer:
    'Be analytical. Reference patterns and what the data suggests. Treat this as a system review, not a pep talk.',
  context_collapsed:
    'Be practical and low-friction. Acknowledge that maintaining any habit during disruption is meaningful. Keep it short.',
};

export async function generateWeeklySummary(
  stats: WeekHabitStat[],
  segment: UserSegment
): Promise<string> {
  const totalCompletions = stats.reduce((s, r) => s + r.completionsThisWeek, 0);
  const totalExpected = stats.reduce((s, r) => s + r.expectedThisWeek, 0);
  const totalMisses = stats.reduce((s, r) => s + r.missesThisWeek, 0);

  const habitLines = stats.map((r) =>
    `- ${r.habit.name} (identity: "${r.habit.identity_frame}"): ${r.completionsThisWeek} of ${r.expectedThisWeek} expected sessions completed, ${r.missesThisWeek} logged misses`
  ).join('\n');

  const systemPrompt = `You are writing a weekly habit reflection for a user. Write 2–3 sentences maximum. ${SYSTEM_BY_SEGMENT[segment]}

Rules:
- Never use the word "streak"
- Never frame a miss as a failure — it's data
- Reference the specific habits and identity frames provided, not generic phrases
- If the week was poor, lead with compassion, then a forward-looking note
- Output only the narrative — no headers, no bullet points`;

  const userMessage = `Here is the user's week:
${habitLines}

Total: ${totalCompletions} of ${totalExpected} expected sessions completed, ${totalMisses} logged misses.

Write the weekly reflection.`;

  return chat([{ role: 'user', content: userMessage }], systemPrompt);
}
