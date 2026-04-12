/**
 * Pattern 3: Identity Narrative Generation
 *
 * After a successful check-in, generates a short (1-3 sentence) identity-reinforcing
 * message specific to this user's habit and progress. Not a template — uses the
 * habit's identity_frame and consistency rate to produce something that feels earned.
 *
 * Evaluation criteria (from CLAUDE.md):
 * - References the specific behavior or identity frame (not generic "great job!")
 * - Frames the behavior as identity evidence
 * - Does NOT use the word "streak"
 * - Calibrated in tone to the user's segment
 */

import { chat } from '../llm';
import { ConsistencyRate, Habit } from '../../types';

function buildIdentitySystemPrompt(habit: Habit, rate: ConsistencyRate, minimumVersion = false): string {
  const segmentGuidance: Record<string, string> = {
    striver: 'Be direct and specific. Respect their intelligence. Data-forward. Do not over-celebrate.',
    restarter: 'Be warm and compassion-forward. Emphasize progress over perfection. Avoid any language that implies judgment.',
    designer: 'Be causal and analytical. "Here is what the pattern suggests" over "great job."',
    context_collapsed: 'Be practical and low-friction. Do not add cognitive load.',
  };

  const minimumNote = minimumVersion
    ? '\nThe user completed the SHORT VERSION of this habit today — a stripped-down minimum for a hard day. Acknowledge this warmly. Frame choosing something over nothing as real identity evidence. Do not diminish the short version. Do not suggest they should have done more.'
    : '';

  return `You generate short, identity-reinforcing messages after someone completes a habit.

Habit: "${habit.name}"
Identity frame: "${habit.identity_frame}"
Behavior completed: "${habit.behavior}"
Consistency: ${rate.completions} completions in the last ${rate.window_days} days (${rate.label})
User segment: ${habit.segment_hint}
Tone guidance: ${segmentGuidance[habit.segment_hint] ?? segmentGuidance.striver}

Rules:
- Write 1-3 sentences only
- Reference the specific identity frame or behavior — not generic praise
- Frame the completed behavior as evidence of who they are becoming
- NEVER use the word "streak"
- Do not start with "Great job" or "Well done" or similar hollow openers
- Output only the message — no quotes, no labels${minimumNote}`;
}

export async function generateIdentityNarrative(
  habit: Habit,
  rate: ConsistencyRate,
  options?: { minimumVersion?: boolean }
): Promise<string> {
  const minimumVersion = options?.minimumVersion ?? false;
  const messages = [
    {
      role: 'user' as const,
      content: `I just completed my "${habit.name}" habit${minimumVersion ? ' (short version)' : ''}. Generate the identity message.`,
    },
  ];
  return chat(messages, buildIdentitySystemPrompt(habit, rate, minimumVersion));
}
