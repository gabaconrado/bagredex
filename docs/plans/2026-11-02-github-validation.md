# GitHub validation

## Summary

Add a GitHub Actions workflow that runs Bagredex's existing validation boundaries without
publishing or deploying anything. Add README badges for the workflow result and the latest
manually published Docker image.

## Goals

- Run repository validation for pull requests, pushes to `main`, and manual workflow dispatches.
- Cover Web GUI checks, backend checks and PostgreSQL-backed tests, documentation and shell lint,
  and deployment-script tests.
- Limit the workflow token to read-only repository contents.
- Show the validation result and latest Docker image version at the top of the README.

## Non-goals

- Publishing container images, creating releases or tags, or deploying to any environment.
- Adding repository secrets, write permissions, scheduled runs, or operational service access.
- Changing application behavior, test semantics, dependencies, or the local validation commands.
- Configuring GitHub branch protection or other remote repository settings.

## User-visible behavior

GitHub displays a `Validation` workflow for pull requests, pushes to `main`, and manually started
runs. Its jobs report failures from the same scoped commands used locally. The README for
`gabaconrado/bagredex` displays the workflow status and links to its Actions runs, and displays the
latest semantic Docker image version with a link to the image tags.

No workflow event invokes `bagredex.sh publish`, `bagredex.sh deploy`, a registry login or push, SSH,
or any production operation.

## Decisions and assumptions

- Use `/home/gaba/penni-more/.github/workflows/ci.yml` only as a local structural reference; adapt
  jobs to Bagredex's command boundaries and locked dependencies.
- Name the workflow `Validation` and its file `.github/workflows/ci.yml`, making the status badge
  URL stable at `gabaconrado/bagredex/actions/workflows/ci.yml`.
- Use `ubuntu-24.04`, versions from `.tool-versions`, locked `npm ci` and `uv sync --frozen`, and
  commit-pinned third-party actions.
- Split independent Web GUI, backend, and documentation/deployment validation into jobs so failures
  are attributable and work can run concurrently. Each job installs only the tools and declared
  project dependencies needed by its existing Bagredex command.
- CI dependency downloads are part of the GitHub-hosted test environment. Agent validation remains
  local and does not contact GitHub, registries, or other operational services.
- The Docker badge observes manually published `gabaconrado/bagredex` tags; it does not trigger or
  imply automatic publication.

## Scope and ownership

The `deployment_agent` exclusively owns all implementation files because CI is repository
automation and the README badges document its release/validation surface:

- `.github/workflows/ci.yml`: workflow triggers, permissions, runtime setup, dependency setup, and
  validation jobs.
- `README.md`: GitHub Actions validation and Docker image badges.

The `architect` owns this plan, cross-scope consistency review, and the completed cycle report.
There are no backend, Web GUI, or Pokémon data implementation changes, so their coding agents and
matching reviewers are not required.

## Data and interface impact

There are no database schema, runtime API, Web GUI, Pokémon data, container image, or deployment
interface changes. The workflow consumes the existing public command interface:

- `./bagredex.sh check-web` after installing the locked Web GUI dependencies;
- `./bagredex.sh check-backend` after syncing the frozen backend development environment;
- `./bagredex.sh test` with Podman and Compose available for PostgreSQL-backed tests; and
- `./bagredex.sh check-deploy` after installing its declared lint and Bats tools.

The workflow must not call the `publish` or `deploy` command branches. Its only GitHub token
permission is `contents: read`, and it receives no deployment environment or repository secrets.

## Implementation sequence

1. The deployment agent inspects the current local worktree and preserves unrelated changes.
2. Add `.github/workflows/ci.yml` with the three agreed triggers, top-level read-only contents
   permission, pinned setup actions, runtime versions from `.tool-versions`, locked dependency
   installation, and scoped Web GUI, backend/test, and documentation/deployment jobs.
3. Keep artifact upload optional and limited to test diagnostics; do not introduce it unless an
   existing Bagredex command creates a useful deterministic report.
4. Add the validation badge linked to the workflow runs and the Docker version badge linked to
   `gabaconrado/bagredex` tags immediately below the README title.
5. The architect reviews the complete change for plan compliance, command coverage, ownership,
   and absence of operational behavior. Return any finding to the deployment agent.
6. The architect writes `docs/reports/2026-11-02-github-validation.md` after review.
7. The deployment agent performs final validation and creates the feature commit, then the
   architect records that exact commit in the report for a narrow correction commit and candidate
   verification required by the feature workflow.

## Review and verification

The deployment agent runs and records:

- a local structural inspection confirming triggers are exactly `pull_request`, pushes to `main`,
  and `workflow_dispatch`;
- a local structural inspection confirming `permissions: contents: read`, no `secrets` or
  deployment environment, and no publish, deploy, login, push, SSH, or registry step;
- YAML parsing or `actionlint` only if an appropriate parser is already installed; do not download
  a missing host tool solely for local validation;
- `npm --prefix src/web ci --ignore-scripts --no-audit --no-fund` before `./bagredex.sh check-web`
  when the locked Web GUI dependencies are not already present;
- `uv --directory src/backend sync --frozen` before `./bagredex.sh check-backend` when the frozen
  backend development environment is not already synchronized;
- `./bagredex.sh check` as the final comprehensive local check, using only already-local Podman
  images and the narrowly permitted elevation path if the managed sandbox blocks Podman;
- `.codex/lint.sh`; and
- `git diff --check` plus review of the exact staged diff before each commit.

Because agents cannot execute GitHub-hosted Actions or access the remote repository, the first
remote workflow run after the user uploads the repository remains a human-observed verification.
A remote-run failure is not worked around by adding publish permissions or deployment behavior.

## Risks

- GitHub's runner image may not contain a working Podman Compose provider. The workflow should
  verify the runtime early so the failure is explicit; any later compatibility correction remains
  CI-only and must not weaken local Podman behavior.
- Python 3.14 or Node.js 26 availability in setup actions may lag the versions pinned by the
  repository. Keep `.tool-versions` authoritative and report setup failures rather than silently
  testing a different runtime.
- The README status badge is unknown until `gabaconrado/bagredex` exists remotely and the workflow
  has run. The Docker badge may show no version until a semantic tag has been manually published.
- The full backend test boundary builds local images and runs PostgreSQL, making it slower than
  lint-only jobs; parallel jobs keep unrelated feedback independent.

## Completion criteria

- `.github/workflows/ci.yml` exists with only the agreed triggers and read-only contents permission.
- CI covers all validation performed by `check-web`, `check-backend`, `test`, and `check-deploy`.
- The workflow contains no publish, deployment, registry authentication/push, SSH, secret, or
  production-environment behavior.
- README badges target `gabaconrado/bagredex`, link to the validation runs and Docker tags, and
  accurately describe remote status rather than promising automatic publication.
- The architect reports no blocking integration findings, all available required local checks
  pass, the cycle report names the exact feature commit after correction, and
  `./bagredex.sh human-review candidate` reports that feature commit as the available target.
