---
name: pokemon-data-standards
description: Govern Pokémon Showdown imports, normalized Bagredex data, versions, and overrides.
---

# Pokémon data standards

Apply these standards to imported Pokémon data and mechanics under `src/data` and to interfaces
that consume those datasets.

## Source policy

- Pokémon Showdown is the sole upstream source until an approved plan changes that decision.
- Pin every import to an exact upstream Git commit supplied to the local import workflow.
- Agents never contact the upstream Git repository. A user obtains or supplies source snapshots;
  agents operate only on local inputs.
- The running application never depends on Pokémon Showdown availability.
- Record upstream revision, retrieval date when known, importer version, content hashes, and schema
  version for each import.

## Ownership and normalization

- Treat normalized, validated, activated Bagredex records as the application's canonical runtime
  data.
- Preserve the distinction between upstream facts, deterministic normalization, and Bagredex
  overrides.
- Use stable canonical identifiers and retain display names separately.
- Model forms, learnsets, regulation legality, mechanics, and inheritance explicitly. Never flatten
  an upstream delta model without tests proving the result.
- Keep raw snapshots or reproducible content hashes according to the approved storage plan and
  Pokémon Showdown's license requirements.

## Update workflow

1. Accept a local snapshot pinned to an exact Showdown revision.
2. Parse and normalize deterministically into a versioned staging dataset.
3. Validate schemas, references, uniqueness, inheritance, legality, and representative mechanics.
4. Produce a human-reviewable summary and semantic diff from the active dataset.
5. Require explicit activation; never silently replace active data after a partial import.
6. Preserve prior activated versions for rollback and historical reproducibility.

Imports must be idempotent. Fail closed with actionable diagnostics on unknown or inconsistent
source structures.

## Manual overrides and verification

- Allow rare overrides without editing imported source records in place.
- Require a rationale, affected data version, authoring date, and regression test.
- Surface active overrides in update diffs so upstream changes cannot silently mask them.
- Use golden fixtures for representative Pokémon, forms, moves, regulations, and damage cases.
- Preserve applicable MIT notices for reused Pokémon Showdown code.
- Treat sprites, artwork, names, and trademarks as separate provenance/IP concerns; an open-source
  code license does not grant rights to all game assets.
