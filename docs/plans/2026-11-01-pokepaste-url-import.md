# PokéPaste URL import

## Summary

Extend the Team Builder's existing text import dialog with a review-first PokéPaste URL workflow.
An authenticated user can replace the dialog text with one canonical PokéPaste URL, ask Django to
retrieve its raw team body, review or edit the returned text, and then use the unchanged local text
importer to replace the unsaved draft. The URL and response are never persisted or cached.

## Goals

- Accept one canonical public `https://pokepast.es/<paste-id>` URL in the existing Team Builder
  import dialog.
- Retrieve only the raw team body through a narrow authenticated Django boundary with strict
  outbound-request controls.
- Replace the URL in the text area with the fetched body before any parsing or draft mutation.
- Preserve the existing text grammar, validation, atomic draft replacement, and explicit Save
  boundary.
- Provide useful loading, success, rate-limit, unavailable, malformed-response, and validation
  feedback without losing the current draft or editable dialog contents.

## Non-goals

- Do not add export-to-PokéPaste, paste creation, sharing, publishing, or paste management.
- Do not import PokéPaste titles, descriptions, authorship, or other page metadata, and do not
  change the Bagredex team name.
- Do not parse arbitrary websites, follow redirects, accept PokéPaste-compatible third-party
  hosts, or scrape HTML pages.
- Do not translate, discard, or silently accept unsupported EV, IV, Level, Tera Type, or unknown
  lines. The existing strict text importer remains authoritative for those diagnostics.
- Do not automatically parse, apply, or save a fetched team, and do not add background refresh,
  retries, response caching, or offline availability.
- Do not add a database model, migration, dependency, normalized data release, or Pokémon-data
  override.

## User-visible behavior

- The existing **Import/Export** dialog continues to open with the current draft exported into the
  text area. Existing text import and Copy behavior remain unchanged.
- If the text area contains exactly one trimmed canonical PokéPaste URL, choosing **Import** changes
  the action into a transient loading state and requests its raw body. The dialog stays open and the
  current team draft does not change.
- A successful fetch replaces the entire text-area value with the raw team body, focuses the text
  area, and announces that the team text is ready for review. The user may edit it and must choose
  **Import** again to run the existing parser and replace the unsaved draft.
- A successful second import retains current behavior: close the dialog, replace the roster
  atomically, mark the team dirty, and state that **Save** is still required.
- Fetch, timeout, rate-limit, oversized-response, encoding, content-type, and upstream-status
  failures keep the URL visible and editable, leave the draft untouched, and expose an accessible,
  actionable error. The user can retry, replace the URL, or cancel.
- A fetched body containing unsupported or illegal fields remains visible. On the second Import it
  receives the same line-specific errors as manually pasted text, with no partial application.
- While retrieval is pending, prevent duplicate submissions and disable Import without blocking
  Cancel. Closing the dialog aborts the browser request; server timeout and response limits still
  bound an outbound request that has already begun.

## Decisions and assumptions

- URL mode is selected only when the complete trimmed text matches the canonical shape
  `https://pokepast.es/<paste-id>`. The paste ID is exactly 16 lowercase hexadecimal characters,
  matching the supplied sample. Do not accept a trailing slash, query, fragment, credentials,
  custom port, alternate scheme, alternate host, uppercase ID, or a URL mixed with other text.
  Anything else continues through the existing text parser and receives its existing errors.
- The browser never contacts PokéPaste directly. It posts the canonical URL to a same-origin,
  CSRF-protected Django endpoint supplied by the Team Builder bootstrap. Django revalidates the
  complete URL and extracts only the paste ID.
- The outbound target is constructed from a code-owned constant and the validated ID as
  `https://pokepast.es/<paste-id>/raw`; no user-controlled origin, port, path suffix, query, or
  header reaches the network client. HTTPS certificate verification remains enabled, redirects
  are rejected, and the request asks for identity-encoded plain text.
- Use the Python standard library behind a small injectable fetch function rather than adding an
  HTTP dependency. Allow one response body of at most 32,000 bytes, read at most one extra byte to
  detect overflow, require a successful 200 response with a `text/plain` media type, decode strict
  UTF-8, and use a three-second total socket timeout. Empty valid plain text may be returned for
  review and then clears the roster only after the second Import.
- Limit syntactically valid fetch attempts to five per rolling 60 seconds per authenticated
  session. Store only attempt timestamps in the Django session, never the URL, paste ID, response,
  or derived team data. Reject excess attempts with HTTP 429 and `Retry-After`; count upstream
  failures so an unavailable host cannot be hammered. CSRF and malformed local requests do not
  consume an outbound-attempt slot.
- PokéPaste is an optional use-time dependency. Ordinary Team Builder loading, local text import,
  saved teams, retained datasets, and exports remain available when it is unreachable.
- Upstream contents are untrusted interchange text, not canonical Pokémon data or mechanics. They
  are returned as JSON text, rendered only as a controlled text-area value, and validated against
  the already loaded regulation dataset only after the user's second Import.

## Scope and ownership

`backend_coder` exclusively owns the Django boundary under `src/backend`:

- Add `src/backend/bagredex/teams/pokepaste.py` for canonical URL validation, fixed-target request
  construction, no-redirect HTTP retrieval, bounded reading, response validation, stable fetch
  failures, and the session throttle policy.
- Update `src/backend/bagredex/teams/views.py` with a POST-only JSON endpoint that applies
  authentication through existing middleware, CSRF, request-size/type validation, throttling, and
  a stable success/error envelope. Add the endpoint URL to the Team Builder bootstrap.
- Update `src/backend/bagredex/urls.py` with a fixed route such as
  `/teams/import/pokepaste/`, ordered before the UUID team-detail route.
- Bump `BOOTSTRAP_SCHEMA` in `src/backend/bagredex/teams/services.py` from
  `team-builder-bootstrap-v2` to `team-builder-bootstrap-v3` because the required
  `pokepaste_import_url` contract is new.
- Extend `src/backend/tests/test_teams.py` with request-boundary and pure fetch-service coverage.
  Tests must replace the outbound client with deterministic fakes and must never contact
  PokéPaste or another live service.

`web_gui_coder` exclusively owns the browser changes under `src/web` after the backend contract is
defined:

- Update `src/web/src/team-builder/contracts.ts` and adjacent fixtures/tests for
  `team-builder-bootstrap-v3` and a required same-origin `pokepaste_import_url`.
- Update `src/web/src/team-builder/app.tsx` to detect only the exact canonical URL, POST it with
  same-origin credentials and CSRF, manage pending/abort/success/error states, replace the text
  area only after a valid response, and retain the existing local `importTeamText` path otherwise.
- Update `src/web/src/team-builder/app.test.tsx` for the two-step workflow, state preservation,
  abort, retry, focus, announcements, disabled controls, and unchanged local imports.
- Update `src/web/static/web/css/team-builder.css` only if the existing dialog styles do not
  adequately represent the pending or status state.
- Extend `src/web/tests/e2e/team-builder.spec.ts` with a routed same-origin endpoint fixture; browser
  tests must not contact live PokéPaste.

The scopes are interface-dependent rather than independently parallel: `backend_coder` defines and
tests the endpoint envelope and bootstrap v3 first, then `web_gui_coder` consumes that reviewed
shape. No `src/data`, deployment, model, migration, or dependency-lock files should change.

`backend_reviewer` reviews the Django scope, `web_gui_reviewer` reviews the Web scope, and
`architect` reviews the complete integration after scope findings are resolved. Any need to relax
the host/redirect policy, alter the existing team grammar, add persistence, or add a dependency
must return to the architect and user instead of expanding implementation scope.

## Data and interface impact

- `team-builder-bootstrap-v3` adds required local string field `pokepaste_import_url`; all existing
  bootstrap fields retain their meaning. The TypeScript parser rejects an absolute or
  protocol-relative endpoint.
- The new endpoint accepts only a small `application/json` POST body shaped as
  `{"url":"https://pokepast.es/<paste-id>"}`. It returns a versioned success envelope containing
  only the raw `text`, or a versioned problem with stable code and safe message. Suggested problem
  codes distinguish invalid request/URL, rate limit, not found, upstream unavailable, timeout,
  invalid content, and response too large without exposing upstream response bodies or transport
  details.
- Every endpoint response sets `Cache-Control: no-store`; errors avoid the submitted URL and paste
  ID. Application logging must not add either value. The browser stores the returned text only in
  the mounted dialog's state.
- `team-builder-data-v7`, `team-draft-v1`, `team-api-v1`, Team/Member persistence, the parser
  grammar, save endpoint, and retained regulation/version semantics do not change.
- The feature does not alter upstream Pokémon provenance: PokéPaste supplies user-authored team
  text only, while activated normalized Showdown data remains authoritative for validation and
  runtime mechanics.
- Rollback removes the endpoint, bootstrap field, and browser fetch branch. No saved-team or
  normalized-data recovery is required because the feature writes no new durable domain state.

## Implementation sequence

1. `backend_coder` adds the pure URL/fetch boundary and deterministic tests. Validate before
   constructing the fixed raw URL, install an explicit no-redirect handler, bound time and bytes,
   normalize transport failures into safe domain errors, and keep the fetch function injectable.
2. `backend_coder` adds the POST endpoint, session throttle, no-store responses, URL route, and
   bootstrap v3 field. Cover authentication, CSRF, methods, content type/size/JSON shape, strict URL
   variants, throttle/reset, response envelopes, and absence of URL/body disclosure.
3. `backend_reviewer` reviews the backend before Web consumption, prioritizing SSRF and redirect
   resistance, TLS defaults, timeout/size enforcement, session-throttle correctness, response
   privacy, and deterministic external-boundary tests. Backend findings return to `backend_coder`
   until no blocker remains.
4. `web_gui_coder` updates the bootstrap contract, then adds exact URL detection and the two-step
   dialog state machine. Keep the existing synchronous parser path unchanged for all nonmatching
   input; a successful fetch changes only dialog text/status and never calls `onImport`.
5. `web_gui_coder` adds unit/component and Playwright coverage with mocked same-origin responses,
   including successful fetch then parse, fetch failure then retry, unsupported fetched fields,
   no draft/save mutation after the first step, duplicate-submit suppression, cancellation/abort,
   focus/status accessibility, and unchanged pasted-text/Copy behavior.
6. `web_gui_reviewer` reviews URL detection parity with Django, contract parsing, CSRF, async race
   and unmount safety, keyboard/touch behavior, announcements, and desktop/tablet/phone dialog
   behavior. Web findings return to `web_gui_coder` until no blocker remains.
7. `architect` reviews the complete diff and reviewer results for cross-scope schema/error parity,
   fixed-origin security, unchanged importer semantics, no persistence or live-test dependency,
   and complete end-to-end evidence. Each actionable finding returns to its owning coder and is
   re-reviewed.
8. After review is clear, `architect` writes the cycle report. `deployment_agent` runs final local
   validation and completes the required feature-commit, report-correction commit, and
   `human-review candidate` workflow.

## Review and verification

Backend tests must prove:

- exact acceptance of one canonical sample-shaped URL and rejection of scheme, host, subdomain,
  credentials, port, path, trailing slash, query, fragment, uppercase, malformed ID, and extra-text
  variants before any outbound call;
- the outbound URL and request headers are code-owned, TLS verification is not weakened, redirects
  are errors, and 200 plain UTF-8 text is returned exactly without metadata or HTML parsing;
- timeouts, DNS/connection/TLS failures, redirects, non-200 statuses, wrong or missing media type,
  invalid UTF-8, empty transport bodies where applicable, and bodies over 32,000 bytes become
  stable safe problems without leaking the URL, ID, upstream body, or exception detail;
- POST/JSON/body-shape boundaries, CSRF, authentication, method rejection, no-store headers, five
  attempts per 60-second authenticated session, 429/`Retry-After`, window expiry, and counting of
  upstream failures; and
- the Team Builder bootstrap exposes schema v3 and exactly one same-origin import URL while the
  existing team and dataset endpoints retain their behavior.

Web tests must prove:

- exact URL detection matches the backend rule and all near misses remain on the existing local
  parser path;
- one URL Import makes one CSRF-protected same-origin POST, shows pending state, and neither calls
  `onImport` nor changes/saves the team;
- a valid response replaces and selects/focuses the text, announces review readiness, and requires
  a second Import before atomic draft replacement;
- fetch/problem/invalid-envelope/network/abort failures preserve the URL and draft, allow recovery,
  and do not produce stale state after edits, retry, cancel, or dialog teardown;
- unsupported fields in fetched text receive the existing strict parser error on the second step,
  and ordinary pasted text, empty-team clearing, Copy, Escape, focus trapping/restoration, and
  explicit Save behavior remain intact; and
- the critical mocked Playwright path exercises desktop and tablet: enter a URL, retrieve text,
  review it, import without a save request, then explicitly Save. It also covers one fetch failure
  with unchanged draft and recoverable dialog content. Existing phone coverage remains functional.

Run and observe at minimum:

```text
cd src/backend && uv run pytest tests/test_teams.py
cd src/backend && uv run ruff check .
cd src/backend && uv run mypy .
cd src/backend && uv run python manage.py check
cd src/backend && uv run python manage.py makemigrations --check --dry-run
cd src/web && npm test -- src/team-builder/contracts.test.ts src/team-builder/team-text.test.ts src/team-builder/app.test.tsx
cd src/web && npm run check
cd src/web && npm run build
cd src/web && npx playwright test tests/e2e/team-builder.spec.ts
./.codex/lint.sh
```

The deployment agent also runs the repository's full local validation. No test or validation may
contact PokéPaste, install missing tooling, or weaken browser/network security to pass.

## Risks

- A general server-side URL fetcher would create SSRF and redirect risk. Exact full-string URL
  validation, ID extraction, fixed code-owned raw target construction, verified HTTPS, and disabled
  redirects keep this endpoint specific to PokéPaste.
- A slow or oversized upstream could occupy workers or memory. A short timeout, identity encoding,
  bounded streaming read, strict content validation, session throttle, and disabled duplicate UI
  submission bound that cost. The synchronous design is deliberate for this low-volume personal
  application and should be revisited only with measured contention.
- Per-session throttling does not combine separate authenticated sessions. Authentication, CSRF,
  the fixed upstream target, and tight request bounds limit the remaining risk without adding a
  shared cache or persistence model; deployment-wide throttling is outside this cycle.
- PokéPaste could change or remove its raw path or media type. The feature must fail clearly while
  leaving local text import and saved teams fully usable; do not fall back to scraping HTML.
- Async browser results could overwrite newer user edits. Associate each request with its submitted
  URL/request generation and apply a response only if it is still current; input edits or dialog
  closure invalidate it.
- A fetched team may use fields or Pokémon illegal in the selected Champions regulation. Showing
  the untouched text first and reusing the strict retained-dataset parser makes incompatibility
  visible instead of silently losing data.

## Completion criteria

- An authenticated user can enter exactly one canonical PokéPaste URL, retrieve its bounded raw
  team text into the existing dialog, review/edit it, and deliberately import it with a second
  action.
- Fetch success alone never changes or saves the draft; fetch and parse failures preserve both the
  existing draft and recoverable dialog content.
- The Django boundary rejects all unapproved targets and redirects, enforces CSRF, authentication,
  timeout, response size/type/encoding, per-session throttling, safe errors, and no-store behavior.
- Titles/descriptions remain excluded, the Bagredex team name remains unchanged, and unsupported
  fetched fields receive the existing strict importer errors without silent conversion or loss.
- Existing manual text import/export, retained dataset validation, and saved-team behavior remain
  compatible, with no model, migration, dependency, or Pokémon-data release change.
- Backend, Web, and representative browser checks pass without live external access; backend and
  Web reviewers and the architect report no blocking findings.
- The cycle report names the exact feature commit after the separate correction commit, and
  `./bagredex.sh human-review candidate` reports that exact feature boundary as `available`.
