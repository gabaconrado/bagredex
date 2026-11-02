# Purple README image badge

## Summary

Give the README's `latest image` Shields.io badge an explicit purple value so it reads as neutral
project metadata rather than an orange warning. Keep its version lookup, label, accessible image
description, and Docker Hub destination unchanged.

## Goals

- Render the dynamic `latest image` badge value segment in purple.
- Preserve the badge's existing semantic-version lookup and navigation behavior.

## Non-goals

- Changing the `Validation` badge or application UI colors.
- Changing image publication, Docker tags, release automation, or deployment behavior.
- Adding dependencies or contacting GitHub, Shields.io, or Docker Hub during agent validation.

## User-visible behavior

The `latest image` badge beneath the README title displays its dynamic Docker image version with a
purple value segment instead of Shields.io's default color. Clicking it still opens the
`gabaconrado/bagredex` Docker Hub tags page.

## Decisions and assumptions

- Add the stable Shields.io `color=6f42c1` query parameter to the existing badge image URL.
- Keep the label `latest image`, `sort=semver`, image repository, alt text, and link target exact.
- The user accepted any purple; `6f42c1` is explicit and visually distinct from warning orange.

## Scope and ownership

The `deployment_agent` owns the implementation because the README badge documents the published
container image surface:

- `README.md`: add the explicit purple color query parameter to the Docker image badge.

The `architect` owns this plan, integration review, and the completed cycle report. No backend,
Web GUI, or Pokémon data implementation changes or matching scope reviewers are required.

## Data and interface impact

There are no database, runtime API, application UI, Pokémon data, container image, release, or
deployment changes. The only interface change is presentation metadata in the remote badge image
request encoded by the README.

## Implementation sequence

1. The deployment agent inspects the worktree and changes only the Docker version badge URL in
   `README.md`, preserving unrelated work.
2. The architect reviews the diff for plan compliance, exact preserved query semantics and link,
   documentation consistency, and scope containment.
3. The architect writes `docs/reports/2026-11-02-purple-readme-image-badge.md` after review.
4. The deployment agent runs the required local checks and creates the feature commit.
5. The architect records the exact feature commit in the report. The deployment agent validates
   and commits that report-only correction, then confirms the human-review candidate boundary.

## Review and verification

The deployment agent verifies locally that:

- the badge image URL retains `sort=semver` and `label=latest%20image` and adds exactly
  `color=6f42c1`;
- the badge alt text and Docker Hub tags link are unchanged;
- only the planned README badge presentation and required cycle artifacts changed;
- `.codex/lint.sh` passes; and
- `git diff --check` and staged-diff review pass before each commit.

No remote badge request or registry access is permitted or required. The architect performs the
integration review after implementation; no separate application-scope reviewer applies.

## Risks

- Shields.io controls the final badge rendering and may change presentation independently. The
  explicit supported color value makes repository intent deterministic without testing remotely.
- An incorrectly placed query separator could change badge lookup behavior. Exact URL inspection
  protects the existing parameters and link target.

## Completion criteria

- The README Docker image badge URL includes `color=6f42c1` and retains its current repository,
  semantic-version sort, label, alt text, and Docker Hub tags link.
- The validation badge and all runtime, release, and deployment behavior remain unchanged.
- Required local checks pass, the architect reports no blocking findings, the cycle report names
  the exact feature commit after correction, and `./bagredex.sh human-review candidate` reports
  that feature commit as the available target.
