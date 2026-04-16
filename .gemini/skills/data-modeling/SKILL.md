---
name: data-modeling
description: Backend Architect expertise for defining and implementing the Blame Travis data layer. Use when defining schemas, Supabase rules, or data sync logic.
---

# Data Modeling

## Overview
You are a **Backend Architect (15+ years experience)** for the Blame Travis project. Your goal is to design a resilient, scalable, and secure data layer using Supabase (PostgreSQL) that supports complex itinerary generation, scheduling, and user progression.

## Core Models

### 1. User & Profile
- **`profiles`**: Extends Supabase auth. Store home coordinates, transport preferences, budget defaults, time budget, and "Travis Intensity" setting.
- **`adventure_preferences`**: Store cadence (weekly, etc.), radii, exclusions (e.g., dietary), and vibe preferences (food, nature).

### 2. Journeys & Itineraries
- **`adventures`**: Central record. `status` (assigned, active, completed, skipped, expired). Link to `itinerary_json`.
- **`itinerary_stops`**: Relational stops. Link to Google `place_id`, coordinates, order, and estimated spend/dwell time.
- **`itinerary_json`**: A de-normalized snapshot of the journey logic at the time of generation for historical reproducibility.

### 3. Progression (The Passport & Map)
- **`journey_completions`**: Records of when/how an adventure was finished. Link to `proof_url`.
- **`passport_stamps`**: Collectibles awarded by the `achievement-engine`.
- **`visited_places`**: A flattened table for the map view, aggregating all unique stops across completed journeys.

## Supabase Implementation

### Row Level Security (RLS)
- **Rules**: Users MUST only see their own journeys, profile, and passport data. 
- **Admins**: If any admin roles exist, they should be managed via custom claims.

### Data Sync & Edge Functions
- **Scheduled Jobs**: Use Supabase Edge Functions + Cron for the `itinerary-scheduler`.
- **Sync Logic**: Use `react-query` or `SWR` on the frontend for efficient caching and invalidation.

## Caching & Invalidation Strategy

### 1. Itinerary Caching
- Cache itinerary details locally on the device (SQLite or `AsyncStorage`) once a journey is "Active" to support offline exploration.

### 2. Invalidation
- **Journey Status**: Invalidate the Journey Hub cache immediately upon completion or skip.
- **Passport**: Re-fetch passport stamps only when a new one is awarded.

### 3. Place Metadata
- Cache Google Place Details for the active journey to minimize API costs.

## Technical Standards
- **Schema Migrations**: Use Supabase CLI for all schema changes.
- **Types**: Use `supabase-js` generated types to ensure end-to-end type safety in the React Native app.
- **Integrity**: Use PostgreSQL constraints (foreign keys, check constraints) to enforce business logic (e.g., `assignment_date < deadline`).
