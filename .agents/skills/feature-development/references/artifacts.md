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
