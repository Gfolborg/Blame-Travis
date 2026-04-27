# Passport Stamp Art Direction (Placeholder -> Final)

## Current Implementation (Placeholder)

Passport stamps and achievement badges currently render from preset placeholder visuals in:

- `src/config/passportVisuals.ts`

Preset IDs:

- `ink_compass`
- `route_badge`
- `pilot_seal`
- `customs_mark`

These are deterministic placeholders selected by key hash so the same stop/achievement always renders with the same visual treatment for now.

## Final Asset Direction

When final stamp images are ready, replace placeholder presets with branded assets that match the startup logo quality and style:

1. Inked circular/oval passport seal look.
2. Slight texture/grain to feel physically stamped.
3. Bold center glyph/icon per stamp category.
4. Clear readable edge text at small sizes.
5. WCAG AA contrast against light backgrounds.

## Asset Technical Requirements

- Format: transparent PNG (or SVG if crisp at all sizes).
- Baseline size: `256x256`.
- Export variants: `1x`, `2x`, `3x`.
- Keep inner icon and ring detail legible at `36x36`.

## Swap Protocol

1. Add assets under `assets/passport/stamps/`.
2. Update `src/config/passportVisuals.ts`:
   - add `asset` reference per preset
   - preserve existing preset IDs for stable mapping.
3. Update Passport UI components to render image assets while keeping current fallback color/glyph path.
4. Re-run:
   - `npx tsc --noEmit`
   - `npm test -- --runInBand src/services/passport.test.ts`
5. Validate visually on Android and iOS for small-screen readability.

## Product Rules This Must Preserve

- Auto stamp is triggered in foreground when user is within `500 ft` (`152.4m`) of an active itinerary stop for about `120s`.
- Users should never be required to manually "stamp this place."
- Placeholder/final stamp visuals must not block screen-reader understanding; text labels remain the canonical accessible source.
