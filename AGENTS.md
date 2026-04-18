# AGENTS.md

This file is the repository-level operating guide for AI coding agents working on **Blame Travis**.

It adopts the project rules already established in [gemini.md](C:\Users\gyasi\.gemini\antigravity\scratch\blame_travis\gemini.md) and translates them into an agent-neutral format so Codex and other agents can follow the same standards.

## 1. Working Agreement

- Partnership first. Treat the user as the decision-maker for product direction and meaningful tradeoffs.
- Do not make automatic code changes when the user is asking for analysis, advice, or technical evaluation. Provide reasoning first unless the user is clearly asking for implementation.
- If a request appears likely to weaken the app architecturally, visually, or functionally, say so plainly and explain the tradeoff.
- Ask for clarification when requirements are genuinely unclear or when a risky assumption would materially affect the outcome.
- For complex, cross-cutting, or architectural work, use a planning-first approach before implementation.

## 2. Product Guardrails

- The LLM is not the planner of record for logistics. Places, routes, and timing must be grounded in structured sources such as Google Maps or Places data.
- The AI layer is for personality, framing, storytelling, and presentation, not factual itinerary logistics.
- Follow the README product rules:
  1. Travis builds the itinerary.
  2. The user can freestyle in real life, but the app does not support live in-app replanning or swapping during execution.
  3. Rerolls happen at the adventure level, never item-by-item, unless a later paid-feature phase explicitly changes that behavior.
- Protect the core loop: assignment, anticipation, nudges, completion, reward.
- Do not let the app drift into a generic booking tool, open-ended travel search assistant, or fully manual planner.

## 3. Voice And Copy Rules

- All user-facing copy must sound like Travis: confident, adventurous, positive, lightly sarcastic, and motivating.
- Travis should read like a bold host or adventurous friend with taste.
- Avoid militarized, punitive, surveillance-style, or guilt-driven language.
- Prefer explorer-themed language such as `itinerary`, `passport`, `stamps`, `the open road`, and `the desk`.
- If you encounter militarized language in code, copy, docs, phases, or skill instructions, correct it to match the explorer theme and update the source text that introduced it.

## 4. Skill-First Workflow

- Before starting a meaningful sub-task, check whether a project skill under [`.gemini/skills`](C:\Users\gyasi\.gemini\antigravity\scratch\blame_travis\.gemini\skills) applies.
- Use the most relevant local skill as the domain playbook for that task.
- Current local skills include:
  - `accessibility-expert`
  - `content-tone`
  - `data-modeling`
  - `design-to-code-mcp`
  - `expo-foundation`
  - `feedback-states`
  - `geospatial-maps`
  - `gesture-interaction`
  - `itinerary-engine`
  - `motion-animation`
  - `navigation-architecture`
  - `notifications-reengagement`
  - `performance-optimization`
  - `product-architect`
  - `screen-composer`
  - `ui-governance`
  - `vibe-check-qa`
  - `vulnerability-scan`

## 5. Testing And Validation

- Test after each sub-section of a phase, not only at the end of a large milestone.
- A sub-task is complete only after it has been verified and documented.
- If behavior cannot be fully exercised in the current environment, document the implemented logic, intended runtime behavior, and how it aligns with the Travis experience.
- After completing a full phase, run a security-minded review using the `vulnerability-scan` skill or an equivalent audit workflow.

## 6. UX And Engineering Standards

- Target smooth Android-first performance, especially for animation-heavy interactions. Aim for 60fps on mid-range Android devices.
- Use `react-native-reanimated` patterns for performance-sensitive animation and gesture work.
- Default UI aesthetic: Explorer's Map.
  - Background: parchment or paper tones
  - Text: ink-black
  - Accents: vintage red
- Avoid solid black backgrounds and digital-only motifs such as "the grid."
- Do not use native in-app alerts such as `Alert.alert` for product messaging, confirmations, or warnings. Build custom in-app notice components instead.
- Native OS notifications are acceptable for reminder and notification-shade delivery.

## 7. Permissions, Privacy, And Access

- Location and notification permissions must be explained clearly in Travis voice, with graceful denied-state fallbacks.
- Keep the app guest-first during development unless the user explicitly asks to change that strategy.
- Use a stable guest identity for Supabase-backed development flows so itinerary saving, rerolls, and related behavior remain testable.
- Temporary development bypasses such as disabled JWT verification must be treated as phase-scoped development shortcuts and revisited before public release.

## 8. Travis Presence And Placeholders

- Wherever Travis is intended to appear, reserve space with a dedicated Travis placeholder component or image treatment.
- Placeholders must be easy to replace later with a real image, Lottie, or Rive asset.
- Prioritize Travis presence in:
  - itinerary request flows
  - itinerary reveal moments
  - contextual empty, loading, and error states

## 9. Source Of Truth

- Use this file as the primary agent instruction file for the repo.
- Preserve alignment with [gemini.md](C:\Users\gyasi\.gemini\antigravity\scratch\blame_travis\gemini.md) unless the user asks to change the project rules.
- When `AGENTS.md` and `gemini.md` diverge, prefer the newer intentional project decision and update the other file to match when appropriate.
