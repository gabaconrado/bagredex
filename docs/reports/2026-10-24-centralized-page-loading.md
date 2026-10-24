# Centralized page loading report

## Outcome

Pokédex, Team Builder, and Damage Calculator now use the same centered, Indigo-accented spinner
for their initial server-rendered and hydrated loading states. Tool-specific status text remains
available to assistive technology, and reduced-motion users receive a static visible indicator.

The implementation follows the approved
[centralized page loading plan](../plans/2026-10-24-centralized-page-loading.md).

## Changes

- Added one shared page-loader markup and CSS contract for all three tools.
- Replaced the Damage Calculator loading banner and Pokédex loading shell with the shared spinner.
- Matched each Django fallback to its Preact initial loading state to avoid a presentation change
  during hydration.
- Preserved the Pokédex detail skeleton and later Team Builder workspace loading as contextual
  states.
- Added focused component and Playwright assertions for the three initial loaders.

## Review cycles

The Web GUI review found no actionable issues. It confirmed equivalent fallback and hydrated
markup, accessible status semantics, reduced-motion styling, contextual-loader preservation, and
focused test coverage.

The architecture review also found no actionable issues. It confirmed plan compliance, correct
initial-versus-contextual loading boundaries, and no backend, data, URL, bootstrap, persistence, or
dependency changes.

## Verification

- Final validation started the already-local Bagredex server and database with `--no-build`; both
  became healthy.
- Focused Vitest passed all 58 Pokédex, Team Builder, and Damage Calculator component tests again.
- `npm run check`, the production Vite build, `.codex/lint.sh`, and `git diff --check` passed again.
- Focused Playwright attempted nine cases across desktop-light, tablet-dark-reduced, and
  phone-light projects. All failed before page load because browser IPC or launch hit the sandbox
  with `Operation not permitted`.
- Repository rules prohibit elevating that browser operation. This leaves an environment-only gap
  in browser-backed viewport, theme, and reduced-motion verification; it is not a code finding.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.
