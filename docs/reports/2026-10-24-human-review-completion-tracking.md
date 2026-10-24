# Human-review completion tracking report

## Outcome

Human-review completion is now durable repository history rather than cache-only lifecycle state.
Every successfully torn-down session remains completion-pending until a committed, validated receipt
records its outcome. Bare `$human-review` selection stops when the newest eligible feature is already
reviewed, while an explicit target still permits an intentional repeat review.

The implementation follows the
[human-review completion tracking plan](../plans/2026-10-24-human-review-completion-tracking.md).

## Changes

- Added strict version-1 completion receipts with target, original artifacts and feature boundary,
  completion timestamp, outcome, result commit, and optional supplemental report. Repeat reviews
  append records to the same per-target receipt.
- Added the recoverable `completion-pending` lifecycle state. Teardown must succeed before entering
  it; `status` and repeated `finish` are safe, credentials are withheld, and `start` and `reload`
  refuse until committed evidence is acknowledged by `complete`.
- Added read-only candidate discovery based on reachable Git topology. A reviewed newest candidate
  requires an explicit target and never causes fallback to older unreviewed work. Explicit targeting
  continues to allow re-review.
- Defined an unchanged close as one narrow completion-record commit. A changed close uses a reviewed
  result commit followed by a narrow receipt and report-correction commit, avoiding circular commit
  references while preserving the original feature history.
- Validated receipt structure, timestamps, tracked and clean paths, commit reachability, feature
  ancestry, outcome-specific evidence, duplicates, conflicts, and session age before removing the
  marker. Failed recording remains recoverable and idempotent.
- Migrated both Damage Calculator review boundaries into one durable receipt. The layout report now
  records full commit `4b57ca970d7ec990529acc0811f70c2b9c28c348`, and the supplemental human-review
  report records full result commit `f9ad9b168f0431cb9e13bec90ef32d72bca693cf`.
- Updated lifecycle policy, skills, operator documentation, and command coverage for the durable
  completion workflow. The user-owned screenshot under `references/screenshots` remains excluded.

## Review cycles

The first architect review found that candidate discovery treated a committed report whose
**Commits** section was still pending as malformed, preventing selection of the newest completed
feature behind it. It also found missing coverage for commit-topology ordering and the required
no-fallback behavior. The deployment owner made pending reports ineligible while retaining
fail-closed handling for malformed non-pending evidence, then added focused current-shape, topology,
ambiguity, and newest-reviewed regression cases.

Architect re-review found no remaining actionable issue. It confirmed the corrected selection
behavior, strict receipt and lifecycle checks, documentation consistency, Damage Calculator
migration, and preservation of the user-owned screenshot.

## Verification

- Focused human-review Bats passed all 31 tests.
- Command Bats passed all 32 tests.
- Final `check-deploy` passed all 78 tests.
- `bash -n` passed for all deployment scripts.
- ShellCheck passed for all deployment scripts.
- `.codex/lint.sh` and `git diff --check` passed.
- Final architect re-review found no remaining blocking or non-blocking finding.

The real migration candidate query is deferred until after this cycle is committed because the new
receipt and corrected reports must be tracked and clean. Post-commit acceptance must run
`./bagredex.sh human-review candidate` and confirm target `damage-calculator-layout-refinement`,
state `reviewed`, and `EXPLICIT_TARGET_REQUIRED: true`; it must not select an older feature.

## Deferred tasks

None. The post-commit candidate query above is a required acceptance check, not deferred scope.

## Commits

This report and the implementation are included in the pending cycle commit. The Damage Calculator
feature, layout-refinement, and reviewed-result commits remain unchanged.
