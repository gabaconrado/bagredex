# Cross-tool form search and selection

## Summary

Make Team Builder, Damage Calculator, and Battle Mode use the Pokédex's reviewed form-family
search behavior. Castform, Aegislash, Gourgeist, and Squawkabilly become one search result per
family with an explicit Form select. Meowstic-Male and Meowstic-Female remain independent search
results, and both become legal Team Builder members backed by the pinned local Pokémon Showdown
snapshot.

This is an ordinary feature cycle opened from feedback during the active
`form-search-sp-popovers` human-review session. Planning may proceed now, but source implementation
must wait until that session is explicitly finished, reviewed, committed, and acknowledged
complete. Its accepted changes currently overlap every implementation scope in this plan, and its
ready-session reload now follows `deploy/pokemon-data.env`; changing that pin beforehand would
silently move the review onto this new feature.

## Goals

- Show one searchable entry, followed by a Form select, for the four families already grouped by
  the Pokédex: Castform, Aegislash, Gourgeist, and Squawkabilly.
- Apply the same grouping and canonical option order in Team Builder, both Damage Calculator
  panels, and Battle Mode opponent selection.
- Keep Meowstic-Male and Meowstic-Female as separate searchable identities and allow either exact
  canonical form to be saved in Team Builder.
- Derive female Meowstic regulation membership transparently from the pinned Showdown family facts
  instead of adding a UI exception or silently editing generated records.
- Switch form-specific sprite, types, stats, abilities, moves, Mega eligibility, and calculation
  facts atomically while retaining only compatible user choices.
- Preserve versioned datasets, retained teams, clauses, local interaction latency, accessibility,
  and rollback to prior immutable releases.

## Non-goals

- Grouping Meowstic, Mega forms, gender choices, regional forms, or any family not already in the
  Pokédex grouped-family contract.
- Changing Species Clause or held-item uniqueness. Male and female Meowstic remain separate search
  and saved form IDs but keep the existing shared base-species clause behavior.
- Making Pokédex detail pages editable, persisting Damage Calculator or Battle Mode opponent state,
  or mutating a saved own-team member from Battle Mode.
- Inferring form families from names, National Pokédex numbers, sprites, or client-side ID lists.
- Adding a live upstream dependency, downloading another snapshot, introducing a manual generated
  data edit, or changing the approved Django/Preact architecture.
- Reloading, retargeting, finishing, or advancing the active `form-search-sp-popovers`
  human-review session as part of this feature.

## User-visible behavior

### Search results

- Team Builder, Damage Calculator, and Battle Mode show exactly one ordinary search result for
  each available Castform, Aegislash, Gourgeist, and Squawkabilly family. Variant names do not
  appear as duplicate results.
- The family labels and Form options match the Pokédex contract and order:

  - Castform: Castform, Rainy, Snowy, Sunny;
  - Aegislash: Shield, Blade;
  - Gourgeist: Average, Large, Small, Super; and
  - Squawkabilly: Green, Blue, White, Yellow.
- A group exposes only canonical options available to that exact retained data version and
  regulation. If the usual base is unavailable, the first available option in the canonical order
  is the search representative. A group with one available option still has one search row but
  does not need a redundant select.
- Meowstic-Male and Meowstic-Female appear as two separate search results. Neither is placed in a
  Form select with the other.
- Search remains keyboard navigable, touch operable, locally filtered, and responsive. Result
  counts count grouped families once and Meowstic sexes twice.

### Form selection

- After a grouped family is chosen, a labeled native Form select appears near the Pokémon identity
  controls in an expanded Team Builder card, each populated Damage Calculator panel, and the
  Battle Mode editor for a user-created opponent.
- Changing the Form select commits one canonical form ID and updates the form name, sprite, types,
  base stats, ability choices, move choices, Mega relation, and calculated output in one render.
  Search text never becomes the persisted identity.
- Team Builder preserves nickname, shiny state, Nature, Stat Points, and a still-legal held item.
  It preserves an ability or move only when the target form supports the same canonical ID, clears
  incompatible choices and their transient autocomplete state, disables an invalid Mega preview,
  and saves the target form ID through the existing authoritative validation path.
- Damage Calculator preserves Nature, Stat Points, stages, status, and field state. It retains an
  ability, item, move, gender, or contextual value only when valid for the target form and resets
  incompatible values through the same defaults used for a fresh selection. Current HP is
  ratio-scaled and clamped to the target maximum; Mega preview is cleared unless the target has the
  selected valid relation.
- Battle Mode own-team members keep their saved exact form and have no form-changing control.
  User-created opponents receive the selector. Switching an opponent preserves battle placement,
  nickname/label, HP percentage, Nature, Stat Points, stages, status, and still-compatible item,
  ability, and moves; it clears incompatible choices, contexts, and Mega state.
- Focus stays on the Form select after a successful change. Any cleared value is visible
  immediately, calculation output does not briefly mix old and new form facts, and an invalid or
  dangling option is rejected rather than partially applied.

### Meowstic legality

- Male and female Meowstic can each be selected and saved in every regulation where the pinned
  Showdown facts establish the legal male family plus the related fixed-female canonical profile.
- Saved and reloaded female members retain `meowsticf`, its own sprite, stats, abilities, learnset,
  and exact female Mega relation. Server validation continues to reject unavailable canonical
  forms and any existing Species Clause or item-clause violation.
- Retained older releases keep their original legality. This feature does not rewrite an existing
  bundle or retroactively change teams pinned to it.

## Decisions and assumptions

- The completed interview is authoritative: Meowstic sexes are two independent search results,
  while only the four existing Pokédex families are grouped.
- Pokémon Showdown remains the sole upstream. The local snapshot already supplies `meowsticf`, its
  fixed female gender, its `baseSpecies` relation, profiles, learnsets, sprites, and Mega relation.
  The importer currently includes those facts as related-form data but deliberately omits female
  membership. The new normalization rule promotes the related fixed-sex form only when the legal
  family representative and every required source relationship agree.
- Membership provenance must distinguish direct Showdown format membership from a derived
  fixed-sex related-form membership. The derived record names its source legal form and resolution
  rule; it is not an overlay and is rejected if Showdown explicitly marks the related form illegal
  or nonstandard.
- Grouping is shared backend domain policy, not a Web-maintained list. Move the existing Pokédex
  definitions and availability helpers into one backend module consumed by Pokédex, Team Builder,
  and Damage Calculator serializers.
- Canonical forms and search entries are separate contracts. Dataset `forms` retain exact facts for
  every selectable canonical ID; a new search-entry collection supplies one default form ID, family
  display name, and optional ordered Form options. This avoids renaming a canonical form merely to
  produce a grouped search label.
- Battle Mode continues to consume the Damage Calculator dataset. Its bootstrap species mapping
  covers every canonical option reachable from a search entry, not only entry representatives.
- Existing base-species clause keys remain authoritative. The user's classification of Meowstic as
  distinct selectable Pokémon does not authorize changing clause rules or allowing both sexes on
  one team when the existing shared base-species key forbids it.
- No new dependency, client state library, endpoint, or network round trip is needed.

## Scope and ownership

### Pokémon data owner

`pokemon_data_coder` exclusively owns:

- `src/data/importer` extraction and normalization for derived fixed-sex related-form membership;
- the next immutable schema/importer release under `src/data/releases`;
- the matching schema and source-shape files under `src/data/schema`;
- deterministic bundle validation, semantic comparison, fixtures, and tests under `src/data`;
  and
- the relevant `src/data/README.md` provenance and normalization documentation.

The data owner must not encode UI grouping. It supplies canonical legality and provenance only.

### Backend owner

`backend_coder` exclusively owns:

- a shared form-family policy module under `src/backend/bagredex/pokemon_data` and migration of the
  existing Pokédex constants/helpers to it;
- bundle allow-list, strict loader, model, migration, admin/service, and retained-release behavior
  for membership provenance under `src/backend/bagredex/pokemon_data`;
- Team Builder dataset and validation changes under `src/backend/bagredex/teams`;
- Damage Calculator dataset changes under `src/backend/bagredex/damage_calculator`;
- Battle Mode bootstrap mapping changes under `src/backend/bagredex/battle_mode`;
- relevant tests under `src/backend/tests`; and
- fixture-generation helpers owned by the backend, if the established test boundary requires them.

The backend owner must not add consumer-specific copies of family IDs or trust a client-submitted
search representative in place of the submitted canonical form ID.

### Web GUI owner

`web_gui_coder` exclusively owns:

- strict bumped contracts and shared form-search utilities under `src/web/src`;
- Team Builder search, form selection, compatible-state transition, and tests under
  `src/web/src/team-builder`;
- Damage Calculator search, both-panel form selection, state transition, and tests under
  `src/web/src/damage-calculator`;
- Battle Mode opponent search, opponent form selection, state transition, and tests under
  `src/web/src/battle-mode`;
- plain CSS for the three islands under `src/web/static/web/css`; and
- focused authenticated browser coverage under `src/web/tests/e2e`.

The Web owner may extract one small shared typed helper/control for search entries and ordered form
options. It must not derive groups from IDs, display names, or base-species equality.

### Deployment and review owners

- `deployment_agent` owns the new local bundle pin in `deploy/pokemon-data.env`, local-only runtime
  validation, final checks, and all local Git mutations. The pin must not change until the prior
  human-review session reaches acknowledged `complete`.
- `pokemon_data_reviewer`, `backend_reviewer`, and `web_gui_reviewer` independently review their
  matching scopes and interfaces without editing.
- `architect` owns cross-scope review, this plan, and the final report
  `docs/reports/2026-11-01-cross-tool-form-selection.md`.

## Data and interface impact

### Normalized release

Create a new immutable release after current schema 6/importer 8. Prefer schema 7/importer 9 because
the membership record gains explicit provenance fields; implementation must use the actual next
available numbers if the completed human-review boundary differs.

Each `regulation_memberships.json` row gains closed fields equivalent to:

```text
form_id, regulation_id, resolution, source_form_id
```

`resolution` is `direct` for an effective legal Showdown formats record and
`related-fixed-sex` only for the deterministic related-form rule. `source_form_id` equals
`form_id` for direct rows and names the directly legal family form for derived rows. Validation
requires referenced profiles and forms, fixed opposite genders, a shared resolved base species,
non-Mega status, source legality, no explicit illegal/nonstandard target marker, one row per
regulation/form, and exact expected provenance. Unknown structures fail closed.

The semantic diff from i8 must contain only the intended membership/provenance changes and any
schema-wide direct provenance fields. It must add `meowsticf` membership in the intended M-A,
M-B, and M-C regulations, retain all prior releases, rebuild deterministically to one release ID,
and document the exact source revisions and normalization rule.

### Shared backend grouping contract

The shared backend form-family module is the only source for ordered group IDs, labels, family
search names, representative selection, and available-option filtering. Pokédex output must remain
byte-semantically equivalent apart from deliberate schema metadata if none is required.

Team Builder and Damage Calculator bump their dataset schemas. Each adds a closed
`pokemon_search_entries` array with records equivalent to:

```text
form_id, name, form_group
```

`form_id` references the default canonical representative. `form_group` is `null` or the same
closed `{label, options: [{id, label}]}` shape already used by the Pokédex. Every option references
one serialized, selectable non-Mega form in that exact version/regulation. Entry form IDs and
ungrouped form IDs are unique; grouped variants cannot also appear as independent entries;
Meowstic records must be two ungrouped entries with exact Male/Female display names.

The existing `forms` arrays remain the canonical lookup collections. Damage Calculator may remove
or retain its old per-form `searchable` boolean only through the bumped strict schema; there must be
one unambiguous search source and no compatibility guessing. Team response and saved-member schemas
remain unchanged because they already persist exact `form_id` values.

Battle Mode bumps its bootstrap schema only if the closed shape changes. Its
`base_species_by_form` keys must equal all non-Mega canonical form IDs reachable through search
entries, including grouped options and both Meowstic forms. Bootstrap and Web parsing reject a
dangling option, omitted mapping, duplicate option, Mega option, or cross-regulation form.

### Persistence and compatibility

- A new female Meowstic save uses the existing team/member transaction, authorization, optimistic
  update, validation, and exact retained data-version pin.
- The backend validates `form_id`, ability, moves, Mega item relation, clauses, and regulation
  membership after a form switch; client filtering remains feedback rather than authority.
- Old loaded data versions keep their old membership and are served only through the dataset schema
  that the updated server deliberately supports. Existing teams remain readable and editable.
- Cache keys and ETags include the bumped schema and immutable data version so a browser cannot mix
  old search entries with new form facts.
- Rollback activates the prior immutable release and deploy pin; no migration deletes membership or
  team records.

## Implementation sequence

1. Do not change source yet. The parent workflow asks the user to finish the active human-review
   session. Complete its reviewer/architect loop, supplemental report, reviewed-result commit,
   completion receipt/report-correction commit, and `human-review complete` acknowledgment first.
2. The Pokémon data owner adds membership-resolution provenance and the fail-closed related
   fixed-sex rule, updates exact inventories/counts and semantic diff tests, generates the new
   immutable release twice, validates it, and reports its exact ID and consumer contract.
3. The Pokémon data reviewer reviews source derivation, provenance, schema, deterministic output,
   exact Meowstic delta, retained releases, and absence of grouping policy. Resolve findings before
   backend retention work proceeds.
4. The backend owner retains the new release, adds the provenance migration/load path, and tests
   atomic loading, activation, old-release defaults, and female Meowstic membership.
5. In the same backend scope, extract the existing Pokédex grouping definitions into the shared
   policy module and prove the Pokédex contract is unchanged.
6. Bump Team Builder and Damage Calculator datasets with strict search entries, then update Battle
   Mode mappings and server-side Team validation tests. Publish exact fixtures/contracts to the Web
   owner.
7. After the backend contract is stable, the Web owner implements strict parsing and one thin
   Team Builder slice: grouped search, selector, compatible-state transition, exact save, reload,
   and malformed-contract failure.
8. Reuse the typed search-entry and selector pattern in both Damage Calculator panels and the
   Battle Mode opponent flow. Do not show an editable selector for an own-team Battle member.
9. Add CSS and component coverage for keyboard, touch, focus, rapid switching, empty/one-option
   groups, responsive layouts, state cleanup, clauses, and two independent Meowstic results.
10. The deployment owner updates the local release pin only after the old human-review session is
    complete, validates the new bundle locally, starts the ordinary Bagredex runtime, applies the
    migration, loads and explicitly activates the release, and runs authenticated end-to-end
    checks without a registry or external service.
11. Dispatch all matching reviewers and the architect. Return every actionable finding to its
    exclusive owner and repeat focused checks and reviews until no blockers remain.
12. The architect writes the report. The deployment owner runs final full checks, creates the
    feature commit, obtains the report correction, creates the narrow correction commit, and proves
    `./bagredex.sh human-review candidate` reports this exact target and feature commit as
    `available`.

Data generation must precede backend retention. Backend contracts must stabilize before Web
implementation. Once the data review is clean, backend work and Web preparation on shared generic
controls may overlap, but Web integration cannot guess the final payload. Runtime and Git work
remain deployment-owned.

## Review and verification

### Pokémon data checks

The data owner runs focused and full `src.data.tests.test_bundle` coverage, exact schema validation,
semantic comparison against i8, two identical importer builds, formatting/lint for importer code,
`.codex/lint.sh`, and `git diff --check`. Evidence must prove:

- only the intended female membership/provenance facts change;
- direct and derived membership provenance is complete and deterministic;
- explicit illegal/nonstandard, mismatched-base, variable-gender, Mega, missing-profile, duplicate,
  and unknown source shapes fail closed;
- female profiles, learnsets, sprites, gender facts, and Mega relations remain source-backed; and
- both the new and retained releases validate without mutation.

`pokemon_data_reviewer` verifies pinned-source evidence, versioning, licenses/provenance, semantic
diffs, rollback, and consumer expectations.

### Backend checks

The backend owner runs all commands through `uv --project src/backend`, including Ruff format and
check, mypy, Django system check, migration drift check, focused Pokémon-data/Pokédex/Team
Builder/Damage Calculator/Battle Mode tests, and the full backend test suite, followed by
`.codex/lint.sh` and `git diff --check`.

Backend evidence must prove exact grouped entry/order/filtering for all four families in each M-A,
M-B, and M-C dataset; two ungrouped searchable Meowstic rows; female create/update/read/retained
team persistence; unchanged Species and item clauses; exact Mega relations; no query-count
regression; malformed/dangling group rejection; Pokédex parity; correct cache/ETag versioning; and
Battle bootstrap coverage for every reachable canonical option.

`backend_reviewer` checks authorization, transactionality, migration compatibility, strict schemas,
canonical-ID validation, query behavior, retained versions, and absence of client-trusted policy.

### Web checks

The Web owner runs `npm run check`, focused Vitest suites for shared contracts and all three
islands, the complete `npm test` suite, `npm run build`, `.codex/lint.sh`, and `git diff --check`.
Authenticated Playwright covers configured light/dark desktop projects, tablet, and the functional
`390 × 844` phone fallback against the locally activated release.

Component and browser evidence must prove:

- one result and the exact ordered selector for every grouped family;
- two independent Meowstic results, female selection/save/reload, and unchanged clause errors;
- immediate canonical sprite/stat/type/ability/move/Mega/calculation changes in Team Builder,
  Damage Calculator, and Battle Mode opponent editing;
- compatible values survive and incompatible values/contexts clear exactly once;
- current HP scaling/clamping and calculation output use only the target form;
- search count, keyboard arrows/Enter/Escape, native select keyboard use, touch targets, focus,
  announcements, rapid switching, themes, and responsive containment remain correct; and
- malformed, stale, or dangling contracts show the established unavailable/error state rather than
  partially rendering.

`web_gui_reviewer` checks DOM ownership, accessible naming/order/focus, local interaction latency,
state integrity, form-specific reset behavior, tablet/phone overflow, themes, and test quality.

### Integration and final validation

The architect confirms one shared group definition feeds all server consumers; the new release,
ORM membership, datasets, Web state, persistence, clauses, sprites, and Mega relations agree on
exact canonical IDs; Pokédex behavior remains the reference; and the previous human-review boundary
was completed separately.

The deployment agent reruns `.codex/lint.sh`, `git diff --check`, full data/backend/Web checks,
bundle validation, migration/load/activation, runtime smoke tests, and available authenticated
Playwright. It uses only already-local images and tools and performs no remote operation.

## Risks

- Treating female Meowstic as a UI exception would allow a selection the server rejects or erase
  provenance. Normalize and validate membership first.
- Treating all same-base forms as legal siblings would admit cosmetic or battle-only forms. Limit
  derivation to the audited fixed-sex related-form rule with explicit negative cases.
- Reusing `forms` as both canonical lookup and grouped search output can rename a form or lose
  variant facts. Keep search entries separate and validate references in both directions.
- A form switch can leave an ability, move, Mega preview, context field, or HP value from the old
  form. Use one pure transition per island and test every dependent field.
- Changing `deploy/pokemon-data.env` while the prior human-review marker is ready would cause its
  controlled reload path to adopt the new release. The lifecycle precondition and deployment-owned
  pin update are hard stops.
- The existing human-review changes touch the same importer, backend datasets, Web islands, deploy
  pin, and tests. Starting implementation before their separate commits would make ownership,
  review evidence, and feature staging inseparable.
- Hiding variants from search can accidentally hide them from clauses or canonical lookup. Search
  visibility must not remove form records or mapping keys.
- Rapid selection can expose mixed old/new state or lose focus. Commit one immutable state update
  and avoid asynchronous per-change fetching.

## Completion criteria

- The prior `form-search-sp-popovers` human-review session is acknowledged complete with its own
  reviewed commits before this feature changes source or the data pin.
- Castform, Aegislash, Gourgeist, and Squawkabilly appear once in each approved search and expose
  the exact available Pokédex-ordered Form options.
- Meowstic-Male and Meowstic-Female appear separately; either exact form can be selected, saved,
  reloaded, calculated, and used as a Battle Mode opponent under the approved regulation facts.
- Female membership is versioned, source-derived, reviewable, deterministic, retained-release safe,
  and enforced authoritatively without a client ID exception.
- Form switching updates all dependent facts atomically, preserves only compatible state, rejects
  stale/dangling inputs, and retains existing clauses and Mega validation.
- Required data, backend, Web, deployment, and browser checks pass; matching reviewers and the
  architect report no unresolved blocking findings.
- The new immutable release remains rollback-safe; no existing release, team, human-review marker,
  remote repository, registry, or operational service is mutated improperly.
- The cycle report names the exact feature commit after the narrow correction commit, and
  `./bagredex.sh human-review candidate` reports this feature boundary as `available` with that
  exact commit.
