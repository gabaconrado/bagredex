# Pokédex polish and regulation legality

## Summary

Correct the general Showdown regulation-membership rule so any form with a meaningful
`isNonstandard` value is excluded, regenerate and explicitly activate a new immutable canonical
bundle, and refine the selected Pokémon controls, detail tables, and search focus presentation.

The data correction precedes backend and browser acceptance because it changes the canonical
membership set and all derived counts. The Web refinements remain presentation-only and can begin
in parallel once the data/runtime interface below is fixed.

## Goals

- Exclude every form whose Showdown formats entry has a non-null, non-`false` `isNonstandard`
  marker from every regulation membership.
- Remove `Magearna-Mega` and `Magearna-Original-Mega` from the M-C and M-B Pokédex lists without a
  species-specific exception.
- Regenerate a deterministic immutable release from the existing pinned local Showdown, PokeAPI,
  and sprite snapshots; update exact generated counts, hashes, goldens, and backend pins.
- Preserve the preceding release and database version for explicit rollback.
- Make an inactive Shiny toggle use exactly the same button background and border treatment as an
  inactive Mega toggle while keeping its white glyph visible in both themes.
- Change the locally packaged Status icon's black portion to the accepted Special pale blue
  `#B7D9EB`, retain the white portion sensibly, and record the Bagredex adjustment.
- Center all Stats table content and all Moves table content in the selected Pokémon pane.
- Rebalance the Moves table so `Power` is fully visible with its reserved sort arrow at every
  supported viewport.
- Remove the duplicated-looking search-field bottom strip while preserving a clear focus indicator
  and correctly layered suggestions.

## Non-goals

- Encoding Magearna identifiers, `Future`, or any other individual nonstandard category as a
  one-off override.
- Changing Showdown source data, using a network/upstream request, moving to a new upstream commit,
  or changing the sole-source data policy.
- Treating `isNonstandard` as a display hint while still admitting the form to membership.
- Deleting or rewriting the preceding immutable release or automatically purging its loaded
  database version, sprites, or activation history.
- Forcing orphaned Magearna forms/profiles/sprites to remain if the established dependency closure
  no longer needs them; conversely, membership must stay separate if a retained form is needed for
  a valid base↔Mega relation.
- Changing bundle schema version, normalized relation shapes, database schema, migrations, API
  fields, regulation URLs, stat formulas, learnset semantics, or sprite encoding unless
  regeneration proves a genuine blocker.
- Changing move/stat values, sort keys, cycles, stable ties, modals, row selection, filters,
  authentication, or cross-visit state.
- Recoloring the Special asset or replacing the Status design. Only the reviewed Status black
  portion changes to the accepted pale blue.
- Adding a dependency, package, framework, state library, external asset, or runtime service.

## User-visible behavior

### Regulation legality

- M-C and M-B no longer list `Magearna-Mega` or `Magearna-Original-Mega` in initial results, search
  Pokémon suggestions, filtered results, counts, or selectable rows.
- The membership rule is generic: a formats entry is eligible only when its tier is not `Illegal`
  and `isNonstandard` is absent, `null`, or exactly `false`. Any string or other meaningful value,
  including `Future`, `Past`, `LGPE`, or an unknown future category, excludes it by default.
- Nonstandard forms may exist as normalized profiles only when the existing relation closure needs
  them for a legal selectable form. Presence in `forms.json`, profiles, sprites, or a base/Mega
  relation never implies regulation membership.
- Regulation counts and payload ETags reflect the newly activated data version. Existing explicit
  M-C/M-B URLs and reload behavior remain unchanged.

### Selected-form controls and icons

- When inactive, the Shiny button has the same computed background, border color, border width,
  border style, radius, and shadow treatment as an inactive Mega button. It does not retain a
  Shiny-specific button surface.
- The Shiny stars remain white. A glyph-local outline, shadow, or backing may provide contrast on
  the shared inactive surface without changing the button's background or border. The generic
  active treatment remains visually distinct and continues to represent `aria-pressed="true"`.
- Shiny and Mega controls retain their fixed sprite-frame position, 44-pixel target, title,
  accessible action name, focus indicator, plain/X/Y/Z presentation, and base↔Mega behavior.
- Status move rows retain the supplied yin/yang-like design and white portion, while every formerly
  black fill/stroke in the packaged asset uses `#B7D9EB`. The adjusted icon stays distinct from
  Special by geometry and retains accessible `Status` text outside the decorative image.

### Detail Stats and Moves tables

- Every Stats header and value is centered within its grid track, including `Stat`, each stat name,
  `Base`, `Real`, `Min`, and `Max`. Numeric tabular alignment and row geometry remain stable.
- Every Moves header and row value is centered within its track: Name, Type, Category, Power, move
  name, type badge group, category icon, numeric power, and the Status em dash.
- The Name, Type, Category, and Power tracks are modestly tightened and rebalanced for the selected
  pane. `Power` is fully visible, never `P…`, and its label plus reserved inactive/active arrow stays
  contained and centered.
- Move names remain readable on one line; if a narrow fallback requires ellipsis, the full name is
  retained in the modal action's accessible name and a hover title. Type badges and category icons
  never overlap adjacent tracks.
- Type, Category, and Power keep ascending→descending→inactive, one-active-sort semantics,
  existing canonical ordering, deterministic ties, and one-frame browser-local response.

### Search field

- The search input has one clean bottom border at rest. Focus adds one deliberate accessible focus
  treatment without the current inset bottom bar shown in
  `references/screenshots/Screenshot 2026-10-16 131051.png`.
- The focus indicator remains visible in light and dark themes, keyboard and pointer focus do not
  change input/search/table geometry beyond the existing one-pixel tolerance, and reduced motion
  remains safe.
- The suggestion list continues to layer above the table, align with the input, avoid covering its
  focus edge, preserve the current combobox relationships, and support Arrow keys, Enter, Escape,
  pointer, and touch.

## Decisions and assumptions

### Legality policy and observed snapshot

- `isNonstandard` is an exclusion boundary, not a known-string allow/deny list. The importer should
  use an explicit helper equivalent to “standard only when `undefined`, `null`, or `false`” rather
  than truthiness that might accidentally accept an empty or unexpected marker.
- `tier === "Illegal"` remains an independent exclusion. Tests cover the Cartesian cases: legal
  tier plus absent/null/false marker is admitted; `Illegal` is excluded; every nonstandard marker
  is excluded regardless of tier.
- A read-only audit of the pinned local Champions and Champions Reg M-B formats found that the only
  current `Future` entries admitted by the old predicate are `magearnamega` and
  `magearnaoriginalmega`, in both regulations. Existing `Past` entries are already excluded. The
  semantic diff must confirm there is no third current membership removal.
- The primary expected membership delta is exactly four relations: two removals from M-C and the
  same two from M-B, yielding 349 M-C and 314 M-B legal forms from the current 351 and 316.
- Current selection closure begins with legal memberships and retains related base/Mega forms only
  as needed. Because Magearna itself is not a legal membership, regeneration is expected to remove
  Magearna, both Mega forms, their profiles, relations, sprite mappings/assets, and unused effective
  metadata. Those downstream count changes are evidence to inspect, not values to guess in code.
- The data owner must run the generated semantic comparison and enumerate every changed file/key.
  Any membership change beyond the four expected relations, or an unrelated changed field/value,
  is a blocker requiring diagnosis before backend pins or deployment are updated.

### Immutable release and runtime

- The pinned source revisions, schema version `1`, and importer version `1` remain unchanged unless
  the implementation establishes that changing importer semantics requires incrementing the
  importer version under the existing bundle-ID contract. The data reviewer decides this from
  current versioning rules; it must not reuse an existing bundle identifier for different bytes.
- Regeneration creates a new content-addressed directory under `src/data/releases`. The existing
  `showdown-3a766f2c-s1-i1-923ba416555c` directory remains byte-for-byte available.
- The new manifest and validation files are authoritative for all exact totals: forms,
  memberships, profiles, identities, effective metadata, flags, learnsets, Mega relations, sprite
  mappings, and sprites, including all grouped provenance/resolution counts.
- `deploy/pokemon-data.env` changes to the reviewed new bundle identifier only after data and
  backend readers agree. Loading is atomic and idempotent; activation remains an explicit separate
  operation. Existing databases are not rewritten in place.
- Rollback reactivates the retained preceding data version and restores the preceding deployment
  pin; no schema rollback is needed.

### Web presentation

- Inactive Shiny equality is tested using computed button styles against an adjacent inactive Mega
  control in the same theme. White-glyph contrast is solved inside the icon rendering, not by
  overriding `.icon-toggle--shiny` button background/border properties.
- The Status source in `references/icons/status-move.svg` remains the user-supplied provenance
  input. `src/web/ASSET_PROVENANCE.md` records its original SHA-256
  `8cc0aec5fe120ab7c21034cbe84e8f18f5349dcba7453c25c1313cb57381e331`,
  describes the exact Bagredex substitution from `#000000` to `#B7D9EB`, and records the resulting
  packaged SHA-256. This is a transparent local adjustment, not a third-party source claim.
- Status SVG tests assert the accepted pale blue is present, black color declarations are absent,
  the white portion remains, active/external SVG content is absent, and no `Zone.Identifier` is
  packaged. The other four reviewed asset fingerprints remain unchanged.
- Stats centering can remain CSS-only. Moves retain the current semantic ARIA table and full-row
  modal button; column rebalancing must not introduce nested controls or make decorative icons
  accessible twice.
- The clean search focus treatment removes the inset bottom `box-shadow` (or its actual diagnosed
  equivalent) and retains a contained/outer outline whose stacking is explicitly tested with the
  suggestions and table border.

## Scope and ownership

### Pokémon data coder

Own importer, data tests, and generated artifacts under `src/data`:

- Replace the `legalIDs` policy in `src/data/importer/extract.mjs` with a named, general standard-
  entry predicate and use it consistently for selected-form roots and regulation memberships.
- Extend `src/data/tests/test_bundle.py` with synthetic marker/tier truth-table coverage, explicit
  M-C/M-B absence for both Magearna Mega identifiers, the audited current Future set, deterministic
  extraction, expected membership totals, relation/profile retention rules, and exact regenerated
  counts.
- Update pinned counts and grouped goldens in `src/data/importer/bundle.py` only from the observed
  validated rebuild, not hand estimates.
- Build a new immutable release under `src/data/releases`, validate it, compare it with the retained
  release, and review every semantic change. Do not edit canonical JSON or sprite records manually.
- Update `src/data/README.md` only if the general legality invariant or versioning/build behavior
  needs durable consumer documentation. Do not edit backend, Web, or deploy files.

### Data reviewer

Review `src/data` read-only for the generic fail-closed legality predicate, local-source provenance,
determinism, exact Future audit, relation closure, generated counts/hashes, complete semantic diff,
old-release retention, and absence of manual artifact edits. Confirm the diff has the four expected
membership removals and only justified dependent removals.

### Backend coder

Own `src/backend` after the data owner publishes the reviewed manifest/count evidence:

- Update `EXPECTED_PINNED_COUNTS`, grouped regulation/learnset/provenance count expectations, and
  committed-release tests in `bagredex/pokemon_data/bundles.py` and
  `tests/test_pokemon_data.py` to the exact generated release.
- Add request/domain regressions proving both Magearna Mega forms are absent from M-C and M-B index
  responses after the new bundle is loaded and activated, while valid forms, explicit regulation
  scoping, detail contracts, ETags/versioning, and stale-version behavior remain correct.
- Record unchanged or improved query bounds and response-contract validity. No model or migration
  change is expected; stop and return to the architect if generated evidence contradicts that.
- Do not edit `src/data`, `src/web`, or deployment files.

### Backend reviewer

Review `src/backend` read-only for exact agreement with the reviewed bundle, membership-versus-
profile semantics, request correctness, immutable version loading/activation/rollback, cache/ETag
behavior, and query bounds. Reject copied estimates or schema changes without evidence.

### Web GUI coder

Own implementation and tests under `src/web`:

- Update `src/web/static/web/css/pokedex.css` for inactive Shiny equality, glyph-local white
  contrast, centered Stats and Moves content, rebalanced Moves tracks, full Power label, and one
  clean search border/focus treatment with correct overlay stacking.
- Update `src/web/src/app.tsx` only for required move-name title/centering hooks; preserve semantic
  roles, modal action, sorting, and combobox behavior.
- Adjust `src/web/src/assets/pokedex-icons/status-move.svg` only by the approved black-to-pale-blue
  color substitution. Update `src/web/ASSET_PROVENANCE.md`, `src/web/src/assets.test.ts`, component
  tests, and `src/web/tests/e2e/pokedex.spec.ts`.
- Do not edit data, backend, deploy, package, lockfile, Vite configuration, reference input, or
  generated Vite output.

### Web GUI reviewer

Review `src/web` read-only for exact inactive-toggle equality, white-glyph/theme contrast, transparent
Status adjustment provenance, Stats/Moves centering and containment, complete Power header, move
sort behavior, search focus/overlay accessibility, responsive geometry, and regression evidence.

### Architect

Own this plan, the cross-scope interface and final integration review, and the completed cycle
report. Verify data, backend, Web, and deployment evidence refer to the same generated bundle and
that no unresolved question is hidden in regenerated counts.

### Deployment agent

Own `deploy/pokemon-data.env`, deployment tests whose exact bundle pin changes, final local Podman
validation, temporary-artifact cleanup, and all local Git mutations. After data/backend review,
update the pin to the new bundle identifier, load it idempotently, activate it explicitly in the
local review database, and prove rollback to the retained prior version and reactivation of the new
version. Do not contact a registry or remote service.

## Data and interface impact

- `regulation_memberships.json` loses exactly the two Magearna Mega identifiers for each
  regulation. The Pokédex index endpoints expose 349 M-C and 314 M-B rows after activation.
- Existing relation-closure rules determine whether nonmember forms remain available for toggles.
  In this snapshot, Magearna's base and Mega family are expected to become unreachable and leave
  forms, profiles, Mega relations, sprite mappings/sprites, and their unused metadata; the semantic
  diff supplies the exact dependent set.
- Bundle schemas and Django models remain unchanged. All content hashes, the bundle hash/identifier,
  manifest inventory, validation SHA, semantic inventory, counts, provenance, and sprite mapping
  hash are regenerated consistently.
- Backend response shapes, URLs, serializers, auth, and cache headers remain unchanged. Data version,
  ETag, form lists/counts, and potentially deduplicated ability/move dictionaries change naturally
  with the activated immutable version.
- Browser code does not special-case Magearna. It consumes the new regulation index and detail
  payloads; search and filters inherit the corrected membership list.
- The packaged Status SVG hash and provenance change because of the approved Bagredex adjustment.
  No network URL, dependency, or runtime interface changes.
- `deploy/pokemon-data.env` becomes the reproducible future runtime pin. An already-running database
  changes only when the new loaded version is explicitly activated.

## Implementation sequence

1. The data owner adds focused legality predicate tests and records the current nonstandard audit,
   including the two `Future` Magearna forms in both regulation tables.
2. Implement the generic predicate, run extraction twice, and inspect the pre-build semantic roots.
   Confirm M-C/M-B membership totals are 349/314 and no unrelated membership changed.
3. Build and validate a new immutable release from the pinned clean local snapshots. Compare it to
   `showdown-3a766f2c-s1-i1-923ba416555c`, record every changed record/count/hash, update generated-
   evidence count pins, rerun determinism, and retain the old release untouched.
4. The data reviewer approves legality semantics, closure, generated artifacts, and the complete
   semantic diff. The new manifest and identifier then become the sole count/interface input for
   backend and deployment work.
5. The backend owner updates exact reader/test pins and adds M-C/M-B request regressions. Run focused
   bundle/load/activate/Pokédex tests, then the complete backend suite with query-count evidence.
6. In parallel with steps 1–5, the Web owner implements the settled presentation changes and unit
   tests. Do not couple Web fixtures to the future bundle identifier; use observable membership
   payloads and add browser absence checks only after the local review database activates the bundle.
7. The Web reviewer checks source behavior. The data and backend reviewers complete their scopes;
   all blockers return to the exclusive owner and reviews repeat.
8. The deployment agent updates `deploy/pokemon-data.env` and exact deployment tests, rebuilds the
   local review stack from already-local inputs/images, loads the new bundle twice to prove
   idempotency, and explicitly activates it.
9. Run cross-scope browser validation against the activated version, including corrected counts and
   Magearna absence. Prove retained-version rollback and new-version reactivation without deleting
   either database version or release.
10. The architect reviews the final diff, manifest/count agreement, activation evidence, Web
    behavior, and plan compliance. After corrections, write the cycle report.
11. The deployment agent runs final checks, removes temporary artifacts, stages reviewed files,
    and creates the local cycle commit without a remote operation.

## Review and verification

### Data checks

- Unit-test the standard-entry truth table: absent/`undefined`, `null`, and `false` markers may pass
  when tier is legal; `Illegal` never passes; `Future`, `Past`, `LGPE`, `CAP`, empty string, and an
  unknown nonstandard value never pass.
- Audit both effective Champions format tables and assert the only current `Future` candidates are
  `magearnamega` and `magearnaoriginalmega`. Assert neither appears in either regulation membership.
- Assert exact 349/314 membership counts and explicit preservation of membership/profile separation.
  Test a synthetic legal-base/nonstandard-Mega case so a required profile may remain without
  accidentally becoming selectable.
- Run extraction twice for byte equality, complete data tests, build twice for the same bundle ID,
  bundle validation, and old→new comparison. Verify the local source revisions/clean trees, schema,
  importer provenance, license notice, sprite encoder inputs, and absence of external access.
- Review exact manifest and validation counts for every file and grouped learnset provenance. Verify
  generated JSON ordering, file hashes, bundle hash/ID, validation hash, sprite mapping hash, sprite
  files/properties, and no mutation of the preceding release.
- Treat any semantic difference outside the four memberships and demonstrably unreachable dependent
  records as a blocker. Include the complete accepted diff summary in the cycle report.

### Backend and runtime checks

- Read both retained and new bundles with pinned validation. Prove corrupted hashes/counts still
  fail closed, unsupported schemas still fail, and synthetic membership/profile separation remains.
- Load the new version twice and prove one immutable database version with no duplicate records;
  activate it explicitly and verify the active pointer, activation history, version metadata, and
  rollback/reactivation behavior.
- Request M-C and M-B index and bulk detail contracts as an authenticated user. Assert HTTP 200,
  version consistency/ETag behavior, 349/314 forms, national-Dex fallback ordering, and absence of
  both Magearna Mega IDs/names from forms, suggestions source data, and serialized detail maps.
- Preserve stale/version-mismatch, unknown-regulation, auth redirect, sprite security, selected-form
  relation, and error/cache behavior. Record index/detail query counts and response sizes; no bound
  may regress merely because the dataset shrank.
- Run backend format/lint/type checks, Django system and migration checks, focused data-loading and
  Pokédex tests, then the complete backend suite.

### Web component and accessibility checks

- Compare inactive Shiny and Mega controls in the same render: background, all border properties,
  radius, and shadow are equal. Assert only the Shiny image receives white/contrast treatment;
  active state, focus, labels, title, `aria-pressed`, target size, and form transitions remain.
- Assert packaged Status contains `#B7D9EB` and white, contains no black declaration, matches the
  recorded adjusted hash, remains mapped only to Status, and passes all existing SVG safety and
  local-asset checks. Preserve the reference hash and adjustment note in provenance.
- Assert every Stats header/name/value is centered and roles/labels/formulas are unchanged.
- Exercise Type, Category, and Power sort cycles. Assert every Moves header/value center differs
  from its track center by at most one CSS pixel, `Power` text and arrow are fully contained, move
  names/types/icons/power do not overlap, and status em dashes retain deterministic power sorting.
- Assert the search input has no inset bottom strip, retains a visible focus outline and one normal
  border, and does not shift adjacent shell/table geometry. Preserve native input/combobox names,
  expanded/controls/active-descendant state, keyboard/touch selection, Escape, and live status.

### Browser and deployment checks

- Run isolated Chromium and real Firefox projects at desktop, tablet, 900-pixel, 641-pixel boundary,
  phone, and 1680-pixel wide viewports in the configured light/dark and reduced-motion variants.
- Capture the supplied-screenshot state in Firefox dark: focused empty search above the table,
  selected Pokémon Stats, and Moves header. Assert one clean input edge, correct overlay z-order,
  centered Stats/Moves content, and fully visible `Power`.
- Measure inactive Shiny/Mega computed equality and visually inspect white Shiny contrast in both
  themes and both pressed states. Verify Status/Special remain distinguishable at rendered size.
- Re-run table no-scroll/phone-scroll, sorting geometry, whole-row selection, modal, sprites,
  Mega/Shiny, search/filter, loading/error, and regulation-navigation critical flows.
- Against the explicitly activated new version, assert UI counts 349/314, zero Magearna Mega rows or
  Pokémon suggestions in either regulation, all expected icon requests local/successful/decoded,
  and no console, request, focus, accessibility, or layout-shift failure.
- Deployment validation proves the pin names the new release, review startup loads/activates it
  idempotently, health/auth succeed, rollback and reactivation work, Ctrl-C cleanup preserves the
  named database volume, and no registry/external operation occurs.

## Risks

- Filtering only known nonstandard strings would recreate the defect when Showdown adds a category.
  Explicit standard-only semantics plus unknown-value tests fail closed.
- Changing legal roots can remove more dependent data than four membership rows. The reviewed
  semantic diff distinguishes justified unreachable closure from an importer regression before pins
  are copied into backend code.
- Reusing the old release directory or identifier would violate immutability and make loaded-version
  collision checks fail. Content-addressed output and old/new validation prevent this.
- Backend and deploy can drift if they copy counts before generation finishes. The reviewed new
  manifest is their only allowed input and integration review compares all three scopes.
- A white glyph can disappear on the shared light inactive surface. Glyph-local contrast treatment
  preserves exact button equality while theme screenshots gate visibility.
- Centered Move content can fit visually while the reserved Power arrow clips. Rendered text/arrow
  boxes and narrow-detail browser checks cover the combined control.
- Removing the search inset shadow can weaken focus or expose the suggestion border as another
  strip. Focus-visible, z-order, geometry, and screenshot checks gate the replacement.
- Editing Status colors changes its reviewed fingerprint. Dual before/after provenance and exact
  source tests prevent the local adjustment from being mistaken for upstream bytes.

## Completion criteria

- The importer enforces the general standard-only `isNonstandard` invariant with complete truth-
  table tests; both Magearna Mega memberships disappear from both regulations and no unrelated
  membership changes.
- A deterministic new immutable release is committed with exact validated manifests, counts,
  hashes, semantic diff, sprites, and provenance; the preceding release remains valid and intact.
- Backend pins match the generated manifest, load/activation is atomic and idempotent, index/detail
  contracts return 349 M-C and 314 M-B forms without Magearna Megas, and all backend/query tests pass.
- The reviewed new release is the deployment pin; local activation, rollback, reactivation, health,
  auth, cleanup, and volume preservation are observed without external access.
- Inactive Shiny and Mega button surfaces are computed-identical, white Shiny remains visible,
  adjusted Status provenance is exact, Stats/Moves content is centered, `Power` is complete, and the
  search field has one clean accessible border/focus presentation.
- Complete data, backend, Web, browser, deployment, reviewer, integration, documentation, and final
  checks pass with no unresolved finding or unrecorded deferral.
- The architect writes the cycle report and the deployment agent creates the local commit. No Git
  remote operation is part of completion.

Remaining material questions: none.
