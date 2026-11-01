# Battle Mode Playwright isolation

## Problem

The full parallel Playwright matrix produced six failures in existing Battle Mode coverage across
desktop and tablet projects. The failures involve navigation timeouts, team-selection dialogs that
remain visible after selection, and fixture cleanup receiving an HTTP 302 after logout. Battle Mode
has no source diff in the form-search, SP-controls, and move-modifier-popovers feature.

## Evidence

The retained Playwright HTML report under `src/web/playwright-report/data/` contains the six Battle
Mode failure artifacts with prefixes `0a5325`, `668a109`, `911eb75`, `91fb237`, `ac63b74`, and
`e1ceab9`. They cover:

- desktop/tablet timeouts in the existing link, logout, regulation, and leave-warning navigation
  flows;
- two `selectPreparedTeam` failures where the **Choose your team** dialog remained visible; and
- cleanup failure `Could not remove Battle Mode fixture team (302)` after the logout scenario.

The local runtime log `/tmp/bagredex-review-runtime.log` records readiness probes continuing to
return HTTP 200 throughout the run. It also records unauthenticated fixture DELETE requests
returning 302 after logout at 05:09:19, 05:09:45, and 05:10:53 UTC, followed by successful HTTP 204
cleanup after re-authentication. No server crash or clustered HTTP 5xx response accompanied these
failures.

## Scope

- `web_gui_coder` owns diagnosis and corrections in existing Battle Mode Playwright coverage and,
  only where the isolated reproduction proves necessary, Battle Mode browser state under
  `src/web`.
- Isolate fixture and browser state per test and worker so parallel projects cannot share prepared
  team identity, authentication transitions, open dialogs, or navigation confirmation state.
- Make cleanup reliable when a test logs out, including deterministic re-authentication or an
  authenticated cleanup context before deleting the exact fixture created by that test.
- Preserve Battle Mode product behavior and assertions. Do not weaken navigation, dialog-dismissal,
  or cleanup expectations merely to make the matrix pass.
- Do not alter the form-search, SP-controls, Pokédex grouping, Meowstic data, or Damage Calculator
  popover implementation as part of this task.

## Acceptance criteria

- The six observed failures reproduce, or their shared isolation fault is otherwise demonstrated,
  with a focused Battle Mode run under the same parallel worker conditions as the full matrix.
- Each test owns its prepared-team identity and mutable browser state; selecting a team closes the
  dialog before subsequent actions, and navigation confirmation state cannot leak between tests.
- Fixture cleanup deletes only the creating test's team and succeeds after logout without treating
  an authentication redirect as successful cleanup or leaving records behind.
- The isolated Battle Mode spec passes in every configured applicable project.
- The full parallel Playwright matrix passes all Battle Mode cases in every applicable project,
  with readiness remaining healthy and no server-crash or HTTP 5xx cluster.

## Deferral reason and dependencies

These failures are safely separable from the active form-search, SP-controls, Pokédex grouping,
Meowstic-data, and Damage Calculator popover work. Battle Mode has no diff in that feature, and the
evidence points to existing parallel test ownership, browser state, and cleanup behavior. Resolve
this in a focused Web GUI maintenance cycle using the established local Playwright runtime; it does
not block review of the active feature changes, while that feature's focused browser matrix remains
required deployment work.
