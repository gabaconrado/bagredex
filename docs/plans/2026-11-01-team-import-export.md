# Team import and export

## Summary

Add a browser-local, Showdown-style text interchange workflow to the team builder. The current
unsaved roster exports into an accessible dialog, and a fully valid import atomically replaces the
draft roster without saving it. The same change simplifies the team-name control by removing its
visible label while preserving its accessible name.

## Goals

- Move complete teams into and out of Bagredex using a deterministic Pokémon Showdown/VGC
  MultiCalc-style set format adapted to Champions SPs.
- Preserve all representable Bagredex team-member fields, including nicknames and shiny state.
- Validate an import completely against the draft's retained regulation dataset before changing
  editor state.
- Keep parsing, export, validation feedback, and draft replacement local to the existing Preact
  island.
- Keep the dialog usable with keyboard, touch, screen readers, desktop, tablet, and phone layouts.

## Non-goals

- Do not save an imported roster until the user chooses **Save**.
- Do not import or export team names, gender state, EVs, IVs, levels, Tera Types, URLs, files, or
  remote pastes.
- Do not add a persistence endpoint, dependency, database migration, normalized data release, or
  Pokémon data override.
- Do not reproduce VGC MultiCalc's parser implementation or expand Bagredex legality rules.

## User-visible behavior

- The team information card orders its actions as **Save**, **Import/Export**, then **Delete** when
  Delete is available. Import/Export remains available for new and saved drafts.
- Import/Export opens a modal dialog with one labelled text area prefilled from the current unsaved
  roster in position order. It provides **Copy**, **Import**, and **Cancel/Close** actions.
- Copy writes the complete text-area contents to the clipboard and announces success or a useful
  failure without changing the draft or closing the dialog.
- Import parses the current text-area contents. A valid import closes the dialog, replaces the
  complete roster, marks the team dirty relative to its baseline, and announces that Save is still
  required. Empty or whitespace-only text validly clears the roster.
- Any syntax, resolution, or legality error leaves the existing roster untouched and keeps the
  dialog open. The dialog presents set- and line-specific errors and moves focus to, or associates
  focus with, the error summary.
- The team-name input no longer has a visible `Team name` label. It retains `Team name` as its
  accessible name and preserves existing validation descriptions and focus behavior.

## Decisions and assumptions

- The supported grammar uses blank lines between sets. A set begins with Showdown header syntax:
  `Species @ Item`, `Nickname (Species) @ Item`, and optional `(M)` or `(F)` markers are accepted.
  Gender markers are ignored and never exported because the team aggregate does not store gender.
- Supported detail lines are `Ability:` or the Showdown alias `Trait:`, `SPs:`, `Shiny: Yes` or
  `Shiny: No`, `<Nature> Nature`, and up to four `- <Move>` lines. Tabs, line endings, case, spacing,
  accents, punctuation, and canonical display-name differences are normalized only for lookup;
  an unknown or ambiguous normalized name is an error.
- `Level:`, `EVs:`, `IVs:`, and `Tera Type:` are recognized but rejected with explicit unsupported
  field errors. Other non-empty, non-grammar lines are rejected rather than silently discarded.
- SP entries use `HP`, `Atk`, `Def`, `SpA`, `SpD`, and `Spe`. Each stat may appear once, must be a
  whole number in the retained mechanics bounds, and the total must meet the retained total cap.
- Omitted values become Serious nature, zero SPs, non-shiny, and no ability, item, or moves. Export
  uses canonical dataset display names, emits a nature line, emits only nonzero SP entries, emits
  `Shiny: Yes` only when needed, and omits absent optional fields.
- Exported move lines retain the relative order of populated move slots. Because Showdown text has
  no empty-slot token, importing compacts populated moves into the first slots; empty move-slot
  placement has no battle meaning. All other representable values round-trip exactly.
- Importing a legal base form with its matching Mega Stone enables `mega_preview`. This is the
  agreed inference even if the source draft had deliberately disabled preview with that stone.
  Mega-form names resolve through the existing Mega search entries to their base form and stone.
- A successful parse must also pass the current client-side member rules plus aggregate rules for
  at most six members, unique base species, unique held items, legal forms, abilities and moves,
  unique moves, nickname length, SP limits, and valid Mega relations. Save remains the
  authoritative Django validation boundary and applies the same retained regulation again.
- A team header such as `=== [format] Team name ===` is outside scope because team names are not
  imported. Treat it as unsupported instead of silently changing or ignoring the draft name.

## Scope and ownership

`web_gui_coder` exclusively owns all implementation changes:

- Add `src/web/src/team-builder/team-text.ts` for pure parsing, normalized lookup, aggregate
  validation, Mega inference, canonical export, and structured import diagnostics.
- Add `src/web/src/team-builder/team-text.test.ts` for parser/exporter and round-trip unit coverage.
- Update `src/web/src/team-builder/app.tsx` to add the dialog, clipboard behavior, atomic draft
  replacement, announcements, error focus, action ordering, and accessible team-name input.
- Update `src/web/src/team-builder/app.test.tsx` for component state, focus, accessibility, copy,
  cancellation, error, and successful-import behavior.
- Update `src/web/static/web/css/team-builder.css` for responsive dialog, text-area, error, and
  action layout using existing design tokens.
- Update `src/web/tests/e2e/team-builder.spec.ts` for the critical browser workflow and the removed
  visible label with retained accessible naming.

No `src/backend`, `src/data`, template, deployment, or dependency files should change. The
`web_gui_reviewer` reviews the Web scope, and the `architect` reviews integration consistency after
Web findings are resolved.

## Data and interface impact

- `BuilderData` remains `team-builder-data-v6`. Its forms, Pokémon search/form-group entries,
  abilities, items, moves, natures, mechanics, and Mega relations already provide the complete
  retained-regulation lookup and validation input.
- `Team`, `Member`, and `team-draft-v1` remain unchanged. The importer produces the existing
  browser `Member` shape; the existing serializer and save endpoint receive no new fields.
- The text format is a new browser boundary. Parsing must be total over arbitrary strings, impose a
  practical input-length limit, avoid HTML interpretation, and return diagnostics rather than
  partially constructed state.
- No data-version pin advances. Saved teams continue to use their retained dataset, while new teams
  use the active dataset already loaded by the builder.
- Rollback consists only of reverting the Web files and plan/report artifacts; stored teams and
  normalized Pokémon data are unaffected.

## Implementation sequence

1. `web_gui_coder` adds the pure text module and tests first. Build collision-aware normalized
   indexes from the supplied `BuilderData`; parse into temporary members; resolve all names; infer
   Mega preview; then run member and aggregate legality checks before returning success.
2. `web_gui_coder` adds canonical export and verifies empty, partial, complete, nickname, gender,
   shiny, form, Mega, punctuation/case, CRLF, and normalized move-slot round trips.
3. `web_gui_coder` adds a native semantic dialog where supported by the existing test/runtime
   patterns. On open, snapshot the current export into editable dialog state. Import must compute a
   complete result before one `setDraft` call and clear stale member errors/transients only after
   success.
4. `web_gui_coder` adds clipboard status, focus restoration, Escape/Cancel behavior, error
   announcement, and responsive plain CSS. Remove only the visible team-name label and retain the
   input's accessible name.
5. `web_gui_coder` extends component and Playwright coverage, then runs the Web checks and
   repository lint before review.
6. `web_gui_reviewer` reviews functionality, keyboard/focus behavior, accessible names and status
   announcements, touch/phone layout, input safety, latency, and test adequacy without editing.
7. `architect` reviews the final diff for plan compliance, retained-data correctness, unchanged
   Django contracts, and consistency between import validation and Save validation.
8. After all blocking findings are resolved and re-reviewed, `architect` writes the cycle report;
   `deployment_agent` runs final checks and completes the required commit/report workflow.

Backend and Web work are not parallelized because no backend change is planned. If implementation
discovers missing canonical lookup or legality data, stop and return that interface gap to the
architect instead of expanding the dataset contract without an amended plan.

## Review and verification

Unit coverage must include:

- canonical export ordering and formatting for empty, defaulted, nicknamed, shiny, and Mega teams;
- accepted header variants, ignored gender, whitespace, CRLF, case/punctuation/accent matching,
  `Trait:`, all SP labels, defaults, and empty-team import;
- atomic rejection of unknown or ambiguous names, malformed headers/details, duplicate fields,
  more than four moves, more than six sets, duplicate species/items/moves, illegal
  ability/move/form combinations, nickname overflow, invalid SP values/totals, and unsupported
  Level/EV/IV/Tera lines;
- exact representable-value round trips and the documented move-slot compaction/Mega inference;
- dialog prefill, Copy success/failure, Import success, error retention, cancellation, dirty state,
  Save remaining explicit, error announcement/focus, Escape, focus trap/restoration, and the
  accessible team-name input without visible label text.

The critical Playwright path must open an existing team, confirm the exported nickname/item/
ability/SP/nature/shiny/moves, replace it with a valid differently cased/punctuated import, confirm
the editor changes without a save request, then Save and inspect the submitted canonical draft. A
second assertion must show an invalid import preserves the original roster and exposes an
actionable dialog error. Run this path in the repository's configured desktop and tablet projects;
retain functional phone coverage where the existing suite provides it.

Required observed checks are:

```text
cd src/web && npm test -- src/team-builder/team-text.test.ts src/team-builder/app.test.tsx
cd src/web && npm run check
cd src/web && npm run build
cd src/web && npx playwright test tests/e2e/team-builder.spec.ts
./.codex/lint.sh
```

The deployment agent also runs the repository's final local validation required by the feature
workflow. No check may install or download missing tools; report a missing capability instead.

## Risks

- Normalization can map distinct legal display names to one key. Collision-aware indexes and
  explicit ambiguity errors prevent a paste from selecting the wrong canonical record.
- A permissive Showdown parser could silently lose unsupported state. Strict recognized-field and
  unknown-line errors make loss visible before draft replacement.
- Client/backend legality drift could let an apparently valid import fail at Save. Reuse existing
  client member validation, add only the aggregate checks already enforced by Django, and retain
  server validation as authoritative.
- Large pasted text could create avoidable synchronous work. Cap input size before parsing and keep
  lookups linear through prebuilt maps; ordinary six-set imports should complete within one normal
  interaction frame.
- Clipboard access can be denied by the browser. Keep the selectable text visible and report the
  failure without closing the dialog.

## Completion criteria

- The Import/Export dialog exports the current draft and atomically imports every agreed supported
  field under the retained regulation, including empty-team clearing, nicknames, shiny state, and
  inferred Mega preview.
- Invalid, ambiguous, illegal, oversized, or unsupported input produces actionable errors and does
  not change the roster.
- Import never performs a save; the normal dirty state and Save action control persistence.
- The actions appear in the agreed order, and the team-name input has no visible label while
  retaining its accessible name and error association.
- Component/unit and representative Playwright coverage pass, including keyboard, focus,
  announcement, desktop/tablet, invalid-import atomicity, and submitted-save behavior.
- Web review and architect integration review report no blocking findings, all required checks are
  observed passing, the cycle report names the exact feature commit after correction, and
  `./bagredex.sh human-review candidate` reports that feature commit as `available`.
