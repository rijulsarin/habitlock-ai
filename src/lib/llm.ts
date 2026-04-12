import Constants from 'expo-constants';
import { ChatMessage } from '../types';

// Shared secret lives in app.json extra — never hardcoded in logic
const PROXY_URL = Constants.expoConfig?.extra?.llmProxyUrl as string;
const SHARED_SECRET = Constants.expoConfig?.extra?.llmSharedSecret as string;

export class LLMError extends Error {}

/**
 * Send a conversation to the Vercel proxy → Groq (llama-3.3-70b-versatile).
 * All six LLM patterns route through here.
 */
export async function chat(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<string> {
  if (!PROXY_URL || !SHARED_SECRET) {
    throw new LLMError('LLM proxy not configured. Check app.json extra fields.');
  }

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-habitlock-secret': SHARED_SECRET,
    },
    body: JSON.stringify({ messages, systemPrompt }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new LLMError(`LLM proxy error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.text as string;
}
