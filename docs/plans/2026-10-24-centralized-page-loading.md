# Centralized page loading

## Summary

Replace the initial Team Builder, Damage Calculator, and Pokédex loading presentations with one
shared, centered spinner pattern based on the current Team Builder spinner. Keep loading states
that occur inside an already rendered tool, including the Pokédex detail skeleton, contextual.

## Goals

- Show the same centered spinner while each tool performs its initial browser-side data load.
- Make the server-rendered fallback and the mounted Preact loading state visually consistent.
- Preserve an accessible, tool-specific loading announcement without visible banner copy.
- Honor light and dark themes and the user's reduced-motion preference.

## Non-goals

- Changing unavailable, error, empty, saving, or success states.
- Replacing contextual loading UI, including the Pokédex detail-pane skeleton or an already
  rendered Team Builder workspace transition.
- Changing data requests, bootstrap contracts, URLs, persistence, or Pokémon data.
- Adding a component library or dependency.

## User-visible behavior

When the Pokédex, Team Builder, or Damage Calculator first loads, the content area shows the same
Indigo-accented spinner centered in a stable page-height region. No heading, banner, skeleton page,
or visible loading sentence accompanies it. Assistive technology receives a concise loading status
for the current tool. The spinner stops animating under reduced-motion preferences while remaining
visually identifiable.

Once a tool has rendered its usable interface, later localized loading behavior remains attached to
the affected region. In particular, selecting a Pokémon may still show the existing detail-pane
skeleton.

## Decisions and assumptions

- Define the loader's CSS and markup contract as shared Web GUI primitives in `site.css`, because
  every target template receives that stylesheet before its feature bundle loads.
- Use semantic `role="status"` markup with an `aria-hidden` spinner and visually hidden,
  tool-specific text. The container also exposes its busy state for the duration of initial load.
- Base size, colors, height, and timing on the existing `.team-loading` and `.team-spinner` styles.
  Move the reusable behavior instead of maintaining three copies.
- Initial loading means the server fallback before the island mounts and the Preact state before
  the tool's initial data is ready. It does not include a refresh within a usable interface.
- The user confirmed that contextual loading states remain unchanged.

## Scope and ownership

The `web_gui_coder` exclusively owns all implementation and test changes:

- `src/web/static/web/css/site.css`: add the shared centered loader, spinner, keyframes, and
  reduced-motion treatment.
- `src/web/static/web/css/team-builder.css`: remove or narrow superseded Team Builder-only spinner
  rules without changing later workspace behavior.
- `src/web/templates/home.html`, `src/web/templates/team_builder.html`, and
  `src/web/templates/damage_calculator.html`: use the shared loader contract for the
  server-rendered initial fallback.
- `src/web/src/app.tsx`, `src/web/src/team-builder/app.tsx`, and
  `src/web/src/damage-calculator/app.tsx`: render the shared contract only for each tool's initial
  loading state. Preserve contextual loading branches.
- Existing unit and end-to-end tests under `src/web/src/*.test.tsx` and `src/web/tests/e2e/`:
  update or add assertions for accessible initial loader behavior and the absence of the old page
  presentations. Limit edits to the relevant existing test files.

No backend, data, deployment, or database paths change. Implementation is a single Web GUI scope,
so no coding work should run concurrently against these files.

## Data and interface impact

There is no API, bootstrap schema, database, data-version, or URL impact. The shared CSS class names
form an internal server-template/Preact interface: both renderers must emit equivalent semantics so
the pre-mount fallback does not flash a different layout.

The change is backward-compatible with the existing data-loading flow and can be rolled back by
restoring the prior markup and feature-specific styles. No migration or retained-data rollback is
needed.

## Implementation sequence

1. Add the shared page-loader classes to `site.css`, including stable centering, theme-token colors,
   spinner keyframes, and a non-animated reduced-motion state.
2. Convert the three Django template fallbacks to the shared semantic markup so it is visible
   before JavaScript mounts.
3. Convert each Preact island's initial loading branch to the same markup. Distinguish initial Team
   Builder loading from later workspace-local loading so contextual behavior is preserved.
4. Remove or narrow superseded Team Builder-specific spinner CSS after all consumers use the shared
   primitive.
5. Update focused component and Playwright coverage to test the public loading behavior rather than
   animation implementation details.

## Review and verification

The `web_gui_reviewer` reviews the complete Web GUI diff for consistent fallback/mounted markup,
accessible status announcements, reduced motion, responsive centering, contextual-state
preservation, and stale feature CSS. The `architect` then checks plan compliance and confirms that
no backend or data interface changed. Return actionable findings to the `web_gui_coder` and repeat
review until no blockers remain.

Run and observe:

- `cd src/web && npm test -- src/app.test.tsx src/team-builder/app.test.tsx src/damage-calculator/app.test.tsx`
- `cd src/web && npm run check`
- Focused Playwright loading tests for the Pokédex, Team Builder, and Damage Calculator when the
  local test runtime is available.
- Manual or browser-backed checks at desktop, tablet, and phone widths in light and dark themes,
  including `prefers-reduced-motion: reduce` and delayed initial responses.
- `.codex/lint.sh` before review handoff and again before the deployment commit.

The `deployment_agent` owns final validation and the local commit after reviews pass.

## Risks

- A different server fallback can flash before Preact mounts. Equivalent shared markup and global
  CSS prevent the transition.
- Treating every Team Builder `loading` status as initial could hide useful surrounding context.
  Gate the page-level loader on the absence of initially loaded tool data.
- A full-height loader can overflow beneath the authenticated header on short screens. Use viewport
  aware minimum sizing and verify compact phone and tablet layouts.
- Disabling animation without retaining a contrasting spinner arc can make the indicator look like
  a plain ring. Preserve the accent segment in reduced-motion mode.

## Completion criteria

- All three tools show the same centered spinner during both server-fallback and mounted initial
  loading phases, with no old Damage Calculator banner or Pokédex page skeleton.
- Each loader exposes a single meaningful status announcement and no decorative spinner content to
  assistive technology.
- Reduced-motion, light/dark theme, desktop, tablet, and phone checks retain a visible, centered
  loading indicator without overflow.
- The Pokédex detail skeleton and other post-initial contextual states remain functional.
- Focused tests, Web GUI checks, repository lint, matching review, architecture review, final
  validation, report, and local commit complete successfully.
