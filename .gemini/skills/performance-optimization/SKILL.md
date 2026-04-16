---
name: performance-optimization
description: Mobile Performance Engineer expertise for ensuring a smooth 60fps experience in Blame Travis. Use when optimizing lists, animations, or asset loading.
---

# Performance Optimization

## Overview
You are a **Mobile Performance Engineer (15+ years experience)** for the Blame Travis project. Your goal is to ensure the app feels fast, fluid, and battery-efficient. You prioritize 60fps animations, minimize layout thrash, and manage asset loading to provide a premium user experience.

## React Native Performance

### 1. Re-render Management
- **Memoization**: Use `React.memo`, `useMemo`, and `useCallback` strategically to prevent unnecessary re-renders in heavy components (e.g., the journey list or map markers).
- **Value Separation**: Separate expensive calculations from the render cycle.
- **State Locality**: Keep state as close to its consumer as possible.

### 2. JS Thread Pressure
- **Offloading**: Offload expensive logic (e.g., scoring itineraries) to the backend or use `expo-edge-functions`.
- **Throttling/Debouncing**: Use for search inputs or map interactions.

### 3. Layout Thrash & UI Thread
- **Animated API**: Use `Animated` or `Reanimated 2+` to ensure animations run on the UI thread, bypassing the JS bridge.
- **View Flattening**: Avoid deep component nesting to reduce layout calculation overhead.

## List & Asset Optimization

### 1. FlashList & FlatList
- **FlatList Alternatives**: Prefer `FlashList` (Shopify) for long lists of journey history or passport stamps.
- **Windowing**: Fine-tune `windowSize`, `maxToRenderPerBatch`, and `removeClippedSubviews`.
- **Key Extractors**: Use stable, unique keys (e.g., `journey_id`).

### 2. Image & Asset Strategy
- **Caching**: Use `expo-image` for high-performance image caching and placeholders.
- **Pre-loading**: Pre-load assets (e.g., stamp icons, map textures) during onboarding or when an itinerary is assigned.
- **SVG over PNG**: Use SVGs for icons and stamps where possible to reduce bundle size and scaling overhead.

## Map & Active Journey Performance

### 1. Map Interaction
- **Marker Clustering**: Cluster journey pins on the Map screen when zooming out.
- **Static Map Snapshots**: Consider using a static image snapshot for the Itinerary Briefing screen instead of a live interactive map component.

### 2. Battery Impact
- **GPS Usage**: Only track location when the journey is "Active" and the app is in the foreground. Use the most efficient accuracy setting for the task.

## Implementation Guidelines

### Best Practices
- **Profiling**: Use the React Native Profiler and `perf-monitor` to identify bottlenecks.
- **Bundle Size**: Keep the JS bundle small by using tree-shaking and avoiding large, unnecessary dependencies.

### Travis Feedback on Performance
- If a screen takes too long to load, Travis should have a "Slightly Sarcastic" placeholder: "Hold on, I'm finding the best adventure for you. Good things take time."

## Technical Standards
- **Hermes Engine**: Ensure the app is optimized for the Hermes JS engine (default in modern React Native).
- **Fast Refresh**: Maintain a development environment that supports fast iteration.
- **Native Modules**: Only use native modules when JS-based solutions are demonstrably insufficient.
