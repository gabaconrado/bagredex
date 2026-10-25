# Default regulation URLs and team slot shortcuts report

## Outcome

Bagredex now uses clean page URLs for the latest regulation and keeps historical regulation
selections explicit across global and server-generated navigation. Team Builder number shortcuts now
open the existing Pokémon picker when the requested slot is empty.

This completes the approved
[implementation plan](../plans/2026-10-25-default-regulation-urls-team-shortcuts.md) and resolves the
[deferred regulation URL task](../tasks/2026-10-25-server-default-regulation-urls.md).

## Changes

- Centralized clean-latest, explicit-historical, selector, and canonical redirect URL behavior in
  Django while preserving repeated unrelated query values.
- Kept malformed and explicitly unavailable regulation selections at HTTP 400 and retained HTTP
  503 for unavailable implicit defaults.
- Updated global navigation and backend-generated page destinations to share the server URL policy.
- Extended Team Builder shortcuts `1` through `6` so empty slots open the existing picker and
  occupied slots retain their expand-and-focus behavior.
- Added backend, component, and browser coverage for URL policy, availability ordering, navigation,
  shortcut guards, and exact-slot creation.

## Review cycles

Backend and Web GUI reviewers completed scope reviews, and the architect completed cross-scope
integration review. Follow-up fixes strengthened historical URL coverage, verified that Team
Builder mechanics availability is checked before redirecting an explicit latest request, expanded
shortcut guard coverage, and corrected a stale browser expectation for brand navigation. Final
re-reviews reported no blocking findings.

## Verification

Observed passing checks:

- `.codex/lint.sh`
- Ruff lint and formatting
- mypy across 65 backend files
- Django system check and migration dry-run with no model changes
- Backend test suite: 283 passed
- Web formatting, lint, and type checks
- Web unit/component tests: 219 passed and 21 skipped
- Deployment tests: 79 passed
- Web production build and static collection
- Focused Playwright feature coverage: 2 passed
- `git diff --check`

A broader Playwright attempt encountered an unrelated pre-existing failure in a JavaScript-disabled
test helper. That case was excluded from the focused feature validation; both regulation-navigation
and Team Builder shortcut browser scenarios passed.

## Deferred tasks

None.

## Commits

Feature commit: `4609a408286080683b0faad1313a2acabd793af7` —
`feat: clean regulation URLs and add slot shortcuts`.
