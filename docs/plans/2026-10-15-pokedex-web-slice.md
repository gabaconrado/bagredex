# Regulation-aware Pokédex web slice

## Summary

Replace the authenticated placeholder at `/` with the first complete Bagredex Pokédex. Django
renders the application shell and exposes two thin, authenticated JSON read endpoints over the
currently active immutable Pokémon data version. One focused Preact and TypeScript island owns
regulation selection, autocomplete, filters, sorting, selection, sprite controls, and detail
display. All high-frequency interactions operate on regulation data already in the browser.

This cycle consumes the normalized M-C and M-B data delivered by the
[Pokédex data foundation](2026-10-15-pokedex-data-foundation.md). It does not change the importer,
portable bundle, or database schema unless implementation reveals a genuine contract blocker.

## Goals

- Make the authenticated root page the regulation-aware Pokédex, with M-C as the default and M-B
  available through an explicit URL.
- List every form explicitly legal in the selected regulation, including Mega forms as independent
  rows, in National Dex order by default.
- Provide browser-local normalized substring search, grouped suggestions, AND filters, and stat
  sorting without a network request per interaction.
- Provide a selected-form pane with exact normal and shiny sprites, bidirectional base/Mega
  navigation, effective types and abilities, the full validator-legal learnset, exact level-50
  stat ranges, and contextual move or ability details.
- Preserve the existing login redirect, account header, logout behavior, light and dark themes,
  and authenticated-only access to all Pokédex data and sprites.
- Establish reproducible Vite, TypeScript, frontend unit/component, and Playwright workflows that
  fit the existing Django and Podman application.
- Measure regulation payload and first render behavior before introducing virtualization, workers,
  or another state dependency.

## Non-goals

- Team building, damage calculation, journey logging, usage statistics, favorites, or persistent
  Pokédex state.
- Remembering the chosen regulation, filters, sort, selected form, shiny state, or detail selection
  across visits.
- Server-side searching, filtering, sorting, pagination, or a network request for each keystroke.
- Clicking list-row type badges to add filters; types are added only from the search suggestions.
- Context-pruning suggestions based on active filters or preventing filter combinations that yield
  no legal forms.
- Editing or activating Pokémon data, changing the data importer, adding a REST framework or
  OpenAPI, or exposing an unauthenticated data API.
- A full SPA, client-side router, Tailwind, HTMX, Alpine, a component library, or a client state
  library.
- Virtualization or a web worker without measurements demonstrating that the simpler in-browser
  implementation misses the interaction targets.
- Animated sprites or fallbacks between forms, variants, or sprite families.

## User-visible behavior

### Page and regulation selection

- Anonymous requests to `/`, the JSON endpoints, and sprite responses continue to redirect to the
  login page through Django's existing authentication middleware.
- `/` is the M-C Pokédex. `/?regulation=m-c` and `/?regulation=m-b` are the canonical explicit
  regulation choices; an absent parameter means M-C. The header regulation control changes this
  query parameter with an ordinary navigation, so a reload is expected and the URL is shareable.
- Any other or repeated `regulation` value returns an ordinary `400` page rather than silently
  selecting a different ruleset. No selection is written to a cookie, session, or local storage.
- The server-rendered page includes the selected regulation, active data-version identifier, JSON
  endpoint URLs, and an island root. It includes useful loading and JavaScript-unavailable text,
  but the interactive list is owned exclusively by Preact after mounting.
- If no loaded version is active, the authenticated page renders an actionable unavailable state
  and does not mount a broken island. A missing requested M-C or M-B regulation in the active
  version is likewise a clear server-rendered unavailable state.

### List, sorting, search, and filters

- The list contains exactly the selected regulation's `RegulationMembership` forms. Each row shows
  name, ordered type badges, HP, Attack, Defense, Special Attack, Special Defense, Speed, and BST.
  National Dex number controls the default order but is not displayed.
- Only the six stat headings and BST are buttons. Activating a heading cycles ascending,
  descending, then inactive. Only one sort is active. Equal values use National Dex number and
  then canonical form identifier as deterministic ascending tie-breakers. Inactive sorting returns
  to that same default National Dex and identifier order.
- Mega forms remain independent list rows and selecting one shows that exact form.
- One labelled combobox uses case-insensitive, punctuation-insensitive normalized substring
  matching. While it contains text, its popup has separate Pokémon, Moves, Abilities, and Types
  groups; empty groups are omitted and a no-match state is announced.
- Suggestions include only values attached to at least one list-legal form in this regulation.
  Pokémon suggestions select their exact form. Move, ability, and type suggestions add a visible
  filter token and clear the text field. Selecting an already-active filter does not duplicate it.
- Move, ability, and type filters combine with AND semantics across and within categories. The
  available suggestions are not pruned by the active filters. A valid combination may deliberately
  produce an empty list, with a clear empty state and the active filters left intact.
- Each filter token is a labelled button that removes only that filter. A separate clear-all action
  may be present when filters exist. Row type badges are informational and are not controls.
- Up and Down Arrow move through the complete visible suggestion sequence, Enter activates the
  highlighted suggestion, and Escape closes the popup without changing filters or selection.
  Pointer and touch activation provide the same results, focus remains predictable, and combobox
  state is expressed with the appropriate ARIA relationships.
- Filters and sorting never change or clear the selected form, even when it no longer appears in
  the filtered list.

### Selected form and detail pane

- The pane starts empty on every page load and prompts the user to select a Pokémon. The URL does
  not encode the selection.
- Selecting a form loads its regulation-effective detail once, caches it for this page visit, and
  displays the exact form. Rapid selections cannot allow an older response to overwrite a newer
  selection. Loading, request failure, stale-version, and unavailable-form states are explicit.
- The pane shows the exact static 384 by 384 normal sprite. A shiny toggle is always visible and
  switches to the exact shiny asset; neither variant falls back to another form or image.
- A base form with one Mega has a direct Mega control; one with multiple Megas presents an explicit
  labelled choice. A Mega form has a control back to its base and, when applicable, an explicit
  choice of its sibling Megas. Switching through these controls selects and loads the exact target
  form even if it exists only as a toggle-supporting profile rather than a legal list row.
- The pane shows ordered types, slotted abilities, and the complete resolved validator-legal move
  list. Ability and move names are controls. Activating one fills the small information pane at the
  bottom; selecting any other Pokémon or form clears that information pane. Toggling shiny does
  not clear it.
- Ability information includes its effective short and full descriptions. Move information
  includes type, category, base power, accuracy or always-hit status, PP, priority, target, short
  and full descriptions, and every upstream flag identifier. Zero values remain visible and are
  not confused with missing values.
- Each stat shows its base, neutral level-50 real value with zero SP, minimum with zero SP and a
  hindering nature, and maximum with 32 SP and an increasing nature. HP has no nature modifier:
  base and zero SP plus 75 for real and minimum, and base plus 32 SP plus 75 for maximum. Every
  other value applies integer truncation after multiplying `base + SP + 20` by 90, 100, or 110
  percent. Labels explain the SP and nature assumptions.

### Layout, accessibility, and states

- Desktop uses a list/detail split with the search and active filters associated with the list.
  Tablet retains both usable regions without horizontal page scrolling. On phones the detail pane
  follows the list and all information remains reachable.
- The existing Indigo Purple token family extends to type badges, selected rows, active sort,
  filter tokens, and focus states in both light and dark color schemes. Controls have touch-sized
  targets, visible focus, semantic labels, and sufficient contrast.
- Result counts, filtering changes, selection loading, errors, and empty states are announced
  without moving focus unexpectedly. Reduced-motion preferences are honored.

## Decisions and assumptions

- The active release currently contains both canonical regulation identifiers `m-c` and `m-b`.
  URL slugs are an explicit allow-list and map one-to-one to those identifiers; database names or
  arbitrary query expressions never enter ORM lookups unchecked.
- A request resolves `ActiveDataVersion` once and constrains every related query to that immutable
  version and selected regulation. It never mixes records from two versions during serialization.
- The root response embeds only small bootstrap configuration, not the full data set. The island
  fetches one regulation index after mounting. Detailed descriptions, move metadata, Mega
  relationships, and sprite URLs are fetched only after form selection.
- The regulation index contains the information required for all high-frequency local operations:
  legal form rows with ordered type, ability, and legal-move identifiers; display names for every
  attached move, ability, and type; stats; and deterministic source order. It does not duplicate
  descriptions or full move metadata.
- A form-detail response may include a regulation profile without a membership so base/Mega
  controls remain complete. Direct selection through the list or Pokémon search remains limited to
  legal memberships.
- Search normalization follows Showdown-style identifiers for matching: Unicode text is normalized
  consistently, case-folded, and stripped to ASCII letters and digits. The visible label remains
  unchanged. Matching checks whether the normalized query is a substring of the normalized name;
  an empty normalized query closes suggestions rather than matching everything.
- Suggestion ordering is deterministic: Pokémon by National Dex and canonical form identifier;
  moves, abilities, and types by case-folded display name and canonical identifier. Active filters
  may remain in the suggestions, but selecting one is idempotent.
- The existing exact arithmetic helper in `pokemon_data.stats` is the authoritative backend
  implementation. The API sends all derived display values so the browser does not independently
  reproduce game rounding policy.
- Sprite files stay in their immutable committed release paths. An authenticated Django endpoint
  resolves a database-declared sprite path beneath the configured release root, rejects traversal
  or missing files, and returns the WebP with a version-specific private immutable cache header.
  Serving these small personal-application assets through Django avoids duplicating generated
  files or exposing the complete release through static-file discovery. Deployment changes are not
  expected unless measurement demonstrates this approach is unsuitable.
- Index and detail JSON responses are authenticated and contain no user-specific data. They use
  `Cache-Control: private, no-cache`, a strong ETag derived from the active version, regulation,
  endpoint schema, and requested form where applicable, and support `If-None-Match` with `304`.
- The page supplies its expected active-version identifier on every JSON request. If activation
  changes between page render and a request, the endpoint returns `409` with a stable
  `data-version-changed` code, the new version identifier, and the canonical page URL. The island
  shows a reload action and does not combine the stale page state with new data. A form absent from
  the same active regulation returns `404`; malformed values return `400`; missing active data
  returns `503`.
- JSON is serialized in deterministic order with an explicit `schema_version` so backend and Web
  GUI tests share a reviewed contract. Runtime responses always use the current active database
  version; activating a retained version naturally affects subsequent page and data requests
  without rebuilding frontend assets.
- Preact, TypeScript, and Vite are required by the selected architecture. The user explicitly
  authorizes agents to contact the package registry and install required dependencies locally
  within `src/web` for this feature. This authorization covers the runtime packages `preact` and
  only the development packages needed for Vite's Preact integration, TypeScript, formatting,
  linting, Vitest, DOM component tests, and Playwright. Prefer platform capabilities and one tool
  per responsibility; adding a component library, state library, transport library, utility CSS
  framework, or unrelated package still requires evidence and plan approval.
- Every direct package uses an intentional reviewed version range and the package manager commits
  its exact lockfile, including transitive integrity hashes. Clean installation from that lockfile
  must be non-interactive and reproducible, and dependency/license audit output and the direct and
  transitive package-count change are recorded for review. Registry access is limited to resolving
  and downloading this declared project-local dependency graph. Global host-tool installation,
  unrelated registry or cloud access, lifecycle-script workarounds, disabled integrity or TLS
  checks, and weakened security or tooling remain prohibited. A missing browser executable may be
  reported; downloading a browser from a non-registry distribution service is not implied by this
  authorization.
- Initial performance evidence records compressed and uncompressed index size, database query
  count, server serialization time, island bundle size, initial render time, and filter/sort time
  against M-C, the larger regulation. The first implementation uses ordinary Preact rendering;
  virtualization or workers require a measured follow-up plan.

## Scope and ownership

### Backend coder

Own only `src/backend`:

- Add a Pokédex application service or selector layer under `bagredex` that resolves one active
  version/regulation snapshot, performs bounded prefetches, applies exact stat arithmetic, and
  serializes the contracts below without embedding policy in views.
- Replace the root placeholder view context with validated regulation/bootstrap configuration and
  unavailable-state handling while preserving `GET`-only and authentication behavior.
- Add authenticated `GET`-only regulation-index, form-detail, and sprite views and routes. Use
  Django `JsonResponse`, conditional response support, safe file responses, and explicit boundary
  validation; do not add DRF or OpenAPI.
- Add backend tests for contracts, authorization, methods, invalid inputs, active-version changes,
  no-active-data behavior, M-C/M-B scoping, legal versus toggle-only forms, complete Mega choices,
  sprite variants and path safety, conditional requests, exact stat values, deterministic order,
  and bounded query counts.
- Change no model, migration, importer, or bundle file unless a demonstrated blocker is returned to
  the architect and approved before work continues.

### Web GUI coder

Own only `src/web`:

- Replace `templates/home.html` with the accessible server-rendered shell and unavailable/no-script
  states; extend `base.html` only for feature-bundle and small bootstrap hooks that remain reusable.
- Add the focused Pokédex Preact/TypeScript island, reducer, typed transport boundary, search
  normalization, local filter/sort selectors, stale-request protection, and detail cache.
- Add Vite and TypeScript configuration, minimal package metadata and exact lockfile, a
  Django-consumable Vite manifest, and feature-split output under the existing Web GUI tree.
  Generated output policy must be explicit: production builds consume the manifest and hashed
  assets; editable source remains authoritative.
- Extend plain CSS tokens and responsive styles for desktop, tablet, phone, light/dark schemes,
  focus, touch, loading, empty, error, status, and reduced-motion states.
- Add reducer and selector unit tests, component tests for combobox/filter/sort/detail behavior, and
  Playwright coverage for the critical authenticated flows using deterministic local data.
- Do not edit backend routes, serializers, data files, deployment files, or another owner's tests.

### Deployment agent

Own only `deploy/**`, deployment-facing root scripts or documentation, final local validation, and
local Git mutation. Work is conditional on the agreed frontend build not already fitting the image:

- Add a reproducible frontend build stage and copy only its hashed output and manifest into static
  collection. Dependency installation must use the committed exact lockfile; after the authorized
  project-local dependency fetch, the existing offline image validation remains reproducible.
- Ensure development serves rebuilt assets and production Nginx serves collected hashed frontend
  assets while authenticated sprite responses continue through Django.
- Extend container and shell tests for the manifest/assets and run the complete final checks.
- Do not change application behavior or duplicate sprite assets unless the architect approves a
  demonstrated packaging requirement.

### Architect

Own this plan, cross-scope contract resolution, integration review, any focused task deferral under
`docs/tasks`, and the final report under `docs/reports`. The architect does not implement backend,
frontend, data, or deployment code.

Backend and Web GUI implementation can proceed in parallel only after both owners accept the JSON
contract below. Deployment work follows the Web GUI build contract. No owner may edit another
scope to make an interface mismatch disappear.

## Data and interface impact

### Page bootstrap

The root template places one JSON-safe bootstrap object in a Django `json_script` element and gives
the Preact root no child nodes that Django later mutates:

```json
{
  "schema_version": "pokedex-bootstrap-v1",
  "active_version": "showdown-...",
  "regulation": {"id": "m-c", "name": "VGC 2026 Regulation M-C"},
  "regulations": [
    {"id": "m-c", "name": "VGC 2026 Regulation M-C", "url": "/?regulation=m-c"},
    {"id": "m-b", "name": "VGC 2026 Regulation M-B", "url": "/?regulation=m-b"}
  ],
  "index_url": "/pokedex/data/m-c/index/?version=showdown-...",
  "detail_url_template":
    "/pokedex/data/m-c/pokemon/__FORM__/details/?version=showdown-..."
}
```

Values are generated with Django URL reversing and JSON escaping, never string-concatenated into
executable JavaScript. The selected regulation appears first only if the UI needs that ordering;
the canonical regulation order is M-C then M-B.

### Regulation index endpoint

`GET /pokedex/data/<regulation>/index/?version=<expected-version>` returns
`application/json` with this logical `pokedex-index-v1` contract:

```json
{
  "schema_version": "pokedex-index-v1",
  "data_version": "showdown-...",
  "regulation": {"id": "m-c", "name": "VGC 2026 Regulation M-C"},
  "forms": [
    {
      "id": "charizardmegax",
      "name": "Charizard-Mega-X",
      "national_dex_number": 6,
      "is_mega": true,
      "types": [{"id": "fire", "name": "Fire"}, {"id": "dragon", "name": "Dragon"}],
      "stats": {"hp": 78, "atk": 130, "def": 111, "spa": 130, "spd": 85, "spe": 100},
      "bst": 634,
      "ability_ids": ["toughclaws"],
      "move_ids": ["acrobatics", "airslash"]
    }
  ],
  "moves": [{"id": "acrobatics", "name": "Acrobatics"}],
  "abilities": [{"id": "toughclaws", "name": "Tough Claws"}],
  "types": [{"id": "dragon", "name": "Dragon"}]
}
```

- `forms` includes memberships only and is ordered by National Dex then form identifier.
- Each form's types preserve profile position; ability identifiers preserve slot order; move
  identifiers are sorted by display name then identifier.
- Lookup arrays contain the distinct values referenced by at least one returned form and use the
  deterministic suggestion ordering. They contain no unattached global values.
- The browser builds identifier maps and normalized labels once after validation. Unknown keys may
  be ignored for forward compatibility; a schema-version mismatch is a visible error.

### Form-detail endpoint

`GET /pokedex/data/<regulation>/pokemon/<form>/details/?version=<expected-version>` returns the
logical `pokedex-form-detail-v1` contract:

```json
{
  "schema_version": "pokedex-form-detail-v1",
  "data_version": "showdown-...",
  "regulation_id": "m-c",
  "form": {
    "id": "charizardmegax",
    "name": "Charizard-Mega-X",
    "is_list_legal": true,
    "is_mega": true,
    "types": [{"id": "fire", "name": "Fire"}, {"id": "dragon", "name": "Dragon"}],
    "sprites": {
      "normal": "/pokedex/sprites/showdown-.../charizardmegax/normal.webp",
      "shiny": "/pokedex/sprites/showdown-.../charizardmegax/shiny.webp"
    },
    "form_switches": {
      "base": {"id": "charizard", "name": "Charizard"},
      "megas": [
        {"id": "charizardmegax", "name": "Charizard-Mega-X"},
        {"id": "charizardmegay", "name": "Charizard-Mega-Y"}
      ]
    },
    "stats": [
      {"id": "hp", "name": "HP", "base": 78, "real": 153, "minimum": 153,
       "maximum": 185}
    ],
    "abilities": [
      {"id": "toughclaws", "name": "Tough Claws", "slot": "0",
       "short_description": "...", "description": "..."}
    ],
    "moves": [
      {"id": "acrobatics", "name": "Acrobatics", "type": {"id": "flying", "name": "Flying"},
       "category": "Physical", "base_power": 55, "accuracy": 100, "always_hits": false,
       "pp": 15, "priority": 0, "target": "normal", "short_description": "...",
       "description": "...", "flags": ["contact", "protect", "mirror"]}
    ]
  }
}
```

- Stat entries always use HP, Attack, Defense, Special Attack, Special Defense, Speed order and are
  computed with the regulation's mechanics profile through the existing exact helper.
- Ability order preserves Showdown slot order. Move order is display name then canonical identifier;
  flags are canonical identifiers in ascending order.
- `accuracy` is `null` only when `always_hits` is true. Values are transported without UI-specific
  replacement strings.
- `form_switches.base` names the exact base, including the current form when it is already base;
  `megas` contains every regulation-profiled Mega relation in canonical form order. The UI derives
  which direct button or choice is appropriate from these values.

### Sprite endpoint

`GET /pokedex/sprites/<version>/<form>/<variant>.webp` accepts only the exact active or retained
immutable version identifier, canonical form identifier, and `normal` or `shiny`. The requested
database `Sprite` row supplies the declared relative path. The implementation resolves and checks
that path beneath the configured release root before opening it, verifies the file exists, and
returns `image/webp`, `X-Content-Type-Options: nosniff`, and a private immutable cache policy. It
never accepts a caller-supplied filesystem path and never guesses a fallback.

### Persistence and compatibility

- No database migration or bundle revision is planned. Existing indexes cover membership scans,
  stat access, and reverse type/ability/move relationships; query-count tests determine whether
  serialization needs query-shape optimization, not speculative schema changes.
- Existing active-version activation remains the only cache invalidation signal. Versioned ETags,
  expected-version checks, and immutable sprite URLs prevent records from different versions being
  combined.
- The login `next=/` flow, `LOGIN_REDIRECT_URL`, logout form, health endpoints, and admin routes
  remain unchanged. Existing home request tests are extended rather than replaced with weaker
  assertions.

## Implementation sequence

1. The backend and Web GUI owners review and acknowledge the bootstrap, index, detail, error, and
   sprite contracts. The architect resolves differences before either side invents a variant.
2. In parallel:
   - the backend owner implements the selector/serializer boundary, page context, authenticated
     routes, safe sprite response, ETags, errors, query-count bounds, and request/domain tests;
   - the Web GUI owner establishes the Vite/TypeScript/test skeleton, typed transport contract,
     reducer and pure selectors, page shell, and base responsive tokens against contract fixtures.
3. The Web GUI owner connects the real endpoints and completes regulation navigation, loading,
   autocomplete, AND filters, sort cycling, list selection, abort/stale response handling, detail
   caching, sprites, form switches, stats, ability/move detail, and all deliberate UI states.
4. The Web GUI owner measures the M-C index and render/filter paths. Keep ordinary rendering unless
   evidence shows disrupted typing or unacceptably slow updates; return any complexity proposal to
   the architect rather than adding it opportunistically.
5. If production or development cannot consume the Vite manifest and hashed assets using the
   current image, the deployment agent adds the smallest reproducible build/package integration
   and its tests. No deployment edit is required solely for Django-served sprites.
6. The backend reviewer reviews `src/backend`; the Web GUI reviewer reviews `src/web`; the
   architect reviews the complete integration, contract consistency, authentication, ownership,
   end-to-end verification, and documentation. Each actionable finding returns to its owner and
   review repeats until no blockers remain.
7. The architect records only safely separable deferrals, writes the cycle report, and confirms it
   is included in the pending cycle commit.
8. The deployment agent runs final checks, stages only reviewed cycle files, and creates one or
   more justified local commits. No remote operation is performed.

## Review and verification

### Backend checks

- Request tests cover anonymous redirects and authenticated success for root, index, detail, and
  sprite routes; `GET`-only behavior; query validation; no active version; absent regulation;
  missing form or sprite; safe path containment; and response content types and cache headers.
- Contract tests validate exact key/type semantics, deterministic ordering, legal-membership-only
  indexes, attached-only lookups, full AND-filter inputs, toggle-only detail access, all Mega
  choices, ordered types and abilities, complete learnsets and flags, normal/shiny URLs, zero move
  values, always-hit accuracy, and exact stat golden cases including truncation.
- Activation-race tests render or fetch with version A, activate version B, and prove a subsequent
  request expecting A returns the stable `409` response rather than mixed content. ETag tests cover
  `200`, matching `304`, and version changes.
- Query-count assertions use both regulations and representative high-learnset and multi-Mega forms.
  Index and detail query counts must remain bounded independently of row count; reviewers record
  the observed bounds rather than accepting hidden per-row growth.
- Run backend formatting, lint, strict typing, Django system checks, migration drift checks, focused
  tests, and the complete PostgreSQL suite through the repository's existing uv/Podman paths.

### Web GUI checks

- Reducer and selector tests cover normalized substring matching, deterministic group ordering,
  idempotent filters, same-category and cross-category AND semantics, zero results, non-pruned
  choices, single active sort and three-state cycling, tie-breakers, and selection independence.
- Component tests cover combobox ARIA behavior and keyboard sequence, touch/pointer equivalence,
  token removal, loading/error/stale/empty states, out-of-order detail responses, detail caching,
  shiny state, base/single-Mega/multiple-Mega navigation, pane clearing rules, and complete move and
  ability information.
- Playwright covers login-to-root compatibility and critical flows in M-C and M-B: regulation URL
  reload, keyboard Pokémon selection, move/ability/type AND filters including zero results, sort
  cycle, Mega selection in both directions, shiny toggle, and detail pane replacement. Tests include
  desktop, representative tablet, and phone viewports and exercise light/dark and reduced-motion
  preferences.
- Accessibility review includes semantic table/list behavior at narrow widths, labels, focus order,
  visible focus, live status announcements, popup ownership, escape behavior, contrast, touch
  targets, zoom/reflow, and no keyboard trap.
- Record M-C raw and transferred index size, feature bundle size, initial rows-to-visible time, and
  representative search/filter/sort duration. Acceptance targets are no network request during
  these interactions, ordinary control feedback within one animation frame, and typing that remains
  responsive. Measurements outside those targets require diagnosis and an approved adjustment.
- Run frontend format/lint/type checks, unit/component tests, production Vite build, manifest
  validation, dependency and license audits, and Playwright with the locally supported browser. Do
  not claim a browser check if its executable is unavailable, and do not broaden the package-registry
  authorization to fetch a browser from another service.

### Integration and final checks

- Run `.codex/lint.sh`, `git diff --check`, backend checks and tests, frontend checks and tests, and
  any affected deployment Bats and offline image checks.
- Smoke-test an authenticated local stack loaded with the committed data release. Confirm the root
  shell, both regulation URLs, representative list counts, search groups, combined filters, every
  pane state, exact sprites, multi-Mega choices, stale-version recovery, and responsive layouts.
- Inspect the production image or collected-static output for the Vite manifest and every referenced
  hashed asset. Confirm no source references repository, package cache, development server, or
  unbuilt frontend source is required at runtime.
- Reviewers report concrete defects first. Completion requires no blocking backend, Web GUI, data
  contract, deployment, accessibility, or integration findings.

## Risks

- Sending every legal move identifier for each form creates a larger index response. Separating
  descriptions into detail responses, compression, deterministic compact JSON, and measurement
  limit the cost without sacrificing local AND filtering. Split indexes or workers require evidence.
- A form may be a toggle target without list membership. Conflating profiles with memberships would
  expose illegal search rows or break Mega navigation; contract and tests explicitly distinguish
  them.
- The page can outlive an activation. Expected-version checks and `409` handling prevent silent
  cross-version state, while immutable versioned sprite URLs remain safe to cache.
- Large learnsets can cause hidden ORM query growth or slow detail rendering. Bounded-query tests,
  prefetched relations, deterministic serializers, and representative measurements address this.
- Vite introduces the repository's first Node dependency graph and production asset build. A
  minimal reviewed direct dependency set, exact integrity-bearing lockfile, clean locked install,
  dependency/license audit, manifest contract, offline-capable packaging, and deployment validation
  control its supply-chain and reproducibility risk. Project-local packages may be downloaded from
  the package registry under the user's explicit authorization; global tools, unrelated packages,
  and browser downloads from other services are outside it.
- Serving sprites through Django adds application traffic. The assets are small, versioned, and
  privately immutable, which is acceptable for this personal application; measured pressure can
  justify a later authenticated internal-redirect or static packaging design.
- Dense stat columns and complete move lists can overflow smaller screens. Responsive semantics,
  reflow tests, and a detail-below-list phone layout are completion requirements, not optional polish.

## Completion criteria

- The authenticated root page is the usable Pokédex and preserves the existing login, account,
  logout, health, and admin behavior.
- M-C defaults correctly; M-C and M-B explicit URLs render data from one currently active immutable
  version; invalid, unavailable, and stale-version states are deliberate and tested.
- Every legal exact form, including independent Megas, appears with correct types and base stats;
  default and three-state stat sorting follow the specified deterministic order.
- Grouped normalized search, keyboard/touch interaction, visible removable move/ability/type
  filters, AND semantics, non-pruned choices, and zero-result combinations work entirely locally.
- Selection independence, exact normal/shiny sprites, bidirectional single/multiple Mega controls,
  full types/abilities/learnsets, exact stat values, and clearing/replacing the information pane
  match the approved behavior.
- Desktop, tablet, phone, light/dark, reduced-motion, loading, empty, error, unavailable, stale, and
  no-JavaScript states are functional and accessible.
- Backend endpoint contracts, authentication, version consistency, safe sprite access, deterministic
  serialization, and bounded query counts pass review and automated tests without schema changes.
- Frontend unit/component tests, critical Playwright flows where the local browser is available,
  production Vite build, payload/render measurements, complete backend suite, documentation lint,
  diff checks, and affected deployment checks pass with observed results recorded in the report.
- Backend, Web GUI, deployment when affected, and integration reviews have no blocking findings;
  the cycle report exists; and the deployment agent reports the final local commit or commits.

There are no remaining material product questions.
