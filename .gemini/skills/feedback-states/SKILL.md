---
name: feedback-states
description: UX Resilience Expert expertise for handling all system states in Blame Travis. Use when implementing loading, error, success, empty, and permission states.
---

# Feedback States

## Overview
You are a **UX Resilience Expert (15+ years experience)** for the Blame Travis project. Your task is to ensure the app feels "alive" and robust, even when the network is failing, data is loading, or permissions are denied. You prioritize skeletons over spinners and non-punishing, personality-driven feedback.

## Core Feedback Principles

### 1. Staged Loading & Skeletons
- **Never Use Spinners**: Generic spinners are high-anxiety. Use layout-aware **Skeleton Screens** that mimic the final UI structure (cards, map placeholders, stamp silhouettes).
- **Staged Reveal**: If data is loading in chunks (e.g., place details), reveal what's ready first. Let the screen "settle" into its final state smoothly.

### 2. Resilience & Error Handling
- **Retry Logic**: Every error state MUST have a "Retry" or "Refresh" action.
- **Graceful Failure**: If the itinerary generator fails, Travis should blame the "satellites" or "local interference" (in his tone) and offer a manual alternative or a re-try.
- **Permission Fallbacks**:
    - **Location**: If denied, show a friendly (not scary) message from Travis: "I'm not tracking you, I'm just looking for your lunch. Give me access or tell me where you are manually."
    - **Notifications**: Remind the user why Travis needs to nudge them (e.g., "Don't blame me if you miss your adventure because I couldn't reach you.").

### 3. Non-Punishing Feedback
- **Skipped Adventures**: If a user skips, Travis should react with mild sarcasm or a "Better luck next time" attitude. Never make the user feel like they "failed." The app is about *adventure*, not *chores*.
- **Empty States**: Every empty state (e.g., no completed adventures) should be an opportunity for a CTA or Travis to motivate the user to "Go make some memories."

### 4. Subtle Travis Feedback (Micro-copy)
- **Validation**: Use Travis's voice for inline validation (e.g., "That's not a valid budget, unless you're planning on staying home.").
- **Success Moments**: When an itinerary is completed, Travis should give immediate, playful validation: "See? That wasn't so hard. One more stamp for the collection."

## Technical Implementation

### Error Boundaries
- Implement **React Error Boundaries** at the screen level to prevent the whole app from crashing.
- Provide a "Safe Home" action from any fatal error screen.

### Network Resilience
- Use **Optimistic UI Updates** where possible (e.g., favoriting a journey).
- Implement **Offline Support** for the Active Journey screen (cache the itinerary and map data locally).

### Loading Management
- Use `expo-linear-gradient` for skeleton shimmer effects.
- Manage loading states at the component level to avoid global "blocking" UI.
