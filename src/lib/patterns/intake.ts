/**
 * Pattern 1: If-Then Intake Conversation
 *
 * The LLM conducts a Socratic conversation to extract a specific if-then plan.
 * Output is a structured Habit object — not just a name.
 *
 * Two phases:
 *   1. Conversation — multi-turn until the LLM signals it has enough
 *   2. Extraction — single call that outputs a JSON Habit plan
 */

import { chat } from '../llm';
import { ChatMessage, Habit, UserSegment } from '../../types';
import { randomUUID } from 'expo-crypto';

const INTAKE_SYSTEM_PROMPT = `You are a behavioral coach helping someone design a habit using implementation intentions — a research-backed technique (Gollwitzer, d=0.65) that specifies WHEN, WHERE, and HOW a behavior will happen.

Your job is to guide a warm, conversational intake to extract:
1. A specific situational CUE ("when I sit down with my morning coffee")
2. The exact BEHAVIOR ("I will open the meditation app and do 10 minutes")
3. CONTEXT CONSTRAINTS (when/where this cue is normally present)
4. An IDENTITY FRAME — a first-person statement of who the person is becoming ("someone who starts the day with clarity")

Rules:
- Ask one question at a time. Never overwhelm.
- Be warm and specific, not clinical.
- When the user is vague ("I want to meditate"), ask follow-up questions to make it concrete.
- Keep replies short (2-4 sentences max).
- Do not explain the technique — just use it conversationally.

When ready to save:
- You are ready ONLY when you have a specific cue, a specific behavior, and a sense of the identity frame.
- IMPORTANT: Do NOT emit [READY_TO_EXTRACT] in any message that contains a question. A message cannot both ask a question and signal readiness.
- When ready, write a closing message that: (1) briefly summarizes the if-then plan you've captured in plain language, (2) tells the user you're ready to save it, (3) invites them to refine if anything feels off. End this message with exactly: [READY_TO_EXTRACT]
- Example closing: "Here's what we've got: when you make your morning coffee, you'll sit at the reading chair and open Calm for 10 minutes — building toward being someone who starts the day with clarity. Ready to save this plan? You can also keep refining if anything doesn't feel right. [READY_TO_EXTRACT]"`;

const EXTRACTION_SYSTEM_PROMPT = `You are extracting a structured habit plan from a conversation.
Output ONLY valid JSON matching this exact shape — no markdown, no explanation:

{
  "name": "short label (2-4 words)",
  "identity_frame": "first-person phrase describing the identity being built",
  "cue": "the specific situational trigger",
  "behavior": "the exact action to take when the cue fires",
  "minimum_behavior": "a stripped-down version completable in 2 minutes on a hard day — or null if none is evident",
  "context_constraints": ["array", "of", "context", "tags"],
  "target_frequency": { "times": 1, "per": "day" },
  "segment_hint": "striver"
}

For segment_hint: use "restarter" if the user expressed past failures or anxiety, "striver" otherwise.
For context_constraints: extract tags like "weekday", "home", "traveling", "morning", etc.
For minimum_behavior: infer a realistic minimum only if obvious from the habit (e.g. "Just open the app and take 3 breaths" for meditation). Set to null if no clear minimum exists — do not invent one.`;

/**
 * Send one turn of the intake conversation.
 * Returns the assistant reply.
 * When the reply contains [READY_TO_EXTRACT], the caller should call extractHabit().
 */
export async function intakeTurn(history: ChatMessage[]): Promise<string> {
  return chat(history, INTAKE_SYSTEM_PROMPT);
}

export function isReadyToExtract(reply: string): boolean {
  return reply.includes('[READY_TO_EXTRACT]');
}

export function stripExtractSignal(reply: string): string {
  return reply.replace('[READY_TO_EXTRACT]', '').trim();
}

/**
 * Extract a structured Habit from the completed conversation.
 * Appends an extraction instruction to the history, calls the LLM once.
 */
export async function extractHabit(
  history: ChatMessage[],
  segmentHint: UserSegment = 'striver'
): Promise<Habit> {
  const extractionHistory: ChatMessage[] = [
    ...history,
    {
      role: 'user',
      content:
        'Based on our conversation, extract the structured habit plan as JSON.',
    },
  ];

  const raw = await chat(extractionHistory, EXTRACTION_SYSTEM_PROMPT);

  // Strip any accidental markdown fences
  const json = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`LLM returned invalid JSON during extraction:\n${raw}`);
  }

  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: parsed.name ?? 'My Habit',
    identity_frame: parsed.identity_frame ?? '',
    cue: parsed.cue ?? '',
    behavior: parsed.behavior ?? '',
    context_constraints: parsed.context_constraints ?? [],
    obstacle_plans: [],
    target_frequency: parsed.target_frequency ?? { times: 1, per: 'day' },
    segment_hint: parsed.segment_hint ?? segmentHint,
    created_at: now,
    minimum_behavior: parsed.minimum_behavior ?? undefined,
  };
}

/** Opening message from the assistant to start the intake flow. */
export const INTAKE_OPENER =
  "Let's design this so it actually sticks. Tell me — what habit have you been wanting to build?";
