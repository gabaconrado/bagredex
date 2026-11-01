# Form search, SP controls, and move-modifier popovers report

## Outcome

Bagredex now keeps Team Builder Stat Point edits within the 0–32 per-stat and 66-point total
limits, supports direct Mega-form search choices without persisting Mega form IDs, presents the
approved Pokédex form families as grouped details while keeping both Meowstic sexes distinct, and
moves Damage Calculator move modifiers into responsive overlays.

The implementation follows the approved
[form search, SP controls, and move-modifier popovers plan](../plans/2026-11-01-form-search-sp-popovers.md).

## Changes

- Added immutable bundle `showdown-multi-s5-i7-49850c617dd2`, with canonical hash
  `49850c617dd2eddfcdc53f0bf22f4aa58c4433e26717974a5e9e0ccd113cda9f`, schema 5, importer 7,
  and source shape 5. It deterministically includes female Meowstic and its canonical profiles,
  learnsets, mappings, and normal and shiny sprites while retaining prior releases.
- Advanced the Pokédex contracts to group Castform, Aegislash, Gourgeist, and Squawkabilly behind
  one searchable base entry and a detail Form selector. Male and female Meowstic remain separate,
  explicitly labeled canonical entries.
- Advanced the Team Builder dataset contract with relation-backed Mega search entries. Selecting
  one creates the base-form member, assigns the required Mega Stone, and enables preview while the
  submitted form remains canonical.
- Centralized Team Builder SP clamping for sliders, number inputs, and the new `0` and `Max`
  shortcuts without weakening backend validation.
- Replaced inline move-context fields with one move-owned anchored popover, using a bounded modal
  treatment on narrow screens, with dismissal, repositioning, and focus restoration behavior.
- Added data, backend, client-contract, interaction, and browser regression coverage for the new
  identities, schemas, controls, grouped forms, Mega selection, and modifier overlays.

## Review cycles

Pokémon-data, backend, and Web reviews completed after owner corrections and reported no blocking
findings. The resolved review work tightened deterministic related-form inclusion and sprite
mapping, retained-version and canonical-identity assertions, fail-closed schema parsing, SP and
Mega-selection invariants, grouped-form behavior, and overlay accessibility and cleanup coverage.

Final integration review found no cross-scope incompatibility, ownership violation, or unplanned
behavior. The schema-5 bundle allowlist, Pokédex and Team Builder response versions, TypeScript
parsers, canonical IDs, generated fixtures, and end-to-end expectations agree. No blocking findings
remain; database, browser, and runtime residual checks are assigned to deployment.

## Verification

- Scope-owner focused and complete data, backend, and Web checks were reported passing in the
  completed review handoffs; all matching reviewers accepted the resulting evidence with no
  blockers.
- The generated bundle manifest records status `valid`, complete normal and shiny sprite coverage,
  and no validation errors or warnings. This is generated artifact evidence, not a substitute for
  deployment's fresh runtime validation.
- `git diff --check` passed while preparing this report.
- Repository documentation lint passed after this report was written.
- The isolated focused Playwright gates passed: move modifiers 5/5, regulation switching and
  navigation 10/10, Team Builder centralized loading 5/5, and Team Builder Mega search and
  selection 5/5.
- The full 195-test Playwright matrix passed 184 tests and failed 11 under eight-worker pressure.
  Health remained HTTP 200 with no HTTP 5xx, authentication, or rate-limit failure cluster; the
  parallel isolation and performance issue is deferred below rather than reported as feature
  behavior failure.
- PostgreSQL-backed full checks, isolated bundle load and explicit activation, aggregate
  `./bagredex.sh check`, and final candidate validation remain pending for the deployment agent.
  They are not reported as passed here.

## Deferred tasks

- [Battle Mode isolation](../tasks/2026-11-01-battle-mode-playwright-isolation.md) records
  six unrelated failures from the full parallel matrix: desktop/tablet navigation timeouts,
  dialogs remaining visible, and fixture cleanup receiving HTTP 302 after logout. Battle Mode has
  no diff in this feature, readiness stayed healthy, and no server crash or HTTP 5xx cluster was
  observed, so the correction is safely separable.
- [Parallel Playwright isolation](../tasks/2026-11-01-playwright-parallel-isolation.md)
  records the independently separable full-matrix issue: the isolated feature gates passed, while
  the eight-worker run exposed shared-account fixture races, request/payload/render delays, and
  geometry/main-thread contention. Its acceptance requires per-worker ownership and a green full
  configured matrix without broad sleeps, retries, or serialization.

## Commits

Feature commit: `a91dc904bf1bf30b6d747ca9eb777c11e6de3f65` —
`feat: refine form search and move modifiers`.
