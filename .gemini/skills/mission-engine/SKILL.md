---
name: itinerary-engine
description: Behavioral Systems Engineer expertise for designing the itinerary generation logic in Blame Travis. Use when implementing itinerary generation, scoring, or anti-repetition rules.
---

# Itinerary Engine

## Overview
You are a **Behavioral Systems Engineer (15+ years experience)** for the Blame Travis project. Your task is to build the core engine that generates surprise, value-driven, and feasible itineraries. You balance randomness with structure and ensure Travis remains a confident, not chaotic, host.

## Itinerary Generation Logic

### 1. The Core Rule: "Confidence Over Choice"
- **Singular Focus**: Never give the user multiple itineraries to choose from. One itinerary, one plan.
- **Feasibility First**: Use Google Routes API to ensure itineraries fit the user's travel time and transport mode (walking vs. driving).
- **Grounding in Reality**: All itineraries must be based on real Google Places data.

### 2. Scoring & Ranking
- **Novelty (High Weight)**: Penalize place IDs used within the last 90 days. Penalize neighborhoods repeated too often.
- **Budget Fit**: All stops in the itinerary should sum to less than or equal to the user's budget (including estimated spend at each location).
- **Vibe Match**: Prioritize places with types (e.g., `park`, `cafe`, `museum`) that match the user's vibe preferences.
- **Business Status**: Ensure all stops are open during the itinerary window using Google Place Opening Hours.

### 3. Anti-Repetition Rules
- No exact place ID repeat for 90 days.
- No lead category (e.g., "Food") twice in a row for the same user.
- No same neighborhood repeated for the main stop more than twice in 5 cycles.
- Require at least one "novel element" in every itinerary (e.g., a new category or a longer distance than usual).

## Difficulty & Progression

### 1. Scaling the Radius
- Start users in their local neighborhood (low radius). 
- Unlock "Regional" (mid-radius) and "Domestic" (long-radius) modes as the user completes more itineraries.

### 2. Effort Balancing
- Mix "Chill" itineraries (e.g., a coffee shop and a park) with "Adventurous" ones (e.g., a 20-mile drive and a nature hike).
- Use a "Difficulty Score" based on total travel time and estimated physical effort.

## The Reroll System

### 1. Guardrails
- **Limit**: One free reroll per itinerary.
- **Full Swap**: Rerolls replace the entire itinerary, not just individual stops.
- **Reason-Based**: Capture the reason for reroll (e.g., "Too Far," "Too Expensive") and feed it back into the `itinerary-engine` for better future ranking.

### 2. Anti-Optimizer Philosophy
- Do not let the user reroll more than 3 times total per cycle (even if paid). Rerolling leads to indecision, which Travis exists to prevent.

## Reward Triggers
- **Trigger**: When a user completes an itinerary, call the `achievement-engine`.
- **Logic**: Check for milestones (e.g., "First Solo Itinerary," "5 Food Itineraries").
- **Output**: Return a "Stamp" ID for the `data-modeling` layer to save.

## Implementation Guidelines
- **AI Packaging**: Once a winning itinerary is ranked, use the LLM to generate the title, Travis's "Why," and the itinerary's "Challenge."
- **Verification**: Run a final "sanity check" (Edge Function) to ensure no stops are permanently closed or in unsafe areas.
