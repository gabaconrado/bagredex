---
name: human-review
description: Run an optional review loop for an already completed Bagredex feature; requires explicit invocation.
---

# Human review

Use this skill only when the user explicitly invokes `$human-review` or `$human-review TARGET`.
Never infer invocation from a visual-review or feedback request. The optional target is explicit
re-review syntax; do not treat ordinary prose as a target.

## Select, start, or resume

1. If a lifecycle marker exists, ask the deployment agent to run
   `./bagredex.sh human-review status`. Its target and state take precedence over any requested
   target. Never edit or delete the marker directly.
2. For bare `$human-review`, ask the deployment agent to run
   `./bagredex.sh human-review candidate`. If it reports `available`, start its target. If it reports
   `reviewed`, stop and tell the user that an explicit `$human-review TARGET` is required; never fall
   back to an older candidate. Ask one focused target question if repository evidence is ambiguous.
3. For `$human-review TARGET`, ask the deployment agent to run
   `./bagredex.sh human-review start TARGET`. Explicit targeting permits intentional re-review of a
   completed boundary.
4. Relay labeled URL, username, password, target, state, active bundle, project, and volume after a
   successful start. Run lifecycle commands exactly as shown without injecting a port override.
5. Route `partial-finishing` to `./bagredex.sh human-review finish`. Route `partial-starting`,
   `partial-reloading`, `partial-ready`, or `stopped` to
   `./bagredex.sh human-review reload`. Route `completion-pending` to completion recording below;
   never reload or start over after teardown.

The lifecycle marker is operational state, not a feedback log. Never delete the session on failure,
interruption, inactivity, or scope expansion.

## Route feedback

- For clear in-scope feedback, have the architect create or update one
  `docs/plans/YYYY-MM-DD-<feature>-human-review.md`, then send implementation to the exclusive path
  owner. Each owner runs focused checks.
- Use `grill-me` one question at a time when expected behavior is ambiguous.
- Send architecture, data/deployment contracts, or cross-scope feedback to the architect first.
- If feedback materially expands the completed feature, leave this session active and start a new
  ordinary `feature-development` cycle.

After each implemented round, ask the deployment agent to run
`./bagredex.sh human-review reload`, relay the stable connection fields, and return control to the
user. Defer independent reviewers, full validation, the report, and Git mutation until explicit
finish.

## Finish only on explicit request

Ask the deployment agent to run `./bagredex.sh human-review finish` first. A teardown failure leaves
`partial-finishing`; retry the exact finish. Successful teardown reports `completion-pending`,
withholds credentials, preserves the marker, and never means the review is complete by itself.

### Unchanged session

Do not invent product review, tests, or supplemental artifacts. Have the architect create or append
the target's `docs/reports/YYYY-MM-DD-<target>-human-review-completion.md` receipt with outcome
`unchanged`, the original feature commit as result, and `-` for the supplemental report. Have the
deployment agent validate and create one narrow completion-record commit.

### Changed session

Dispatch only matching reviewers, then the architect. Resolve findings, run the supplemental plan's
full checks, and have the architect write the matching `*-human-review.md` report. The deployment
agent first creates a separate reviewed-result commit containing accepted changes and supplemental
artifacts. The report may say pending only in that intermediate commit. Then the architect replaces
the pending statement with the full result hash and creates or appends the completion receipt with
outcome `changed`. The deployment agent creates a second narrow completion-record commit containing
only the receipt and report correction. Never amend the result commit or original feature history.

### Acknowledge completion

After the completion-record commit, ask the deployment agent to run
`./bagredex.sh human-review complete`. It validates committed, unchanged, reachable receipt evidence
against the pending marker and removes the marker only on success. Relay `STATE: complete`, outcome,
feature commit, and result commit. A repeated explicit review appends a newer receipt record; an
older record cannot clear a later session.

Interactive approval supplements but never replaces automated checks, independent review, the
durable receipt, or final `complete` acknowledgment.
