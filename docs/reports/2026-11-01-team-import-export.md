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
- Web and integration re-review reported no remaining blocking findings. The only residual check
  was the browser run, whose Chromium launch was blocked by the managed sandbox before tests ran.

## Verification

- Targeted parser and component tests passed: 46 tests.
- The full Web test suite passed: 264 tests, with 21 skipped.
- TypeScript checks and the production Web build passed.
- `.codex/lint.sh` and `git diff --check` passed after the review corrections.
- The focused Playwright command reached the already-local Chromium launch, but the managed
  sandbox denied browser startup with `sandbox_host_linux.cc:41` and `Operation not permitted`.
  The deployment agent retains the permitted exact retry for final validation.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.
