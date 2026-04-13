# HabitLock AI

> Habit failure is almost never a motivation problem. It's a feedback loop problem.

Most habit apps optimize for streaks. Streaks are the wrong variable.

This is a long-term personal product bet: a habit formation system built around behavioral science and powered by a thin LLM layer — designed to do what human coaches do (behavioral architecture, failure recovery, contextual reasoning) at zero marginal cost.

---

## The Problem with Every Habit App

The market has two dominant mechanics: **streaks** and **gamification**. Both are well-studied and both are wrong for the people who need habit support most.

**Why streaks fail:**

- **Goodhart's Law.** Once the streak becomes the target, it ceases to measure the behavior. Users tap a checkbox without doing the habit. The streak survives; the behavior doesn't.
- **The what-the-hell effect** (Polivy & Herman). When a rigid rule breaks, binary thinkers abandon the goal entirely. One miss → app deleted. Behavioral data: 67% abandonment by week 4 for streak-based apps vs. 38% for non-streak apps.
- **Overjustification** (Deci & Ryan / Self-Determination Theory). External rewards crowd out intrinsic motivation over time. Users who start meditating because they want to become users who meditate to protect a streak. When the streak ends — and it always ends — so does the meditation.

**Why gamification fails:**

Same mechanism as streaks, compounded. Points and badges externalize motivation effectively in the short term and hollow it out in the long term. Habitica has 15M+ downloads and high churn. The engagement metrics look good; the behavior change outcomes don't.

**The gap no one has filled:**

The research on what actually works is settled. Implementation intentions (Gollwitzer, d=0.65 across 94 studies) — specific if-then plans ("when X happens, I will do Y") — are one of the most replicated findings in behavioral science. Mental contrasting with implementation intentions (Oettingen) outperforms pure positive visualization. Identity-based framing (Clear) outperforms outcome-based framing. Self-compassion on failure (Neff) reduces the what-the-hell cascade.

None of this is implemented meaningfully in any current habit app. The product that does it at scale, without human coaches, is the gap.

---

## The Hypothesis

> A conversational if-then intake flow combined with miss-as-data-event attribution will produce meaningfully better 30-day retention than any streak-based mechanic, for users who have already failed at habit apps before.

This is falsifiable. The leading metric is 30-day retention at target frequency (not streaks, not daily opens). The lagging metric is self-reported identity shift ("I think of myself as someone who does X").

---

## Who This Is For

Four segments download habit apps. Two are the design target for MVP.

| Segment | Real JTBD | Why current apps fail them |
|---|---|---|
| **Intentional Striver** *(primary)* | Close the gap between stated identity and daily behavior — without relying on willpower | Apps don't help design the if-then cue link. They set "meditate daily" with no trigger. The habit never becomes automatic. |
| **Anxious Restarter** *(primary)* | Make progress without the shame spiral that follows every broken streak | Streak mechanics actively trigger the what-the-hell effect for this segment. One miss → abandonment. |
| **Behavior Designer** *(secondary)* | Understand causally why some habits stick and others don't | No app exposes attribution data or treats misses as diagnostic signal. |
| **Context-Collapsed** *(future)* | Rebuild self-care scaffolding when life disruption has broken every prior system | All apps assume schedule stability. None reason about cue instability. |

---

## How It Works

The product is not primarily a tracker. It is a **habit design system** where tracking is infrastructure.

### 1. If-Then Intake (not a form — a conversation)

Every current app asks: "What habit do you want to build?" The user types "meditate" and sets a reminder.

This product asks: "Tell me about your morning." The LLM conducts a Socratic intake and extracts a specific implementation intention:

> "When I sit down with my second cup of coffee, I will close my laptop, put on headphones, and open the meditation app for 10 minutes — before checking email."

That's the artifact stored in the system. Not a habit name. A behavioral plan with a cue, a behavior, a context, and an identity frame.

### 2. Miss Attribution (not a streak reset — a diagnosis)

When a check-in is missed, the system doesn't reset a counter. It asks what happened.

The response is classified into a cause type: wrong cue, high friction, context shift, competing priority, low energy, or forgotten. A specific plan repair is generated — not generic advice, but a concrete modification to this user's specific if-then plan based on what they reported.

This is motivational interviewing at scale. The miss is a data event, not a failure event.

### 3. Consistency Rate (not a streak — a ratio)

Progress is shown as a rolling 21-day consistency rate: completions ÷ expected occurrences. "14 of the last 18 days." A single miss doesn't cascade. The what-the-hell effect has no lever to pull.

---

## Where the LLM Actually Adds Value

"AI-powered" is not a feature description. Here are the six specific interaction patterns where the LLM does something a rule-based system cannot:

| Pattern | What the LLM does | Why rules can't do it |
|---|---|---|
| **If-then intake** | Extracts a cue/behavior/context/identity plan through adaptive conversation | A form gives you fields. An LLM gives you follow-up questions calibrated to what the user actually said. |
| **Miss attribution + plan repair** | Classifies the miss cause and generates a specific plan modification | Rule-based systems have three responses to a miss: ignore, reset, or send a generic message. None are a plan repair. |
| **Identity narrative** | Generates progress framing tied to the user's specific identity frame — not a template | "Great job!" is a template. "Three times this week — that's what someone who protects their mornings looks like" is specific. Templates get tuned out within a week. |
| **Obstacle anticipation** | Runs a structured MCII session: visualize success → identify obstacle → pre-commit to if-then response | MCII requires adaptive follow-up questions. A form produces garbage outputs because users don't have pre-formed obstacle plans. |
| **Context plan adjustment** | When the user's environment changes (travel, schedule disruption), proposes alternative if-then plans for affected habits | A rule-based system sends the same reminder regardless of context. An LLM reasons about whether the original cue is available. |
| **Language register calibration** | Adjusts tone across segments: compassion-forward for Restarters, data-forward for Designers, autonomy-supporting for Strivers | One template cannot serve all segments without becoming generic enough to reach none of them. |

**Where the LLM is not used:** reminders, frequency tracking, consistency rate calculation, progress visualization, data storage. Rule-based systems do these better, faster, and cheaper.

---

## Architecture

**Constraint:** Free to install for users, free to maintain and host. This shaped every architectural decision.

```
React Native (Expo)          →   Vercel serverless proxy   →   Groq API
On-device SQLite                 (shared secret auth)           (llama-3.3-70b-versatile, free tier)
No backend server
```

| Decision | Choice | Why |
|---|---|---|
| Mobile framework | React Native + Expo | Cross-platform. Android-first (Play Store, $25 one-time). iOS later. |
| Storage | Expo SQLite, on-device | No server cost. No privacy surface — behavioral data never leaves the device. |
| LLM | Groq (llama-3.3-70b-versatile) via Vercel proxy | Free tier (14,400 req/day, 30 RPM) is sufficient for the six sparse interaction patterns. Key never exposed client-side. |
| Sync | None in MVP | Single-device sufficient for hypothesis validation. Supabase free tier available when needed. |
| Hosting | Vercel free tier | Serverless proxy only. No persistent server. |

**Key architectural constraints (do not violate without updating CLAUDE.md):**
- Habit completion is tracked as **events**, not state. No `is_completed_today` boolean. This enables retrospective analysis and rolling window calculations.
- `ContextModel` is a **first-class entity**, not derived at query time. Maintained asynchronously.
- The LLM is invoked for **six specific patterns only**. It is not a chatbot interface.
- Misses are **stored with attribution**, never discarded. Miss attribution data is the primary product feedback signal.

---

## Behavioral Science Reference

The frameworks this product operationalizes — not claims, implementations:

| Framework | Author(s) | How it's used |
|---|---|---|
| Implementation intentions | Gollwitzer | If-then intake structure. Every habit is stored as a cue/behavior/context object. |
| MCII | Oettingen | Periodic obstacle anticipation sessions. Output is stored as ObstaclePlans on the habit. |
| Identity-based habits | James Clear | Identity frame stored per habit. Used to calibrate all LLM-generated language. |
| Self-compassion on failure | Neff | Miss attribution conversation opens with compassion framing before diagnosis. |
| Self-Determination Theory | Deci & Ryan | No extrinsic rewards. Autonomy-supporting language. Consistency rates over streaks. |
| What-the-hell effect | Polivy & Herman | Consistency rates are resilient to single misses. No streak mechanic gives this effect a lever. |

---

## Current Status

**Stage:** MVP built. Android dev builds actively tested on device. Vercel LLM proxy live.

**Built:**
- [x] Conversational onboarding (3 pages: welcome, how it works, segment picker) — routes directly into intake on finish
- [x] If-then intake conversation — LLM Pattern 1 (keyboard-safe on Android 15)
- [x] Miss attribution + plan repair loop — LLM Pattern 2
- [x] Identity narrative on check-in — LLM Pattern 3 (minimum version variant)
- [x] MCII obstacle planning session — LLM Pattern 4
- [x] Context model + plan adjustment — LLM Pattern 5
- [x] Weekly summary screen
- [x] On-device SQLite (habits, checkins, user_prefs, context_model)
- [x] Vercel proxy → Groq with shared secret auth
- [x] Consistency rate (rolling 21-day window) + ring visualization
- [x] Push notifications — cue reminders, miss check, Sunday MCII nudge (weekly)
- [x] Dark / light / system theme, persisted locally; toggle on home screen
- [x] Emergency Brake — "Short version" button on home screen; `minimum_behavior` stored at intake; logs as completed, counts toward consistency rate
- [x] Settings screen — appearance, tone calibration (segment), notifications toggle, app version
- [x] Habit edit, cue-time setting, context mode management screens
- [x] Miss logging distinction — "✓ Today" for completed, "· Logged" (gray) for missed

**Before public release:**
- [ ] User testing — 10-15 Striver and Restarter users, 30-day retention measurement
- [ ] Play Store listing and assets (screenshots, store copy, privacy policy URL)

**Next (first month post-launch):**
- [ ] Miss pattern insight — after 3 same-cause misses, surface the pattern and prompt plan revision
- [ ] Weekly identity audit — narrative summary of "evidence gathered" this week, not a report card
- [ ] Re-engagement flow — compassion-forward re-entry after 7+ days away
- [ ] Scientific Why — contextual delivery of behavioral science briefs at the moment of doubt

**Later:**
- [ ] Habit pausing — per-habit pause with a pre-committed return date
- [ ] Behavioral Blueprints — share the if-then plan as a designed card, not a score
- [ ] Cue salience prompt — "what do you need to put in place for this cue to work?"
- [ ] Habit portfolio awareness — soft advisory when cue windows are overloaded
- [ ] Identity frame refresh — quarterly LLM check "does this frame still feel like you?"
- [ ] Graduation flow — when a habit is internalized, close it with a narrative, don't just archive it
- [ ] Home screen widget — ambient IF-THEN plan display without opening the app
- [ ] Habit stacking — chain habits so completing one serves as the cue for the next
- [ ] Offline graceful degradation — queue check-ins locally, surface attribution on reconnect
- [ ] iOS release

---

## What I Don't Know Yet

Intellectual honesty is part of the methodology. These are open questions, not deferred problems:

- Whether Groq (llama-3.3-70b-versatile) instruction-following is sufficient for the nuance required in miss attribution at scale. Claude Haiku is the fallback — but adds per-call cost. Validate on real users before switching.
- What percentage of users will engage with a miss attribution prompt vs. dismiss it. This is the core UX risk of the product. If the friction of the attribution conversation exceeds the value users perceive, the feedback loop breaks.
- Whether the identity frame should be shown to users during intake for editing, or generated silently and surfaced only in LLM messages.
- How to detect user segment reliably — self-reported during onboarding is the current approach, but behavioral inference over time may be more accurate.
- Long-term: whether the implementation intentions effect size (d=0.65, from goal achievement research broadly) holds specifically in a digital, self-directed context. Internal 30-day retention data will be the first signal.

---

## Why This Project

Most product portfolios show execution. This one is a bet on a specific insight that I think the market has wrong.

The insight: the apps that dominate the habit space are optimizing for engagement, not behavior change. Streaks are a great engagement mechanic and a poor behavior change mechanic. The research has known this for years. The product gap exists because solving the actual problem is harder — it requires reasoning about individual context, recovering gracefully from failure, and building a feedback loop that improves the plan rather than punishing the user.

That's what this is. The LLM layer is not the product. The behavioral architecture is the product. The LLM is what makes it deliverable without human coaches.

---

*Built by Rijul Sarin — [LinkedIn](#) · [Portfolio](#)*
