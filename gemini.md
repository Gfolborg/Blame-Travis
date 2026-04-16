# Gemini CLI Guidelines — Blame Travis

This document defines the operational partnership and engineering standards for the development of the **Blame Travis** mobile adventure system.

## 1. Collaborative Partnership
- **Partnership First:** We operate as equal partners in this development. Decisions are made through discussion and mutual agreement.
- **No Automatic Changes:** When asked a question or when providing analysis, do not automatically proceed with code changes. Instead, provide suggestions, technical rationale, or ask for explicit permission to implement.
- **Proactive Advice:** If a requested change or technical direction is perceived to put the app at a disadvantage (architecturally, visually, or functionally), advise against it. We will discuss the trade-offs before proceeding with a final decision.
- **Clarification & Support:** If any requirement, design, or instruction is unclear, ask for clarification. If I need you to perform an action outside of this environment (e.g., creating a project in a web console or generating an API key) to proceed, I will let you know immediately.
- **Mandatory Planning:** For any task that is complex, architectural in nature, or involves multiple interconnected systems, I will use the `enter_plan_mode` tool to research and propose a detailed design before implementation.

## 2. Technical & Product Guardrails
- **Planner of Record:** The LLM (OpenAI/Gemini) is **not** the planner of record. Logistics (places, routes, times) must be grounded in structured data from Google Maps/Places. The AI layer is strictly for personality, framing, and storytelling.
- **Scope Control:** Adhere to the "Product Rules" from the README:
    1. Travis builds the itinerary.
    2. The user can freestyle in real life, but the app does not assist in real-time re-planning/swapping.
    3. Rerolls happen only at the adventure level, never item-by-item.
- **Voice Mandate:** Every piece of user-facing copy (notifications, Rundowns) must reflect Travis's personality: confident, adventurous, positive, lightly sarcastic, and motivating.
- **Tone Guardrail:** Travis should read like a bold host or adventurous friend with taste. Avoid militarized, punitive, or surveillance-style language such as "mission," "deployment," "grid," "intel," or copy that sounds threatening or guilt-driven. Instead, use "itinerary," "passport," "stamps," "the open road," and "the desk."
- **Proactive Voice Correction:** If any existing code or documentation (including development phases and skill instructions) contains militarized language, you are mandated to immediately correct it to explorer-themed language and update the source documentation to prevent future occurrences.

## 3. Skill-First Execution
- **Contextual Activation:** Before starting any sub-task in `phases.md`, I will activate the most relevant specialized skill (e.g., `expo-foundation` for setup, `motion-animation` for UI work) to ensure expert-level adherence to domain standards.

## 4. Testing & Validation Protocol
- **Section-Level Testing:** Testing must be completed after each sub-section within every development phase (e.g., after 1.1, 1.2, etc.).
- **Vulnerability Scan:** After the completion of each full Phase (e.g., after Phase 1, Phase 2), I will activate the `vulnerability-scan` skill and conduct a full security audit of the newly implemented features and infrastructure.
- **Verification of Intent:** If a specific component or logic cannot be directly tested (e.g., push notifications, GPS), I will provide a detailed walkthrough of the developed logic, the intended action, and how it aligns with the "Travis" experience.
- **Validation Before Progression:** A sub-task is only considered "complete" once it has been verified and documented.

## 5. Privacy & Permissions
- **Graceful Handling:** Location and notification permissions must be handled with clear, Travis-voiced rationale and graceful fallbacks for denied states.

## 6. Engineering Standards
- **Android-First Performance:** All animations and interactions must target 60fps on mid-range Android devices, utilizing `react-native-reanimated`.
- **Adventure Card Aesthetic:** The UI defaults to the "Explorer's Map" aesthetic (parchment/paper background, ink-black text, and vintage red accents). Avoid solid black backgrounds or digital-only motifs like "The Grid."
- **Custom In-App Notices:** We will NOT use native platform alerts (e.g., `Alert.alert`). All in-app notifications, confirmations, and warnings must be built as custom UI components within the app's design system to ensure a consistent look.
- **Custom In-App Notices:** We will NOT use native platform alerts (e.g., `Alert.alert`). All in-app notifications, confirmations, and warnings must be built as custom UI components within the app's design system to ensure a consistent look.
- **Native OS Notifications:** Standard OS-level notifications (reminders, adventure drops in the notification shade) will utilize native platform capabilities.

## 7. Asset Management & Placeholders
- **Travis Character Rule:** In every location where Travis is meant to be seen (as defined in README.md), implement a dedicated placeholder component or placeholder image treatment that reserves space for his future illustration.
- **Placeholder Implementation:** Use a Travis-specific placeholder that is easy to replace later with a real image asset. The placeholder should support the intended layout without implying a system-status metaphor.
- **Anchor Points:** Placeholder appearances should be focused on moments where Travis adds personality or guidance:
    - **Itinerary request:** Planning guidance surfaces.
    - **Itinerary reveal:** The main personality-driven reveal moment.
    - **Contextual empty/loading/error states:** Supportive feedback areas where Travis has something to say.
- **Future-Proofing:** Code must be written so that replacing the placeholder with a real Image, Lottie, or Rive asset is a minimal, localized update.

## 9. Authentication & Access Strategy
- **Guest-First Development:** The app must remain fully functional without a login wall during the development phase. Authentication and onboarding are deferred to a later stage when the Freemium/Premium tier logic is defined.
- **Persistent Guest State:** Use a stable "Guest" profile and ID for all Supabase operations (adventures, preferences) to ensure the system logic (itinerary saving, rerolls) remains testable.
- **Secure Bypass:** Edge Functions will maintain `--no-verify-jwt` during this phase to support unauthenticated testing, with a hardening phase planned before public release.

