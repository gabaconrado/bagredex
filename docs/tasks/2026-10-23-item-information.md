# Item information

## Outcome

Add authoritative held-item effect information to Bagredex's normalized Pokémon data and expose it
through the team builder's accessible information control. This is explicitly deferred from the
basic-team-builder human-review session and must run later as an ordinary `feature-development`
cycle.

## Rationale

The current pinned bundle stores Item identity and regulation-effective legality only. `Item` has
an ID/name, and `ItemProfile` has its regulation and `source_status`; neither stores a short or full
effect description. The team builder therefore cannot implement an honest Item `(i)` tooltip or
dialog from canonical runtime data.

Do not fabricate item effects, use `source_status` as descriptive content, scrape a live service at
runtime, or copy unversioned text into the Web bundle. Pokémon Showdown remains the sole upstream
source, consumed from a user-supplied local snapshot pinned to an exact revision.

## Required feature cycle

1. Use `grill-me` to confirm the desired Item dialog content and whether the source's short/full
   descriptions need any display normalization.
2. Have `pokemon_data_coder` extend the local Showdown extractor, normalized bundle schema,
   validation, semantic inventory/diff, and provenance to retain regulation-effective Item short
   and full descriptions. Generate and validate a new pinned data release; never rewrite an
   existing release.
3. Have `backend_coder` add the normalized description fields and migration/load/admin coverage,
   preserve old loaded versions deliberately, and extend the team-builder dataset contract with
   descriptions from the exact retained regulation/version.
4. Have `web_gui_coder` add the Item `(i)` control beside a valid selected Item, reusing the
   established Ability/Move tooltip and information-dialog primitives without coupling island DOM
   ownership.
5. Run matching Pokémon-data, backend, and Web reviews, architect integration review, full
   validation, a cycle report, and a separate deployment-agent commit under the ordinary feature
   workflow.

## Acceptance boundary

- Every legal Item offered by the team builder has non-empty, versioned short and full effect text
  traceable to the pinned local Showdown revision.
- Bundle validation rejects missing, malformed, duplicate, cross-version, or unprovenanced Item
  descriptions; semantic comparison reports description changes reviewably.
- Loading and activating the new release is atomic, retains prior activated versions, and does not
  make runtime behavior depend on upstream availability.
- The team dataset serves Item details for active and owner-authorized retained versions without
  per-click network requests or N+1 queries.
- A blank, invalid, or unavailable Item has no enabled information control. A valid selection shows
  the same accessible hover/focus tooltip and activated modal behavior as Ability and Move, with
  focus restoration, keyboard/touch support, and light/dark responsive coverage.
- Existing Ability/Move information, Item legality, Mega Stone mapping, saving, and retained-team
  behavior remain unchanged.

## Exclusions

- Implementing the task during the active basic-team-builder human-review session.
- Remote data fetching, a live upstream dependency, manual unversioned overlays, or descriptions
  sourced outside the approved local Pokémon Showdown snapshot.
- Changing item legality, held-item uniqueness, Mega mappings, or team persistence semantics.
