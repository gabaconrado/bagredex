# Pokédex polish and regulation legality report

## Outcome

The Pokédex now excludes every form carrying a meaningful Showdown `isNonstandard` marker from
regulation membership. `Magearna-Mega` and `Magearna-Original-Mega` no longer appear in M-C or M-B,
whose reviewed lists now contain 349 and 314 forms. A new immutable importer-v2 release is active,
while the preceding importer-v1 release remains loadable for audited rollback.

The selected-Pokémon presentation also received the agreed polish: inactive Shiny and Mega
controls share one surface treatment, the white Shiny glyph remains legible, the Status icon uses
the approved pale blue, Stats and Moves content is centered, the full Power heading fits, and the
search field has one clean accessible focus edge.

See the [Pokédex polish and regulation legality plan](../plans/2026-10-16-pokedex-polish-legality.md).

## Changes

- Added a fail-closed standard-form predicate: only absent, `null`, or exactly `false`
  `isNonstandard` values are eligible, independently of the existing `Illegal` tier exclusion.
- Generated and validated `showdown-3a766f2c-s1-i2-4bedbf1eb44d` from the pinned local sources. The
  semantic diff contains exactly the four expected regulation-membership removals and their
  deterministic dependent data changes; the i1 release remains unchanged.
- Extended the bundle schema, data validator, and Django reader with exact i1/i2 release contracts.
  Runtime loading remains content-addressed, allowlisted, idempotent, explicitly activated, and
  reversible without a database migration.
- Updated the deployment pin and its command/release assertions to the reviewed i2 identifier.
- Applied the Web-only toggle, icon, table-alignment, column-density, move-title, and search-focus
  refinements without changing endpoint shapes, sorting, modal behavior, dependencies, or assets
  outside the approved Status color substitution. Provenance records both source and packaged
  Status fingerprints.

## Review cycles

Data review checked the generic marker truth table, pinned-source determinism, exact semantic diff,
generated inventories, and retention of the preceding release. Backend review then reconciled both
release contracts with load, activation, rollback, endpoint, cache, and query behavior. Web review
covered computed toggle equality, glyph contrast, asset safety and provenance, centered responsive
tables, full Power-label containment, and focus/suggestion layering.

Final architect integration review found the importer, schema, backend allowlist, deployment pin,
and browser contract consistent. The reviewed lifecycle successfully loaded i2 idempotently,
reactivated i1, and returned to i2 with activation history intact. No blocking or nonblocking
findings remain.

## Verification

- All 22 data tests passed. Both immutable releases validate, and the semantic comparison was exact:
  M-C is 349 forms, M-B is 314, and neither contains either nonstandard Magearna Mega form.
- All 181 backend tests passed. Real PostgreSQL validation covered idempotent loads and the audited
  i2 -> i1 -> i2 lifecycle. The M-C/M-B endpoints returned 349/314 forms with correct ETags, no
  excluded Magearna forms, and zero database queries on warm cached responses.
- All 46 deployment tests passed with the i2 pin and explicit load/activation ordering.
- All 91 frontend tests and the offline production build passed. Authoritative browser validation
  passed all 30 tests across the configured desktop, tablet, phone, Chromium, and Firefox projects.
- Documentation lint and `git diff --check` passed, and temporary validation artifacts were cleaned.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.
