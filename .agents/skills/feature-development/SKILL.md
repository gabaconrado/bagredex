---
name: feature-development
description: Orchestrate a Bagredex feature from interview and plan through review, commit, and report.
---

# Feature development

Use this workflow for every requested Bagredex feature. Read
[`references/artifacts.md`](references/artifacts.md) before creating a plan, task, or report.

## Hard stops

- Fix ordinary implementation and validation failures within the owning scope, then rerun checks.
- Stop and report missing host tools or permission restrictions. Do not install tools or change
  environment/security behavior to bypass failures. Only the deployment agent may retry an
  approved local Git mutation or local Bagredex Podman validation command with direct sandbox
  elevation, as defined by `git-standards` and `bash-standards`.
- Never perform any Git remote operation or access an operational external service.
- Public documentation may be browsed when relevant. Data updates consume user-supplied local
  source snapshots rather than contacting upstream repositories.

## Cycle

1. Use `grill-me` one question at a time until no material ambiguity remains.
2. Dispatch the architect to write a plan in `docs/plans`. Allocate paths and interfaces to owners,
   order dependencies, define reviewers and checks, and state objective completion criteria.
3. Obtain user agreement for any new material choice not settled during the interview.
4. Dispatch affected coding agents. Parallelize only independent scopes with exclusive ownership.
5. Dispatch the matching reviewers after implementation:
   - backend reviewer for `src/backend`;
   - Web GUI reviewer for `src/web`;
   - Pokémon data reviewer for `src/data` and its consumer interfaces;
   - architect for cross-scope consistency.
6. Return every actionable finding to its owner and repeat until no blocking findings remain.
7. Defer only out-of-scope, safely separable work; record evidence and acceptance criteria in
   `docs/tasks`.
8. Dispatch the architect to write a concise report in `docs/reports` after review and before final
   staging. Its commits section may state that the report is included in the pending cycle commit.
9. Dispatch the deployment agent for final local checks and the local commit.

## Completion

A cycle is complete only when approved behavior exists, affected interfaces agree, required checks
pass, blocking findings are resolved, required documentation exists, and local commits are
reported. A remote repository is never part of completion.
