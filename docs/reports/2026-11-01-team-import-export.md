# Team import and export report

## Outcome

Team Builder now moves complete drafts through a Showdown-style text format adapted to Champions
SPs. Import is atomic, remains unsaved until **Save**, and validates the complete replacement
against the retained regulation. Export preserves representable member state, including nicknames
and shiny status. The team information card now orders **Save**, **Import/Export**, and **Delete**,
and the team-name field no longer has a visible label while retaining its accessible name.

The work follows the approved
[team import and export plan](../plans/2026-11-01-team-import-export.md).

## Changes

- Added a dependency-free parser and canonical exporter for headers, abilities, SPs, natures,
  shiny state, and moves. It accepts ignored gender markers and normalized name variations, infers
  valid Mega previews, and rejects unsupported or illegal input without changing the draft.
- Added an accessible, responsive import/export dialog with current-draft prefill, clipboard
  feedback, actionable errors, keyboard containment, Escape and Cancel behavior, and focus
  restoration.
- Kept `team-builder-data-v6`, `team-draft-v1`, Django persistence, and normalized Pokémon data
  unchanged. Django remains authoritative when the user saves the imported draft.
- Added parser, round-trip, component, accessibility, and authenticated browser coverage for the
  import, export, invalid-input, unsaved-draft, and canonical-save boundaries.

## Review cycles

- Initial Web and integration review found no implementation or cross-scope contract defect. It
  identified missing coverage in the critical browser path: the test did not exercise a complete
  set through export, varied import, and canonical Save submission.
- The Web owner expanded component edge coverage and the browser workflow to include nickname,
  item, ability, SPs, nature, shiny state, moves, case and punctuation normalization, ignored
  gender, invalid-import atomicity, explicit saving, reload, and the full submitted draft.
- Web and integration re-review reported no remaining blocking findings. Final validation found a
  browser-test teardown race after the save request; the test now waits for the successful PUT
  response before cleanup, with no product-behavior change.

## Verification

- Targeted parser and component tests passed: 46 tests.
- The full Web test suite passed: 264 tests, with 21 skipped.
- TypeScript checks and the production Web build passed.
- `.codex/lint.sh` and `git diff --check` passed after the review corrections.
- The focused Playwright validation passed 2 tests after the permitted local browser retry. The
  imported-team save completed with HTTP 200, and runtime evidence contained no HTTP 500 response.

## Deferred tasks

None.

## Commits

Original feature commit: `bc87b4539d214ecefaa9945e5e623a7eb274dce2`
(`feat: add team text import and export`).

Final reviewed feature boundary: `adcfb55a11e8fca8b4740283433fdf9cfc4a72e2`
(`test: verify imported team save response`). This narrow correction waits for the Team Builder
save response before teardown and contains no product-behavior change.
