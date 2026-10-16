# Pokédex keyboard discoverability

## Summary

Extend the Pokédex keyboard layer with detail-pane arrow scrolling, confirmed query/filter clearing,
and clearer inline shortcut discovery. Add the existing server version label beneath the global
Bagredex brand through a small backend-owned template context contract.

## Goals

- Let eligible global ArrowUp/ArrowDown keys move the selected detail pane by a predictable line
  step without scrolling the page.
- Add a guarded Shift+C shortcut that confirms and atomically clears the search query plus every
  active move, ability, and type filter.
- Surface the complete shortcut set persistently near the Pokédex result count and in the help
  dialog without cluttering responsive layouts.
- Show the Enter hint on exactly the suggestion that Enter would activate.
- Display `development` locally and the existing `vMAJOR.MINOR.PATCH` label in production beneath
  the global authenticated Bagredex brand.

## Non-goals

- Persisting query, filters, shortcut state, scroll position, or dialogs across visits or regulation
  reloads.
- Changing Pokémon data, APIs, client bootstrap JSON, URL behavior, authentication, or database
  schema.
- Adding smooth scrolling, acceleration, continuous key-repeat state, customizable shortcuts, or
  dependencies.
- Turning the persistent shortcut reminder or suggestion Enter hint into a button or focus stop.
- Changing existing search matching, filter AND semantics, option ordering, sort behavior,
  selection scroll reset, or pointer/touch behavior.
- Exposing build metadata beyond the already established `BAGREDEX_VERSION_LABEL` setting.

## User-visible behavior

### Detail-pane arrow scrolling

- When search is not focused, no dialog is open, and focus is on otherwise eligible noneditable,
  noninteractive page content, unmodified ArrowDown moves the selected `.detail-pane` down by one
  fixed 48 CSS-pixel step and ArrowUp moves it up by the same step.
- A ready selected pane with overflow owns the key: Bagredex prevents page scrolling even at the
  pane's top or bottom boundary, clamps to the native scroll range, and never transfers the same key
  to the document.
- Empty, unselected, loading, error, or nonoverflowing detail panes do not claim the key. Native page
  behavior remains available in those states.
- Inputs, textareas, selects, buttons, links, contenteditable regions, and anything inside an open
  dialog retain their normal arrow behavior. Ctrl, Meta, Alt, and Shift combinations are ignored.
- Search suggestion ArrowUp/ArrowDown keeps precedence because search is an excluded input and its
  existing combobox handler remains authoritative.
- Scrolling is immediate rather than animated, keeps layout and boundaries stable, and is naturally
  safe under reduced-motion preferences on desktop, tablet, and phone.

### Confirmed clear shortcut

- Pressing capital `C` via Shift+C from an eligible noneditable, noninteractive context, with no
  Ctrl, Meta, or Alt modifier, opens a confirmation dialog only when the query or at least one
  filter is present. Lowercase `c` and modified variants do nothing.
- If query and filters are already empty, Shift+C is a true no-op: it does not open a dialog, change
  focus, or prevent a default action.
- The confirmation dialog explains that search and all active filters will be cleared. Enter on its
  initially focused confirm button confirms; the visible confirm button does the same.
- Confirming clears the query and every move/ability/type filter in one Preact update, closes the
  suggestion list and confirmation dialog, clears any active descendant, then focuses the empty
  search field.
- Escape, Cancel, or backdrop dismisses without changing query, filters, suggestions, result count,
  or selection, and restores the connected invoker.
- The confirmation dialog uses native dialog semantics, a programmatic title, focus containment,
  visible focus, and the existing one-dialog coordinator. It never competes with shortcut or
  move/ability information dialogs.
- The shortcut guide adds `Shift` + `C` using separately styled `<kbd>Shift</kbd>` and `<kbd>C</kbd>`
  elements and describes the confirmation behavior.

### Shortcut discovery and suggestion hint

- Muted semantic text reading `Press ? for keyboard shortcuts` remains visible near the result
  count above the Pokémon table. Only `?` is visually styled as `<kbd>`; the reminder is not
  interactive and is not announced as a button.
- The reminder is present in the initial server shell and loaded island so geometry remains stable.
  It wraps or stacks cleanly on tablet and phone without overlapping the regulation picker, count,
  search, or table.
- When autocomplete has suggestions and no active index, only its first row displays the decorative
  `<kbd>Enter</kbd>` hint because Enter selects that row. Once navigation highlights a suggestion,
  the hint moves to exactly that active row.
- The hint is absent for zero results, remains `aria-hidden`, never becomes interactive, and does not
  alter option accessible names, row height, or Enter behavior.

### Global version label

- Authenticated pages show a small muted version label directly below `Bagredex` within the global
  brand link. The whole brand remains one link to the home page.
- Base/local/test settings display exactly `development`, replacing the current internal `dev`
  label. Production continues to display the validated existing value
  `vMAJOR.MINOR.PATCH` derived from `BAGREDEX_IMAGE_VERSION`.
- Django supplies the label to templates through a backend-owned context processor. The template
  uses ordinary autoescaping; the value is not copied into Pokédex bootstrap JSON or browser state.

## Decisions and assumptions

### Keyboard state and priority

- A single App-level key dispatcher preserves this priority: an open native dialog owns its keys;
  focused search owns suggestion keys; excluded/editable/interactive targets keep native behavior;
  then eligible global `/`, `?`, Shift+C, and ArrowUp/ArrowDown shortcuts may run.
- Reuse the established `/` exclusion boundary for Shift+C and detail arrows: nearest `input`,
  `textarea`, `select`, `button`, `a[href]`, or `[contenteditable]` excludes handling. Any target
  inside `dialog` is additionally excluded, even if it is otherwise plain text.
- The detail step is the named constant `DETAIL_SCROLL_STEP = 48`. Use direct `scrollTop` assignment
  or `scrollBy({behavior: "auto"})`; do not use smooth scrolling. A ready selected pane claims arrows
  only when `scrollHeight > clientHeight`.
- At an overflow pane's boundary the shortcut still prevents the document from moving, preserving
  the user's detail-navigation context. Empty/loading/error/nonoverflow panes do not prevent.
- Detect capital C from `event.key === "C" && event.shiftKey`; require Ctrl, Meta, and Alt false.
  Do not infer capitalization from keyboard codes or activate on lowercase `c`.

### Atomic clear interface

- Lift the search `query` to `App` as controlled state so Shift+C can inspect it and update it in the
  same event as `filters`. `Search` retains its local open/active state but receives the query and
  change callback.
- Add a clear revision/request contract from `App` to `Search`: after confirmation, Search closes,
  resets active index, and focuses its input in a layout-timed effect. This prevents a frame with an
  empty query and stale `aria-activedescendant`.
- Confirmation applies `setQuery("")` and `setFilters([])` from one handler/batched Preact update.
  It does not clear the selected Pokémon, sort, Shiny state, detail scroll, or modal history.
- Generalize the existing overlay coordination rather than independently mounting dialogs. Opening
  clear confirmation is disallowed while any dialog is open; each close path owns exactly one
  connected restoration target. Confirm intentionally focuses search instead of restoring invoker.

### Version-label interface

- Backend contract: add a context processor such as
  `bagredex.context_processors.bagredex_metadata(request)` returning exactly
  `{"bagredex_version_label": settings.BAGREDEX_VERSION_LABEL}` and register it in the Django
  template engine. It performs no I/O and exposes no other settings.
- Change `settings/base.py` to `BAGREDEX_VERSION_LABEL = "development"`. Production keeps its
  validated `f"v{_image_version}"` override unchanged.
- Web template contract: `base.html` renders `{{ bagredex_version_label }}` as normal escaped text in
  a child element under the brand name. There is no fallback invented in the template; missing
  context is a backend/test failure.

### Presentation

- Group result count and persistent shortcut reminder in a stable metadata container in both
  `home.html`'s shell and `App`. Preserve the current `aria-live` count behavior; the static reminder
  must not be inside the live region.
- Suggestion rows derive `showEnterHint = choices.length > 0 && choiceIndex === (active >= 0 ? active
  : 0)`. Do not maintain a separate hint index that can drift from Enter activation.
- Version-label styles live in global `site.css`; Pokédex reminder, dialog, and suggestion styles
  live in `pokedex.css`. Both use existing tokens and light/dark themes.

## Scope and ownership

### Backend coder

Own Django settings/context and tests under `src/backend`:

- Change the base version label from `dev` to exact `development`; retain production semantic-
  version validation and `v` prefix.
- Add the narrow version-label context processor and register it in `TEMPLATES`.
- Add tests for the processor's exact key/value, authenticated template rendering with ordinary
  escaping, exact local/base `development`, and production `vMAJOR.MINOR.PATCH` behavior. Reuse the
  established isolated production-settings test pattern without weakening required environment
  validation.
- Do not edit Web templates/CSS, Pokédex APIs, data models, deployment files, or dependencies.

### Backend reviewer

Review `src/backend` read-only for the minimal context boundary, exact environment behavior,
autoescape-compatible value handling, lack of I/O/query growth, production validation preservation,
and complete local/production/template tests.

### Web GUI coder

Own templates, Preact, CSS, and Web tests under `src/web` after accepting the fixed context key
`bagredex_version_label`:

- Update `templates/base.html` and `static/web/css/site.css` for the two-line global brand.
- Update `templates/home.html` so the server shell reserves the persistent shortcut reminder and
  result metadata geometry.
- Update `src/app.tsx` for controlled query/clear revision, the clear-confirmation dialog, overlay
  coordination, global arrow scrolling, help entry, single-row Enter hint, and loaded reminder.
- Update `static/web/css/pokedex.css` for the reminder, dialog, split `<kbd>` chord, brand-safe
  responsive geometry, and moving suggestion hint without row-size changes.
- Extend unit/component/performance and `tests/e2e/pokedex.spec.ts` coverage for every behavior below.
- Do not edit backend, data, deploy, package/lock files, or client bootstrap contracts.

### Web GUI reviewer

Review `src/web` read-only for shortcut precedence/eligibility, atomic state clearing, dialog
coexistence and focus restoration, arrow boundary/default behavior, controlled-query accessibility,
single-hint truth, server-shell parity, version-label layout, themes, responsive behavior, and
regression strength in Firefox and Chromium.

### Architect

Own this plan, the exact context interface, cross-scope integration review, and the cycle report.
Verify backend/template agreement and that no version value leaks into the client bootstrap.

### Deployment agent

Own no source change unless an unforeseen packaging test requires an approved deploy adjustment.
Run full backend and Web checks, offline build, local template/browser validation with already-local
inputs, cleanup, and the justified local commit after reviews.

## Data and interface impact

The only cross-scope interface is the Django template context variable
`bagredex_version_label: str`. It is available to templates through the registered context processor
and consumed by `base.html`. It is not user input, persisted data, an API field, or part of the
Pokédex bootstrap.

There is no database, migration, normalized-data, endpoint, cache, URL, dependency, or deployment-
pin change. Query/filter clearing and arrow scrolling remain page-lifetime client state.

## Implementation sequence

1. The backend owner implements and tests the exact context-processor contract plus local/production
   label values. Backend review resolves findings before template integration is considered final.
2. In parallel with backend tests, the Web owner may implement Preact keyboard state using the fixed
   context key, but template rendering acceptance waits for the backend contract.
3. The Web owner updates the global brand and server shell, then implements controlled query,
   confirmation/overlay behavior, arrows, help text, reminder, and single Enter hint.
4. The Web owner runs static/build checks and focused real-keyboard/browser validation. Web review
   returns all actionable findings to the owner.
5. The architect reviews backend-to-template integration, complete diff, reviewer results, and
   end-to-end evidence. Owners resolve any cross-scope finding and rerun affected suites.
6. The architect writes the cycle report. The deployment agent runs final backend/Web/offline smoke,
   cleans artifacts, and creates the pending local commit.

## Review and verification

### Backend and template contract

- Assert base/local/test `BAGREDEX_VERSION_LABEL` is exactly `development`.
- Load production settings with a valid isolated `BAGREDEX_IMAGE_VERSION` and assert exact
  `vMAJOR.MINOR.PATCH`; retain invalid/missing version failures.
- Unit-test the context processor returns only the documented key and current setting without a
  database query. Request-test an authenticated page and assert the label is escaped, visible below
  Bagredex, and inside the same brand link. Anonymous login rendering remains unchanged because the
  authenticated header is absent.
- Assert home bootstrap JSON contains no version-label field and backend Pokédex request/query bounds
  remain unchanged.

### Component and model behavior

- Test eligible ready-overflow ArrowDown/ArrowUp steps exactly 48 pixels, clamps at zero/max, and
  prevents default at both boundaries. Test unselected, empty, loading, error, and nonoverflow panes
  do not move or prevent.
- Cover modifiers and every excluded target, including nested contenteditable and plain content
  inside a dialog. Search Arrow keys must change active suggestions and never invoke detail scroll.
- Test Shift+C uppercase-only eligibility, lowercase/modifier rejection, empty-state no-op, and
  complete help-dialog chord markup/text.
- With query only, filters only, and both present, assert the dialog opens without mutation. Confirm
  clears both atomically, closes suggestions/active descendant/dialog, focuses empty search, and
  preserves selection/sort/Shiny. Escape, Cancel, and backdrop preserve all state and restore focus.
- Test one-dialog coordination from shortcut and information dialog states and global-listener
  cleanup on unmount. Enter confirms only through the focused confirmation action; Tab remains
  trapped in the dialog.
- For autocomplete active `-1`, assert exactly the first suggestion owns one hidden decorative Enter
  hint. Traverse by Tab, arrows, and Alt category jumps and assert exactly one hint moves to the
  active option. Activate/remove options, change query, and test zero results for no stale hint.
- Assert reminder semantics are plain text with one decorative/presentational `<kbd>?` and no button,
  link, live-region, or focus behavior. Verify shell and loaded structures reserve equivalent space.

### Browser and visual validation

- Run full real-keyboard flows in current Firefox and Chromium across desktop, tablet, and phone,
  with representative light/dark and reduced-motion coverage.
- On a long selected detail pane, press arrows from eligible content and measure exact 48-pixel
  increments, top/bottom clamping, stable page scroll, and default prevention. Repeat excluded
  targets, search suggestions, modifiers, dialog content, no selection, delayed loading, error, and
  nonoverflow states.
- Exercise Shift+C for query-only, filters-only, combined, and empty cases. Verify pre-confirm state,
  Enter/confirm success, Escape/Cancel/backdrop cancellation, one-dialog invariant, focus outcomes,
  accessible title/order, and atomic result/list update without an intermediate filter/query frame.
- Inspect the version label on authenticated local pages as exact `development`; render a backend
  test or isolated production-settings response for `vMAJOR.MINOR.PATCH`. Verify autoescaping and
  confirm the label is absent from Pokédex bootstrap/network JSON.
- Verify the brand label and persistent shortcut reminder in light/dark desktop/tablet/phone shell
  and loaded states. Check no overlap, clipping, layout shift beyond one pixel, or header/account
  regression.
- For mouse, Tab, arrow, and Alt category navigation, assert exactly one Enter hint tracks the row
  Enter would select; zero results show none. Check option accessible names, row height, suggestion
  scroll visibility, and pointer/touch selection remain unchanged.
- Retain all prior shortcut, help, sorting, selection-scroll-reset, modal, filtering, loading/error,
  geometry, and performance flows. Run complete backend and frontend tests, type/format checks,
  offline Vite build, `.codex/lint.sh`, and `git diff --check`; clean artifacts before handoff.

## Risks

- A document-level arrow handler can steal native control, dialog, or page navigation. Require a
  ready overflowing detail pane plus strict target/modifier/dialog eligibility before preventing.
- A boundary arrow can leak to the page if prevention depends on whether `scrollTop` changed. Once
  an overflow pane claims the key, prevent it even at zero or maximum.
- Clearing query and filters through separate component-local APIs can expose an intermediate result
  set or stale active descendant. Controlled App state plus one confirm handler and clear revision
  make the transition atomic and accessible.
- Independent dialogs can compete or restore focus to disconnected elements. Use one overlay
  coordinator and explicit connected invokers; test transitions from every existing dialog state.
- Duplicating Enter-hint state can drift from Enter semantics. Derive its row directly from `active`
  with first-option fallback.
- A global context processor could accidentally expose settings or add queries. Return one named
  string only and prove zero database work.
- Header and result metadata changes can reintroduce responsive flicker. Keep server shell and island
  geometry aligned and measure both states in Firefox and Chromium.

Rollback restores the preceding backend setting/context registration, template/CSS, and Web bundle
in one cycle commit. No data, migration, versioned bundle, or deployment rollback is required.

## Completion criteria

- Eligible arrows move a ready overflowing selected detail pane by exact stable increments, own
  boundaries, and never hijack excluded/modifier/search/dialog/loading/error/nonoverflow cases.
- Shift+C eligibility, no-op, confirmation, atomic clear, focus, cancellation, and dialog coexistence
  match the confirmed contract in component tests and real Firefox/Chromium flows.
- Shortcut help includes the split-key Shift+C chord; the persistent reminder and exactly-one Enter
  hint are accessible, responsive, and behaviorally synchronized.
- Authenticated templates receive the exact backend-owned label through
  `bagredex_version_label`; local shows `development`, production keeps `vMAJOR.MINOR.PATCH`, and no
  client bootstrap/API field is added.
- Existing shortcuts, sorting, filter semantics, selection scroll reset, pointer/touch, themes,
  responsive geometry, loading/error states, and performance remain green.
- Backend and Web owners/reviewers approve their scopes; architect integration finds no interface or
  ownership drift; all tests/build/browser/docs/diff checks pass.
- The cycle report records observed evidence, no hidden deferrals remain, temporary artifacts are
  cleaned, and the deployment agent reports the local commit.

Remaining material questions: none.
