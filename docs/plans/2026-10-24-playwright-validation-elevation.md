# Playwright validation elevation

## Summary

Allow the `deployment_agent` to retry an exact, already-local Playwright validation command with
direct sandbox elevation when its ordinary attempt fails specifically because the managed sandbox
prevents a browser from launching. Reconcile the repository's policy surfaces so future feature
cycles can complete browser validation without weakening Chromium or broadening agent authority.

## Goals

- Make the permitted Playwright retry explicit and consistent in repository and deployment-agent
  instructions.
- Limit the retry to the same command that produced a sandbox-specific browser launch or IPC
  failure.
- Require project-pinned Playwright tooling and browser binaries to be present locally before an
  elevated retry.
- Retain the existing bans on downloads, remote services, registry access, and restriction
  workarounds.

## Non-goals

- Changing `src/web/playwright.config.ts`, browser projects, test behavior, or application code.
- Adding `--no-sandbox`, `chromiumSandbox: false`, a custom executable, or any other browser
  security bypass.
- Installing or downloading Playwright, browsers, packages, host tools, or container images.
- Allowing coders, reviewers, architects, or data agents to request Playwright elevation.
- Granting a reusable broad command prefix or general permission to run arbitrary Node.js, npm, or
  browser commands outside the managed sandbox.
- Changing the existing local Git or Bagredex Podman elevation rules.

## User-visible behavior

This is an agent-workflow change and does not alter Bagredex. During final validation, the
`deployment_agent` first runs the planned project-pinned Playwright command normally. If the
browser process cannot launch because of the managed sandbox, the agent may request approval to
rerun that exact command with direct elevation. A successful retry supplies the browser evidence
required by the feature plan. A denied retry, missing local browser, test failure after launch, or
different environment failure is reported without further escalation.

## Decisions and assumptions

- The user chose a narrow policy exception for the `deployment_agent`, not a browser-configuration
  workaround.
- The qualifying failure must occur before test execution and identify sandbox, permission, IPC,
  or browser-launch denial. Assertion failures, server failures, missing credentials, unavailable
  browsers, and ordinary test errors do not qualify.
- The retry must preserve the command, working directory, arguments, environment, paths, browser
  project selection, and security settings from the failed attempt. The only change is direct
  sandbox elevation.
- Use `npm run test:e2e -- ...` from `src/web` or another already-defined repository script. Do not
  use a package runner mode that can obtain missing packages.
- Before requesting elevation, confirm the repository-pinned Playwright package and requested
  browser executable are already local, and confirm the configured base URL targets the local
  Bagredex runtime. The elevated command must not contact an external service.
- A previous approval does not excuse the normal first attempt or expand the exact retry's scope.
  The tool's approval mechanism remains authoritative for each requested elevated operation.

## Scope and ownership

The `deployment_agent` owns the operational policy implementation because the new authority is
limited to deployment-stage validation:

- `AGENTS.md`: add local Playwright validation to the deployment-only sandbox exceptions and state
  its specific prerequisites and prohibitions.
- `.codex/agents/deployment-agent.toml`: teach the deployment agent the normal-attempt, evidence,
  local-availability, approval, exact-retry, and stop conditions.
- `.agents/skills/feature-development/SKILL.md`: include qualifying local Playwright validation in
  the feature-cycle hard-stop exception.
- `.agents/skills/bash-standards/SKILL.md`: define the safe operational boundary for the exact local
  Playwright retry alongside the existing Podman boundary.

No application owner changes files. The architect reviews the complete instruction diff for
consistency and writes the cycle report. The deployment agent performs final validation, stages
only the cycle files, and creates the local commit. These files express one policy contract and
must be changed sequentially by the single owner.

## Data and interface impact

There is no database, API, URL, bootstrap, Pokémon data, JavaScript bundle, container-image, or
runtime configuration impact. The affected interface is the repository's agent permission
contract: the root instructions, feature workflow, Bash standards, and deployment-agent profile
must describe the same narrow exception and stop conditions.

Rollback consists of reverting the four policy edits and this cycle's artifacts. It requires no
data migration or operational cleanup.

## Implementation sequence

1. Update the root hard boundary to list qualifying already-local Playwright validation as a third
   `deployment_agent` exception while retaining the exact-command and denial stop rules.
2. Add Playwright-specific prerequisites: normal attempt first, sandbox-launch evidence, local
   package and browser availability, a local Bagredex target, and no downloads or external access.
3. Update the deployment-agent profile with the same decision sequence and explicitly prohibit
   browser security flags, environment/path changes, command changes, and repeated escalation for
   a different failure.
4. Align `feature-development` and `bash-standards` with the root contract without duplicating
   unrelated Playwright usage guidance.
5. Search the authoritative instruction surfaces for stale statements that still say elevation is
   limited to only Git and Podman, then correct contradictions within the approved files.

## Review and verification

The architect reviews the completed policy diff for cross-file agreement, least privilege,
unambiguous qualifying evidence, exact-command semantics, and preservation of all Git, Podman,
network, installation, and browser-security boundaries. There is no matching application reviewer
because no backend, Web GUI, or Pokémon data implementation changes.

Run and observe:

- `.codex/lint.sh`
- `git diff --check`
- focused searches across `AGENTS.md`, `.codex/agents`, and `.agents/skills` proving no
  authoritative instruction still excludes the approved Playwright case or grants it to another
  role;
- a normal focused Playwright command against the already-local Bagredex runtime;
- only if that command reproduces a qualifying sandbox launch failure, one user-approved elevated
  retry of the exact same command from the same working directory;
- confirmation that tests start and complete under the configured browser sandbox, with test
  results reported normally rather than treating elevation itself as a pass.

If the ordinary command succeeds, record that result and do not request elevation merely to test
the policy. If local packages, browser binaries, or the local runtime are unavailable, stop and
report the missing capability rather than downloading anything. Temporary Bagredex containers and
networks follow the existing scoped cleanup rules, and persistent database volumes remain intact.

## Risks

- Vague wording could turn a browser-launch exception into general npm elevation. Requiring the
  exact failed Playwright command, local prerequisites, qualifying failure evidence, and sole
  deployment ownership constrains the authority.
- Adding insecure Chromium flags could mask the managed-sandbox issue by weakening the browser.
  The policy explicitly prohibits command or browser-security changes.
- An elevated browser could reach an unintended URL. Confirming the configured local Bagredex base
  URL before the retry preserves the no-external-service boundary.
- Cross-file drift could cause future agents to stop despite the new approval or elevate too
  broadly. The implementation and review treat all four instruction files as one contract.
- Browser tests can still fail after launch for real product or fixture defects. Those remain
  ordinary validation failures and must be diagnosed rather than escalated again.

## Completion criteria

- All four authoritative instruction surfaces consistently authorize only the
  `deployment_agent` to retry an exact locally available Playwright command after a qualifying
  sandbox browser-launch failure.
- The instructions require a normal attempt first, local tooling and browser checks, a local
  Bagredex target, direct approval, unchanged command semantics, and an immediate stop after denial
  or a non-sandbox failure.
- Chromium's sandbox and Playwright configuration remain unchanged, with no insecure flags,
  package installation, download path, external access, or broader elevation permission added.
- The focused policy searches, repository lint, and diff checks pass.
- A normal Playwright validation is observed; when it is sandbox-blocked, the exact approved retry
  launches locally available browser tests and yields a real test result.
- Architecture review reports no blocking findings, the cycle report records the observed
  validation, and the deployment agent creates and reports the local commit.
