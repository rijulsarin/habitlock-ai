/**
 * Pattern 5: Context Model Update and Plan Adjustment
 *
 * Single LLM call (not conversational). The user has reported a context change.
 * For each habit whose context_constraints don't match the current mode,
 * the LLM proposes a realistic alternative if-then plan for the disrupted period.
 *
 * Does NOT say "skip it" — tries to find an alternative cue/behavior that
 * can execute in the current context. Preserves the identity frame.
 */

import { chat } from '../llm';
import { ContextMode, Habit, HabitAdjustment } from '../../types';

const MODE_DESCRIPTIONS: Record<ContextMode, string> = {
  baseline: 'Normal routine — no disruption.',
  travel: 'Away from home. Hotel or different city. Usual environment not available.',
  high_stress: 'High-pressure period — work deadline, personal crisis, or elevated anxiety. Cognitive load is high.',
  schedule_disrupted: 'Schedule is unpredictable. Normal timing of cues is unreliable.',
  low_energy_period: 'Low physical or mental energy — illness, poor sleep, or recovery period.',
};

const SYSTEM_PROMPT = `You are a behavioral coach helping someone adapt their habits to a temporary life disruption. The user's context has changed and some habits may not be executable in their normal form.

For each habit provided:
1. Check if the context disruption is likely to affect this habit (based on its cue, behavior, and context_constraints)
2. If it IS affected: propose a specific, realistic adapted if-then plan for this context. Preserve the identity frame. Do not say "skip it" — find the minimal viable version or an alternative cue that works in this context.
3. If it is NOT affected: output null for that habit.

Rules:
- The adapted behavior should be simpler and more achievable, not abandoned
- Preserve the identity frame (what the habit is building toward) even if the behavior changes
- Be specific: "IF I'm in the hotel gym at 7am, THEN I will do 15 minutes on the treadmill" not "try to exercise"
- Output ONLY valid JSON — no markdown, no explanation

Output format:
{
  "adjustments": [
    {
      "habit_id": "the-habit-id",
      "affected": true,
      "adjusted_cue": "the adapted cue for this context",
      "adjusted_behavior": "the adapted behavior for this context",
      "note": "one sentence explaining the adaptation"
    },
    {
      "habit_id": "another-habit-id",
      "affected": false,
      "adjusted_cue": null,
      "adjusted_behavior": null,
      "note": null
    }
  ]
}`;

export async function generateContextAdjustments(
  habits: Habit[],
  mode: ContextMode
): Promise<Record<string, HabitAdjustment>> {
  if (habits.length === 0 || mode === 'baseline') return {};

  const modeDescription = MODE_DESCRIPTIONS[mode];
  const habitList = habits.map((h) => ({
    id: h.id,
    name: h.name,
    identity_frame: h.identity_frame,
    cue: h.cue,
    behavior: h.behavior,
    context_constraints: h.context_constraints,
  }));

  const userMessage = `Current context: ${modeDescription}

Habits to evaluate:
${JSON.stringify(habitList, null, 2)}

Generate adapted plans for habits that are affected by this context change.`;

  const raw = await chat([{ role: 'user', content: userMessage }], SYSTEM_PROMPT);
  const json = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`LLM returned invalid JSON during context adjustment:\n${raw}`);
  }

  const adjustments: Record<string, HabitAdjustment> = {};
  for (const item of parsed.adjustments ?? []) {
    if (item.affected && item.adjusted_cue && item.adjusted_behavior) {
      adjustments[item.habit_id] = {
        adjusted_cue: item.adjusted_cue,
        adjusted_behavior: item.adjusted_behavior,
        note: item.note ?? '',
      };
    }
  }
  return adjustments;
}
