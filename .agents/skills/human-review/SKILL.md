---
name: human-review
description: Run an optional review loop for an already completed Bagredex feature; requires explicit invocation.
---

# Human review

Use this skill only when the user explicitly invokes `$human-review`. It starts or resumes one
isolated local browser-review session after an ordinary feature cycle is complete and committed.
Never infer invocation from a visual-review or feedback request.

## Start or resume

1. If a session marker exists, ask the deployment agent to run
   `./bagredex.sh human-review status`. Resume its recorded target; never replace it silently.
2. Otherwise, resolve the newest completed feature from a matching committed plan, completed
   report, and reported commit. Ask one question if candidates are ambiguous or explicit context
   conflicts. Incomplete features are ineligible.
3. Ask the deployment agent to run `./bagredex.sh human-review start TARGET`. Relay its labeled URL,
   username, password, target, state, active bundle, project, and volume. Run the lifecycle command
   exactly as shown without injecting a port override. Do not reconstruct Podman commands or open a
   browser automatically.
4. If status reports `partial-finishing`, ask the deployment agent to run
   `./bagredex.sh human-review finish` to resume the exact teardown. For `partial-starting`,
   `partial-reloading`, `partial-ready`, or `stopped`, ask it to run
   `./bagredex.sh human-review reload`; this resumes idempotently without clearing review data.

The lifecycle marker is operational state, not a feedback log. Do not edit it directly. Never
delete the session on failure, interruption, inactivity, or scope expansion.

## Route feedback

- For clear in-scope feedback, have the architect create or update one
  `docs/plans/YYYY-MM-DD-<feature>-human-review.md`, then send implementation to the exclusive path
  owner. Each owner runs focused checks.
- Use `grill-me` one question at a time when expected behavior is ambiguous.
- Send architecture, data/deployment contracts, or cross-scope feedback to the architect before
  implementation.
- If feedback materially expands the completed feature, leave this session active and start a new
  ordinary `feature-development` cycle. Do not fold expanded scope into this loop.

After every implemented round, ask the deployment agent to run
`./bagredex.sh human-review reload`, relay the stable connection fields, and return control to the
user. Defer independent reviewers, full validation, the report, and Git mutation until explicit
finish.

## Finish only on explicit request

Ask the deployment agent to run `./bagredex.sh human-review finish` first. A teardown failure stops
completion and preserves the marker.

- If no tracked feedback change was accepted, stop after successful teardown. Create no artifact,
  review cycle, test run, or commit.
- If tracked changes accumulated, dispatch only matching reviewers, then the architect. Resolve all
  findings, run the supplemental plan's full checks, have the architect write one matching
  `*-human-review.md` report, and have the deployment agent create one separate follow-up commit.
  Never amend or edit the original feature artifacts or commit.

Interactive approval supplements but never replaces automated checks or independent review.
