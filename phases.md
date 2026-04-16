# Blame Travis — Development Phases

This document tracks the phased implementation of the Blame Travis mobile adventure system. Each phase must be completed and validated with testing before proceeding to the next.

## Phase 1: Project Foundation & Core Infrastructure
*Goal: Establish a clean, scalable Expo foundation and connect the core backend services.*

- [x] **1.1 Expo Project Initialization**
    - [x] Initialize Expo project with TypeScript template.
    - [x] Configure `app.json` and project metadata (slug, bundle identifier).
    - [x] Set up `.gitignore` and environment variable management (`.env`).
- [x] **1.2 Folder Architecture & Standards**
    - [x] Establish directory structure (`src/components`, `src/hooks`, `src/screens`, `src/services`, `src/theme`, `src/types`).
    - [x] Configure ESLint and Prettier for strict TypeScript adherence.
- [x] **1.3 Backend Setup (Supabase)**
    - [x] Initialize Supabase project and link to the app.
    - [x] Implement core Database Schema (Users, Profiles, Adventures).
    - [x] Set up Supabase connectivity for future Authentication flow (Signup/Login/Session management).
- [x] **1.4 Design System & Theme Foundation**
    - [x] Define Design Tokens (Colors, Typography, Spacing, Roundness).
    - [x] Implement Theme provider and base styles (Adventure Card aesthetic).
- [x] **1.5 Navigation Skeleton**
    - [x] Install and configure React Navigation.
    - [x] Build top-level Tab Navigator (The Desk, Journeys, Passport, Profile).
    - [x] Implement basic Stack Navigation for nested screens.
- [x] **1.6 Core State Management**
    - [x] Set up global state for Itinerary lifecycle (Draft, Stamped, Active).
    - [x] Implement basic data fetching for the first Journey.


---
Phase 1 is officially complete and verified. 

## Phase 2: User Onboarding & Adventure Preferences
*Goal: Define the future onboarding and account system that will be restored for production.*

- [ ] **2.1 Authentication UI & Logic**
    - [ ] Re-introduce Login and Sign Up screens when the product is ready for production.
    - [ ] Reconnect account creation and session management to the live app shell.
    - [ ] Implement secure session handling and auto-login on restart.
- [ ] **2.2 The Travis Setup Flow**
    - [ ] Re-introduce the multi-step onboarding sequence for production.
    - [ ] Implement Cadence Selection (How often Travis should suggest Adventures).
    - [ ] Implement Scope & Radius setup (How far the user is willing to go).
    - [ ] Implement Vibe & Category preferences (Food, Culture, Nature, etc.).
- [ ] **2.3 Profile & Preference Persistence**
    - [ ] Persist onboarding data to the Supabase `profiles` table as part of the restored account flow.
- [ ] **2.4 Navigation Guard (Auth Gate)**
    - [ ] Restore account-aware routing based on login state and profile completeness.

---
Phase 2 is intentionally deferred until production readiness. 

## Phase 3: The Adventure Architect & Planning Engine
*Goal: Transition to an on-demand planning system where Travis builds custom itineraries.*

- [x] **3.1 The "Adventure Request" UI**
    - [x] Build `AdventureRequestScreen.tsx` with Duration, Location, and Vibe selection.
- [x] **3.2 Enhanced Planning Interface**
    - [x] Implement a custom **Budget Slider** (Low, Mid, High, "Travis Style").
    - [x] Expand Vibe selection to multi-select with new categories (Beach, Mountains, Nightlife).
    - [x] Add **"Worldwide"** and **"Brave Mode" (Radius)** to location options.
- [x] **3.3 The Planning Engine (Itinerary Generation)**
    - [x] Update `discovery.ts` to support multi-day itineraries and budget-aware results.
    - [x] Implement "Worldwide" logic for finding travel-worthy destinations globally.
- [x] **3.4 The Commitment Step**
    - [x] Add a **Date Selector** to the Adventure Reveal flow.
    - [x] Implement the date confirmation logic that moves an itinerary from Draft to Active.

## Phase 4: Travis in Your Pocket (Nudges & Rerolls)
*Goal: Implement Travis's companion behavior, reroll limits, and push notifications.*

- [ ] **4.1 The Reroll System**
    - [ ] Implement daily reroll counters (1 for Free, 3 for Paid).
    - [ ] Build the "Section Reroll" feature for Paid users (5-minute window).
    - [ ] Create Travis's opinionated reroll warning UI for the 2nd reroll.
- [ ] **4.2 The Nudge Engine (Notifications)**
    - [ ] Configure Expo Notifications for scheduled reminders.
    - [ ] Implement Travis-voiced reminder logic (3 days out, day of, overdue).
    - [ ] Add "Idle Nudges" to prompt users to start planning something fun.
- [ ] **4.3 Validation (The Passport)**
    - [ ] Implement GPS-locked "Check-in" button.
    - [ ] Add Photo Upload logic for Passport Stamps.

