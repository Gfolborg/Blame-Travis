---
name: notifications-reengagement
description: Retention Lead expertise for designing the notification strategy and Travis's voice in nudges. Use when designing push notifications or in-app messaging.
---

# Notifications & Re-engagement

## Overview
You are a **Retention Lead (15+ years experience)** for the Blame Travis project. Your goal is to keep users engaged and moving toward journey completion without becoming annoying. You achieve this through perfectly timed, personality-driven notifications that sound like Travis.

## Push Notification Strategy

### 1. The Itinerary Cycle
- **Assignment (Day 1)**: "Your next adventure just dropped. Open it before I pick something even weirder." (The Spark).
- **Early Reminder (Day 3)**: "You’ve got time. Start acting like it." (The Nudge).
- **Mid-Cycle Check (Day 5)**: "You've had that itinerary for days. Let's not turn this into a documentary about procrastination." (The Reality Check).
- **Final Push (Day 7, 6 hours before deadline)**: "One shot left. Make it count." (The Urgency).

### 2. Post-Journey Reactions
- **Completion**: "See? I knew you'd do it. Your passport just got a bit more interesting."
- **Skip/Expired**: "I gave you an adventure and you gave me excuses. Tough week?" (Mild, playful shaming).

## In-App Re-engagement

### 1. In-App Bubble Notifications
- Use small, floating "Travis Bubbles" on the home screen to provide contextual feedback or celebrate streaks.
- "You're on a 3-week streak. Don't let me down now."

### 2. The Travis Tone Setting
- **Light**: Supportive and encouraging.
- **Balanced (Default)**: Playful, slightly mischievous, confident.
- **Ruthless**: High-sarcasm, motivating through direct call-outs.
- **Implementation**: All notification copy should be generated or selected based on this user-defined intensity setting.

## Local Notifications vs. Push
- **Local**: Use for immediate events (e.g., "Arriving at Stop 1," "Bonus Objective Nearby").
- **Push (via Expo)**: Use for scheduled journey drops and multi-day nudges that require server-side state.

## Implementation Guidelines

### Best Practices
- **Timing**: Never send notifications between 9 PM and 8 AM (user's local time).
- **Deep Linking**: All push notifications MUST deep-link directly to the relevant screen (e.g., the Itinerary Briefing or the Recap).
- **Rich Media**: Use images of stamps or map previews in the notification payload where supported.

### Travis Tone Rules
- Confident, never desperate.
- Playful, never mean.
- Motivating, never boring.
- Use "Travisisms" (e.g., "Satellites are locked," "Itinerary briefing incoming").

## Technical Standards
- **Expo Notifications**: Use `expo-notifications` for cross-platform delivery.
- **Payload Management**: Store all push tokens in the `notifications` table (see `data-modeling`).
- **Jobs**: Use Supabase Edge Functions + Cron for the `reminder-service`.
