# Battle Mode report

## Outcome

Bagredex now has an authenticated, session-only Battle Mode for live VGC reference. Users select
an exact active-regulation saved team, build an opposing preview quickly, place both sides on a
doubles board, record revealed battle state, and receive immediate damage and effective-Speed
information.

The implementation follows the [Battle Mode plan](../plans/2026-10-24-battle-mode.md). It reuses
the existing private team and normalized calculator boundaries without adding battle persistence,
a migration, a Pokémon-data release, or another mechanics implementation.

## Changes

- Added an exact active-version and regulation Battle Mode bootstrap with owner-filtered team
  summaries, calculator and team-detail URLs, and base-species identity for opponent species clause.
- Added a dedicated Vite/Preact workspace with rapid opponent entry, two-slot doubles placement,
  first-class benching, persistent per-Pokémon observations, switch stage resets, Mega state, HP,
  status, stat stages, field controls, and discard warnings.
- Reused the validated damage engine for selected-attacker calculations against both targets, with
  opponent percentage and user raw-HP output, automatic or overridden spread behavior, and inferred
  active-partner Friend Guard.
- Extracted one structured effective-Speed path shared by Speed-based damage and the turn-order
  display. Accounted Effects exposes automatic spread state, Friend Guard, HP conversion, Mega and
  contextual defaults, field state, Speed modifiers, ties, and Trick Room ordering.
- Added the top-level navigation entry, loading/error/empty states, light and dark styling, and
  responsive desktop, tablet, and phone layouts with one page-level main landmark.

## Review cycles

Backend review approved the authenticated read-only boundary, exact active-context filtering,
owner isolation, base-species mapping, and absence of persistence or data-schema changes.

Web review findings were returned and resolved before approval. The final implementation includes
explicit bench controls that retain learned state while clearing stages, corrected navigation
confirmation behavior, accessible modal focus handling, and focused state, contract, and browser
coverage.

Architecture review initially found missing non-destructive benching and a nested main landmark.
Both were corrected and the targeted rereview reported no remaining blocking findings. The final
cross-scope review found the backend/Web contracts, calculation units, shared mechanics, inferred
context, and switch/reset lifetimes consistent with the plan.

Final local-runtime validation exposed fixture lifecycle and query-bound assumptions plus navigation
and browser-test isolation issues. Their owning agents corrected them, repeated the affected reviews,
and returned the complete result with no blocking findings.

## Verification

Observed local checks include:

- focused Battle Mode Vitest passed all 13 tests after the final corrections;
- the complete Web Vitest suite passed 201 tests, with 21 skipped;
- Web TypeScript/Prettier checks and the Vite production build passed;
- `check-backend` passed Python formatting, Ruff, mypy, Django system checks, and Django deployment
  checks;
- `check-deploy` passed all 78 checks;
- the PostgreSQL-backed `./bagredex.sh test` suite passed all 272 tests;
- authenticated Battle Mode Playwright passed all 15 cases across desktop-light,
  tablet-dark-reduced, and phone-light projects;
- the related Damage Calculator and Team Builder Playwright regression matrix passed all 84 cases;
  and
- `.codex/lint.sh` and `git diff --check` passed.

## Deferred tasks

None. Broader partner-ability mechanics, battle persistence, priority ordering, turn simulation,
and other excluded features remain non-goals rather than deferred work from this cycle.

## Commits

The reviewed implementation was committed as
`306d632767d9914cb94e8124f4c79014ab39c642`
(`feat(battle): add live battle mode`).
