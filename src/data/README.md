# Pokémon data bundles

This directory owns the reproducible, dependency-free conversion of a pinned local Pokémon
Showdown checkout into Bagredex's portable data bundle. PostgreSQL is the runtime source of truth;
these files are reviewed inputs for loading immutable database versions.

## Build inputs

The v8 bundle importer accepts only three clean local repositories. The supplied Pokémon Showdown
checkout must be at `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640` and its local object database must contain
historical commit `b555f4d8ce7250e72939fe0c12cc5b303741d203`. PokeAPI sprites revision
`ba403973fdf9d0ac59175813861e6a1f8ed5020c`, and PokeAPI mapping revision
`81d20919845b6a445969b9265aab5cec6b04cece`. It also requires installed `cwebp` 1.3.2. The build
never contacts a remote or installs packages.

Run the importer from the repository root:

```text
python -m src.data.importer build \
  --showdown references/pokemon-showdown \
  --sprites references/sprites \
  --pokeapi references/pokeapi
```

The importer loads an audited allow-list of TypeScript data exports with the installed Node
runtime. It verifies the clean current tree and both exact commits, then materializes only the
allow-listed files from the historical tree through read-only local Git commands. It independently
extracts M-A from the 2026-04-10 historical tree and M-B/M-C from the 2026-10-13 current tree,
resolves their inheritance layers, rejects cross-revision identity conflicts, validates all
references, maps forms through pinned PokeAPI
CSV identities, and converts only the required normal and shiny HOME PNGs to static 384 by 384
WebPs. Missing sprites, invalid PNGs, tool drift, and unknown source flags fail the build.

A form is a regulation member only when its effective Showdown formats entry has a tier other than
`Illegal` and `isNonstandard` is absent, `null`, or exactly `false`. Every meaningful marker,
including unknown future markers, is excluded by default. Profiles required by base-to-Mega
relations remain separate from selectable regulation membership.

Importer version 9 and schema 7 add provenance to every regulation membership. Direct records
source themselves. A `related-fixed-sex` record is derived only when an effective legal fixed-sex
form and an opposite fixed-sex, non-Mega related form share the same resolved base species, the
target has no explicit illegal or nonstandard entry, and every referenced profile exists. The
pinned data derives female Meowstic from male Meowstic in M-A, M-B, and M-C; malformed, duplicate,
or ambiguous relationships fail closed.

Importer version 8 and schema 6 retain schema 5's calculator records and add ordered held-item
stat-modifier fractions plus unconditional held-item-suppression facts.

Importer version 7 and schema 5 retain importer 6's damage-calculator facts and add narrowly
expanded related-form selection. When a selected legal family has fixed male or female gender, the
importer includes an opposite fixed-sex, non-Mega form listed by that family only when its source
`baseSpecies` resolves to the same base. This admits female Meowstic without broadly importing
cosmetic siblings.

Importer version 6 and schema 5 retain schema 4's regulation-effective Item descriptions and add
the Showdown facts required by the one-on-one damage calculator: exact weights, the complete type
effectiveness matrix, primitive move calculation metadata, and bounded contextual-input
descriptors. The capability record pins the formula compatibility target without importing
vgcmulticalc game-data tables. The normalized facts remain sourced only from the pinned Showdown
snapshots. Boolean and counter context inputs default deterministically to false and zero unless
their descriptor declares another value; integer descriptors carry inclusive bounds. The frozen
consumer fixture classifies every pinned `StateMove` and `StatePokemon` input as source-backed,
user-controlled, deterministically defaulted, or unsupported, and a test rejects interface drift.

Importer version 5 and schema 4 added regulation-effective Item descriptions and their source marker
to the team-builder facts introduced by importer 4 and schema 3. Item identity and legality come
from the effective Item table; text comes from the owning revision's `data/text/items.ts`.
Non-empty `desc` supplies the full description, otherwise the same record's `shortDesc` does. The
six explicitly pinned M-A compatibility transitions under `overlays` are the only
cross-revision text exception. Validation continues to accept retained schemas with their original
semantics. No source tree is checked out or mutated, and the build never fetches missing objects.

Rebuilding identical inputs returns the existing bundle without rewriting it. Output files use
canonical UTF-8 JSON with sorted keys, compact separators, stable record order, and a final newline.
The bundle hash is SHA-256 over the canonical ordered file inventory. Its identifier has this form:

```text
showdown-multi-s7-i9-<bundle-hash-prefix>
```

## Bundle contract

`manifest.json` is the authoritative interchange contract. Schema 7 retains the ordered
`showdown_sources`, normalized team-builder and Item-information records, and schema-5 damage
calculator records, plus schema-6 held-item facts. It adds explicit regulation-membership
provenance and deterministic fixed-sex related-form membership described below.
Each source contains its exact revision, commit date, and regulation IDs; `provenance.json`
additionally stores source counts for that tree. The portable files are:

- `forms.json`: stable form identity, display name, National Dex number, base-form identity, Mega
  marker, and Showdown sprite identifier.
- `regulations.json`: stable regulation identity, exact Showdown format identity, mod, rules, and
  mechanics profile.
- `types.json`, `abilities.json`, `moves.json`, and `move_flags.json`: stable identities.
- `items.json` and `item_profiles.json`: stable Item identities and regulation-effective legal held
  Items, including normalized upstream status, short and full descriptions, and whether full text
  came from `desc` or the same record's `shortDesc`.
- `natures.json`: the stat-changing nature directions plus Serious as the only approved neutral
  nature.
- `regulation_memberships.json`: canonical legal forms with `direct` or `related-fixed-sex`
  resolution and the exact directly legal source form. A fixed-sex counterpart is derived only
  when the pinned Pokédex relationship, opposite fixed genders, shared base species, non-Mega
  status, source legality, and absence of an explicit illegal or nonstandard target all agree.
- `profiles.json`: regulation-effective facts for every included form, including non-list
  counterparts needed for base/Mega toggles, with ordered types, base stats, BST, and slotted
  abilities.
- `ability_profiles.json` and `move_profiles.json`: regulation-effective metadata and descriptions.
- `move_flag_relations.json`: regulation-effective move-to-flag relations.
- `learnsets.json`: regulation/form/move legality with orthogonal form-resolution, exact source
  form, source mod, and target-relative source-kind provenance.
- `mega_relations.json`: base-to-Mega edges; reverse traversal is the same relation by base key.
- `mega_item_relations.json`: regulation-scoped stone and non-Mega form mappings to one exact Mega
  target, including bases with multiple possible Mega forms.
- `sprite_mappings.json`: the exact reviewed form-to-PokeAPI identity mapping, bound by a pinned
  canonical hash.
- `sprites.json`: form/variant logical paths, PokeAPI identities, complete source PNG properties,
  exact encoder provenance, output WebP properties, and content hashes.
- `mechanics_profiles.json`: exact level, per-stat and total SP limits, and integer stat formulas.
- `type_effectiveness.json`: all 324 attacking/defending pairs for the 18 included types, stored as
  exact integer percentages.
- `calculator_capabilities.json`: the calculator schema marker, fixed level/game type, supported
  status and stat-stage bounds, and the pinned formula-reference revision.
- `profiles.json`, `ability_profiles.json`, `item_profiles.json`, and `move_profiles.json` include
  the schema-5 weight, primitive calculation, and contextual-input extensions.
- `item_profiles.json` carries ordered exact held-item stat modifier fractions with closed
  `always` or `form_is_nfe` eligibility, while `ability_profiles.json` carries the source-derived
  unconditional held-item-suppression fact. Unsupported and triggered callback shapes normalize
  to no baseline modifier rather than being treated as always active.
- `validation.json`: deterministic counts, coverage, ignored categories, warnings, and errors.
- `provenance.json` and `POKEMON-SHOWDOWN-LICENSE.txt`: separate code and sprite provenance.

JSON overlays under `overlays` are validated and applied in filename order before bundle validation.
Each pins its source revisions, a complete before/after record transition, rationale, date, and a
machine-checked regression fixture. The v7 release retains the active six-transition M-A Item-text
compatibility overlay: the M-A revision supplies Item identity and legality, while missing text is
copied exactly from the pinned current Showdown revision. Its manifest and provenance record the
overlay hash, target keys, both revisions, and fixture hashes.

All identity keys use Showdown-normalized IDs. Effective records use the composite keys documented
by their fields, such as `(regulation_id, form_id)` for profiles and
`(regulation_id, form_id, move_id)` for learnsets. Consumers must reject an unsupported schema
version and verify every manifest hash before persistence.

Validate or compare reviewed bundles with:

```text
python -m src.data.importer validate src/data/releases/<bundle-id>
python -m src.data.importer compare src/data/releases/<old-id> src/data/releases/<new-id>
```

Sprite assets have no supplied license claim. PokeAPI sprite and mapping provenance is deliberately
separate from the Pokémon Showdown MIT code notice.
