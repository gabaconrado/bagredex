# Item information report

## Outcome

Bagredex now retains versioned Pokémon Showdown held-Item effect text in normalized data and
serves it through the Team Builder's established accessible information control. Described Items
provide a short tooltip and a name/full-description dialog without per-click requests; retained
legacy versions remain editable and expose no unavailable information control.

The implementation follows the approved
[Item information plan](../plans/2026-10-24-item-information.md) and completes the deferred
[Item information task](../tasks/2026-10-23-item-information.md).

## Changes

- Added immutable bundle `showdown-multi-s4-i5-7205fa48044e`, with canonical hash
  `7205fa48044e73f059e980629e222fcbdc1d5aaffb2bd667c8b8837a7b15ab6b`, schema 4, importer 5,
  and source shape 4. All 431 regulation-effective Item profiles have normalized short and full
  descriptions plus record-level source provenance.
- Advanced the deployment data pin to the schema-4 release and updated the production data
  documentation and deployment expectations.
- Added a fail-closed, exactly enumerated compatibility overlay for the six legal M-A Items absent
  from its historical text table. The overlay pins both Showdown revisions and authenticates each
  before/after transition, fixture, normalized record, rationale, and hash without changing Item
  legality or Mega mappings.
- Added nullable Django Item-description fields and an additive integrity constraint so retained
  schema-3 rows remain unchanged. Schema-4 loading requires complete validated descriptions and
  preserves `description_source` as internal provenance.
- Advanced the exact-version Team Builder dataset to `team-builder-data-v3`, emitting paired
  description strings for schema 4 and paired nulls for retained legacy profiles through the
  existing set-based Item query.
- Added strict client parsing and reused the Ability/Move information primitives for Item tooltip,
  dialog, `Alt+I`, pointer, touch, close, and focus-restoration behavior. Blank, invalid,
  unavailable, and legacy-null Items have no enabled information control.

## Review cycles

Source discovery showed that Showdown Item text is stored in `data/text/items.ts`, most Items lack
an independent `desc`, and six legal M-A Items are absent from the historical text table. The plan
was revised with user approval to use same-record `shortDesc` fallback and the exact six-Item,
dual-revision compatibility overlay before bundle generation resumed.

Pokémon-data review approved the finalized extraction, fallback, overlay, provenance, schema
compatibility, deterministic bundle, and semantic comparison. Backend review required stronger
authentication of the overlay document, transitions, fixtures, and normalized output; the backend
owner added those validations and mutation tests. Web review required representative end-to-end
coverage for described Items, no-request activation, touch and focus behavior, and retained legacy
editing; the Web owner added those scenarios.

Final data, backend, Web, and integration re-reviews reported no blocking findings. Cross-scope
review confirmed the schema/importer/source-shape constants, canonical hash, loader, nullable
legacy representation, `team-builder-data-v3` transport, client parser, and exact-version behavior
are aligned.

## Verification

- The data importer suite passed all 40 tests. Explicit validation passed, and semantic comparison
  reported 431 changed Item profiles, no added or removed profiles, and no changes to other
  portable data files.
- Backend Ruff formatting and lint, strict mypy, migration checks, and Django system checks passed.
  The PostgreSQL-backed `./bagredex.sh test` run passed all 251 tests.
- A fresh disposable stack applied migration `0004`, loaded the schema-4 bundle, and explicitly
  activated it successfully.
- Web TypeScript and formatting checks passed, all 127 Vitest tests passed, and the production Vite
  build passed.
- Focused Item-information Playwright validation passed all four selected retained-version and
  touch scenarios across the desktop and phone projects. This was not a full parallel Playwright
  pass.
- The full browser run reached an unrelated existing Team Builder desktop assertion whose broad
  `/Regulation/i` text query also matched the correct empty-state message. This is recorded in the
  [Team Builder empty-state E2E task](../tasks/2026-10-24-team-builder-empty-state-e2e.md).
- All 64 deployment Bats tests passed with the schema-4 pin and expectations.
- `.codex/lint.sh`, `git diff --check`, and the deployment agent's final scoped checks passed.

## Deferred tasks

The unrelated existing Team Builder desktop assertion is deferred in the
[Team Builder empty-state E2E task](../tasks/2026-10-24-team-builder-empty-state-e2e.md). It does
not block the Item-information feature because the correct empty state rendered and all four
focused Item-information browser scenarios passed.

## Commits

This report is included in the pending cycle commit.
