# Repository bootstrap

## Summary

Create the documentation, governance, agent setup, and empty source layout for Bagredex without
implementing application, command, CI, or deployment behavior.

## Goals

- Record the product direction, technology choices, data policy, and permission boundary.
- Adapt Penni More's agent ownership and feature cycle to Bagredex.
- Establish an empty layout for backend, Web GUI, Pokémon data, deployment, and lifecycle docs.
- Select the already-installed local Python and Node.js toolchain versions used by Penni More.
- License original Bagredex work under the MIT License.
- Validate and create the repository's first local commit.

## Non-goals

- Creating a Django project, database schema, or Python dependency manifest.
- Creating a frontend package, Preact component, stylesheet, or Vite configuration.
- Implementing the Pokémon Showdown import workflow or storing Pokémon data.
- Copying Penni More deployment assets or implementing `bagredex.sh`.
- Adding CI, OpenAPI, Django REST Framework, or remote repository configuration.

## User-visible behavior

There is no application behavior in this cycle. A reader can understand the intended product,
architecture, data ownership, contribution workflow, and current bootstrap status from the README.

## Decisions and assumptions

- Original project work uses the MIT License while the repository remains private initially.
- Django, PostgreSQL, and uv form the backend foundation.
- Local tooling selects Python 3.14.7 and Node.js 26.7.0 through ASDF metadata.
- Django-rendered pages host Preact/TypeScript islands built by Vite.
- CSS is plain and token-driven, with first-class light and dark themes and an Indigo Purple accent.
- Desktop is primary, tablet support is strong, and phones receive functional fallback.
- Pokémon Showdown is the sole initial upstream source for game data and mechanics.
- Runtime data is normalized, versioned Bagredex data; upstream is never a runtime dependency.
- Agents never perform Git remote operations or connect to operational external services.
- Agents stop for host dependency and permission failures without workarounds. The deployment agent
  may use direct sandbox elevation only for approved local Git mutation and stops if it is denied.

## Scope and ownership

- Architect scope: this plan, top-level policy, README, and adapted lifecycle instructions.
- Role instruction scope: `.codex/agents` definitions for architecture, backend, Web GUI, Pokémon
  data, review, and deployment.
- Repository skill scope: `.agents/skills` standards and feature workflow.
- Deployment agent scope: local validation, staging, and initial local commit.

No application coding agent receives implementation work in this cycle.

## Data and interface impact

No schemas, datasets, APIs, or runtime interfaces are created. Documentation establishes future
ownership and invariants only.

## Implementation sequence

1. Inspect Penni More's policies, skills, roles, repository layout, and deployment approach.
2. Research the reference projects and select the frontend/data boundaries.
3. Resolve licensing, source policy, target devices, themes, and permission rules with the user.
4. Adapt repository skills and agent definitions.
5. Write the README, project policy, license, ignore rules, and empty tracked layout.
6. Validate skill structure, Markdown, shell, TOML, JSON, repository status, and staged content.
7. Review the complete bootstrap diff and resolve blocking findings.
8. Write the bootstrap cycle report.
9. Create and report the initial local commit.

## Review and verification

- Run the skill creator's `quick_validate.py` against each repository skill.
- Run `.codex/lint.sh`.
- Parse `.codex/hooks.json` and all TOML files with local standard-library tools.
- Run `bash -n` and `shellcheck` against `.codex/lint.sh`.
- Inspect `git diff --check`, the complete diff, and the staged diff.
- Verify no application or deployment implementation entered the commit.
- Verify no Git remote operation occurs.

## Risks

- Exact dependency versions and deployment identifiers remain intentionally unresolved until their
  implementation cycles.
- Pokémon Showdown source structure can change; the future importer must fail closed and be pinned.
- Sprite and artwork provenance remains a separate future decision.
- Preact/Django integration requires disciplined DOM ownership and performance measurement.

## Completion criteria

- Every approved bootstrap file exists with internally consistent decisions and ownership.
- Empty source/deployment/report/task directories are tracked.
- Available local validation passes, with unavailable tools reported as blockers.
- Review finds no unresolved blocking defect.
- The initial commit exists locally and its hash is reported.
