# Battle Mode human-review report

## Outcome

The completed [Battle Mode feature](2026-10-24-battle-mode.md) now incorporates the accepted
interactive-review refinements described in the
[supplemental plan](../plans/2026-10-25-battle-mode-human-review.md). Battle Mode opens directly
into an empty workspace, validates saved teams before selection, uses team replacement as the reset
path, and presents a denser left-versus-right battle layout without adding battle persistence.

The reviewed result keeps damage and Speed mechanics in the existing calculator engine, while
making field state, opponent observations, move details, and responsive controls practical during
a live battle. The original feature commit and artifacts remain unchanged.

## Changes

- Replaced the pre-battle screen with an always-visible workspace and accessible team-selection
  modal. Unavailable teams remain visible with concise reasons, and changing teams safely resets
  in-memory state after confirmation when progress would be lost.
- Reworked both rosters into matching card grids and the field into a compact two-by-two layout,
  with one selected editor per side, compact active cards, effective-Speed turn order, and explicit
  tie presentation.
- Added fast opponent entry and set editing through exact-context autocomplete controls, including
  legal Ability and Move filtering, Item Clause filtering, sprites, keyboard operation, and
  empty Item and Move values.
- Consolidated HP, Stat Point sliders, staged values, status, observed set information, Mega state,
  and placement controls without duplicating move selection outside the Damage pane.
- Moved Field Effects beside the damage workflow and added independent Friend Guard, Helping Hand,
  and Single Target controls with the correct attacking- or defending-side semantics.
- Reused one styled move-information dialog across Pokédex and Battle Mode, added canonical full
  move descriptions to `damage-calculator-data-v2`, and kept exact damage rolls in one calculation
  description instead of a duplicate section.
- Added the selected attacker's sprite, responsive light/dark presentation, and focused accessibility
  behavior for dialogs, comboboxes, controls, focus return, and touch targets.

## Review cycles

Backend review required broader Battle readiness regression coverage. Final validation then exposed
sealed-fixture construction errors, a reason expectation mismatch, and a per-team mechanics-profile
query. The backend owner moved canonical test rows before activation, retained sealed-data guards,
corrected the expectations, preloaded the mechanics profile, and passed rereview.

Web review found that cancelling team selection could still allow an in-flight response to install
a team. The Web owner added abort and request-token invalidation for every close path plus deferred-
response tests. Browser validation subsequently exposed only test issues: ambiguous selectors, an
autocomplete timing race, field scoping, and one comprehensive tablet scenario exceeding the
default timeout. The owner corrected those tests without reducing assertions, and Web rereview
reported no remaining blocker.

Architecture review corrected two superseded supplemental-plan statements concerning full move
descriptions and the default opponent Ability. The final integration rereview found the backend/Web
contracts, directional field semantics, shared dialog, and deferral boundary consistent.

## Verification

Observed finish-time checks include:

- `./bagredex.sh check` passed, including 218 passing and 21 skipped Web tests across 20 files,
  the production Vite build, 277 PostgreSQL-backed backend tests, 79 deployment checks, and the
  configured lint, type, Django system, deployment, and static checks;
- the focused authenticated Battle Mode Playwright command passed all 15 cases in 59.1 seconds
  across desktop-light, tablet-dark-reduced, and phone-light projects;
- `npm run check` passed; and
- `.codex/lint.sh` and `git diff --check` passed.

## Deferred tasks

The user explicitly separated global default-regulation URL handling into
[Use the latest regulation as the server URL default](../tasks/2026-10-25-server-default-regulation-urls.md).
It is not part of this reviewed Battle Mode result.

## Commits

This report is included in the pending reviewed-result commit.
