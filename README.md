# Bagredex

[![Validation](https://github.com/gabaconrado/bagredex/actions/workflows/ci.yml/badge.svg)](https://github.com/gabaconrado/bagredex/actions/workflows/ci.yml)
[![Latest Docker image](https://img.shields.io/docker/v/gabaconrado/bagredex?sort=semver&label=latest%20image&color=6f42c1)](https://hub.docker.com/r/gabaconrado/bagredex/tags)

A personal Pokémon Champions VGC hub for learning, team development, fast battle reference, damage
calculation, and journey logging.

## Status

Bagredex has a persistent authenticated slice: Django serves username/password login, protected
pages, standard administration, and health endpoints backed by PostgreSQL. Rootless Podman
packaging supports local execution and a human-operated Nginx, Let's Encrypt, and rollback-capable
production lifecycle.

## Product direction

Bagredex will bring a focused set of personal VGC tools into one responsive interface:

- a regulation-aware Pokédex for quickly checking stats, abilities, and moves during matches;
- a team builder with versions, matchup notes, replay links, and related research;
- a damage calculator for evaluating matchups and optimizing stat spreads;
- a durable record of the user's Pokémon journey.

Features will be designed and implemented one at a time. The goal is not to reproduce every feature
from existing VGC sites, but to keep only the workflows useful to this project.

## Intended stack

- Python and Django for server-side behavior
- PostgreSQL for persistent application and normalized Pokémon data
- uv for Python versions, environments, dependencies, locking, and commands
- Django-rendered HTML for the application shell and ordinary pages
- Preact with TypeScript for focused interaction-heavy islands
- Vite for feature-split frontend builds integrated with Django templates
- Plain CSS with semantic tokens, light and dark themes, and an Indigo Purple primary accent
- Rootless Podman for local and production packaging

OpenAPI, Django REST Framework, a full single-page application, Tailwind, HTMX, Alpine, and a client
state library are deliberately absent from the initial architecture. They may be introduced later
only for a concrete requirement.

## Interaction goals

Frequent actions such as typing in a Pokédex search, selecting a move, changing a stat spread, or
recalculating damage must not wait for a server round trip. The interface is desktop-first, has
strong tablet support, and remains functional on phones without prioritizing dense phone layouts.
Keyboard use, touch targets, focus stability, accessibility, and measured interaction latency are
part of feature completion.

## Pokémon data

[Pokémon Showdown][showdown] is the sole upstream source for Pokémon data and battle mechanics
until the project deliberately changes that policy. Bagredex will not query it at runtime.

The planned update workflow accepts a locally supplied Showdown snapshot pinned to an exact commit,
normalizes it into a Bagredex-owned schema, validates it, and produces a semantic diff for review.
Activation is explicit, prior versions remain available for rollback and reproducibility, and rare
manual corrections are documented, tested overlays. Every dataset records provenance and content
versions.

Pokémon Showdown's server and simulator are MIT-licensed, while its client is generally AGPL-3.0.
Bagredex may study client behavior but will not copy client code or styling without a separate
licensing decision. Code licenses do not grant rights to Pokémon artwork, sprites, names, or
trademarks; asset provenance will be handled independently.

## Frontend architecture

Django owns routes, authentication, persistence, validation, initial rendering, and ordinary forms.
Each state-heavy tool receives an isolated Preact root. An island owns everything inside that root
and communicates with Django only to load or save durable state. This preserves fast local
interaction without duplicating the whole application as a separate SPA.

The interface uses plain CSS rather than a utility or component framework. Shared semantic tokens
will produce equivalent light and dark themes with Indigo Purple as the defining accent family.
Exact colors and contrast pairs will be selected and tested when the first interface is designed.

## Repository layout

- `src/backend`: Django server source, settings, and tests
- `src/web`: Django templates and CSS; future Preact islands and browser tests
- `src/data`: future Pokémon import tooling, schemas, fixtures, and normalized artifacts
- `deploy`: Podman packaging, Nginx and Certbot configuration, release scripts, and deployment tests
- `docs/plans`: architect-authored implementation plans
- `docs/tasks`: explicitly deferred follow-up work
- `docs/reports`: completed cycle reports
- `.agents/skills`: repository-specific workflows and standards
- `.codex/agents`: role definitions and ownership boundaries

## Development workflow

Features begin with a one-question-at-a-time interview and an architect-authored plan. Scope owners
implement the agreed work; independent reviewers return concrete findings until no blockers remain.
The deployment agent runs final local checks, creates local commits, and records a concise report.
After that cycle is complete, an explicit `$human-review` invocation can open an isolated,
disposable browser-feedback loop. It never starts implicitly. Successful teardown remains
completion-pending until a committed per-target receipt is validated. Changed sessions use a
reviewed-result commit and a narrow completion-record commit; unchanged sessions create only the
completion record.

Agents operate locally. They never run Git remote operations, contact deployment targets, install
missing host tools, or bypass sandbox restrictions. The deployment agent may request narrow
sandbox elevation for an approved local Git mutation or local Bagredex Podman validation command,
and must stop if it is denied. Escalated Podman checks use only already-local images and
project-scoped resources; registry access and unrelated container mutations remain forbidden.
Public documentation may be consulted when relevant. Human-invoked publishing and deployment
remain outside agent execution.

## Command entry point

`bagredex.sh` is the top-level interface:

```bash
./bagredex.sh check
./bagredex.sh run
./bagredex.sh review
./bagredex.sh migrate
./bagredex.sh human-review candidate
./bagredex.sh human-review start FEATURE-SLUG
./bagredex.sh human-review complete
./bagredex.sh publish VERSION
./bagredex.sh deploy VERSION [--dry-run]
```

`run` starts PostgreSQL, applies migrations, serves the local container at
`http://127.0.0.1:8000`, and stops the containers on `Ctrl+C` without deleting database data.
`review` prepares the complete browser-review stack on configurable port `8000` by default with
the local-only `admin` / `admin` account. Human-review sessions use fixed port `8000` and the same
default account. `migrate` applies local migrations without starting the web server. `publish` and
`deploy` are human-invoked operational commands; agents do not execute their registry, SSH,
certificate, or remote-system operations. See the [deployment guide](deploy/README.md) for database
persistence, isolated human-review lifecycle, host preparation, configuration, account bootstrap,
TLS, renewal, and rollback behavior.

## License

Bagredex's original code and documentation are licensed under the [MIT License](LICENSE). Third-party
data, code, trademarks, and assets retain their own terms.

[showdown]: https://github.com/smogon/pokemon-showdown
