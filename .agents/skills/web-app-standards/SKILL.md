---
name: web-app-standards
description: Apply Bagredex Django-template, Preact-island, CSS, accessibility, and latency standards.
---

# Web application standards

Apply these standards to Web GUI code and assets under `src/web`.

## Architecture

- Use Django templates for the application shell, navigation, initial HTML, and ordinary forms.
- Use Preact with TypeScript for interaction-heavy feature islands and Vite for feature-split
  bundles integrated through its manifest.
- Keep each island's DOM ownership exclusive. Django fragments or another library must not mutate
  nodes inside a mounted Preact root.
- Do not introduce a full single-page application, Tailwind, HTMX, Alpine, or a component library
  without an approved plan and demonstrated need.
- Use plain CSS with semantic design tokens. Support light and dark themes from the same tokens,
  with Indigo Purple as the primary accent family.

## Interaction and layout

- Keep typing, autocomplete, filtering, team edits, and damage recalculation local to the browser.
- Do not require a network round trip for high-frequency tool interactions.
- Prefer native Preact state and reducers; add shared-state libraries only for demonstrated needs.
- Split bundles by feature and lazy-load large regulation-specific datasets.
- Target desktop first, provide strong tablet behavior, and maintain functional phone fallback.
- Design for keyboard-first desktop use and touch-friendly tablet targets.
- Preserve focus and selection during rapid updates; virtualize only when measurement justifies it.

## Accessibility, security, and states

- Use semantic elements and native controls before custom widgets.
- Provide labels, visible focus, logical focus order, reduced motion, and status announcements.
- Provide deliberate loading, empty, error, success, stale-data, and disabled states.
- Escape untrusted content and use Django's CSRF, authentication, and authorization boundaries.
- Do not place sensitive user data in URLs, analytics, or client logs.
- Treat client validation as feedback, not a replacement for authoritative backend validation.

## Performance and verification

- Aim for visible ordinary-control response within one animation frame and search/filter work that
  does not disrupt typing.
- Measure data payload and rendering cost separately from framework size.
- Profile representative desktop and tablet hardware before adding complexity such as workers.
- Use unit/component tests for stateful behavior and Playwright for critical keyboard/touch flows.
- Verify light and dark themes, supported viewports, focus behavior, and unavailable/error states.
