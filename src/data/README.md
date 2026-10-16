# Pokémon data bundles

This directory owns the reproducible, dependency-free conversion of a pinned local Pokémon
Showdown checkout into Bagredex's portable data bundle. PostgreSQL is the runtime source of truth;
these files are reviewed inputs for loading immutable database versions.

## Build inputs

The v1 importer accepts only three clean local repositories: Pokémon Showdown revision
`3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`, PokeAPI sprites revision
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
runtime. It verifies all local revisions and clean tracked trees, resolves the Champions and
Champions Reg M-B inheritance layers, validates all references, maps forms through pinned PokeAPI
CSV identities, and converts only the required normal and shiny HOME PNGs to static 384 by 384
WebPs. Missing sprites, invalid PNGs, tool drift, and unknown source flags fail the build.

A form is a regulation member only when its effective Showdown formats entry has a tier other than
`Illegal` and `isNonstandard` is absent, `null`, or exactly `false`. Every meaningful marker,
including unknown future markers, is excluded by default. Profiles required by base-to-Mega
relations remain separate from selectable regulation membership.

Importer version 2 introduces this fail-closed legality and dependency-closure policy. Validation
continues to accept the retained version-1 release only with its exact legacy legality semantics;
newly generated corrected bundles use `i2` in their content-addressed identifier.

Rebuilding identical inputs returns the existing bundle without rewriting it. Output files use
canonical UTF-8 JSON with sorted keys, compact separators, stable record order, and a final newline.
The bundle hash is SHA-256 over the canonical ordered file inventory. Its identifier has this form:

```text
showdown-<revision-prefix>-s<schema>-i<importer>-<bundle-hash-prefix>
```

## Bundle contract

`manifest.json` is the authoritative interchange contract. The v1 files are:

- `forms.json`: stable form identity, display name, National Dex number, base-form identity, Mega
  marker, and Showdown sprite identifier.
- `regulations.json`: stable regulation identity, exact Showdown format identity, mod, rules, and
  mechanics profile.
- `types.json`, `abilities.json`, `moves.json`, and `move_flags.json`: stable identities.
- `regulation_memberships.json`: forms that appear in each regulation's legal Pokédex list.
- `profiles.json`: regulation-effective facts for every included form, including non-list
  counterparts needed for base/Mega toggles, with ordered types, base stats, BST, and slotted
  abilities.
- `ability_profiles.json` and `move_profiles.json`: regulation-effective metadata and descriptions.
- `move_flag_relations.json`: regulation-effective move-to-flag relations.
- `learnsets.json`: regulation/form/move legality with orthogonal form-resolution, exact source
  form, source mod, and target-relative source-kind provenance.
- `mega_relations.json`: base-to-Mega edges; reverse traversal is the same relation by base key.
- `sprite_mappings.json`: the exact reviewed form-to-PokeAPI identity mapping, bound by a pinned
  canonical hash.
- `sprites.json`: form/variant logical paths, PokeAPI identities, complete source PNG properties,
  exact encoder provenance, output WebP properties, and content hashes.
- `mechanics_profiles.json`: exact level, SP range, and integer stat formulas.
- `validation.json`: deterministic counts, coverage, ignored categories, warnings, and errors.
- `provenance.json` and `POKEMON-SHOWDOWN-LICENSE.txt`: separate code and sprite provenance.

Optional JSON overlays under `overrides` are validated and applied in filename order before bundle
validation. Each pins this Showdown revision, a complete before/after record transition, rationale,
date, and a machine-checked regression fixture. This release has no active overlays.

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
