# Purple README image badge report

## Outcome

The README's dynamic `latest image` badge now uses an explicit purple value color while retaining
its Docker image version lookup and destination. See the
[implementation plan](../plans/2026-11-02-purple-readme-image-badge.md).

## Changes

- Added the Shields.io `color=6f42c1` query parameter to the Docker image badge.
- Preserved the validation badge, Docker repository, semantic-version sort, label, alt text, and
  Docker Hub tags link.

## Review cycles

The architect reviewed the implementation for plan compliance, badge semantics, documentation
consistency, and scope containment. No blocking findings remained.

## Verification

- Exact badge-line assertions confirmed the new color and preserved parameters and link.
- `.codex/lint.sh` passed.
- `git diff --check` passed.

No remote badge or registry request was made.

## Deferred tasks

None.

## Commits

The feature commit is pending and includes this report.
