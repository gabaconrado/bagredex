# Bagredex agent instructions

## Project

Bagredex is a personal Pokémon Champions VGC hub for fast reference, team development, damage
calculation, and journey logging. The intended implementation is Django with PostgreSQL and uv,
using Django-rendered pages plus focused Preact and TypeScript islands built by Vite. Plain CSS
provides light and dark themes with Indigo Purple as the primary accent. Podman owns runtime
packaging.

## Instruction and skill loading

- Follow this file before performing project work.
- Load every repository skill named by the active agent or workflow before acting.
- Repository skills live in `.agents/skills`; custom agents live in `.codex/agents`.

## Hard boundaries

- Never run a Git remote operation of any kind, including fetch, pull, push, remote inspection,
  remote tag operations, or repository-hosting API calls.
- Only `deployment_agent` may stage files, create commits, amend commits, rebase, switch branches,
  or otherwise mutate local Git state. Every other agent is limited to read-only local Git
  inspection.
- Agents run tools locally only. Never connect to a registry, cloud provider, VPS, live API, or
  other operational external service. Public documentation browsing is allowed when relevant.
- Never download or install a missing host tool. Stop and report missing capabilities.
- Run backend uv commands through `src/backend/pyproject.toml` so uv uses its configured
  backend-local `src/backend/.cache/uv` cache. Do not set `UV_CACHE_DIR` or add a command-specific
  cache override; changing cache paths remains prohibited as a restriction bypass.
- Stop and report permission or sandbox failures except for these `deployment_agent` operations:
  an approved local Git mutation, an approved local Bagredex Podman validation command, or an
  approved retry of an already-local Playwright validation command after the managed sandbox
  prevents the browser from launching. Retry only the exact blocked operation with direct sandbox
  elevation and stop if it is denied or fails for a different reason.
  Escalated Podman work must target only Bagredex containers, images, networks, and volumes; must
  use already-local images; and must never log in, pull, push, prune account-wide state, or contact
  a registry or other operational service. Before a Playwright retry, confirm the project-pinned
  package and requested browser are already local and the configured base URL targets the local
  Bagredex runtime. Preserve the failed command's working directory, arguments, environment,
  paths, project selection, and browser security settings. Never install or download tooling,
  contact an external service, add insecure browser flags, or change environment variables, paths,
  registries, command semantics, security controls, or tool configuration to bypass a restriction.
- Treat syntax, formatting, lint, type, test, build, and validation failures as ordinary feedback.
  Diagnose them, fix owned files, and rerun the failed check.
- Preserve unrelated user changes. Never perform destructive cleanup without explicit approval.

## Ownership

- `backend_coder` owns Django implementation under `src/backend`.
- `backend_reviewer` reviews backend changes and never edits them.
- `web_gui_coder` owns Django templates, Preact islands, and Web GUI assets under `src/web`.
- `web_gui_reviewer` reviews Web GUI changes and never edits them.
- `pokemon_data_coder` owns import tooling, normalized schemas, fixtures, and generated data under
  `src/data`.
- `pokemon_data_reviewer` reviews Pokémon data changes and never edits them.
- `architect` interviews the user, writes plans under `docs/plans`, resolves cross-scope design,
  reviews integration consistency, and writes completed cycle reports under `docs/reports`.
- `deployment_agent` owns `deploy`, shell automation, final validation, and all local Git mutations.

Implementation ownership is exclusive. Agents may read other scopes to understand interfaces but
must not edit them. Split cross-scope work among the respective owners.

## Feature workflow

Use the `feature-development` skill for every requested feature.

1. Use `grill-me` to interview the user one question at a time until material ambiguity is gone.
2. Dispatch `architect` to write the agreed plan before source changes begin.
3. Dispatch relevant coding agents, parallelizing only independent scopes with explicit ownership.
4. Dispatch matching reviewers and the architect for cross-scope consistency.
5. Return every actionable finding to its owner and repeat review until no blockers remain.
6. Defer only explicitly separable work, recording focused tasks under `docs/tasks`.
7. Dispatch `architect` to write a concise cycle report under `docs/reports`.
8. Dispatch `deployment_agent` for final checks and one or more justified local commits.

After that cycle is complete and committed, the user may explicitly invoke `$human-review` for an
optional isolated browser-feedback loop. Ordinary requests never enter it implicitly. Focused
feedback rounds defer independent review, full validation, the supplemental report, and the
follow-up commits until the user explicitly finishes. Successful teardown enters recoverable
`completion-pending` state until a committed per-target completion receipt is validated. An
unchanged finish creates only a narrow completion-record commit. A changed finish restores the
matching reviewers, architect review, full validation, and supplemental report, then uses a
reviewed-result commit followed by a narrow receipt/report-correction commit. Follow the
`human-review` skill for candidate selection, explicit re-review, recovery, artifacts, and lifecycle
commands.

## Data policy

- Pokémon Showdown is the sole upstream Pokémon data and mechanics source until an approved plan
  changes that decision.
- Agents never obtain upstream content through Git. Data workflows consume local snapshots supplied
  by the user and pinned to exact upstream revisions.
- Bagredex's normalized, validated, activated data is canonical at runtime. The application never
  requires upstream availability.
- Imports must preserve provenance, support reviewable diffs and rollback, and retain prior
  activated versions.
- Manual corrections are rare, documented overlays with regression tests; never edit imported
  records silently.
- Track code licenses separately from sprite, artwork, name, and trademark provenance.

## Architecture

- Django owns URLs, authentication, persistence, validation, initial HTML, and ordinary forms.
- Preact islands own high-frequency browser state such as search, filtering, team editing, and
  damage previews. Vite produces feature-split bundles for Django templates.
- Do not mutate a Preact root from Django fragments or another client library.
- Use plain CSS design tokens for light and dark themes. Prioritize desktop, provide strong tablet
  support, and retain functional phone fallback.
- Do not add a full SPA, Tailwind, HTMX, Alpine, DRF, OpenAPI, or a client state library without an
  approved, evidence-backed plan.

## Documentation and quality

- Plans are detailed agent-facing execution documents; reports are concise human-facing outcomes.
- Name plans, tasks, and reports `YYYY-MM-DD-short-topic.md`.
- Follow `docs-standards` for every Markdown edit.
- Run `.codex/lint.sh` before review handoff and before committing.
- Findings lead with concrete defects and evidence; do not block on preferences covered by tools.
- Never claim a check passed unless it was run and observed.
