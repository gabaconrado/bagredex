---
name: git-standards
description: Govern safe local Git operations performed exclusively by the deployment agent.
---

# Git standards

Only the deployment agent may perform Git operations that change repository state. Other agents
may use read-only local inspection commands.

## Absolute boundaries

- Never run any Git remote operation. This includes fetch, pull, push, remote tag operations, and
  read-only remote inspection.
- Never use a hosting-provider API to inspect or mutate the repository.
- The deployment agent may retry an approved local Git mutation with direct sandbox elevation when
  the protected `.git` path requires it. Retry the same intended operation, and stop if elevation is
  denied or fails.
- Never alter configuration, hooks, paths, command semantics, or security controls to bypass an
  environment restriction.
- Do not rewrite, amend, squash, or rebase existing user commits unless an approved plan explicitly
  requires it.
- Never discard uncommitted user work.

## Preparing a commit

1. Inspect local status, the complete diff, and relevant local history.
2. Separate unrelated user changes and stage only files belonging to the approved work.
3. Run applicable checks. Fix ordinary failures; stop for missing host tools or unresolved
   permissions after the allowed local-Git elevation retry.
4. Verify staged content with `git diff --cached`.
5. Use a Conventional Commits subject describing one coherent change.

Use this trailer for commits created by the deployment agent:

```text
Co-authored-by: deployment-agent <deployment-agent@bagredex.local>
```

Report the local commit hash after a successful commit.
