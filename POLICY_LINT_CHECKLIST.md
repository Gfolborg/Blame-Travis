# Policy Lint Checklist - Blame Travis

**Audit Date:** 2026-04-19
**Scope:** `AGENTS.md`, `gemini.md`, `phases.md`, and all `.gemini/skills/*/SKILL.md`
**Audit Type:** Strict requirement-to-file coverage and structural consistency
**Automation Command:** `npm run policy:lint`
**Sprint Gates:** `npm run sprint:start:check` and `npm run sprint:end:check`

## Structural Validation Results

1. Skill file count validated: 18
2. Required skill sections present in 18/18 skill files:
- `## Use When`
- `## Required Inputs`
- `## Workflow`
- `## Required Outputs`
- `## Acceptance Gates`
- `## Non-Negotiables`

Status: PASS

## Requirement Coverage Matrix

| ID | Requirement | AGENTS.md | gemini.md | phases.md | Skills Coverage | Status |
|---|---|---|---|---|---|---|
| R1 | Product is discovery -> itinerary -> booking -> retention | 7-14, 30-40 | 13-21 | 5, 105-491 | `product-architect`, `screen-composer`, `mission-engine` | PASS |
| R2 | Structured provider data is factual source of truth | 16-29 | 23-37 | 23 | `data-modeling`, `mission-engine`, `vulnerability-scan` | PASS |
| R3 | LLM cannot define logistics facts | 22-29 | 27-33 | 23 | `mission-engine`, `vulnerability-scan` | PASS |
| R4 | MVP scope is constrained and explicit | 42-57 | 39-50 | 58-340 | `product-architect` | PASS |
| R5 | Mandatory user flow order is explicit | 32-40 | 13-21 | 58-273 | `screen-composer`, `navigation-architecture` | PASS |
| R6 | Required UX states exist for every touched screen | 85-90 | 54-61 | 25, 35-54 | `feedback-states`, `screen-composer` | PASS |
| R7 | Map/list parity is mandatory | 35, 88 | 16, 42, 92 | 105-140 | `geospatial-maps`, `navigation-architecture` | PASS |
| R8 | No native `Alert.alert` for core product messaging | 87 | 88 | 25 (state framework implies custom flows) | `expo-foundation` (via app standards) | PASS |
| R9 | Accessibility hard rules (contrast, tap size, announcements) | 91-97 | 55-66 (state expectations) | 41, 379 | `accessibility-expert`, `vibe-check-qa` | PASS |
| R10 | Android-first performance with measurable targets | 98-110 | 90-95 | 26, 136-141, 399-402 | `performance-optimization`, `motion-animation` | PASS |
| R11 | Supabase RLS and least privilege are required | 111-117 | 97-103 | 24, 166-173, 210-217, 252-260, 297-305, 382 | `data-modeling`, `vulnerability-scan` | PASS |
| R12 | Secrets cannot leak to client bundle | 100-104, 119-122 | 87, 101 | 381 | `expo-foundation`, `vulnerability-scan` | PASS |
| R13 | Delivery model is sprint-based vertical slices | 124-135 | 105-115 | 4, 7-21, 58-494 | `product-architect`, `tracking in phases` | PASS |
| R14 | Sprint completion requires acceptance gates and docs sync | 128-159 | 109-115, 126-135 | 14-20, all sprint sections | All skills now include acceptance gates | PASS |
| R15 | Voice is Travis: confident, adventurous, non-punitive | 59-82 | 68-81 | 54 | `content-tone`, `notifications-reengagement` | PASS |
| R16 | Documentation sync is mandatory across policy files | 150-159, 191-193 | 5, 126-135 | 19 | All skills follow deterministic template | PASS |
| R17 | Skill-first execution is mandatory | 137-149 | 116-124 | implied via sprint work model | All 18 skills standardized | PASS |
| R18 | Booking funnel must be measurable end-to-end | 39, 51, 117 | 20, 44 | 237-273, 412-445 | `data-modeling`, `notifications-reengagement`, `product-architect` | PASS |

## Cross-File Consistency Checks

1. Terminology consistency (`sprint`, `vertical slice`, `itinerary`, `booking`) across top-level docs: PASS
2. Prohibited ambiguity language removed from policy and skill docs: PASS
3. Skill format consistency across all local skills: PASS
4. Supabase handoff prompts present in DB-heavy sprints: PASS

## Known Clarification (Non-Blocking)

1. Skill folder name is `mission-engine`, but frontmatter skill name is `itinerary-engine`.

Status: ACCEPTED (already documented explicitly in [AGENTS.md](C:\Users\gyasi\.gemini\antigravity\scratch\blame_travis\AGENTS.md:178)).

## Final Lint Verdict

- Policy sync status: PASS
- Structural completeness status: PASS
- Requirement coverage status: PASS
- Blocking gaps: 0

