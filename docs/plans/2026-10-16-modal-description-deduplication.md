# Modal description deduplication

## Summary

Render exactly one descriptive paragraph in move and ability information modals, using the required
full `description` field. Present move Target and Flags as readable noninteractive pills while
keeping `short_description` and raw metadata unchanged in existing data and browser contracts.

## Goals

- Remove semantic repetition when Showdown's `shortDesc` and `desc` differ.
- Show exactly one `description` paragraph for every ability and move modal.
- Present the move Target and each Flag as readable, wrapping pills based on the existing ability-
  chip visual language.
- Preserve all modal metadata, interaction, focus, layout, and responsive behavior.

## Non-goals

- Changing importer fallbacks, normalized records, bundle versions, Django models, API payloads, or
  TypeScript contracts.
- Removing, renaming, or repurposing `short_description`.
- Editing description text or selecting between the two fields at runtime.
- Changing search suggestions, filters, selected-Pokémon lists, modal titles, move-flag values, or
  move metadata.
- Adding dependencies or changing backend, data, deployment, or package files.

## User-visible behavior

- Clicking an ability or move in the selected-Pokémon pane opens the existing modal with one and
  only one descriptive paragraph containing its full `description`.
- An unequal pair such as Thick Fat shows the longer full detail and does not repeat its short
  summary first. An equal pair such as Tough Claws still shows one paragraph.
- Moves follow the same rule while retaining Type, Category, Power, Accuracy, PP, Priority, Target,
  and Flags.
- Move Target appears as one noninteractive pill. Camel-case identifiers are split into words and
  displayed in title case, so `adjacentFoe` becomes `Adjacent Foe`.
- Each move Flag appears as its own noninteractive pill in source order. Flag text and casing are
  preserved exactly; the browser does not infer friendlier names or capitalization.
- `Target` and `Flags` remain visible semantic labels. Pill groups wrap within the dialog at narrow
  widths without horizontal overflow. When a move has no flags, the existing `None` fallback
  remains visible after `Flags` rather than inventing a flag pill.
- The title, close button, Escape and backdrop dismissal, focus trap/restoration, and close-on-form-
  change behavior remain unchanged in light/dark themes and responsive layouts.

## Decisions and assumptions

- The normalized importer stores `short_description` from Showdown `shortDesc` and `description`
  from `desc`, with the established `desc || shortDesc` fallback. Therefore `description` is the
  single authoritative modal paragraph even when upstream provides only the short form.
- Current bundle validation, Django loading, and Web parsing require both fields as strings. This
  feature does not need a data migration, API compatibility path, or empty-field fallback in the
  component.
- Paragraph counting applies to descriptive body copy, not the move Flags paragraph or metadata
  grid. Tests should identify the description node or its text rather than treating all modal
  paragraphs as descriptions.
- Target humanization is presentation-only and deterministic: insert a boundary before each ASCII
  uppercase letter, normalize the resulting word separation, then uppercase the first character of
  every displayed word without lowercasing the remaining characters. Flags bypass this transform.
- Target and flag pills are informational `<span>` content, not buttons, because they have no
  action. They may share the ability-chip colors, border, radius, spacing, and typography through a
  reusable noninteractive pill class without inheriting pointer or focus behavior.

## Scope and ownership

### Web GUI coder

Own implementation and tests under `src/web`:

- In `src/web/src/app.tsx`, change both `MoveInfo` and the ability branch of `InformationDialog` to
  render one `<p>` from `description`; do not render `short_description` in either modal.
- Refactor the move metadata markup so `Target` owns one humanized visual pill and `Flags` owns an
  ordered, wrapping list of one pill per unchanged flag value. Preserve visible labels and the
  current `None` empty-state text.
- Add only the minimal plain-CSS hooks under `src/web/static/web/css/pokedex.css` needed to match
  existing ability-chip styling for noninteractive pills and wrap them without overflow.
- Add focused component fixtures/assertions for unequal and equal ability descriptions and an
  unequal move description. Prove full text appears once, short-only text is absent when unequal,
  and equal text has one descriptive occurrence.
- Add component assertions for `adjacentFoe` -> `Adjacent Foe`, exact flag spelling/casing and
  order, noninteractive semantics, wrapping containers, and the no-flags `None` fallback.
- Extend browser coverage only as needed to exercise the production modal presentation and protect
  title, metadata, focus, Escape, backdrop, close button, and responsive behavior.
- Do not change `contracts.ts`, data fixtures outside Web-owned tests, backend/data/deploy files,
  dependencies, or generated Vite output.

### Web GUI reviewer

Review `src/web` read-only for exact full-description-only behavior across abilities and moves,
target-only humanization, flag fidelity/order, noninteractive ability-chip presentation, test
quality for equal/unequal fields, unchanged contracts, modal accessibility, and absence of layout
or responsive regressions.

### Architect

Own this plan, final plan-completion review, and the cycle report. Confirm that no Web contract or
cross-scope change was introduced.

### Deployment agent

Run final offline Web/build/browser checks with already-local inputs, clean temporary artifacts,
and create the justified local commit after review. No deployment source change is planned.

## Data and interface impact

There is no data, schema, bundle, backend, endpoint, or serialized-contract change. Both
`short_description` and `description` remain required and populated in ability and move payloads.
The browser continues to parse and retain both; only modal rendering stops consuming the short
field. Target and flag identifiers also remain byte-for-byte unchanged in API data and TypeScript
models; humanization applies only to the rendered target label.

No URL, cache, selection, filter, sorting, or persistence behavior changes. The Vite bundle may
change by a few bytes, with no new asset or network request.

## Implementation sequence

1. The Web owner adds component regressions that demonstrate current duplicate output for unequal
   ability and move fields, establish the one-paragraph expectation for equal fields, and pin the
   Target/Flags presentation contract.
2. The Web owner makes the minimal modal render and plain-CSS changes in `app.tsx` and
   `pokedex.css`, then updates affected tests.
3. The Web owner runs the complete frontend suite, type/format checks, production build, and focused
   modal browser flows in supported themes and viewports.
4. The Web reviewer performs read-only source and behavior review; the owner resolves findings and
   repeats affected checks.
5. The architect verifies scope and plan completion, then writes the cycle report. The deployment
   agent performs final validation, cleanup, and the pending local commit.

## Review and verification

- Component test a Thick Fat-like ability with distinct summary/full strings: the full description
  appears exactly once and the summary-only string does not appear in the dialog.
- Component test a Tough Claws-like ability whose two fields are equal: the modal contains exactly
  one descriptive paragraph/text occurrence.
- Component test a move whose fields differ: the full description appears exactly once, the short
  summary is absent, and Type, Category, Power, Accuracy, PP, Priority, Target, and Flags remain.
- Component test target humanization with `adjacentFoe` and at least one additional camel-case
  identifier. Assert one `Target` label followed by one `Adjacent Foe` pill, without changing the
  stored value or applying the transform to flags.
- Component test multiple flags with deliberately meaningful casing: assert one pill per flag,
  original order and exact text/case, no button/link roles, and one visible `Flags` label. Test an
  empty array separately and retain visible `None` without an empty or synthetic flag pill.
- Retain contract-parser tests proving both description fields are required strings; do not weaken
  parsing because the modal no longer displays the short field.
- Run the complete frontend unit/component/accessibility/performance suite, TypeScript and format
  checks, and the offline Vite production build.
- Run focused Chromium and Firefox browser checks in light and dark themes, with desktop and phone
  coverage and the established tablet/responsive suite. Verify one description, title association,
  initial close-button focus, Tab containment, close button, Escape, backdrop dismissal, invoker
  focus restoration, form-change dismissal, metadata visibility, and no overflow or geometry
  regression.
- In the same browser matrix, inspect a move with multiple flags and a camel-case target. Confirm
  Target and Flag pills match the established ability-chip surface, preserve reading order and
  accessible text, wrap inside the modal on phone, remain noninteractive, and do not add focus
  stops. Check the empty-flags fallback in a component test unless a real browser fixture provides
  one without weakening production data.
- Run `.codex/lint.sh` and `git diff --check`; remove temporary build/browser artifacts before
  handoff.

## Risks

- A broad paragraph-count assertion could mistake the move Flags paragraph for a second
  description. Tests must target description text or a stable description-specific container.
- Removing `short_description` from contracts because it is no longer rendered would create an
  unapproved API change and discard useful normalized data. Contract definitions and parsers remain
  untouched.
- Equal fields can conceal duplicate DOM output because repeated text looks identical. Tests must
  assert one occurrence or one description node, not merely visible text.
- Reusing `.chip-list button` directly would incorrectly make metadata look or behave interactive.
  Share visual tokens/declarations through a noninteractive class and verify cursor/focus semantics.
- Naive title casing could mutate flag text or damage target acronyms. Scope the helper to targets,
  preserve characters after each word's first letter, and pin representative output.

Rollback restores the preceding two conditional render branches and their matching tests in one
Web-only commit; no data or runtime rollback is required.

## Completion criteria

- Every ability and move information modal renders exactly one descriptive paragraph sourced only
  from `description`.
- Move Target renders as one correctly humanized noninteractive pill; every Flag renders as its own
  exact, ordered noninteractive pill; semantic labels, wrapping, and `None` behavior are preserved.
- Unequal ability/move and equal ability regressions pass without weakening required-field
  contracts.
- Modal metadata, accessibility, focus/dismissal behavior, selected-form behavior, themes, and
  responsive layout remain green in component and browser checks.
- No backend, data, deploy, dependency, or reference files change; all Web, build, documentation,
  and diff checks pass with no blocking review findings.
- The architect report records observed evidence, no hidden deferrals remain, temporary artifacts
  are cleaned, and the deployment agent reports the local commit.

Remaining material questions: none.
