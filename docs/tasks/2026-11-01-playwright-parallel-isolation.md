# Playwright parallel isolation and performance

## Problem

The full 195-test Playwright matrix passed 184 tests and failed 11 under eight-worker pressure,
despite all isolated feature gates passing. The failures combine shared-account fixture races with
request, payload/render, geometry, and browser main-thread contention. They belong to Web E2E and
deployment test isolation/performance, not to the approved feature behavior.

## Evidence

The isolated focused gates passed in every configured applicable project:

- Damage Calculator move modifiers: 5/5;
- regulation switching and navigation: 10/10;
- Team Builder centralized loading: 5/5; and
- Team Builder Mega search and selection: 5/5.

The subsequent full run used eight workers and finished with 184 passing and 11 failing tests. Its
retained failure artifacts are under `src/web/playwright-report/data/`, with prefixes `15c3a71c`,
`35dd0778`, `6ad561e9`, `7cbeb531`, `1ec9c722`, `91b9ec85`, `03eed481`, `efc3f796`, `ff23893a`,
`7414807d`, and `a9e5373a`. Per-test snapshots are under `src/web/test-results/`. Failed-test IDs
are retained in `src/web/test-results/.last-run.json`.

The failures include requests taking approximately 1.2-5.3 seconds, requests still unfinished when
their tests timed out, and geometry operations blocked while visible elements waited on browser
main-thread work. The Team Library geometry test selects `cards.first()` from a shared account; it
can choose a fixture another worker deletes, after which the selected team returns HTTP 404 and the
page reports that the requested team was not found.

The local runtime log `/tmp/bagredex-review-runtime.log` records HTTP 200 health responses, no HTTP
5xx cluster, and no authentication or rate-limit failure pattern during the run. This evidence
points to parallel fixture ownership and bounded-load problems rather than a server crash or a
regression in the focused feature flows.

## Scope

- `web_gui_coder` owns Web E2E fixture creation, account/worker isolation, owned Team Library
  selection, deterministic browser request gates, and focused timing assertions under
  `src/web/tests/e2e` and adjacent Playwright support.
- `deployment_agent` owns full-matrix orchestration, worker-pressure validation, local runtime
  observation, and any deployment-owned test harness correction.
- Give each worker an independent account or equivalently isolated ownership boundary, and select
  only fixtures created by that test or worker. Never rely on global list order such as
  `cards.first()` for mutable shared data.
- Replace ambiguous load completion with deterministic request/response and rendered-ready gates.
- Diagnose and bound parallel response payload, render, layout, and main-thread timing while
  preserving the configured desktop, tablet, phone, theme, reduced-motion, and browser projects.
- Preserve product behavior and meaningful geometry assertions. Do not solve the failures with
  broad sleeps, blanket retries, or suite-wide serialization.

## Acceptance criteria

- Every worker uses a separate account or an equivalent per-worker namespace, and every mutable
  test selects and deletes only its owned fixture by deterministic identity.
- Request gates identify the exact expected response and rendered-ready state; no test proceeds on
  unrelated network idleness, list ordering, or another worker's data.
- Parallel payload transfer, initial render, geometry reads, and browser main-thread work complete
  within documented bounds under the configured worker pressure, with no unfinished request at a
  test timeout.
- The full Playwright matrix passes in every configured project with health remaining HTTP 200 and
  no HTTP 5xx, authentication, or rate-limit failure cluster.
- The result uses no broad sleeps, blanket retries, or suite-wide serialization.

## Deferral reason and dependencies

The issue is independently deferrable because the four isolated feature gates pass across their
configured projects and the full-run failures appear only under eight-worker shared-runtime
pressure. The affected ownership is test accounts, fixtures, request gates, and parallel
performance; no evidence shows incorrect form-search, SP-control, grouped-form, Mega-selection, or
move-modifier behavior. Resolve it as a focused Web E2E/deployment maintenance cycle after the
current feature, while retaining the full-run artifacts and runtime log as the reproduction
baseline. This task is separate from the existing Battle Mode isolation task, which covers its own
dialog, navigation, logout, and cleanup failures.
