# Playwright validation elevation report

## Outcome

The repository now defines a narrow deployment-only path for retrying an already-local Playwright
validation command when the managed sandbox prevents the browser from launching. The change keeps
the command and browser security settings intact and does not alter Bagredex application behavior.

See the [approved implementation plan](../plans/2026-10-24-playwright-validation-elevation.md).

## Changes

- `AGENTS.md` now recognizes qualifying Playwright browser-launch failures as a deployment-only
  sandbox exception with local-tooling and local-runtime prerequisites.
- `.codex/agents/deployment-agent.toml` defines the normal-attempt, evidence, approval, exact-retry,
  and stop sequence for final validation.
- `.agents/skills/feature-development/SKILL.md` aligns the feature-cycle hard stop with the narrow
  exception.
- `.agents/skills/bash-standards/SKILL.md` defines the operational boundary without permitting
  downloads, external access, insecure browser flags, or general command elevation.

## Review cycles

Architecture review found no blocking or actionable findings. It confirmed that the four policy
surfaces agree, only the `deployment_agent` receives the authority, and the Git, Podman, network,
installation, and browser-security boundaries remain unchanged.

## Verification

Observed checks passed:

- `.codex/lint.sh`
- `git diff --check`
- Focused contradiction searches across `AGENTS.md`, `.codex/agents`, and `.agents/skills`

From `src/web`, deployment validation ran:

```text
npm run test:e2e -- tests/e2e/damage-calculator.spec.ts \
  --project=desktop-light \
  --grep 'renders delayed loading state'
```

The normal attempt failed before test execution when Chromium sandbox-host IPC returned
`Operation not permitted`. After confirming the project-pinned Playwright package and browser were
already local and the configured target was the local Bagredex runtime, the user-approved elevated
retry preserved the exact command and launched Chromium successfully.

The test then stopped with the ordinary fixture prerequisite `Set BAGREDEX_E2E_USERNAME and
BAGREDEX_E2E_PASSWORD.` The deployment agent correctly did not change the environment or command
and did not retry. This result proves the narrow elevation path works; providing local test
credentials remains an ordinary Playwright prerequisite rather than a policy defect.

## Deferred tasks

None.

## Commits

This report will be included in the pending cycle commit.
