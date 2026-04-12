/**
 * Daily quotes aligned with the HabitLock AI philosophy.
 * No motivation-poster clichés. No streak language.
 * Themes: implementation intentions, self-compassion, identity framing,
 *         behavioral architecture, consistency over perfection.
 */

export interface Quote {
  text: string;
  attribution?: string;
}

export const QUOTES: Quote[] = [
  {
    text: "A habit without a cue is just an aspiration.",
  },
  {
    text: "One miss is data. Ten misses is a pattern worth listening to.",
  },
  {
    text: "You don't need more motivation. You need a better plan for when motivation runs out.",
  },
  {
    text: "Consistency isn't a personality trait. It's an architecture problem.",
  },
  {
    text: "The plan that survives a bad week is worth more than one that assumes a perfect one.",
  },
  {
    text: "'When X happens, I will do Y.' That's the whole system.",
  },
  {
    text: "A miss tells you something your original plan didn't account for. That's useful.",
  },
  {
    text: "Showing up in minimum form still counts. Especially when it would've been easy not to.",
  },
  {
    text: "14 of the last 18 days is a resilient system. A streak resets to zero.",
  },
  {
    text: "Self-compassion isn't letting yourself off the hook. It's what keeps you on it.",
    attribution: "Kristin Neff",
  },
  {
    text: "The question after a miss isn't 'why did I fail?' It's 'what did the situation need that my plan didn't provide?'",
  },
  {
    text: "Motivation gets you started. Architecture keeps you going.",
  },
  {
    text: "Specific beats general. 'When I pour my coffee' beats 'in the morning.'",
  },
  {
    text: "Willpower is finite. A good if-then plan makes it unnecessary.",
  },
  {
    text: "The person you're becoming is built from ordinary days, not perfect ones.",
  },
  {
    text: "Identity follows behavior. Behavior follows a specific trigger.",
  },
  {
    text: "If-then plans double follow-through — not because of willpower, but because the decision is already made.",
    attribution: "Peter Gollwitzer",
  },
  {
    text: "The goal isn't a 100-day streak. It's a habit that doesn't need the app.",
  },
  {
    text: "A 2-minute version of your habit is not a failure. It's proof you showed up.",
  },
  {
    text: "What you do when it's hard is the evidence that matters.",
  },
  {
    text: "Every completion is a vote for the person you're becoming.",
    attribution: "James Clear",
  },
  {
    text: "The what-the-hell effect is real. One miss doesn't have to mean anything.",
  },
  {
    text: "Your habit doesn't need to be perfect. It needs to be recoverable.",
  },
  {
    text: "Design your environment and you won't need to rely on motivation.",
  },
  {
    text: "A 70% week still means you showed up most of the time.",
  },
  {
    text: "Mental contrasting — picturing what could go wrong — outperforms positive visualization alone.",
    attribution: "Gabriele Oettingen",
  },
  {
    text: "Habits are identity in motion. Each small action is a vote cast for who you are.",
  },
  {
    text: "The right cue makes the behavior almost automatic. Specificity is the shortcut.",
  },
  {
    text: "Failure is information. The only question is whether you use it.",
  },
  {
    text: "Missing once never ruined anyone. Missing twice is the start of a new habit — the wrong one.",
    attribution: "James Clear",
  },
];

/**
 * Returns a deterministic quote for today based on day of year.
 * Same quote all day, changes at midnight.
 */
export function getDailyQuote(): Quote {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}
