---
name: django-standards
description: Apply Bagredex Python and Django backend implementation and review standards.
---

# Django standards

Apply these rules to Python and Django code under `src/backend`.

## Tooling and design

- Use uv for Python versions, environments, dependencies, locking, and project commands.
- Declare dependencies in `pyproject.toml` and commit `uv.lock` for reproducible builds.
- Run Python and Django commands through `uv run`; never edit installed packages.
- Keep views thin and domain policy separate from forms, transport, rendering, and persistence.
- Prefer Django facilities over dependencies when they satisfy the requirement clearly.
- Keep synchronous code unless measured behavior and deployment constraints justify async work.

## Domain integrity

- Use canonical stable identifiers for Pokémon, forms, moves, abilities, items, and regulations.
- Associate persisted teams and calculations with the applicable data/mechanics version when
  reproducibility requires it.
- Use exact integer or rational arithmetic for stats and damage; never substitute binary
  floating-point arithmetic where game rounding matters.
- Keep imported upstream records distinguishable from user-authored teams, notes, and overrides.

## Validation, security, and persistence

- Validate untrusted input with Django forms or explicit boundary validation.
- Preserve CSRF protection, template autoescaping, secure sessions, and standard middleware.
- Keep secrets in runtime configuration and fail clearly when required configuration is absent.
- Use database constraints for durable invariants and `transaction.atomic()` for atomic workflows.
- Treat schema and data migrations as reviewed application changes that preserve existing data.
- Review list and aggregation paths for pagination, indexes, and hidden query growth.
- Add a JSON API only when an interactive island or external consumer requires one; do not add DRF
  or OpenAPI by default.

## Verification

- Test observable behavior at domain, request, and persistence boundaries.
- Test exact arithmetic, regulation scoping, canonical forms, authorization, rollback, and database
  constraints where applicable.
- Run project formatting, lint, type, migration, system, and test checks without weakening them.
