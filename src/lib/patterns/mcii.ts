/**
 * Pattern 4: Obstacle Anticipation (MCII Session)
 *
 * Runs a short Mental Contrasting with Implementation Intentions conversation
 * for a specific habit. Three steps:
 *   1. Visualize success — make the positive outcome vivid
 *   2. Surface the obstacle — the most realistic thing that could block it
 *   3. Commit to an if-then response for that obstacle
 *
 * Output: an ObstaclePlan attached to the habit.
 */

import { chat } from '../llm';
import { ChatMessage, Habit, ObstaclePlan } from '../../types';
import { randomUUID } from 'expo-crypto';

const MCII_SYSTEM_PROMPT = `You are a behavioral coach running a brief MCII session (Mental Contrasting with Implementation Intentions — Oettingen). This technique has three steps: (1) visualize success, (2) identify the most likely obstacle, (3) commit to a specific if-then response for that obstacle.

Your job:
- Step 1: Ask the user to briefly imagine this habit going well this week. Keep it concrete and sensory, not abstract.
- Step 2: Ask what's the single most realistic thing that could get in the way.
- Step 3: Help them commit to a specific if-then response: "IF [obstacle], THEN I will [response]."

Rules:
- Keep each message short: 2–3 sentences max, one question at a time.
- Be warm and practical — this is a conversation, not a form.
- Do not ask for multiple obstacles. One obstacle, one plan.
- When you have a clear obstacle AND a concrete if-then response, end your message with exactly: [READY_TO_EXTRACT]
- This should take 3–5 exchanges. Don't drag it out.`;

const EXTRACTION_SYSTEM_PROMPT = `You are extracting a structured obstacle plan from an MCII conversation.
Output ONLY valid JSON matching this exact shape — no markdown, no explanation:

{
  "obstacle": "short description of the obstacle",
  "if_then_response": "IF [obstacle trigger], THEN I will [specific action]",
  "trigger_contexts": ["array", "of", "relevant", "context", "tags"]
}

For trigger_contexts: extract when/where tags like "late meeting", "traveling", "tired", "busy week", etc.
The if_then_response must be specific and actionable — not "I'll try harder" but a concrete behavioral plan.`;

/**
 * Generate the opening message for an MCII session, grounded in the specific habit.
 */
export function getMCIIOpener(habit: Habit): string {
  return `Let's make sure "${habit.name}" actually happens this week. I want to walk through a quick exercise — it takes about 2 minutes and research shows it doubles follow-through.\n\nFirst: picture this habit going well. You're at the moment your cue fires — ${habit.cue} — and you follow through. What does that feel like?`;
}

/**
 * Send one turn of the MCII conversation.
 * Returns the assistant reply.
 * When the reply contains [READY_TO_EXTRACT], the caller should call extractObstaclePlan().
 */
export async function mciiTurn(history: ChatMessage[], habit: Habit): Promise<string> {
  // Inject habit context as a system addendum so the LLM stays grounded
  const contextualSystemPrompt = `${MCII_SYSTEM_PROMPT}

Habit context:
- Name: ${habit.name}
- Identity frame: ${habit.identity_frame}
- Cue: ${habit.cue}
- Behavior: ${habit.behavior}
- Segment: ${habit.segment_hint}`;

  return chat(history, contextualSystemPrompt);
}

export function isReadyToExtract(reply: string): boolean {
  return reply.includes('[READY_TO_EXTRACT]');
}

export function stripExtractSignal(reply: string): string {
  return reply.replace('[READY_TO_EXTRACT]', '').trim();
}

/**
 * Extract a structured ObstaclePlan from the completed MCII conversation.
 */
export async function extractObstaclePlan(history: ChatMessage[]): Promise<ObstaclePlan> {
  const extractionHistory: ChatMessage[] = [
    ...history,
    {
      role: 'user',
      content: 'Extract the obstacle plan we just discussed as JSON.',
    },
  ];

  const raw = await chat(extractionHistory, EXTRACTION_SYSTEM_PROMPT);

  const json = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`LLM returned invalid JSON during MCII extraction:\n${raw}`);
  }

  return {
    id: randomUUID(),
    obstacle: parsed.obstacle ?? 'Unnamed obstacle',
    if_then_response: parsed.if_then_response ?? '',
    trigger_contexts: parsed.trigger_contexts ?? [],
  };
}
