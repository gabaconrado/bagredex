# Feature artifact templates

Use the minimum content needed while retaining every applicable section.

## Implementation plan

Path: `docs/plans/YYYY-MM-DD-topic.md`

```markdown
# Feature title

## Summary

## Goals

## Non-goals

## User-visible behavior

## Decisions and assumptions

## Scope and ownership

## Data and interface impact

## Implementation sequence

## Review and verification

## Risks

## Completion criteria
```

Allocate each changed path to one owner. Identify dependencies, safe concurrency, exact checks when
known, data-version effects, and rollback or compatibility concerns.

## Follow-up task

Path: `docs/tasks/YYYY-MM-DD-topic.md`

```markdown
# Task title

## Problem

## Evidence

## Scope

## Acceptance criteria

## Deferral reason and dependencies
```

Never use a task file to conceal a blocking defect or unfinished approved scope.

## Implementation report

Path: `docs/reports/YYYY-MM-DD-topic.md`

```markdown
# Feature title report

## Outcome

## Changes

## Review cycles

## Verification

## Deferred tasks

## Commits
```

Keep reports concise, record observed outcomes rather than activity transcripts, and link the plan
and any deferred tasks.

## Human-review supplements

An explicitly invoked post-completion human-review session leaves the original feature plan,
report, and commit unchanged. Create supplemental artifacts only after accepted feedback will
change tracked files:

- `docs/plans/YYYY-MM-DD-<feature>-human-review.md` accumulates all focused rounds using the
  implementation-plan sections above, plus the original artifacts/base commit and round evidence.
- `docs/reports/YYYY-MM-DD-<feature>-human-review.md` is written only at changed-session finish and
  uses the implementation-report sections above, linking the original artifacts and supplemental
  plan.

An unchanged session creates neither artifact. Update one supplemental plan across rounds rather
than creating a file per round.
