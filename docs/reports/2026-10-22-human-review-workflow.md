# Human review workflow report

## Outcome

Bagredex now has an explicit-only `$human-review` workflow for optional browser feedback after a
feature is complete and committed. It starts or resumes one isolated local review session, routes
accepted feedback through existing owners, and returns changed sessions to independent review,
full validation, a supplemental report, and a separate commit only when the user explicitly
finishes.

See the [human review workflow plan](../plans/2026-10-22-human-review-workflow.md).

## Changes

- Added the explicit-only `human-review` skill and disabled implicit invocation in its OpenAI
  metadata. Ordinary feature delivery remains complete at its original commit; unchanged review
  sessions create no tracked artifacts, tests, or follow-up commit.
- Added deterministic `start`, `status`, `reload`, and `finish` commands under `bagredex.sh`, with
  stable connection output and strict target, argument, tool, port, and credential validation.
- Added a fixed `bagredex-human-review` Compose project and dedicated
  `bagredex-human-review-database` volume, isolated from ordinary local and production resources.
- Added an ignored, atomic mode-`0600` session marker, single-session locking, persisted target,
  completion commit, active data bundle, credentials, and lifecycle state.
- Added fail-closed resource and label reconciliation, health-aware status, resumable partial
  startup/reload/finish behavior, data-preserving rebuilds, and exact explicit teardown.
- Added feedback-routing and supplemental-artifact rules for clear, ambiguous, architectural,
  cross-scope, and expanded requests, plus command and operator documentation.

## Review cycles

Initial integration review found that interrupted teardown was routed to reload, established
sessions could report normal status after required resources disappeared, older selected features
recorded current `HEAD` instead of their reported completion commit, and the lifecycle matrix did
not cover several approved failure paths. The deployment owner separated finishing recovery,
added state-aware resource and health reconciliation, validated the reported commit and artifact
boundary, persisted the activated bundle, and expanded focused tests.

A second review found two remaining recovery gaps: a partially created startup resource set could
not resume, and `status` used undeclared `curl`. The owner allowed validated startup subsets to be
repaired idempotently, declared and tested the missing tool, and narrowed commit extraction to the
report's **Commits** section. Final integration review found no blockers.

## Verification

- Bash syntax and ShellCheck passed for `bagredex.sh` and all deployment scripts.
- The skill creator validator passed for `.agents/skills/human-review`; its metadata disables
  implicit invocation. The skill was not separately observed through an end-to-end Codex UI
  invocation during this cycle.
- All 18 focused human-review Bats tests passed, including target boundaries, credentials, locking,
  health states, partial-resource recovery, bundle persistence, and exact teardown behavior.
- The complete deployment Bats suite passed all 64 tests.
- `.codex/lint.sh` and `git diff --check` passed.
- A real local-image-only Podman smoke started a fresh isolated session, reached the pinned healthy
  application, retained a recognizable database record across reload, recovered after the server
  was stopped, and preserved the same dedicated volume and review data.
- Explicit finish removed the human-review containers, network, volume, and marker without touching
  ordinary resources. A second start used a fresh database in which the recognizable record was
  absent, and its explicit finish removed the second session.
- After the final health-aware status changes, another real reload reached HTTP and container
  health successfully, and explicit finish again removed the scoped session resources.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.
