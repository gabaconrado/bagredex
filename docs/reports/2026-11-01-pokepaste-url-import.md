# PokéPaste URL import report

## Outcome

Team Builder now accepts one canonical PokéPaste URL in its existing import dialog. Django
retrieves the bounded raw team body, and the dialog presents that text for review before the user
chooses **Import** again. Retrieval never changes or saves the draft; the existing strict text
parser and explicit **Save** action remain authoritative.

This cycle implements the
[PokéPaste URL import plan](../plans/2026-11-01-pokepaste-url-import.md).

## Changes

- Added an authenticated, CSRF-protected, POST-only Django boundary for exact
  `https://pokepast.es/<paste-id>` URLs. It constructs a fixed HTTPS raw endpoint, rejects
  redirects, verifies plain UTF-8 text, and bounds request time and response size.
- Added atomic PostgreSQL-session throttling at five attempts per rolling minute. Session state
  stores timestamps only; endpoint responses are `no-store`, and safe errors omit URLs, paste IDs,
  upstream bodies, and transport details.
- Advanced the Team Builder bootstrap to v3 with one validated same-origin PokéPaste endpoint.
  Team data, draft, persistence, parser grammar, normalized Pokémon data, and dependencies remain
  unchanged.
- Added the review-first browser flow with pending, success, error, retry, cancellation, abort,
  stale-response, focus, and announcement handling. Fetch success replaces only the text-area
  value; unsupported fetched fields continue through the existing strict importer diagnostics.
- Added deterministic backend, component, contract, and browser coverage. Every outbound boundary
  is faked or routed locally; the test suite never contacts live PokéPaste.

## Review cycles

- Backend review identified transport and concurrency hardening needs. The backend owner normalized
  incomplete and low-level HTTP failures, closed HTTP error bodies, and made per-session attempt
  reservation atomic across concurrent workers with row locking. Added tests cover safe error
  content, body cleanup, rolling windows, failure counting, and concurrent request limits.
- Web review identified client-boundary and stale-request hardening needs. The Web owner tightened
  same-origin bootstrap URL validation against control characters and backslashes, validated the
  versioned fetch envelope, and invalidated or aborted in-flight retrieval when text changes or the
  dialog closes. Added tests cover malformed envelopes, retry, teardown, edit races, and unchanged
  local-import behavior.
- Backend and Web re-reviews reported no remaining blocking findings. Architect integration review
  found the bootstrap and response schemas aligned, client/server URL rules consistent, the
  fixed-origin security and privacy boundaries intact, and the two-step no-persistence behavior
  compliant with the plan.

## Verification

Observed passing during implementation and review:

- initial pure PokéPaste tests: 28 passed;
- after backend review fixes, 30 non-database PokéPaste URL, fetch, and protocol tests passed;
- backend Ruff, mypy, Django system check, and migration dry-run;
- focused Team Builder contract, parser, and component tests: 70 passed;
- Web reviewer contract and component subset: 36 passed;
- Web formatting, ESLint, TypeScript, and production build; and
- repository `git diff --check` and `./.codex/lint.sh`.

The architect independently reran the 70 focused Web tests, Ruff, mypy, and the Django system
check. Its migration dry-run found no changes but warned that PostgreSQL was unavailable in that
review environment.

Deployment validation must still run the repository's full local checks and the configured
Playwright Team Builder path against the managed local runtime. It must confirm desktop and tablet
fetch, review, import, failure recovery, and explicit Save without contacting live PokéPaste. The
deployment agent must also run the PostgreSQL-backed backend checks: the attempted focused run
reached 26 passing tests before four database setup errors because PostgreSQL was unavailable, and
no complete backend suite was observed passing in the implementation environment.

## Deferred tasks

None. Deployment-wide throttling across separate authenticated sessions remains an explicitly
accepted non-goal; the approved feature uses atomic per-session limits.

## Commits

This report is included in the pending PokéPaste URL import cycle commit. After that commit exists,
the report will be corrected separately with its exact full hash and subject.
