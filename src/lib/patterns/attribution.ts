/**
 * Pattern 2: Miss Attribution and Plan Repair
 *
 * When a check-in is missed, this runs a short conversational loop:
 *   1. Opens with compassion framing (never shame)
 *   2. Asks what happened
 *   3. Classifies the miss into a cause type
 *   4. Generates a specific plan repair — not generic advice
 *
 * Output is a MissAttribution object stored on the CheckIn event.
 */

import { chat } from '../llm';
import { ChatMessage, Habit, MissAttribution, MissCauseType, ObstaclePlan } from '../../types';

function buildAttributionSystemPrompt(habit: Habit): string {
  return `You are a compassionate behavioral coach. A user missed their habit and you're having a short conversation to understand why — and to suggest a specific plan repair.

The habit they missed:
- Name: ${habit.name}
- Cue: "${habit.cue}"
- Behavior: "${habit.behavior}"
- Identity frame: "${habit.identity_frame}"

Your approach:
1. Open with compassion — not disappointment. Missing a habit is data, not failure.
2. Ask a single, open question about what happened. Keep it warm.
3. Listen carefully to the response.
4. When you understand the cause, end your message with exactly: [READY_TO_ATTRIBUTE]
- Do NOT explain that you're classifying anything.
- Keep replies short (2-3 sentences).
- Never use the word "streak" or imply they failed.`;
}

const ATTRIBUTION_EXTRACTION_SYSTEM = `You are extracting structured data from a habit miss conversation.
Output ONLY valid JSON — no markdown, no explanation:

{
  "cause_type": one of: "wrong_cue" | "high_friction" | "context_shift" | "competing_priority" | "energy_state" | "forgotten",
  "user_report": "brief summary of what the user said in their own words",
  "plan_repair": "a specific, concrete modification to the if-then plan that addresses the cause",
  "is_situational": true or false,
  "obstacle_trigger": "short phrase describing the situational condition, or null if not situational"
}

is_situational should be TRUE for cause types: context_shift, competing_priority, energy_state.
These are temporary conditions — the original habit plan is still correct for normal days.
The repair should become a conditional fallback (IF this situation occurs, THEN do this instead), NOT replace the main plan.

is_situational should be FALSE for cause types: wrong_cue, high_friction, forgotten.
These suggest the original plan itself needs updating — replace it.

For plan_repair: be specific. Not "try harder" or "set a reminder."
Example situational: "IF low energy, THEN do a 5-minute version instead of 10."
Example fundamental: "Move the cue from leaving the office to sitting down after lunch — more reliable trigger."`;

export function buildAttributionOpener(habit: Habit): string {
  return `Hey — ${habit.name} didn't happen. That's okay, it's just information. What got in the way?`;
}

export async function attributionTurn(
  history: ChatMessage[],
  habit: Habit
): Promise<string> {
  return chat(history, buildAttributionSystemPrompt(habit));
}

export function isReadyToAttribute(reply: string): boolean {
  return reply.includes('[READY_TO_ATTRIBUTE]');
}

export function stripAttributeSignal(reply: string): string {
  return reply.replace('[READY_TO_ATTRIBUTE]', '').trim();
}

export async function extractAttribution(
  history: ChatMessage[],
  habit: Habit
): Promise<MissAttribution> {
  const extractionHistory: ChatMessage[] = [
    ...history,
    {
      role: 'user',
      content: 'Based on our conversation, extract the miss attribution as JSON.',
    },
  ];

  const raw = await chat(extractionHistory, ATTRIBUTION_EXTRACTION_SYSTEM);
  const json = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`LLM returned invalid JSON during attribution extraction:\n${raw}`);
  }

  return {
    cause_type: (parsed.cause_type as MissCauseType) ?? 'forgotten',
    user_report: parsed.user_report ?? '',
    plan_repair: parsed.plan_repair ?? '',
    applied: false,
    // Extra fields used by the UI to decide how to apply the repair
    _is_situational: parsed.is_situational === true,
    _obstacle_trigger: parsed.obstacle_trigger ?? null,
  } as MissAttribution & { _is_situational: boolean; _obstacle_trigger: string | null };
}

import { randomUUID } from 'expo-crypto';

/**
 * For situational misses: extract an ObstaclePlan from the repair.
 * The original habit plan stays intact; this plan fires only in this situation.
 */
const OBSTACLE_EXTRACTION_SYSTEM = `Extract a structured obstacle plan from a plan repair description.
Output ONLY valid JSON — no markdown, no explanation:

{
  "obstacle": "short label for the obstacle/situation (e.g. 'low energy day', 'late meeting')",
  "if_then_response": "IF [obstacle trigger], THEN I will [adapted behavior]",
  "trigger_contexts": ["relevant", "context", "tags"]
}

The if_then_response must be a complete if-then sentence, not just the behavior.`;

export async function extractSituationalObstaclePlan(
  planRepair: string,
  obstacleTrigger: string | null
): Promise<ObstaclePlan> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `Plan repair: "${planRepair}"\nObstacle trigger: "${obstacleTrigger ?? 'situational'}"\n\nExtract the obstacle plan as JSON.`,
    },
  ];
  const raw = await chat(messages, OBSTACLE_EXTRACTION_SYSTEM);
  const json = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    const parsed = JSON.parse(json);
    return {
      id: randomUUID(),
      obstacle: parsed.obstacle ?? obstacleTrigger ?? 'Situational obstacle',
      if_then_response: parsed.if_then_response ?? planRepair,
      trigger_contexts: parsed.trigger_contexts ?? [],
    };
  } catch {
    // Fallback: build a basic obstacle plan from the raw repair text
    return {
      id: randomUUID(),
      obstacle: obstacleTrigger ?? 'Situational obstacle',
      if_then_response: planRepair,
      trigger_contexts: [],
    };
  }
}

/**
 * Given an accepted plan_repair string, extract the new cue and behavior so they
 * can be written back to the Habit. Returns null if the repair doesn't specify
 * a concrete cue/behavior change (e.g. it's advice rather than a plan rewrite).
 */
const REPAIR_EXTRACTION_SYSTEM = `You extract a revised if-then plan from a plan repair description.
Output ONLY valid JSON — no markdown, no explanation:

{
  "new_cue": "the updated situational trigger, or null if unchanged",
  "new_behavior": "the updated behavior, or null if unchanged"
}

If the repair is general advice without a specific new cue or behavior, return null for both fields.`;

export async function extractRepairPlan(
  originalHabit: Habit,
  planRepair: string
): Promise<{ new_cue: string | null; new_behavior: string | null }> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `Original cue: "${originalHabit.cue}"\nOriginal behavior: "${originalHabit.behavior}"\nPlan repair: "${planRepair}"\n\nExtract the revised if-then plan as JSON.`,
    },
  ];
  const raw = await chat(messages, REPAIR_EXTRACTION_SYSTEM);
  const json = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(json);
  } catch {
    return { new_cue: null, new_behavior: null };
  }
}
