# habitlock-ai — CLAUDE.md

> This file is the living PRD and AI context document for habitlock-ai. Read it at the start of every session. It tells you what this product is, what it is not, how it works, and why — so you can build on-model features without re-briefing.

---

## 1. Project Identity

habitlock-ai is a habit formation product built around behavioral science and powered by a small LLM layer.

**It is not a streak tracker.** It does not gamify habit completion. It does not send shame-framed notifications. It does not treat a missed day as a failure.

**The core hypothesis:** Habit failure is almost never a motivation problem — it is a feedback loop problem. People who fail at habits usually had the motivation; they lacked the behavioral architecture (a specific if-then plan), and they had no recovery mechanism when that plan broke down. Most apps optimize for streak length, which is the wrong variable. This product optimizes for behavioral internalization: habits that persist after the user stops tracking.

**The strategic whitespace:** The market is full of apps that externalize motivation (streaks, badges, virtual pets). There is almost nothing that builds intrinsic motivation architecture at scale without human coaches. This is that product.

---

## 2. Behavioral Science Foundations

These are not marketing claims. They are the specific frameworks the product operationalizes. When building features, check them against this list.

### Implementation Intentions (Gollwitzer)
**What it is:** If-then plans that specify the when, where, and how of a behavior: "IF situation X occurs, THEN I will perform behavior Y."
**Effect size:** d=0.65 across 94 studies — one of the most replicated findings in behavioral science.
**How we use it:** Every habit in this product is stored as a structured if-then object, not a name + frequency. The LLM guides users through specifying this plan during intake via natural conversation. A habit without a cue is not a habit — it is an aspiration.

### MCII — Mental Contrasting with Implementation Intentions (Oettingen)
**What it is:** A two-step exercise: (1) visualize the positive outcome of succeeding, (2) identify the most likely obstacle, then form a specific if-then plan for that obstacle.
**How we use it:** Periodically (e.g., Sunday evenings, before high-disruption periods like travel), the LLM runs a short MCII conversation to surface and pre-plan obstacles. Output is stored as obstacle plans attached to the habit.

### Identity-Based Habits (James Clear / Atomic Habits)
**What it is:** Framing habit formation as identity change, not outcome change. "I am a runner" vs. "I want to run." Every completed behavior is evidence for an identity claim.
**How we use it:** The LLM generates identity-framed nudges and progress messages — not "you completed your habit" but "three times this week — that's what someone who protects their mornings looks like." The identity frame is stored as part of the habit object and used to calibrate all LLM-generated language.

### Self-Compassion on Failure (Neff)
**What it is:** Treating oneself with the same compassion one would offer a friend after a setback. Reduces the what-the-hell effect and improves long-term persistence.
**How we use it:** When a miss occurs, the LLM response is never shame-framed or streak-punishing. The miss is treated as data, not failure. The attribution conversation opens with a compassion-forward framing before asking what happened.

### Self-Determination Theory (Deci & Ryan)
**What it is:** Intrinsic motivation requires three conditions: autonomy (the user chose this), competence (the user experiences progress), and relatedness (the behavior connects to something that matters to them).
**How we use it:** Feature design checks against SDT. We do not override user choices or push habits on users (autonomy). We show rolling consistency rates, not streak numbers, to provide competence feedback that is resilient to single misses. We connect habits to user-stated identity goals (relatedness).
**Anti-pattern we design against:** Extrinsic rewards (points, badges, streaks) crowd out intrinsic motivation over time via the overjustification effect (SDT prediction, replicated in Deci et al. meta-analysis). We do not add these.

### The What-the-Hell Effect (Polivy & Herman)
**What it is:** When a rigid rule is broken, binary thinkers abandon the goal entirely — "I already failed, so the rule no longer applies." Originally documented in dieters, replicated in habit contexts. Behavioral data: 67% abandonment by week 4 for streak-based apps vs. 38% for non-gamified apps.
**How we design against it:** No streak mechanics as a primary variable. Rolling consistency rates over windows (e.g., "14 of the last 18 days") are resilient to single misses and do not trigger the what-the-hell cascade. Failure recovery is a first-class product mechanic, not an afterthought.

---

## 3. Core Data Model (Plain English)

The schema reflects the behavioral science model. Do not simplify these entities to name + frequency. The richness of the data model is what enables the LLM layer to be specific rather than generic.

### Habit
The core entity. Not a tracker entry — a behavioral plan.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | — |
| `name` | string | Short label for the UI |
| `identity_frame` | string | The identity claim this habit builds toward. E.g., "someone who protects their mental clarity" |
| `cue` | string | The situational trigger. E.g., "when I pour my second cup of coffee" |
| `behavior` | string | The specific action. E.g., "I will sit in the reading chair and open the meditation app" |
| `context_constraints` | string[] | Conditions under which this cue is normally present. E.g., ["weekday", "home", "not traveling"] |
| `obstacle_plans` | ObstaclePlan[] | Pre-committed if-then responses to anticipated obstacles |
| `target_frequency` | object | e.g., `{ times: 5, per: "week" }` — not a daily streak |
| `created_at` | timestamp | — |
| `segment_hint` | enum | User segment context: `striver`, `restarter`, `designer`, `context_collapsed` |

### CheckIn
An event, not a state. Every interaction with a habit — completion or miss — is a timestamped event that can be analyzed retrospectively.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | — |
| `habit_id` | UUID | — |
| `timestamp` | timestamp | — |
| `status` | enum | `completed`, `missed`, `skipped` |
| `miss_attribution` | MissAttribution | Populated only on `missed` status |
| `notes` | string | Optional user-provided context |

### MissAttribution
Populated by the LLM attribution conversation when a miss is logged.

| Field | Type | Description |
|---|---|---|
| `cause_type` | enum | `wrong_cue` / `high_friction` / `context_shift` / `competing_priority` / `energy_state` / `forgotten` |
| `user_report` | string | Raw text from the attribution conversation |
| `plan_repair` | string | Specific plan adjustment generated by LLM |
| `applied` | boolean | Whether the user accepted the plan repair |

### ObstaclePlan
Generated during MCII conversations, stored on the habit.

| Field | Type | Description |
|---|---|---|
| `obstacle` | string | The anticipated obstacle |
| `if_then_response` | string | The pre-committed response plan |
| `trigger_context` | string[] | Contexts where this obstacle is likely |

### ContextModel
A first-class entity — not derived from check-in history. Updated through periodic check-ins or calendar integration.

| Field | Type | Description |
|---|---|---|
| `user_id` | UUID | — |
| `mode` | enum | `baseline`, `travel`, `high_stress`, `schedule_disrupted`, `low_energy_period` |
| `mode_until` | timestamp or null | Expected end of current mode |
| `active_habit_adjustments` | object | Map of habit_id → adjusted cue/behavior for current mode |
| `updated_at` | timestamp | — |

---

## 4. User Segments and Jobs-to-be-Done

MVP primary targets: **Segments 1 and 2.** Design every onboarding flow, notification, and miss-recovery interaction for these two first.

### Segment 1: Intentional Striver (Primary MVP Target)
**Profile:** 28-42, professional, has read productivity content, motivated but inconsistent.
**Real JTBD:** "Help me close the gap between who I say I am and who I actually am day-to-day, without requiring willpower I don't have at 9pm."
**Why they churn from existing apps:** Apps don't help them design the if-then cue link that converts intention to automaticity. They set "meditate daily" without specifying when or what triggers it. The habit never becomes automatic.
**Design implication:** The intake conversation is the highest-value interaction for this segment. It must produce a specific if-then plan, not just a habit name. Every feature must preserve the quality of that plan as the primary artifact.

### Segment 2: Anxious Restarter (Primary MVP Target)
**Profile:** 25-38, self-identifies as "bad at habits," may have ADHD or anxiety, history of starting and abandoning.
**Real JTBD:** "Help me make progress without the shame spiral that comes every time I break a streak or miss a week."
**Why they churn from existing apps:** Streak mechanics actively harm this segment. One miss → what-the-hell effect → app deleted. People in this pattern are 3.2x more likely to quit after their first perceived failure.
**Design implication:** Failure recovery is not a feature — it is the product for this segment. The miss attribution conversation must open with compassion framing. Rolling consistency rates (not streaks) are the primary progress metric. The design cannot introduce any mechanic that makes a single miss feel catastrophic.

### Segment 3: Behavior Designer (Secondary)
**Profile:** 30-50, systems-thinker, uses Notion/Obsidian, wants causal insight into their own behavioral patterns.
**Real JTBD:** "Help me understand which habits are actually moving my leading indicators, and why some stick and others don't."
**Design implication:** Expose correlation views and attribution data. This segment is small but high-LTV and influential on Product Hunt / Hacker News. Don't optimize for them in MVP, but don't break the data model that would serve them later.

### Segment 4: Context-Collapsed (Future Target)
**Profile:** 32-50, major life disruption (new child, relocation, caregiving) has broken all prior habit systems.
**Real JTBD:** "Help me rebuild the scaffolding for basic self-care when my schedule changes week to week."
**Design implication:** Requires robust context model and alternative-cue reasoning. The ContextModel entity exists to serve this segment. Deprioritize for MVP but preserve in the data model.

---

## 5. LLM Interaction Patterns

The LLM is not a chatbot interface. It is invoked for six specific patterns. Calls outside these patterns should go through deterministic rule-based systems or standard UI components.

**Default model:** Claude claude-sonnet-4-6 (or equivalent Anthropic Sonnet-tier). Fast enough for real-time interaction, sufficient for these reasoning tasks.

---

### Pattern 1: If-Then Intake Conversation
**When triggered:** New habit creation flow.
**Input context:** User's stated goal or desire (freeform), time of day, any prior habit data.
**Goal:** Extract a specific if-then plan — cue, behavior, context constraints, and an initial identity frame — through natural conversation. The user rarely arrives with this fully formed. The LLM must ask the right follow-up questions.
**Output type:** Structured `Habit` object (see Section 3) populated with `cue`, `behavior`, `context_constraints`, and `identity_frame`. Also a natural-language confirmation for the user to review.
**Evaluation criteria:** The output cue is specific enough to reliably trigger the behavior (not "in the morning" but "when I sit down with my coffee"). The behavior is specific enough to be unambiguous. The identity frame is stated in first person and connects to a larger self-concept.
**Not the LLM's job:** Validating whether the habit is realistic, setting reminders, storing the data.

---

### Pattern 2: Miss Attribution and Plan Repair
**When triggered:** A `CheckIn` event with status `missed` is logged (either explicitly by user or inferred from no check-in past the expected window).
**Input context:** The habit object (cue, behavior, identity frame), recent check-in history, current ContextModel mode, timestamp of miss.
**Goal:** Short conversational loop. First, open with compassion framing. Then: "What happened?" → classify the miss into a `cause_type` → generate a specific `plan_repair` (a concrete modification to the if-then plan, not generic advice).
**Output type:** Populated `MissAttribution` object. Also a short natural-language message presenting the repair for user acceptance.
**Evaluation criteria:** The `plan_repair` is specific and actionable (not "try harder" or "set a reminder"). It addresses the stated `cause_type` directly. The tone is compassion-forward, not shame-adjacent.
**Not the LLM's job:** Resetting streaks, sending push notifications, updating the check-in record (that is done by the app layer based on user confirmation).

---

### Pattern 3: Identity Narrative Generation
**When triggered:** After a successful check-in, or at weekly summary time.
**Input context:** Habit's `identity_frame`, completion count over the rolling window, total history, user's segment hint.
**Goal:** Generate a short (1-3 sentence) identity-reinforcing message that is specific to this user's plan and progress — not a template. The message should feel earned, not hollow.
**Output type:** Natural-language string for display in the app.
**Evaluation criteria:** The message references the specific behavior or identity frame (not generic "great job!"). It frames the behavior as identity evidence. It does not use the word "streak." It is calibrated in tone to the user's segment (warmer for Restarters, more data-forward for Designers).
**Not the LLM's job:** Displaying the message, tracking whether the user read it.

---

### Pattern 4: Obstacle Anticipation (MCII Session)
**When triggered:** Periodic cadence (e.g., Sunday evening), or when ContextModel mode changes to `travel` or `high_stress`.
**Input context:** All active habits, upcoming calendar events (if integrated), current ContextModel mode.
**Goal:** Run a short MCII-style conversation for each high-priority habit. Ask the user to visualize succeeding, then identify the most likely obstacle this week, then commit to an if-then response.
**Output type:** One or more `ObstaclePlan` objects attached to the relevant habits. Also a brief confirmation message.
**Evaluation criteria:** Each obstacle plan includes a specific trigger context and a concrete behavioral response (not "I'll try anyway" but "IF my evening meeting runs late, THEN I'll do a 10-minute version in the morning instead"). The conversation doesn't feel like a form.
**Not the LLM's job:** Scheduling the conversation, triggering push notifications for it.

---

### Pattern 5: Context Model Update and Plan Adjustment
**When triggered:** User reports a context change ("I'm traveling this week"), ContextModel mode transitions, or a pattern of misses suggests the original cue may be unavailable.
**Input context:** All active habits, current and upcoming ContextModel mode, each habit's `context_constraints`.
**Goal:** For each habit whose `context_constraints` do not match the current context, propose an alternative if-then plan for the disrupted period. E.g., "Your gym habit requires leaving the office at 6pm — you're traveling. Want to design a hotel-room version?"
**Output type:** Updated `active_habit_adjustments` in the ContextModel, plus natural-language summary of proposed changes for user review.
**Evaluation criteria:** The proposed adjustment is realistic given the context. It preserves the identity frame. It does not just say "skip it" — it tries to find an alternative cue/behavior that can execute in the current context.
**Not the LLM's job:** Detecting context changes passively (that requires calendar/sensor integration handled by the app layer). The LLM reasons about the context once it is reported.

---

### Pattern 6: Language Register Calibration
**Not a separate call** — a parameter that modulates all of the above patterns.
**What it is:** The LLM adjusts tone and framing based on the user's `segment_hint`.
- **Striver:** Autonomy-supporting, respects their intelligence, data-forward, doesn't over-celebrate small wins.
- **Restarter:** Compassion-forward, avoids any language that implies failure or judgment, emphasizes progress-not-perfection.
- **Designer:** Causal and analytical. "Here's what the pattern suggests" over "great job."
- **Context-Collapsed:** Practical and low-friction. Doesn't add cognitive load.

**Where LLM is NOT called:**
- Sending push notifications or reminders — cron jobs and OS notification APIs handle this
- Frequency tracking and consistency rate calculation — database queries
- Progress visualization — UI components with chart libraries
- Storing check-in events — app layer
- User authentication — standard auth service

---

## 6. Tech Stack and Architecture Decisions

**Hard constraint:** Free to install for users, free to maintain and host. This rules out any architecture that incurs per-user server costs or paid API calls at scale.

**Stack:**
- **Mobile:** React Native with Expo (free to build, distribute via Expo Go for beta, TestFlight/Play Store for release — both free tiers sufficient)
- **Storage:** Expo SQLite (on-device, local). No backend server required. All behavioral data lives on the user's device.
- **LLM:** Groq API (llama-3.3-70b-versatile). Free tier: 14,400 requests/day, 30 RPM — more than sufficient given the six patterns are sparse. Proxied via Vercel serverless function.
- **Sync (optional, future):** Supabase free tier (500MB database, auth) if cross-device sync becomes necessary. Not in MVP.
- **Hosting:** No persistent server. Any serverless functions (e.g., LLM proxy to avoid exposing API key client-side) run on Vercel free tier.

**Why Groq over Claude API:** Claude API costs money per call. Groq's free tier (llama-3.3-70b-versatile) has no monthly cost, no credit card required, and the rate limits are compatible with the six sparse interaction patterns. If the product ever monetizes, migrating to Claude API (for better instruction-following and behavioral nuance) is a straightforward swap since all LLM calls are isolated to specific patterns in `src/lib/patterns/`.

**Architectural constraints — do not violate these without updating this file:**

- **No backend server.** All state is local. This is not just a cost decision — it is a privacy decision. Behavioral data (habits, misses, context) is sensitive. Keeping it on-device avoids the privacy surface entirely.
- **The LLM is invoked for the six patterns above only.** It is not a general chatbot. Every other interaction is deterministic. This is a cost and latency constraint, but more importantly a product constraint — users should not feel like they are talking to a bot at all times.
- **Habit completion is tracked as events, not state.** There is no `is_completed_today` boolean on the Habit object. There are CheckIn events. This enables retrospective analysis, pattern detection, and rolling window calculations that streak-state would make impossible.
- **ContextModel is a first-class entity, not derived at query time.** It is maintained asynchronously and read by the LLM layer when generating pattern 1–5 responses. Deriving it on the fly from check-in history would be too slow and would not capture user-reported context changes.
- **Miss attribution is stored, not discarded.** MissAttribution data is the primary feedback signal for improving the product. Analyze it. It tells you which habits have systematic cue problems, which have friction problems, and which are being attempted in the wrong context.
- **Consistency rate, not streak, is the primary metric exposed to users.** Calculated as: completions / (completions + expected_occurrences_in_window) over a rolling 21-day window.
- **LLM API key handling:** A Vercel serverless function proxies all LLM calls. The Groq API key lives in Vercel environment variables — never in the client bundle. The app calls the proxy endpoint; the proxy calls Groq and returns the response. Users see no API key, no setup friction. The proxy validates a hardcoded shared secret sent as a request header (stored in the app bundle as a non-sensitive constant) to prevent the endpoint from being drained by external callers. Rate limiting falls back to Groq's free tier quotas as a second line of defense.

---

## 7. Design Anti-Patterns

These are explicit constraints. Do not implement any of the following without a documented decision to override this list.

- **No streaks as a primary metric.** Rolling consistency rates only. "14 of the last 18 days" not "14-day streak."
- **No streak reset mechanics.** There is nothing to reset because there is no streak. A miss is a data event.
- **No shame-framed miss notifications.** "You missed your habit" is not an acceptable message. "How did yesterday go?" is the floor.
- **No gamification.** No points, badges, levels, XP, virtual pets, or leaderboards. These externalize motivation and crowd out intrinsic motivation over time (SDT).
- **No treating a miss as a failure event.** A miss triggers an attribution conversation, not a penalty. The attribution conversation is the feature.
- **No generic reminders at arbitrary times.** Reminders fire at predicted cue moments (when the user's if-then plan says the cue should occur), not at a fixed time the user tapped in a settings menu.
- **No LLM calls for things rule-based systems can do.** Don't add latency and cost to frequency calculations, UI rendering, or notification delivery.

---

## 8. Current State and Roadmap

**Current state (as of April 2026):** MVP fully built and deployed. Android dev builds are being actively tested on device via EAS. Vercel LLM proxy is live. All six LLM patterns are implemented. Hypothesis not yet validated with external users.

**MVP hypothesis:** A conversational if-then intake flow + miss attribution loop will produce meaningfully better 30-day retention than any current streak-based app mechanic, for the Intentional Striver and Anxious Restarter segments.

**Decisions made:**
- Free for users to install, free to maintain and host (zero infrastructure cost constraint)
- Stack: React Native + Expo, on-device SQLite, Groq (llama-3.3-70b-versatile) free tier for LLM, Vercel free tier for serverless proxy
- Platform: Android first (Play Store, $25 one-time fee). iOS later.
- LLM scope: All six patterns implemented — intake, miss attribution, identity narrative, MCII obstacle planning, context plan adjustment, language register calibration.
- Miss detection: hybrid — infer from no check-in past expected cue window when cue is time-anchored; prompt user to self-report when cue is event-anchored ("when I make coffee").
- LLM API key handling: Vercel serverless proxy with shared secret header. Key in Vercel env vars, never in client bundle.
- Onboarding: conversational chat-bubble UI — the LLM is behind the scenes; users experience natural conversation, not a form.
- Context sensing: active (user-reported) only for MVP. Passive calendar integration is post-MVP.

**What's built:**
- [x] Onboarding flow (3-page: welcome, how it works, segment picker) with back navigation, theme picker, scroll-safe layout
- [x] Onboarding routes directly to `/intake` on finish — no empty home screen
- [x] If-then intake conversation — LLM Pattern 1 (chat-bubble UI, keyboard-safe on Android 15)
- [x] Miss attribution + plan repair loop — LLM Pattern 2
- [x] Identity narrative on check-in — LLM Pattern 3 (minimum version variant included)
- [x] MCII obstacle planning session — LLM Pattern 4
- [x] Context model + plan adjustment — LLM Pattern 5
- [x] Weekly summary screen
- [x] On-device SQLite schema (habits, checkins, user_prefs, context_model)
- [x] Vercel proxy → Groq with shared secret auth
- [x] Consistency rate calculation (rolling 21-day window) + ConsistencyRing UI
- [x] Push notifications — cue reminders + miss check (time-anchored habits) + Sunday MCII nudge
- [x] Sunday MCII nudge scheduled automatically after first habit is saved
- [x] Theme system — dark / light / system, persisted in user_prefs; toggle on home screen
- [x] Habit edit, cue-time setting, context mode management screens
- [x] Emergency Brake — `minimum_behavior` field on Habit; "Short version" button on home screen; logs as completed, counts toward consistency rate
- [x] Settings screen — appearance, tone calibration (segment), notifications master toggle, app version
- [x] Miss logging distinction — "✓ Today" only for completed; "· Logged" (gray) for missed; no action buttons after either
- [x] App name: HabitLock AI
- [x] Splash screen: 1024×1024 icon-only, `resizeMode: contain`

**Technical decisions / known behaviors:**
- Android 15 (`edgeToEdgeEnabled: true`) breaks `KeyboardAvoidingView` — all chat screens use manual `Keyboard.addListener` height tracking instead
- `initDB()` called at module level in `_layout.tsx` (before any component renders) to prevent "no table user_prefs" crash in ThemeContext
- `minimum_version` flag stored in `CheckIn.notes` field (`minimum_version: true`) — no CheckIn schema change needed
- `minimum_behavior` column added to habits table via migration guard in `initDB()`
- Sunday MCII nudge: WEEKLY trigger, weekday=1 (Sunday), 19:00, habit ID stored in user_prefs for cancellation

---

## 8a. Product Roadmap

Features are grouped by release tier. Each entry includes the behavioral rationale and implementation notes so future sessions can build on-model without re-briefing.

**Guiding constraint for all features:** Zero infrastructure cost. No streaks. No gamification. Every feature must pass the SDT check (autonomy, competence, relatedness) and must not introduce a mechanic that externalizes motivation.

---

### Tier 0 — Required before public release

These are blocking gaps. The app is not ready for external users without them.

**1. Onboarding flows directly into first intake** ✅ BUILT
- **Why:** The highest-churn moment in any habit app is landing on an empty home screen. A user who completes onboarding without creating a habit is almost certainly lost. Every well-designed onboarding funnel collapses the gap between understanding the product and having your first artifact.
- **What:** At the end of onboarding, instead of routing to `/(tabs)`, route directly to `/intake`. The user leaves onboarding with a completed if-then plan, not a button to make one.
- **Implementation:** `finish()` in `app/onboarding/index.tsx` calls `router.replace('/intake')`. Home screen has onboarding gate — `Redirect` to `/onboarding` if `onboarding_complete !== 'true'`.

**2. Settings screen** ✅ BUILT
- **Why:** Without the ability to change segment, manage notifications, or review/delete data, the app cannot be trusted. Restarters especially need to feel in control — a product that feels opaque will not get candid attribution data.
- **What:** Screen accessible from home via ⚙ button. Contains: appearance (Light/Dark/System), tone calibration (segment picker), notifications master toggle, app version.
- **Implementation:** `app/settings.tsx`. Registered in `_layout.tsx`. Notifications toggle calls `requestNotificationPermission()` on enable, `cancelWeeklyMCIINudge()` on disable.

**3. Emergency Brake (Minimum Viable Habit)** ✅ BUILT
- **Why:** On high-stress days, the full behavior feels impossible. This triggers the what-the-hell effect for Restarters — "I can't do the full thing so I won't do anything." Defining a minimum version during intake pre-commits a fallback before the moment of failure arrives.
- **What:** During Pattern 1 intake, the extraction prompt asks for a minimum version. Stored as `minimum_behavior` on the Habit object. On the home screen, a "Short version" button appears below Done/Missed when `minimum_behavior` exists. Logs as `completed`. Counts fully toward consistency rate.
- **Implementation:** `minimum_behavior TEXT` column added to habits table (migration guard in `initDB()`). `minimum_version: true` stored in `CheckIn.notes` field — no schema change to checkins table. Identity narrative has a minimum-version variant in `src/lib/patterns/identity.ts`.

**4. Sunday MCII nudge — wire the notification** ✅ BUILT
- **Why:** Pattern 4 (MCII obstacle planning) is fully built but has no trigger. It exists as a card on the home screen that users have to consciously tap. One weekly notification is the only prompt that keeps the app present without requiring the user to remember it exists.
- **What:** A single notification every Sunday evening. Message: "Quick question before the week starts →". Opens Pattern 4 for the first habit. Uses `expo-notifications` WEEKLY trigger.
- **Implementation:** `scheduleWeeklyMCIINudge(habitId)` and `cancelWeeklyMCIINudge()` in `src/lib/notifications.ts`. Scheduled automatically after the first habit is saved in `saveHabit()` in `app/intake.tsx`. Notification tap handler in `_layout.tsx` routes to `/mcii/[id]`. Notification ID stored in `user_prefs` for cancellation via Settings toggle.

**5. User testing + hypothesis validation**
- **What:** 10-15 users across Striver and Restarter segments. Primary metric: 30-day retention at target frequency. Secondary: self-reported "I think of myself as someone who does X" before and after. No A/B infrastructure needed — manual recruitment, qualitative interviews at day 7 and day 30.

**6. Play Store listing and assets**
- **What:** Store description, screenshots (3-5), feature graphic. Copy should lead with the behavioral science differentiation, not feature lists. "No streaks. No shame. Just a plan that actually works."

---

### Tier 1 — Ship within first month post-launch

These directly address retention and the core product thesis. High value, low infrastructure cost.

**7. Miss pattern insight**
- **Why:** The stored `cause_type` data is the product's core feedback signal. Surfacing it to users is the moment the product proves its thesis — "the app noticed something about my behavior that I didn't." No other app does this.
- **What:** After 3+ misses with the same `cause_type` on a given habit, surface a prompt: "Your last 3 misses all happened because of [cause]. Your cue might be competing with something. Want to look at it?" One LLM call, triggered on check-in by a simple count query. Compassion-forward framing, not diagnostic.
- **Segment calibration:** Restarters get warmer framing. Designers get the raw pattern data.

**8. Identity Audit (weekly narrative)**
- **Why:** Users need a pull reason to open the app every week. A narrative summary of "evidence gathered" is more powerful than a bar chart — it frames progress as identity construction, not performance scoring.
- **What:** Every Sunday (same trigger as MCII nudge, but separate notification or combined into one session), the LLM generates a 3-5 sentence narrative summary using the past 7 days of check-ins, miss attributions, and each habit's identity frame. Displayed on a dedicated screen or as a push notification the user taps into. Not a report card — no numbers, no percentages. Only evidence and narrative.
- **LLM input:** Habits + identity frames + 7-day check-in log + segment hint.
- **Example output:** "This week you gathered 4 pieces of evidence that you are someone who protects their mental clarity. Even on Tuesday, when your meeting ran late, you chose the 5-minute version. A resilient system doesn't require perfect conditions — it requires a plan for imperfect ones."

**9. Re-engagement flow**
- **Why:** For Restarters, returning to an app after 7+ days away is a high-stakes moment. They've been here before — they know this feeling. The app's response to their return determines whether they stay or delete it.
- **What:** On app open after 7+ days of no check-ins, detect the gap and route to a short re-entry screen before home. Not a missed-days count. Opening line: "You're back. That's the hard part." One LLM call assessing whether any habits need plan revision given the gap. Option to pause or archive habits that no longer fit rather than accumulating a backlog of misses.
- **Segment:** Restarters get compassion-forward framing. Strivers get a pragmatic "let's check the plan still works" frame.

**10. Scientific Why — contextual delivery**
- **Why:** Users who come from streak-based apps will doubt the no-streak approach. Proactively delivering the behavioral science rationale at the moment of doubt prevents churn before it happens. A static library tab nobody opens is not the answer — contextual delivery is.
- **What:** Static JSON file of 6-8 short briefs (no LLM cost). Delivered contextually: after first miss → "Why a miss is data, not failure." After onboarding → "The research behind if-then plans." After a rough week → "Why self-compassion outperforms discipline." After first Emergency Brake use → "Why showing up in minimum form still counts."
- **No new screen needed:** Delivered as a card on the relevant screen, dismissable, never repeated.

---

### Tier 2 — Next meaningful version

These require more design or engineering work but are on-model with the product thesis.

**11. Habit pausing**
- **Why:** The context model handles environment-wide disruption (travel mode). Individual habit pausing handles specific circumstances — injury, project deadline, a habit that needs to be temporarily shelved. Without pausing, users accumulate misses on a habit they've intentionally deprioritized, which distorts the consistency rate and feels unfair.
- **What:** Pause button on habit detail screen. Requires a return date (not optional — forces the user to pre-commit to resuming). Paused habits disappear from the home screen. On the return date, the LLM surfaces a re-entry prompt: "Your [habit] pause ends today. Want to review the plan before restarting?" Counts neither as completed nor missed during pause period.

**12. Behavioral Blueprints (growth mechanic)**
- **Why:** Word-of-mouth growth in niche communities (Reddit, productivity forums) without requiring users to share scores or streaks. Sharing the *architecture* — the if-then plan — attracts exactly the Striver segment that self-selects into this product.
- **What:** Export a habit's if-then plan + identity frame as a designed image card. Shows: the cue, the behavior, the identity frame, and the HabitLock AI attribution. No consistency rate. No check-in history. Just the plan. Generated client-side with `react-native-view-shot`.
- **Timing:** Build when you have users who've been on the app 3+ weeks. Sharing a brand new plan feels hollow — sharing a plan that's been working feels earned.

**13. Cue salience prompt (lightweight Environmental Design)**
- **Why:** The Environmental Design Consultant as a full LLM session has a broken feedback loop (the app never knows if you moved your journal). The insight is still valid: making the physical cue visible is one of the most effective implementation intention supports.
- **What:** One additional question at the end of intake, after the full if-then plan is confirmed: "Is there anything you need to put in place for this cue to work — something to move, put out, or set up?" Response stored as `cue_setup_note` on the Habit object and shown on the habit detail screen as a reminder. Zero LLM cost — just a text field with a prompt.

**14. Habit portfolio awareness**
- **Why:** Implementation intentions work best when specific and few. A user with 6 habits anchored to the same morning cue window has a fragile system — one disrupted morning takes everything down. The product should have an opinion consistent with the science it's built on.
- **What:** During intake, if the user already has 2+ habits sharing a similar cue context, surface a soft advisory: "You already have [N] habits in this cue window. Research suggests 1-3 active habits at a time work best. Want to continue?" Not a hard block — autonomy is preserved. Just a moment of reflection. Rule-based, no LLM needed.

**15. Identity frame refresh (quarterly)**
- **Why:** A user's identity aspirations shift over time. An identity frame set in January may feel foreign by April. The frame silently decays without reinforcement, taking the motivation architecture with it.
- **What:** After 90 days on a habit, the LLM sends one prompt: "You've been working on this for 3 months. Does '[identity frame]' still feel like the right frame for who you're becoming?" User can affirm or revise. One LLM call, quarterly maximum per habit.

---

### Tier 3 — Longer horizon

These require either significant engineering (data model changes, native modules) or should wait until the retention hypothesis is validated.

**16. Home screen widget (Android)**
- **Why:** The single highest-retention lever — keeps the IF-THEN plan visible in the user's environment without requiring them to open the app. The widget is the situational cue made ambient.
- **What:** Shows today's top habit cue. "When you [cue] → [behavior]." Tap opens the app. No streak counter, no percentage. Just the plan.
- **Blocker:** Requires `react-native-android-widget` with native module setup and EAS build configuration. Non-trivial. iOS widget requires separate implementation.
- **Timing:** After validated retention data. A widget for an app users aren't opening yet doesn't help.

**17. Graduation flow**
- **Why:** This is the deepest expression of the product's thesis. Every other habit app implicitly wants you to use it forever. This product's stated goal is "habits that persist after the user stops tracking." The product needs to be able to end a habit — celebrate it as internalized — without treating it as quitting.
- **What:** When a habit hits 80%+ consistency over 60 days, the LLM asks: "This habit has been consistent for 2 months. Does [behavior] feel automatic yet — like something you just do?" If yes: offer to archive with a closing identity narrative ("You became someone who [identity frame]"). If no: continue tracking. Archived habits are preserved in history but removed from active tracking.
- **Timing:** Design carefully. This is the most differentiated thing in the category. Don't rush it.

**18. Habit stacking**
- **Why:** One of the most researched implementation intention extensions — chaining habits so that completing one serves as the cue for the next. "After I meditate, I will journal." The data model supports single cues; stacking requires a sequence.
- **What:** Requires adding `stacked_after_habit_id: string | null` to the Habit object and updating the intake LLM pattern to support stack design. Non-trivial data model change with migration implications.
- **Timing:** Post-validation. Don't change the data model before the core is proven.

**19. Offline graceful degradation**
- **Why:** A user who can't log a check-in because they're offline will stop logging. For Restarters, one friction moment is enough to break the loop.
- **What:** Allow check-ins to be stored locally with a `pending_attribution: true` flag when offline. Surface the attribution conversation when connectivity returns. LLM calls queue locally and fire on reconnect.
- **Timing:** Required before scale. Not blocking for initial user testing with known-connected users.

---

### Explicitly never build

These would undermine the core thesis regardless of how they're framed:

- Streaks as a primary or secondary metric
- Points, badges, XP, levels, or any progression system
- Leaderboards or social comparison of any kind
- Daily open streaks or "login rewards"
- Shame-framed miss language in any surface
- Push notifications more than once per day per habit
- Passive location tracking (privacy surface, Android restrictions)

---

**Remaining before public release (summary):**
- [x] Onboarding → first intake (Tier 0, #1) — **DONE**
- [x] Settings screen (Tier 0, #2) — **DONE**
- [x] Emergency Brake (Tier 0, #3) — **DONE**
- [x] Sunday MCII nudge notification (Tier 0, #4) — **DONE**
- [ ] User testing — 10-15 users, 30-day retention (Tier 0, #5)
- [ ] Play Store listing and assets (Tier 0, #6)

**Next decisions to make:**
1. Segment detection: self-reported only, or inferred from behavior over time?
2. LLM model quality: validate attribution nuance at real usage before deciding on model upgrade.
3. Graduation flow: design the UX carefully before building — this is the product's most differentiated moment.

---

## 9. Open Questions

These are intentionally unresolved. Do not make confident implementation decisions on these without first logging a decision here.

- **LLM model quality:** Groq (llama-3.3-70b-versatile) is live. Validate whether attribution nuance and plan repair specificity are sufficient at scale. If not, Claude Haiku via Anthropic API is the next step — but adds per-call cost. Validate on real user behavior before switching.
- **Segment detection:** How do we know which segment a user is in? Self-reported during onboarding? Inferred from behavior over time? Both? Currently defaults to `striver` unless user self-selects.
- **Context sensing approach:** Currently active (user-reported) only. Calendar API integration vs. passive inference from miss patterns remains open for post-MVP.
- **Failure rate for the attribution conversation:** What percentage of users will engage with a miss attribution prompt vs. ignore it? This is the core UX risk of the product. Need real user data to validate.
- **Identity frame generation:** Currently generated silently and surfaced only in LLM messages. Should users see and edit it during intake? Open for v2.
- **Offline behavior:** LLM patterns require connectivity. Currently fails silently. Needs a graceful offline state for check-ins (store locally, prompt attribution when reconnected).
- **Research validation:** The implementation intentions effect size (d=0.65) is from goal achievement research broadly — less specific to digital, self-directed contexts. Need to track 30-day retention and self-reported identity shift to validate the hypothesis against our own data.

---

## 10. Glossary

**Cue:** The situational trigger that initiates a behavior. In this product, cues are specified as part of the if-then plan: "when [CUE] occurs." Cues must be specific enough to be reliably observable by the user.

**Implementation Intention:** An if-then plan of the form "IF [situational cue], THEN I will [behavior]." Studied by Peter Gollwitzer. Distinguished from a goal intention ("I intend to X") by its specificity about the when and where of behavior.

**Identity Frame:** A first-person statement of the self-concept that a habit builds toward. E.g., "someone who starts the day with clarity" or "a person who moves their body." Stored per habit. Used to calibrate all LLM-generated language for that habit.

**Miss Attribution:** The process of classifying a missed habit execution into a cause type (wrong cue, high friction, context shift, competing priority, energy state, forgotten) and generating a specific plan repair. Miss attribution is a first-class product mechanic, not an error state.

**Context Model:** A lightweight data entity representing the user's current life context (mode, duration, habit adjustments). Distinct from check-in history. Updated through user reporting or calendar integration. Used by the LLM to reason about habit plan adjustments during disruptions.

**Obstacle Plan:** A pre-committed if-then response to an anticipated barrier. Generated during MCII conversations. E.g., "IF my evening meeting runs late, THEN I will do a 10-minute version in the morning instead." Stored on the Habit object.

**MCII (Mental Contrasting with Implementation Intentions):** A structured exercise developed by Gabriele Oettingen. Step 1: visualize the positive outcome of succeeding. Step 2: identify the most likely obstacle. Step 3: form a specific if-then plan for that obstacle. Consistently outperforms positive visualization alone for goal achievement.

**Consistency Rate:** The primary progress metric exposed to users. Calculated as: completions ÷ expected_occurrences over a rolling 21-day window. Expressed as a ratio or percentage. Does not reset on a miss. Designed to be resilient to the what-the-hell effect.

**What-the-Hell Effect:** The cognitive pattern documented by Polivy and Herman in which breaking a rigid rule causes binary thinkers to abandon the goal entirely ("I've already failed, so the rule no longer applies"). The primary reason streak mechanics produce high early-week abandonment rates.

**Segment Hint:** A field on the Habit object indicating which user segment context to apply when generating LLM responses. Used for language register calibration. Values: `striver`, `restarter`, `designer`, `context_collapsed`.
