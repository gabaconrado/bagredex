# Team import and export human review

## Summary

Apply the first focused feedback round from the active `team-import-export` human-review session.
The importer will accept `EVs:` as an alternate label for Champions stat points and standard
Showdown nature names such as `Timid Nature`. The selector can retain its explanatory nature
labels, while team text uses canonical nature names.

This supplement extends the original [team import and export plan](2026-11-01-team-import-export.md)
and report at `docs/reports/2026-11-01-team-import-export.md`. The reviewed base feature boundary is
`adcfb55a11e8fca8b4740283433fdf9cfc4a72e2` (`test: verify imported team save response`).

## Feedback rounds

### Round 1: Showdown stat label and nature names

The reported six-set Showdown paste used `EVs:` with Champions-sized allocations and ordinary
nature names. The user confirmed that `EVs:` is a compatibility alias for direct Champions points,
not 252-scale EVs, and must not be combined with `SPs:`. Investigation found that the active
release contains all 21 supported natures, but the Web contract decorates their selector labels and
the text boundary incorrectly treated those labels as canonical names.

### Round 2: Mega headers and abilities

After the round-1 correction, the paste reached aggregate validation. `Gengar-Mega @ Gengarite`
with Shadow Tag and `Raichu-Mega-X @ Raichunite X` with Electric Surge failed because the importer
correctly mapped each Mega name to the stored base form and stone, but incorrectly retained the
Mega-only ability as the persisted base ability.

The retained M-C release has 82 Mega relations. Seventy-eight related base forms have more than one
legal ability. Showdown's Mega set text does not preserve which base ability existed before Mega
Evolution, and no upstream relation maps a Mega ability back to that choice. The user approved a
deterministic compatibility policy: a valid Mega-only ability maps to the base form's Showdown
slot-0 ability. Thus Gengar maps to Cursed Body and Raichu maps to Static. A supplied legal base
ability is preserved. An unrelated ability or a Mega-header/stone mismatch remains an atomic error.

## Goals

- Accept either `EVs:` or `SPs:` for one Champions stat-point allocation line per set.
- Apply the existing Champions bounds to either label: whole numbers from 0 through 32 per stat
  and no more than 66 points in total.
- Accept and export canonical nature names even though the team editor decorates nature labels with
  their increased and decreased stats.
- Preserve atomic import, current-regulation legality, canonical persistence, and all previously
  supported fields.
- Cover the reported Showdown paste shape, including nicknames, Mega forms, abilities, items,
  shiny state, full move sets, and multiple ordinary nature names.
- Accept both base and Mega headers for a valid base-form/Mega-Stone relation while storing and
  exporting the base form and a legal base ability.
- Translate a related Mega-only ability to the base form's retained Showdown slot-0 ability without
  weakening ordinary ability legality.

## Non-goals

- Do not interpret standard main-series EV values or allow values up to 252.
- Do not convert EVs into Champions stat points.
- Do not allow `EVs:` and `SPs:` in the same set or change export from canonical `SPs:` output.
- Do not change nature mechanics, selector presentation, saved team contracts, normalized data, or
  the active data release.
- Do not broaden the accepted grammar beyond this feedback round.
- Do not infer a historical pre-Mega ability that is absent from the pasted text. Slot 0 is the
  approved deterministic fallback, not a claim that the original set selected that ability.
- Do not persist Mega forms or Mega-only abilities in `team-draft-v1`.

## User-visible behavior

- A set may contain either `EVs: 2 HP / 32 SpA / 32 Spe` or the equivalent `SPs:` line. Both map
  directly to the existing `Member.sp` values.
- A value above 32, a total above 66, a repeated allocation line, or any mixture of `EVs:` and
  `SPs:` in one set rejects the whole import with a line-specific error.
- `Timid Nature`, `Jolly Nature`, `Sassy Nature`, `Brave Nature`, and `Modest Nature` resolve to the
  retained canonical nature records. Case and punctuation normalization remain unchanged.
- Export continues to emit `SPs:` and emits `Timid Nature`, not the selector-only label
  `Timid (+Spe/-Atk) Nature`.
- A valid six-set paste shaped like the reported Showdown export replaces the draft atomically and
  remains unsaved until **Save**. Any other syntax or legality error leaves the roster untouched.
- `Gengar-Mega @ Gengarite` with Shadow Tag imports as base Gengar with Cursed Body, Gengarite, and
  Mega preview enabled. `Raichu-Mega-X @ Raichunite X` with Electric Surge imports as base Raichu
  with Static, Raichunite X, and Mega preview enabled.
- A base or Mega header that supplies an ability already legal on the base preserves that ability.
  A related Mega-only ability uses the slot-0 fallback. Any other ability is rejected.
- A Mega header with the wrong stone remains an error. A base header with its matching Mega Stone
  infers the same Mega relation and applies the same ability rules.
- Export always names the stored base form and stored base ability, even when Mega preview is
  enabled. It never exports the Mega-only display ability.

## Decisions and assumptions

- Repository evidence resolves the nature failure. The active release contains 21 nature records,
  including all names reported by the user. `teams/datasets.py` returns every non-neutral nature
  plus Serious. During Web contract conversion, `contracts.ts` intentionally changes a nature's
  browser `name` to a selector label such as `Timid (+Spe/-Atk)`. `team-text.ts` currently builds
  its lookup and export from that decorated value, while its unit fixture uses an unrealistic raw
  `Timid` name. This is a Web text-boundary defect, not missing Pokémon data.
- The text module will derive or retain the canonical name from the known selector-label contract
  without changing the backend payload. The implementation must keep the selector label and must
  not expose the decorated suffix in exported text.
- `EVs:` is a compatibility spelling only. Parsing, validation messages, and state continue to use
  Champions SP mechanics and the existing `sp` member fields. Export remains `SPs:` so Bagredex's
  domain meaning stays explicit.
- One shared allocation-line guard covers both spellings. Two `EVs:` lines, two `SPs:` lines, or
  one of each are duplicate/conflicting allocation input and must not partially merge.
- The existing server remains authoritative when the user saves. No persistence or wire-format
  field changes are required.
- Normalized `PokemonProfileAbility.slot` values already retain Showdown's `0`, `1`, `H`, and other
  source slots. The current browser payload discards those slots and sorts only ability IDs, so the
  Web client cannot safely derive slot 0 from array order.
- Add the base form's slot-0 ability as explicit payload metadata. The importer uses this fallback
  only when the resolved base/stone relation proves that the pasted ability belongs to the related
  Mega form. It does not silently replace an unknown or unrelated ability.
- When the related Mega ability is also legal on the base, preserve it as the supplied legal base
  ability rather than invoking the fallback. This keeps the precedence rule mechanical even though
  the current M-C relations normally have distinct Mega and base ability sets.

## Scope and ownership

`backend_coder` exclusively owns the retained builder-data contract extension:

- Update `src/backend/bagredex/teams/services.py` to advance the dataset contract from
  `team-builder-data-v6` to `team-builder-data-v7`.
- Update `src/backend/bagredex/teams/datasets.py` to serialize one `default_ability_id` on every
  base-form record from the profile ability whose retained Showdown slot is `0`.
- Update `src/backend/tests/test_teams.py` to verify the v7 schema, exact slot-0 selection for
  single- and multi-ability forms, retained-version behavior, and fail-closed handling if a legal
  builder profile lacks one unambiguous slot-0 ability.

`web_gui_coder` exclusively owns the focused Web implementation after the backend interface is
defined:

- Update `src/web/src/team-builder/team-text.ts` to accept the `EVs:` alias, reject mixed or
  repeated allocation labels, resolve canonical nature names, and export canonical nature names.
- Update `src/web/src/team-builder/team-text.test.ts` so nature fixtures reproduce decorated
  runtime labels and cover canonical imports/exports, both allocation labels, mixed/repeated label
  rejection, 32-per-stat and 66-total limits, and the reported multi-set shape or a focused
  equivalent.
- Update `src/web/src/team-builder/app.test.tsx` only if component-level atomicity needs an explicit
  regression for the new alias or nature behavior.
- Update `src/web/tests/e2e/team-builder.spec.ts` to import a canonical non-neutral nature and an
  `EVs:` allocation through the real retained payload, verify the draft remains unsaved until Save,
  and inspect the canonical submitted `sp` and `nature` values.
- Update `src/web/src/team-builder/contracts.ts` and its tests to require
  `team-builder-data-v7`, validate that every form's `default_ability_id` belongs to its
  `ability_ids`, and expose it on `BuilderForm` without relying on ability-array order.
- Extend `src/web/src/team-builder/team-text.ts` and its tests to recognize the resolved Mega
  relation for either a Mega header or base header plus matching stone. Preserve a pasted legal
  base ability; translate a related Mega-only ability to `default_ability_id`; reject unrelated
  abilities and relation conflicts; export only stored base form and ability.
- Extend component or Playwright coverage with Gengar and multi-ability Raichu so both the
  deterministic and slot-0 fallback paths reach the submitted canonical draft.

No `src/data`, database migration, normalized release, deployment, CSS, or dependency change is
planned. `backend_reviewer` and `web_gui_reviewer` review their matching scopes when the user
explicitly finishes the session. The architect then reviews integration consistency under the
human-review finish flow.

## Data and interface impact

- The read-only builder dataset advances from `team-builder-data-v6` to
  `team-builder-data-v7`. Each base form adds required `default_ability_id`, the canonical ID of
  its retained Showdown slot-0 ability. No Mega-to-base guess is stored in normalized data.
- V7 is a deliberate fail-closed contract boundary: the Web parser rejects v6 payloads, and the
  backend ETag changes with `DATA_SCHEMA`. Backend and built Web assets must deploy together. Saved
  teams, retained normalized releases, and database rows are compatible because they do not embed
  the builder dataset schema.
- The raw Django payload continues to contain canonical nature names; the Web conversion may keep
  presenting decorated names to selector consumers while the text boundary uses canonical names.
- `team-draft-v1`, `Member.sp`, nature canonical IDs, save requests, and database records remain
  unchanged.
- The normalized release `showdown-multi-s7-i9-78b322057dd0` remains active and unmodified. Its
  `natures.json` already contains the required canonical names and stat directions, and its loaded
  profile-ability records already contain the slot values needed by v7.
- The text grammar expands only by accepting `EVs:` wherever one `SPs:` allocation line is valid.
  This is backward compatible with existing Bagredex exports.

## Implementation sequence

1. `backend_coder` advances the dataset schema to v7, exposes each base profile's exact slot-0
   ability, and adds backend contract tests. This interface change must land in the shared worktree
   before Web contract implementation begins.
2. `web_gui_coder` updates the v7 TypeScript contract and fixtures, then updates the pure text
   boundary so canonical nature names are indexed and exported independently of selector
   decoration.
3. The same owner refactors the allocation-line parser to recognize `EVs:` and `SPs:` through one
   validation path with one per-set occurrence guard.
4. The Web owner adds relation-aware Mega ability translation using the explicit v7 fallback,
   while retaining base ability and stone legality checks.
5. The owners add focused backend, unit, and browser coverage using decorated nature labels and the
   reported six-set value shape, including Gengar and Raichu Mega-only abilities.
6. After focused checks pass, `deployment_agent` runs `./bagredex.sh human-review reload` and
   returns the stable review connection to the user. No review, full validation, report, or Git
   mutation occurs until the user explicitly finishes the human-review session.
7. On explicit finish, follow the changed-session workflow: matching backend and Web reviews,
   architect integration review, full supplemental checks, supplemental report, reviewed-result
   commit, receipt/report-correction commit, and final lifecycle completion acknowledgment.

## Review and verification

Focused coverage must demonstrate:

- all 21 canonical nature names can resolve when the runtime-facing names include selector stat
  suffixes;
- canonical nature export omits the selector suffix and round-trips to the same nature ID;
- `EVs:` and `SPs:` independently produce identical `Member.sp` values within Champions bounds;
- repeated `EVs:`, repeated `SPs:`, and mixed allocation labels reject the entire import with a
  focused diagnostic;
- `EVs: 33 HP`, negative or non-integer allocations, and totals above 66 remain invalid;
- a reported-shape multi-set import preserves Unicode nicknames, Mega inference, items, abilities,
  shiny state, moves, nature IDs, and point values when every set is legal for the retained
  regulation;
- the real browser payload accepts a non-neutral canonical nature and `EVs:` alias, performs no
  save during import, and submits canonical `nature` and `sp` fields only after **Save**;
- v7 emits exactly one base `default_ability_id` selected by source slot `0`, including Static for
  Raichu, and rejects a missing or contradictory fallback contract;
- Mega headers and base headers with a matching stone both infer the intended relation;
- related Mega-only abilities translate to the expected base slot-0 abilities, while pasted legal
  base abilities are unchanged;
- an unrelated ability, wrong stone, missing stone for a Mega header, or conflicting Mega relation
  rejects the whole import;
- canonical export contains the base species and stored base ability, never a Mega header or
  Mega-only ability;
- the real submitted `team-draft-v1` stores Gengar/Cursed Body and Raichu/Static with their stones
  and Mega preview flags after the reported paste is saved.

The owners run focused checks during the active feedback round:

```text
cd src/backend && uv run pytest tests/test_teams.py
cd src/web && npm test -- src/team-builder/team-text.test.ts src/team-builder/app.test.tsx
cd src/web && npm run check
cd src/web && npm run build
./.codex/lint.sh
```

The deployment agent runs the applicable focused Playwright path while reloading the local review
runtime. Full Web tests, independent review, final validation, and commits remain deferred until
explicit finish, as required by the human-review lifecycle.

## Risks

- Treating a decorated selector label as a canonical interchange name recreates the reported
  incompatibility. Regression fixtures must use the actual converted shape rather than raw-only
  nature names.
- Calling `EVs:` a compatibility alias can suggest 252-scale semantics. Bounds and diagnostics
  must state that the pasted values are Champions points and fail above 32 rather than converting.
- Separate code paths for `EVs:` and `SPs:` could drift or permit merging. One parsing path and one
  occurrence guard keep behavior identical and atomic.
- A full user paste can still contain genuinely unavailable forms, items, abilities, or moves for
  the retained regulation. Tests should distinguish format compatibility from ordinary legality
  rejection rather than weakening current-regulation validation.
- Choosing the first alphabetically sorted browser ability would map Raichu to Lightning Rod rather
  than the approved Static fallback. V7 carries the source slot explicitly and contract validation
  proves it belongs to the base form's legal abilities.
- A Mega ability cannot reconstruct the user's historical base ability. UI copy and tests must
  describe slot 0 as a deterministic compatibility fallback, not recovered source state.
- A partial backend/Web rollout would make the strict parser unavailable. The schema bump and
  fail-closed Web guard make that mismatch visible; deployment continues to ship both scopes as one
  reviewed result.

## Completion criteria

- The reported nature names import from canonical Showdown syntax and export without selector
  decoration.
- `EVs:` works as a bounded Champions-point alias, while mixed/repeated labels and 252-scale values
  fail atomically with actionable errors.
- Mega and base headers with matching stones import into base-form storage; valid base abilities
  are preserved, related Mega-only abilities use the exact slot-0 fallback, and every other
  ability/relation conflict fails atomically.
- Export and saved drafts contain only canonical base forms and base abilities while retaining
  stones and Mega preview state.
- Focused backend, unit/component, type, build, lint, and retained-payload browser checks pass
  during the active review round.
- The local review environment is reloaded with the accepted changes and returned to the user for
  another focused review round.
- No material questions remain for this feedback round. Final review, full validation, reports,
  commits, receipt, and lifecycle completion wait for the user's explicit finish request.
