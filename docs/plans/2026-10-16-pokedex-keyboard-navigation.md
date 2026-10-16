# Pokédex keyboard navigation

## Summary

Add a complete keyboard layer to the existing Pokédex island: predictable detail-pane scroll reset,
global search and help shortcuts, category-aware autocomplete navigation, discoverable key hints,
and domain-appropriate sort cycles. Preserve the current Django page, browser-local state, data
contracts, and pointer/touch behavior.

## Goals

- Reset the selected-detail pane to its top whenever selection changes through a table row, search
  result, or base/Mega control, including the detail-loading state.
- Make `/` focus search and `?` open a complete accessible shortcut reference without hijacking
  editable/control contexts or browser modifier shortcuts.
- Support deliberate Tab, Shift+Tab, Enter, Escape, Alt+Down, and Alt+Up autocomplete behavior with
  stable combobox semantics.
- Show compact, noninteractive `/` and Enter hints where users need them.
- Start numeric sorts with the most useful descending order while preserving ascending-first text
  sorts and all existing disabled fallbacks.

## Non-goals

- Persisting shortcuts, query, selection, sort, filters, or scroll position across reloads.
- Changing regulation URLs, authentication, API payloads, normalized data, Django behavior, or
  detail preloading.
- Moving DOM focus into autocomplete option buttons; the combobox retains focus and uses
  `aria-activedescendant`.
- Replacing native browser shortcuts, adding user-configurable bindings, or adding dependencies.
- Changing sort comparison, stable ties, category order, power/status buckets, or disabled-sort
  fallback ordering.
- Changing pointer/touch selection, whole-row activation, dialog behavior, or responsive table
  geometry outside the minimal hint accommodations.

## User-visible behavior

### Selection and detail scroll

- Selecting a different Pokémon or form immediately places the selected-detail pane at scroll top.
  This applies to whole-row/name activation, a Pokémon search suggestion, base-to-Mega, Mega-to-
  base, and any future route using the shared selection callback.
- The pane is already at top while a not-yet-prefetched selection shows its loading skeleton; it
  does not briefly retain the prior Pokémon's lower scroll position.
- Reselecting the current identifier is a no-op and does not unexpectedly move the pane, reset
  Shiny state, or close information unnecessarily.
- Desktop's sticky pane and the scrollable tablet/phone pane follow the same rule.

### Global shortcuts and help

- Pressing unmodified `/` outside an editable or interactive control focuses the Pokédex search
  field. It does not insert `/`. Inputs, textareas, selects, buttons, links, and contenteditable
  regions keep their normal key behavior; modified `/` combinations are ignored.
- A compact visual `<kbd>/</kbd>` hint sits inside the search treatment with reserved space so it
  never overlaps query text, focus treatment, or the native search clear affordance.
- Pressing unmodified `?` outside an input, textarea, select, or contenteditable region opens a
  native accessible hotkey dialog listing every shortcut in this plan. `?` remains typable in the
  search field. Modified `?` combinations are ignored.
- The shortcut dialog uses visible `<kbd>` key labels, has a programmatic title and close button,
  traps Tab focus, closes by its button, Escape, or backdrop, and restores focus to the invoking
  element when still connected.
- Browser/application modifiers remain untouched. In particular, `Ctrl+S`/`Cmd+S` is never
  prevented or remapped to search.

### Autocomplete keyboard behavior

- While a nonempty suggestion list is open, Tab highlights the next individual suggestion and
  Shift+Tab highlights the previous one. Both wrap. Focus deliberately remains on the search
  combobox, native Tab exit is prevented only while there are suggestions to traverse, and
  `aria-activedescendant`/`aria-selected` track the highlighted option.
- Enter activates the highlighted suggestion. If none is highlighted, Enter activates the first
  suggestion. Pokémon selection and move/ability/type filter behavior stay unchanged.
- Each suggestion row ends with a noninteractive, assistive-technology-neutral `<kbd>Enter</kbd>`
  hint. It does not alter the option's accessible name or become a focus stop.
- Alt+Down jumps to the first suggestion in the next nonempty category; Alt+Up jumps to the first
  suggestion in the previous nonempty category. Navigation follows Pokémon, Moves, Abilities,
  Types, wraps, and skips absent categories.
- Escape closes autocomplete, clears its active descendant, and blurs search while preserving the
  query and active filters. Re-focusing search can reopen suggestions for the preserved query.
- ArrowUp/ArrowDown and pointer/touch suggestion activation retain their existing behavior. The
  active option is scrolled into view when keyboard navigation moves beyond the visible panel.
- With zero suggestions, category and Enter activation do nothing safely; Escape still closes and
  blurs, and Tab is not trapped because there is no option to traverse.

### Sort cycles

- Pokémon HP, Atk, Def, SpA, SpD, Spe, and BST cycle descending -> ascending -> disabled.
- Move Power cycles descending -> ascending -> disabled. Existing Status placement and deterministic
  name/identifier ties remain unchanged in both directions.
- Move Type and Category continue ascending -> descending -> disabled.
- Starting a different sort immediately uses that key's first direction, only one sort stays
  active, disabled returns to the existing canonical fallback, and `aria-sort`, indicator direction,
  reserved geometry, focus, and scroll stability remain synchronized.

## Decisions and assumptions

- The shared `select(id)` callback remains the only selection transition. It returns early for the
  current identifier, synchronously resets the currently mounted detail scroller before changing
  state, and a layout-timed follow-up keyed to the selection revision resets the newly rendered
  ready/loading/error pane. This prevents one painted frame at the old scroll offset.
- The actual `.detail-pane` scroll container receives one stable ref through every
  `RefinedDetailPane` state. Do not key/remount the whole Pokédex or use animation to conceal scroll
  movement.
- Global shortcuts use one component-owned `keydown` listener installed and removed by an effect.
  Handlers require no Ctrl, Meta, or Alt modifier; Shift is allowed only as the keyboard mechanism
  needed to produce `?`. They call `preventDefault()` only when Bagredex actually handles the key.
- Editable/control exclusion is determined from the event target and its ancestors, including
  `input`, `textarea`, `select`, `button`, `a[href]`, and `[contenteditable]` for `/`. The `?` dialog
  follows its confirmed narrower text-entry exclusion while still refusing modified shortcuts.
- Autocomplete keeps one flattened ordered `choices` array plus derived nonempty group start
  indices. Tab moves one flattened index; Alt navigation chooses category starts. No alternate copy
  of suggestion ordering should drift from the rendered group order.
- Native dialog focus/dismissal behavior should reuse or extract the existing information-dialog
  focus-trap and restoration pattern rather than create conflicting global focus logic. Only one
  dialog may be active; opening help closes/defers any incompatible modal state deliberately.
- `<kbd>` hints are visual instruction, not controls. Suggestion hints use `aria-hidden="true"`;
  the search hint is associated with the visible search label/help copy without duplicating the
  combobox value or name.
- Sort-cycle policy belongs in `model.ts`: numeric keys return descending first; textual move keys
  return ascending first. Render components continue to reflect model state rather than encode a
  separate direction policy.

## Scope and ownership

### Web GUI coder

Own all implementation and tests under `src/web`:

- Update `src/web/src/app.tsx` to provide the stable detail-scroller ref/reset, global shortcut
  listener, search ref and hints, autocomplete key transitions, active-option scrolling, and hotkey
  dialog.
- Extract small local helpers/components only where they make key eligibility, grouped navigation,
  or accessible dialog behavior independently testable. Keep state native to the focused Preact
  island; do not add a state library.
- Update `src/web/src/model.ts` so Pokémon numeric and move Power cycles start descending while move
  Type/Category remain ascending-first.
- Update `src/web/static/web/css/pokedex.css` for reserved search-hint space, end-aligned suggestion
  hints, `<kbd>` styling, help-dialog layout, active states, wrapping, light/dark contrast, and phone
  containment. Preserve established geometry and reduced-motion behavior.
- Extend focused model, component, accessibility, and performance tests plus
  `src/web/tests/e2e/pokedex.spec.ts` for every shortcut and transition below.
- Do not edit templates, `src/backend`, `src/data`, `deploy`, packages, lockfiles, or generated Vite
  output unless implementation evidence reveals a genuine blocker and the architect approves it.

### Web GUI reviewer

Review `src/web` read-only for keyboard eligibility and default prevention, combobox pattern,
category math, scroll reset timing, dialog focus/restore semantics, sort-cycle policy, hint layout,
pointer/touch preservation, themes, responsive geometry, and test strength. Test real Firefox
behavior rather than relying only on DOM simulation.

### Architect

Own this plan, final integration/plan-completion review, and the cycle report. Confirm that the
feature remains browser-local and introduces no interface, data, persistence, or dependency drift.

### Deployment agent

Run final offline build and browser validation using already-local project inputs, clean temporary
artifacts, and create the justified local commit after reviews. No deployment source change is
planned.

## Data and interface impact

There is no database, normalized-data, backend, endpoint, serialization, URL, cache, or version
change. No visit state is persisted. The current regulation reload continues to clear selection,
query, autocomplete, help, and sort state naturally.

All behavior is contained in the Preact island and plain CSS. Existing accessible names and
combobox relationships remain; the help dialog and visible key hints add only local DOM semantics.

## Implementation sequence

1. The Web owner adds model tests and implements the per-key first-direction sort policy without
   changing comparisons or disabled fallbacks.
2. The Web owner centralizes the detail-pane ref and adds synchronous plus layout-timed scroll reset
   through the shared selection path, then tests different/same selection and loading transitions.
3. The Web owner factors shortcut eligibility/group-index helpers and adds component tests for
   modifiers, editable/control exclusions, empty/partial groups, wraparound, and default prevention.
4. The Web owner implements search/hint keyboard behavior and active-option visibility while
   preserving pointer/touch and combobox semantics.
5. The Web owner adds the accessible help dialog by reusing the existing dialog behavior, then
   completes plain-CSS theme/responsive work.
6. The Web owner runs static tests/build and focused Chromium/Firefox keyboard E2E across desktop,
   tablet, and phone. The Web reviewer reviews source and evidence; findings return to the owner.
7. The architect performs final plan-completion review and writes the cycle report. The deployment
   agent performs final validation, cleanup, and the pending local commit.

## Review and verification

### Unit and component

- Assert Pokémon numeric and move Power cycles are descending, ascending, null; move Type and
  Category are ascending, descending, null; changing keys uses the new key's correct first state.
- Assert selection through row/name, search Pokémon, base-to-Mega, and Mega-to-base uses one shared
  transition and resets scroll before ready/loading content paints. Same-ID selection does not reset
  scroll or unrelated selected state.
- Assert `/` focuses search only without Ctrl/Meta/Alt from an eligible target. Cover input,
  textarea, select, button, link, nested contenteditable, and modifiers; prove `Ctrl+S`/`Meta+S`
  remains unprevented and does not change focus.
- Assert `?` opens help only when unmodified and outside input/textarea/select/contenteditable;
  typing `?` in search changes the query normally. Verify complete shortcut text and `<kbd>` labels.
- With suggestions open, test Tab/Shift+Tab individual wrap, Enter active/first behavior,
  Alt+Down/Alt+Up group wrap and skip-empty behavior for all missing-category combinations,
  Arrow behavior, Escape blur with query/filter preservation, and zero-result safety.
- Assert focus remains on the combobox, active IDs and `aria-selected` agree after every route,
  hints do not alter option names or become focusable, and only handled keys are prevented.
- Assert help-dialog title, close focus, Tab trap, Escape/backdrop/button closure, focus restoration,
  and cleanup of global listeners on unmount. Cover coexistence with the information modal.

### Browser and visual

- Run full keyboard-only flows in current Firefox and Chromium on desktop, tablet, and phone widths;
  repeat representative flows in light and dark themes and with reduced motion.
- Scroll a selected detail pane well below the top, then choose a different form through each route.
  Use a deterministically delayed details response to prove loading skeleton and ready pane both
  have `scrollTop === 0` before screenshots/layout assertions. Reselect the same form and prove its
  current scroll offset remains.
- Exercise `/`, `?`, all autocomplete keys, wrap/skip behavior, Enter-first, Escape blur, and help
  dialog focus restoration using real keyboard events. Verify editable/control exclusions and
  assert `defaultPrevented` only for handled shortcuts; attach a browser event probe proving
  `Ctrl+S`/`Meta+S` is not prevented, without invoking or depending on the browser Save UI.
- Verify active descendants are visible inside a scrolled suggestion panel and that absent
  categories, zero suggestions, index loading/error, and detail loading/error do not throw, trap
  focus, or expose unavailable shortcuts incorrectly.
- Verify the search `/` hint never overlaps typed text or the clear affordance, suggestion Enter
  hints remain aligned without changing row height/accessible names, and the help dialog fits and
  scrolls on phone. Preserve focus outlines, 44-pixel interactive targets, light/dark contrast,
  touch activation, and existing one-pixel geometry tolerance.
- Cycle every Pokémon stat/BST header and all move sort headers by pointer and keyboard. Assert
  direction, order, `aria-sort`, icon visibility, one-active-sort state, disabled fallback, stable
  horizontal/vertical scroll geometry, and no sprite reload/remount regression.
- Run the complete frontend unit/component/contract/accessibility/performance suite, TypeScript and
  formatting checks, offline Vite production build, `.codex/lint.sh`, and `git diff --check`; clean
  browser/build artifacts before handoff.

## Risks

- Resetting only the old detail node can leave a replacement loading/ready node at a restored
  offset; resetting only in a passive effect can paint one stale frame. Shared ref plus synchronous
  and layout-timed reset covers both transitions.
- Global handlers can break typing or browser commands if eligibility and modifiers are vague.
  Centralized predicates and explicit `defaultPrevented` tests are mandatory.
- Preventing Tab with no suggestions would create a keyboard trap. Override Tab only when the open
  list has an individual option to select.
- Group navigation can drift when categories are absent. Derive group starts from the same ordered
  choices rendered by the list and test every sparse shape.
- Native search controls differ across Firefox and Chromium. Reserve hint space based on rendered
  boxes and test the clear affordance rather than assuming engine-specific internal dimensions.
- A second dialog implementation can regress focus restoration or leave competing modals open.
  Reuse one accessible primitive/pattern and test dialog coexistence and teardown.

Rollback restores the preceding Web bundle and tests in one commit. There is no persisted state,
data rollback, database migration, or deployment-pin change.

## Completion criteria

- Different-form selection through every route resets the real detail scroller before loading or
  ready content paints; same-form reselection preserves its offset and state.
- `/`, `?`, Tab, Shift+Tab, Enter, Escape, Alt+Down, and Alt+Up match the confirmed eligibility,
  navigation, wrapping, activation, blur, and default-prevention contracts in Firefox and Chromium.
- The help dialog and both `<kbd>` hints are discoverable, accessible, theme-safe, responsive, and
  nonintrusive to search text, clear controls, option names, or focus order.
- Numeric and text sort cycles match their separate policies with unchanged comparison semantics,
  fallbacks, indicators, accessibility state, and geometry.
- Loading, error, sparse-category, and zero-result paths remain safe; pointer/touch and all prior
  Pokédex critical flows remain green.
- No backend, data, deploy, dependency, template, or persistence change occurs; all Web, browser,
  build, documentation, and diff checks pass with no blocking review findings.
- The architect report records observed evidence, no hidden deferrals remain, temporary artifacts
  are cleaned, and the deployment agent reports the local commit.

Remaining material questions: none.
