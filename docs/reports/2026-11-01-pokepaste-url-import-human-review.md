# PokéPaste URL import human-review report

## Outcome

The accepted human-review correction gives the Bagredex server outbound routing for its existing
fixed-origin PokéPaste request while keeping PostgreSQL isolated. The user confirmed the original
failure in the active runtime, and the focused correction preserves the import workflow, security
boundary, and rate limiter defined by the completed feature.

This supplement implements Round 1 of the
[PokéPaste URL import human-review plan](../plans/2026-11-01-pokepaste-url-import-human-review.md)
without changing the original
[feature plan](../plans/2026-11-01-pokepaste-url-import.md) or
[feature report](2026-11-01-pokepaste-url-import.md).

## Changes

- Added a distinct non-internal egress network to the local Compose topology and attached only the
  Bagredex server to it.
- Kept the server and PostgreSQL on the internal application network, with PostgreSQL attached to
  no other network.
- Added focused deployment coverage for server-only egress, the internal database boundary, and
  the absence of published ports, host networking, privileged mode, or added capabilities.
- Left the backend fixed PokéPaste host/path construction, verified TLS, redirect rejection,
  response bounds, safe errors, authentication, CSRF, and five-attempt rolling limiter unchanged.
  No backend, Web, data, persistence, or dependency change was required.

## Review cycles

- Human-review Round 1 established that Django returned the safe unavailable response for a paste
  reachable from the user's host browser, followed by the expected five-per-minute rate limit.
  Repository evidence showed that the server container had only an internal network and therefore
  no outbound route.
- Backend diagnosis confirmed that the existing deterministic error mapping and fixed-origin
  request boundary behaved as designed; no backend correction was needed.
- The deployment owner added the server-only egress network and topology regression coverage. The
  accepted runtime behavior required no Web follow-up.
- Architect review reported no blocking or actionable findings. It confirmed server-only egress,
  database isolation, unchanged backend protections, no new ports or privileges, and correct
  human-review teardown semantics.

## Verification

Final changed-session validation observed:

- complete backend suite: 332 passed;
- complete Web suite: 283 passed and 21 skipped;
- Web type/format check and production build passed;
- Playwright Team Builder coverage: 26 passed;
- deployment suite: 82 passed;
- repository lint, diff validation, and focused topology checks passed; and
- cleanup left no `bagredex-human-review` containers, no review volume, and no listener on port
  8000.

The stopped `bagredex-local` server belongs to a separate Compose project and did not affect the
human-review teardown result. All automated checks remained local and deterministic; none used
live PokéPaste as a test dependency.

## Deferred tasks

None.

## Commits

Reviewed-result commit: `f24f11a67711f617fbaf04462ac54d5854f4ca0a`
(`fix(deploy): allow server-only egress`).
