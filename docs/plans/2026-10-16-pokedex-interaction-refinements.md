# Pokédex interaction refinements

## Summary

Refine the existing regulation-aware Pokédex for clearer interaction, stable Firefox layout, and
faster selection after the initial list appears. Django adds one normalized bulk-detail response
for the current regulation and small bootstrap additions. The Preact island background-loads that
response once per page, keeps it only in memory, and renders selected Pokémon without further
detail requests after it arrives.

This cycle also adds exact row sprites, aligned shiny and Mega icon toggles, structured move rows,
and an accessible move or ability modal. It preserves the current explicit regulation URL and
full-page reload behavior, active-version protections, search and filter semantics, empty initial
details pane, immutable sprite source, and Django/Preact ownership boundary.

## Goals

- Make every interactive Pokémon name, ability, and move visibly clickable with a pointer cursor
  while preserving native button, keyboard, and focus behavior.
- Prevent page and panel geometry from jumping between server-rendered, index-loading, list-ready,
  detail-loading, and detail-ready states, with Firefox desktop and tablet as primary validation
  targets.
- Load all regulation-effective form details in the background after the legal list first renders,
  using a compact normalized contract that sends each move and ability description only once.
- Replace the inline information pane with an accessible modal opened immediately from selected
  Pokémon ability and move controls.
- Present shiny and applicable Mega controls side by side as one coherent native Bagredex icon-toggle
  system with explicit labels, tooltips, focus, and active state.
- Present the full learnset as structured move rows containing name, type, category icon, and power.
- Add the exact normal, non-shiny sprite as the first column of every legal list row.
- Replace the regulation links and upstream format heading with a compact, scalable native selector
  and Bagredex labels such as `Regulation M-C` and `Regulation M-B`.
- Preserve one-frame browser-local search, filter, sort, modal-open, shiny-toggle, and already-loaded
  selection response after data is available.

## Non-goals

- Changing regulation legality, learnsets, sprite derivatives, imported data, database models, or
  migrations.
- Persisting bulk details, selections, shiny state, modal state, or regulation state in a session,
  browser storage, service worker, or shared client cache.
- Incremental or priority per-Pokémon detail requests. Selecting before the bulk response completes
  deliberately waits on that response.
- Changing search-suggestion semantics: move and ability suggestions still add filters rather than
  opening the information modal.
- Client-side regulation switching, preloading both regulations, or retaining state across a
  regulation reload.
- A custom ARIA combobox or an Apply step for regulation selection; the platform-native select
  navigates immediately.
- Animated sprites, shiny row sprites, sibling-Mega controls while a Mega is selected, or sprite
  fallbacks.
- A new dependency, external icon or asset package, state library, virtualization layer, worker,
  DRF, or data schema revision without measured evidence and separate approval.

## User-visible behavior

### Stable loading and layout

- The server-rendered shell reserves the same desktop/tablet list and details columns, principal
  panel heights, toolbar region, and scrollbars that the mounted island uses. Initial and index
  loading display quiet skeletons or a reduced-motion-safe spinner inside that geometry rather than
  replacing one centered card with a differently sized application.
- The legal list appears as soon as the index request succeeds. The details pane remains in its
  existing empty prompt state until the user selects a Pokémon; background detail loading alone
  must not replace the empty prompt.
- Selecting a Pokémon before bulk details finish keeps the outer details pane geometry stable and
  shows a labelled loading skeleton or spinner within it. When data arrives, the selected form
  replaces that placeholder without changing the list position or resetting filters and sort.
- The index, bulk details, or selected-detail failure states occupy the same reserved panels and
  provide the existing reload or retry affordance without collapsing the application.
- Sprite and icon dimensions, table columns, and scroll gutters are reserved before image or data
  completion. Firefox must not show a width jump from scrollbar appearance, intrinsic image size,
  sticky-column recalculation, or loading-state replacement.

### List and background detail load

- The first table column is a compact image cell containing the exact row form's normal sprite.
  The sprite is never affected by the selected pane's shiny toggle. It has fixed intrinsic and CSS
  dimensions, useful alternative text or a deliberately empty alternative when the adjacent name
  supplies the same label, and browser-native lazy loading outside the visible region.
- The Pokémon name remains a native button and gains the pointer cursor expected of a clickable
  control. Ability and move controls use the same pointer treatment. Visible focus, Enter/Space,
  touch targets, selected-row indication, and screen-reader names remain intact.
- After the index has committed and the browser has had an opportunity to paint the legal list, the
  island starts one authenticated bulk-detail request for the selected regulation and active data
  version. The request covers every regulation-effective profile required for legal rows and
  base/Mega switching, including toggle-supporting forms without list membership.
- A page makes at most one successful bulk-detail request. Parsed normalized maps live only for the
  current island lifetime. A regulation link performs the existing full-page navigation, aborts the
  old request, and starts with empty state for the new regulation.
- No selection starts a separate form-detail request. If a form is selected while bulk data is
  loading, the island records its identifier and shows the stable details skeleton. When loading
  completes, the most recently selected form renders. Changing selection during loading updates the
  pending identifier without starting or reprioritizing network work.
- A stale active-version response keeps the existing reload behavior. A bulk failure leaves search,
  filters, sorting, row sprites, and selection usable, while the details pane offers a retry that
  replaces the one failed page-lifetime request.

### Regulation presentation

- The page heading and native regulation select use compact Bagredex labels: `Regulation M-C` and
  `Regulation M-B`. The upstream Showdown format name is no longer displayed above the Pokédex;
  canonical regulation identifiers and imported names/provenance remain unchanged internally.
- One labelled native `<select>` replaces the current regulation-link toggle and contains every
  regulation in the bootstrap contract. It is designed to accept more options without a new layout
  pattern. The current regulation is selected when the page renders.
- Changing the select immediately navigates to that option's existing explicit URL, such as
  `/?regulation=m-b`. There is no Apply button. The full-page load clears selection, filters, sort,
  modal, shiny, index, and bulk-detail state as before.
- Keyboard selection, touch, visible focus, accessible name, and browser-native expanded-list
  behavior are preserved. The loading shell reserves its dimensions so replacing the former links
  or loading longer labels does not shift the toolbar in Firefox.

### Selected form controls

- Shiny and Mega controls form one side-by-side toggle group near the selected form heading. Each is
  a native button with a local inline SVG Bagredex icon, visible text or tooltip, `aria-pressed`, and
  an accessible name describing its exact action and form. Hover, pointer, focus, and active
  backgrounds use the same visual system in light and dark themes.
- Shiny is always present. Activating it changes only the selected sprite between the exact normal
  and shiny variants; it does not affect list sprites, selection, or modal state.
- A selected base form shows one separate Mega toggle for every available Mega relation. Labels use
  imported `form_label` data to distinguish plain Mega and Mega X, Y, or Z. Activating one selects
  that exact Mega form.
- A selected Mega shows only its own Mega toggle in the active state. Activating it returns to the
  base form. It does not show sibling Mega toggles. Returning to the base reveals all of that base's
  applicable Mega choices again.
- Changing the selected form by list, search, or Mega control closes any open information modal.
  Shiny toggling does not close it.

### Abilities, moves, and modal

- Abilities remain native controls. Moves become a semantic table or equivalent structured list
  with labelled columns for name, type, category, and power. Each move row is one keyboard and touch
  operable control without invalid interactive nesting.
- Category uses native inline SVG Bagredex icons for Physical, Special, and Status, paired with an
  accessible text name or visually hidden label. Power shows an em dash for Status moves regardless
  of their transported numeric value; Physical and Special moves show their numeric base power,
  including zero when that is the canonical value.
- Activating an ability or move in the selected pane opens its information modal immediately from
  the already-loaded normalized data. The modal contains the existing complete ability description
  or move metadata, descriptions, and flags.
- The modal uses the native `<dialog>` element when supported by the existing browser target. It has
  a labelled heading, explicit close button, initial focus, contained tab order, Escape behavior,
  backdrop styling, and backdrop-click dismissal. Closing restores focus to the invoking control
  when it still exists. Changing the selected form closes the modal without restoring focus to a
  removed control.
- Search suggestions remain independent: activating a move or ability suggestion adds its filter
  and never opens this modal.

## Decisions and assumptions

- Existing models already contain every required form label, Mega relation, sprite, stat, ability,
  move, flag, and learnset edge. No data or persistence change is expected.
- The current `pokedex-index-v1` response remains the fast legal-list and browser-filter input.
  Row sprite URLs are derived from a server-generated, versioned sprite URL template added to the
  bootstrap rather than repeated in every index row.
- Bootstrap advances to `pokedex-bootstrap-v2` and adds `details_url` plus
  `sprite_url_template`. Each regulation entry and the selected regulation carry a server-authored
  compact presentation label such as `Regulation M-C`, while canonical IDs and database provenance
  remain untouched. The templates contain explicit `__FORM__` and, for sprites, `__VARIANT__`
  placeholders, are produced with Django URL reversing and JSON escaping, and are accepted only as
  same-origin paths by the client parser. The former per-form detail URL may remain during this
  cycle for compatibility, but the refined island does not call it.
- One new authenticated, GET-only endpoint serves normalized bulk details:
  `GET /pokedex/data/<regulation>/details/?version=<expected-version>`. It uses the existing
  allow-listed regulation, active-version comparison, `409` stale response, private no-cache
  policy, conditional ETag behavior, and deterministic serialization conventions.
- `pokedex-details-v1` contains top-level `forms`, `abilities`, and `moves`. Shared effective move
  and ability metadata appears once; each form references canonical identifiers. This avoids the
  current per-form repetition of descriptions and flags across tens of thousands of learnset edges.
- Bulk serialization includes every `PokemonProfile` in the selected regulation, not only
  `RegulationMembership`, so all approved base/Mega navigation targets are locally available.
  The legal list and search remain membership-only through the index.
- Client normalization produces three page-lifetime maps keyed by canonical identifier and rejects
  duplicate, dangling, cross-version, cross-regulation, missing-sprite, or unsupported category
  values before marking bulk details ready. It does not mutate the transport objects afterward.
- The client schedules the bulk fetch from an effect after the index-ready list commit and at least
  one animation opportunity. This sequencing is tested with a controlled fetch and paint boundary;
  it is not implemented as a per-row cascade or an idle callback that may never run.
- Bulk details may be materially larger than the current index but should compress well because
  relationships are identifier arrays and shared text is unique. Measure raw and gzip bytes,
  serialization/query cost, download timing, JSON parse/normalization time, retained client data,
  and selected-form render time before considering another transport split.
- Native Bagredex icons are small repository-owned inline SVG components in `src/web`, with paths
  authored for this interface and `currentColor` styling. They introduce no external asset,
  dependency, network request, font, trademark claim, or separate DOM owner.
- Geometry stability is an observable contract, not only a visual preference. Desktop and tablet
  tests compare the application, list, details, and toolbar rectangles across server shell, delayed
  index, index-ready/bulk-loading, selected/bulk-loading, and fully loaded states with a small
  documented tolerance. Scrollbar reservation and fixed media dimensions are included in the
  implementation rather than hidden with screenshots.
- Existing supported Chromium flows remain, but this cycle requires Playwright Firefox projects at
  desktop and tablet widths. Use the already project-pinned Playwright tooling and locally available
  browser; do not add dependencies or download a missing browser during agent work.

## Scope and ownership

### Backend coder

Own only `src/backend`:

- Extend Pokédex bootstrap serialization to v2 with the reversed bulk-details and sprite-template
  URLs and compact Bagredex regulation presentation labels. Keep imported regulation names and
  provenance unchanged.
- Add the authenticated bulk-details route, view, normalized selector/serializer, schema constant,
  ETag, active-version validation, and errors using existing Pokédex patterns.
- Serialize shared moves and abilities once and form-specific references separately, preserving
  deterministic order, exact stats, all flags, form labels, all relevant Mega relations, and legal
  versus toggle-only identity.
- Keep the existing per-form endpoint compatible unless removal is separately justified; do not
  change models, migrations, imported releases, or sprite serving.
- Add request, contract, query-count, ETag, stale-version, toggle-only, duplicate-avoidance, and
  exact-value tests. Measure both M-C and M-B, with M-C as the payload/performance baseline.

### Web GUI coder

Own only `src/web`:

- Update the bootstrap and bulk transport types, strict parsers, normalized page-lifetime maps,
  background-load state machine, abort/retry behavior, and pending selection behavior. Remove the
  refined island's per-selection detail fetching without weakening stale-data handling.
- Add the stable server and Preact loading geometry, detail skeleton, spinner, reserved media and
  table dimensions, and Firefox-safe scrollbar behavior.
- Add exact normal row sprites, pointer cursor styling, icon components, side-by-side shiny/Mega
  toggles, structured move rows, the accessible information dialog, and a labelled native
  regulation select that navigates immediately to its selected bootstrap URL.
- Preserve current search, filtering, sorting, regulation reload, empty initial pane, themes,
  responsive behavior, and one-frame local interaction behavior.
- Expand contract, reducer/state, component, performance, and Playwright tests with deterministic
  delayed bulk responses and no new package.

### Backend and Web GUI contract boundary

The owners agree on this logical response before parallel implementation:

```json
{
  "schema_version": "pokedex-details-v1",
  "data_version": "showdown-...",
  "regulation_id": "m-c",
  "forms": [
    {
      "id": "charizardmegax",
      "is_list_legal": true,
      "is_mega": true,
      "form_label": "Mega-X",
      "base_id": "charizard",
      "mega_ids": ["charizardmegax", "charizardmegay"],
      "stats": [
        {"id": "hp", "name": "HP", "base": 78, "real": 153,
         "minimum": 153, "maximum": 185}
      ],
      "ability_slots": [{"id": "toughclaws", "slot": "0"}],
      "move_ids": ["acrobatics", "airslash"]
    }
  ],
  "abilities": [
    {"id": "toughclaws", "name": "Tough Claws", "short_description": "...",
     "description": "..."}
  ],
  "moves": [
    {"id": "acrobatics", "name": "Acrobatics",
     "type": {"id": "flying", "name": "Flying"}, "category": "Physical",
     "base_power": 55, "accuracy": 100, "always_hits": false, "pp": 15,
     "priority": 0, "target": "normal", "short_description": "...",
     "description": "...", "flags": ["contact", "mirror", "protect"]}
  ]
}
```

- `forms` order is National Dex then canonical identifier; this requires selecting the related
  form only for ordering and does not repeat names or types already supplied by the index.
- `ability_slots` preserves Showdown slot order. `move_ids` uses display-name then identifier order.
  `mega_ids` uses form label then identifier order and contains all regulation-profiled Megas for
  the base, including the current Mega.
- `abilities` and `moves` include exactly the distinct identifiers referenced by returned forms,
  each once, in display-name then identifier order. Flags use ascending canonical identifier order.
- Sprite URLs are constructed only from the validated bootstrap template and returned identifiers.
  The backend's existing sprite endpoint remains the authority for exact variant availability and
  safe file access.
- Form display name and ordered types come from the index for legal forms. For a toggle-only form,
  the client needs the display values when navigating from a legal relative; therefore the bulk
  form record also carries `name` and ordered `types` only when that form is absent from the index,
  or the serializer may carry them consistently for every form if measurement shows the small
  duplication is clearer. The two owners must select one deterministic representation before code;
  no client inference from identifiers is allowed.

### Architect

Own this plan, contract resolution, cross-scope integration review, any focused task under
`docs/tasks`, and the final report under `docs/reports`. The architect does not implement backend,
Web GUI, data, or deployment code.

### Deployment agent

No packaging change is expected because this cycle adds no dependency or external asset and uses
the existing Vite entry. The deployment agent owns final repository checks, local Podman/browser
validation, and all local Git mutation. It edits `deploy/**` only if an observed build or browser
validation gap requires a focused deployment-owned correction approved by the architect.

## Data and interface impact

- No PostgreSQL model, migration, bundle, importer, sprite, or active-version workflow changes.
- One new read endpoint and one bootstrap schema revision are the only planned backend interfaces.
  The existing index, per-form detail, sprite, login, regulation URL, health, and admin routes remain
  compatible.
- Bulk response ETags incorporate response schema, active version, and regulation. Matching
  `If-None-Match` receives `304`; an activation between page and fetch receives the existing `409`
  reload contract rather than a retained-version payload.
- Browser memory contains only the current regulation's index, normalized details, filters, sort,
  selection, shiny state, and modal state. Page unload or regulation navigation releases it; no
  storage API is used.
- Row sprites reuse authenticated immutable sprite URLs and browser caching. They add no derivative
  or alternate source.
- Modal contents reuse canonical move and ability metadata from the bulk response and never change
  the meaning of search suggestion activation.
- Regulation presentation labels exist only in bootstrap/UI serialization. The canonical IDs,
  upstream database names, rulesets, and provenance remain unchanged and continue to scope every
  endpoint.

## Implementation sequence

1. Backend and Web GUI owners finalize the one open representation detail inside the agreed
   transport boundary: whether toggle-only form names/types are conditional or consistently present.
   Choose the smaller unambiguous measured form and record it in tests; this is an implementation
   representation choice, not a product question.
2. The backend owner implements bootstrap v2 and the bulk endpoint, with normalized deterministic
   output, bounded query tests, active-version behavior, and payload/serialization measurements.
3. After the contract fixture is stable, the Web GUI owner updates strict parsing and normalized
   maps, then implements post-paint background loading, pending selection, retry, and page-lifetime
   disposal. Backend endpoint and Web GUI state work may otherwise proceed in parallel.
4. The Web GUI owner implements reserved shell/panel geometry, exact list sprites, native icons,
   aligned toggle controls, structured moves, and the accessible dialog, then preserves and extends
   existing interaction behavior.
5. The Web GUI owner measures payload download/parse/normalization, Firefox geometry transitions,
   bulk-ready selection and modal latency, and existing filter/sort latency. Complexity changes
   require evidence and architect approval.
6. Backend and Web GUI reviewers inspect their scopes. The architect reviews the complete contract,
   state transitions, no-priority-request rule, modal focus, Mega directionality, Firefox stability,
   performance evidence, and ownership. Every actionable finding returns to its owner until no
   blocker remains.
7. The architect writes the cycle report. The deployment agent runs final checks and real local
   Firefox/Chromium smoke tests, stages only reviewed files, and creates the justified local commit.
   No remote operation occurs.

## Review and verification

### Backend

- Contract tests prove one record per shared move and ability, complete references for every
  regulation profile, no dangling identifiers, deterministic ordering, exact form labels, all
  Mega relations, exact stats, complete move flags and metadata, and legal/toggle-only distinction.
- Request tests cover authentication, GET-only behavior, regulation/version validation, no active
  data, stale activation, ETag `200`/`304`, unsupported mechanics, and deterministic errors.
- Query-count tests prove the bulk endpoint remains bounded independently of forms, abilities,
  moves, flags, and learnset edge counts; no per-form or per-move query growth is accepted.
- Record M-C and M-B raw and gzip response sizes, query counts, and serialization times. Compare the
  normalized response with the sum or representative projection of current per-form detail
  responses to demonstrate that shared metadata is not duplicated.
- Run Ruff formatting/lint, strict mypy, Django checks, migration drift checks, focused request tests,
  and the complete PostgreSQL suite.

### Web GUI

- Contract tests reject duplicate IDs, dangling form-to-move/ability/Mega/base references, invalid
  categories, wrong version/regulation, unsafe URL templates, and malformed optional toggle-only
  display data.
- State/component tests hold the bulk fetch pending and prove the list renders first, no detail
  request is made per selection, the empty pane stays empty without selection, the latest pending
  selection wins, failure offers retry, successful normalization renders selection, and regulation
  unload aborts and clears state.
- Interaction tests prove row sprites are exact normal URLs and ignore shiny state; pointer styling
  applies without replacing buttons; base forms show separate plain/X/Y/Z Mega choices; a Mega
  shows only its active toggle and returns to base; shiny and Mega controls align and report active
  state.
- Regulation tests prove compact labels are displayed, upstream format labels are absent from the
  heading/options, the native select has an accessible label and current value, keyboard and pointer
  changes immediately navigate to the chosen explicit URL, no Apply control exists, and the reload
  starts with cleared page state.
- Move tests cover semantic headings, all four displayed fields, category icon accessible names,
  Status power em dash, numeric Physical/Special zero, and immediate modal opening. Ability tests
  cover immediate modal opening. Search move/ability choices still add filters.
- Dialog tests cover labelled modal semantics, initial focus, close button, Escape, backdrop click,
  focus restoration, selected-form change closure without stale restoration, light/dark backdrop,
  and no keyboard trap.
- Loading tests compare reserved geometry and scrollbar state across server shell, delayed index,
  list with delayed bulk response, selected skeleton, loaded detail, error, and retry. Spinners stop
  animation under reduced motion.
- Measure current M-C bulk raw/gzip transfer, JSON parse and map construction, retained browser data,
  and post-load selection/modal render durations. Filter, sort, selection, shiny, and modal actions
  after data load must complete their deterministic DOM mutation within one 60 Hz frame in repeated
  in-page measurements.
- Run TypeScript, Prettier, Vitest, production Vite build, manifest verification, and Playwright.

### Browser and integration

- Add Firefox desktop-light and Firefox tablet-dark-reduced Playwright projects without removing
  existing Chromium desktop/phone coverage. Run critical flows in Firefox for initial/loading/loaded
  geometry, delayed selection, exact row sprites, each Mega toggle direction, shiny independence,
  structured moves, modal keyboard/backdrop behavior, and regulation reload.
- Manually inspect Firefox at desktop and tablet widths for no visible initial or panel flicker,
  sticky table behavior, scrollbar stability, sprite sizing, focus rings, dialog backdrop, dark
  theme, reduced motion, zoom, and touch-sized targets. Confirm the phone layout remains functional
  with details below the list and a viewport-contained dialog.
- Smoke-test against the loaded local M-C and M-B data through `./bagredex.sh review`; confirm HTTP
  caching/stale behavior and no per-selection detail requests in browser network inspection.
- Run `.codex/lint.sh`, `git diff --check`, the complete backend/frontend/deployment checks, and any
  affected offline image validation. Record exact observed measurements and browser versions in the
  report; never claim unavailable browser coverage.

## Risks

- Full normalized details can increase initial background bandwidth and client memory. Shared
  dictionaries, one page-lifetime request, compression, and explicit measurements control this;
  another split is justified only by evidence.
- Hundreds of list sprites can compete with detail transfer and decoding. Fixed dimensions,
  immutable caching, native lazy loading, and a single compact detail response reduce contention;
  eager preloading is prohibited.
- Firefox can calculate intrinsic table widths and scrollbars differently from Chromium. Reserved
  columns, fixed sprite dimensions, `scrollbar-gutter`, matched server/client skeletons, and direct
  Firefox geometry tests address this rather than browser-specific timing hacks.
- A modal can lose focus or expose background controls if implemented as a styled overlay alone.
  Native dialog semantics, explicit focus restoration rules, and keyboard tests are required.
- Mega naming inferred from canonical IDs would be brittle. The endpoint transports the imported
  form label and exact relation identifiers; the client does not parse names to invent X/Y/Z/plain.
- A background response can arrive after navigation or activation. Abort handling, version checks,
  strict normalization, and full-page regulation navigation prevent cross-page state mutation.

## Completion criteria

- Initial, loading, and loaded Pokédex geometry is visibly stable and passes documented Firefox
  desktop/tablet rectangle and scrollbar assertions; responsive phone fallback remains functional.
- Every legal row starts with its exact normal sprite, and interactive Pokémon names, abilities,
  and moves retain native accessible controls with pointer feedback.
- The heading and accessible native selector use compact Bagredex regulation labels and immediate
  explicit-URL navigation, while canonical identifiers and upstream provenance remain unchanged.
- The list paints before one normalized full-regulation detail request begins; selection never
  starts a priority detail request; pending selection shows a stable skeleton and resolves to the
  latest chosen form.
- Bulk details contain complete regulation profiles with shared move and ability metadata only once,
  pass bounded-query and strict-reference tests, and meet recorded payload/parse/render targets.
- The empty details pane remains empty until selection. Regulation navigation reloads and clears all
  page state.
- Shiny and exact applicable Mega toggles share the approved icon style and behavior: base shows all
  plain/X/Y/Z choices, Mega shows only its active return toggle, and shiny never affects row sprites.
- Moves display name, type, accessible category icon, and correct power representation. Ability and
  move controls open the complete accessible modal immediately; all dismissal, focus, and
  selection-change behavior passes tests.
- Search/filter/sort behavior remains compatible, suggestion move/ability activation still filters,
  and measured local interactions after load complete within one 60 Hz frame.
- No dependency, external asset, model, migration, importer, generated data, or production behavior
  changes without separately reviewed evidence.
- Backend, Web GUI, Firefox/Chromium, accessibility, performance, integration, documentation, and
  deployment checks pass; reviews have no blocking findings; the report exists; and the deployment
  agent reports the final local commit.

There are no remaining material product questions.
