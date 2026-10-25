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

Before the feature commit exists, the report may say that it is included in the pending cycle
commit. After the deployment agent creates that commit, the architect must replace the pending
statement with the exact full feature-commit hash and subject. The deployment agent commits that
report-only correction separately and verifies the completed boundary with
`./bagredex.sh human-review candidate`. Never amend the feature commit to make it reference itself.

## Human-review supplements

An explicitly invoked post-completion human-review session leaves the original feature plan,
report, and commit unchanged. Create supplemental artifacts only after accepted feedback will
change tracked files:

- `docs/plans/YYYY-MM-DD-<feature>-human-review.md` accumulates all focused rounds using the
  implementation-plan sections above, plus the original artifacts/base commit and round evidence.
- `docs/reports/YYYY-MM-DD-<feature>-human-review.md` is written only at changed-session finish and
  uses the implementation-report sections above, linking the original artifacts and supplemental
  plan.

An unchanged session creates neither supplemental artifact. Every finished session creates or
appends one authoritative receipt at
`docs/reports/YYYY-MM-DD-<feature>-human-review-completion.md`. Its fenced machine-record history is
append-only and uses:

```text
v1|COMPLETED_AT|TARGET|PLAN|REPORT|FEATURE_COMMIT|OUTCOME|RESULT_COMMIT|SUPPLEMENTAL_REPORT
```

Use `OUTCOME` `changed` with the exact reviewed-result commit and supplemental report path, or
`unchanged` with the original feature commit as the result and `-` as the supplemental report.
Update one supplemental plan across rounds rather than creating a file per round. A changed report
may say its commit is pending only in the reviewed-result commit; the narrow completion-record
commit must replace that statement with the full result hash.
