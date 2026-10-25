# Default regulation URLs and team slot shortcuts

## Summary

Make Django the single owner of default-regulation URL policy: query-free HTML routes select the
latest supported regulation, explicit latest-regulation page URLs redirect to their clean form,
and historical selections remain explicit across navigation. Extend the Team Builder's existing
number shortcuts so an empty slot opens the same Pokémon picker as its Add Pokémon button.

This plan resolves
[`docs/tasks/2026-10-25-server-default-regulation-urls.md`](../tasks/2026-10-25-server-default-regulation-urls.md).

## Goals

- Resolve an omitted regulation to the server-selected latest regulation on every
  regulation-aware HTML page.
- Generate clean latest-regulation navigation URLs and explicit historical-regulation URLs from
  one server-owned policy.
- Canonicalize an explicit, available latest-regulation page request to a query-free URL without
  dropping unrelated query parameters.
- Preserve strict request validation and cross-route regulation context.
- Make unmodified `1` through `6` open the Pokémon picker for the corresponding empty slot while
  retaining the occupied-slot shortcut.

## Non-goals

- Do not change dataset endpoint paths, data-version pinning, persisted team regulation ownership,
  or Pokémon data.
- Do not add client-side default-regulation policy, a new navigation framework, or dependencies.
- Do not change the Pokémon picker, choose a Pokémon automatically, or create a member before the
  user selects a form.
- Do not broaden shortcuts to modified keys, editable controls, repeated keydown events, pages
  without an active draft, or states already blocked by a palette or dialog.

## User-visible behavior

- `/`, `/teams/`, `/damage-calculator/`, and `/battle-mode/` load the latest supported regulation.
- An explicit latest query such as `/?view=grid&regulation=m-c` receives a temporary redirect to
  `/?view=grid`. Repeated unrelated query values are retained.
- Selecting or navigating within the latest regulation uses clean page URLs. Selecting a
  historical regulation and moving among regulation-aware pages keeps
  `?regulation=<historical-id>`.
- Blank, duplicate, unknown, and explicitly requested unavailable regulations return HTTP 400
  rather than falling back. A missing active data version and an unavailable implicit default
  remain service-unavailable conditions.
- In an active Team Builder draft, pressing the number of an occupied slot expands and focuses its
  card as today. Pressing the number of an empty slot opens that slot's Add Pokémon search palette;
  choosing a form then creates the member in the requested slot through the existing flow.

## Decisions and assumptions

- `bagredex.regulations` remains the authoritative ordering and latest/default policy. Web code
  consumes server-produced URLs and does not compare regulation identifiers.
- Canonical redirects use HTTP 302 rather than a permanent status because the latest regulation
  changes over time. Redirect handling applies only to GET HTML page boundaries, not versioned
  dataset URLs or Team Builder mutation requests.
- Canonicalization removes every `regulation` field and preserves the path plus all other encoded
  query values, including repeated values. A clean URL is emitted without a trailing `?`.
- The server validates the explicit regulation against the active version and feature support
  before redirecting. Thus a supported identifier that is unavailable for the requested page is a
  400, while an absent active data version remains a 503.
- The regulation selector's latest choice and server-generated cross-feature links use the same
  URL policy as the global menu. Historical choices remain explicit.
- The existing shortcut guards, palette focus behavior, member-construction defaults, dirty-state
  tracking, and navigation confirmation behavior are authoritative and remain unchanged.

## Scope and ownership

- `backend_coder` owns `src/backend/bagredex/regulations.py`, the regulation-aware Django page
  views and server-generated navigation URLs under `src/backend/bagredex`, plus corresponding
  backend tests under `src/backend/tests`.
- `web_gui_coder` owns `src/web/templates/base.html`,
  `src/web/src/team-builder/app.tsx`, and relevant component and Playwright tests under `src/web`.
- `backend_reviewer` reviews Django resolution, redirect, availability, URL-generation, and test
  behavior without editing.
- `web_gui_reviewer` reviews template consumption, shortcut/focus behavior, accessibility, and
  browser coverage without editing.
- `architect` owns this plan, cross-scope consistency review, and the cycle report.
- `deployment_agent` owns final validation and all local Git mutations.

The empty-slot shortcut is independent of regulation URL work and may be implemented in parallel.
The base-template update depends on the backend context contract below, although both owners may
work concurrently against that fixed contract.

## Data and interface impact

- Extend the server regulation request/context contract to distinguish omission from an explicit
  selection and to expose a server-built navigation suffix or equivalent URL value for the active
  regulation. It is empty for latest and contains the encoded regulation query for historical
  selections.
- Build selector choice URLs through the same backend helper: the latest option omits regulation,
  historical options include it, and every option preserves unrelated current-page query values.
- Reuse the server URL helper for backend-generated page destinations such as Battle Mode's Team
  Builder link and data-version reload destinations where they represent an HTML page.
- `base.html` uses only the supplied context value when composing primary-navigation links; it
  must not embed the latest identifier or independently decide whether a query is needed.
- No database schema, migration, normalized data, persistence, or public JSON schema changes are
  planned. If an existing bootstrap URL string changes from explicit latest to clean, update its
  contract fixtures and tests without changing the field shape.

## Implementation sequence

1. `backend_coder` centralizes helpers in `bagredex.regulations` for explicit-versus-implicit
   request state, clean/historical query construction, canonical GET destinations, and selector
   choices. Preserve ordered/repeated non-regulation query values.
2. `backend_coder` applies the contract consistently to Pokédex, Team Builder, Damage Calculator,
   and Battle Mode HTML views. Validate active-version availability and feature support, return 400
   for an explicit unavailable selection, and return a 302 only for an available explicit latest
   request.
3. `backend_coder` updates server-generated HTML navigation destinations to omit the latest query
   and retain historical queries. Add request-level coverage for all four page routes, query
   preservation, strict invalid/unavailable behavior, selector choices, and bootstrap links.
4. `web_gui_coder` changes the global menu template to consume the backend navigation contract and
   updates Web fixtures or browser expectations for clean latest and propagated historical URLs.
5. Independently, `web_gui_coder` extends the Team Builder keydown branch: find the requested
   zero-based slot; expand/focus an existing member or set the palette to that empty position. Add
   component coverage for the branch and Playwright coverage that opens the correct picker, chooses
   a Pokémon, and observes it in the pressed slot.
6. The owners run focused checks, then `.codex/lint.sh`, and hand the complete diff to the matching
   reviewers and architect.
7. Resolve every actionable finding in its owning scope and repeat reviews until no blockers
   remain. The architect then writes the cycle report; the deployment agent performs final checks
   and the two-commit report workflow required by `feature-development`.

## Review and verification

Backend verification must include focused tests, run through `src/backend/pyproject.toml`, for:

- query-free latest resolution on all regulation-aware HTML pages;
- 302 destinations for explicit latest requests with absent, single, and repeated unrelated query
  parameters;
- explicit historical requests without redirects and historical context across generated links;
- blank, duplicate, unknown, and active-version-unavailable explicit regulation requests returning
  400, while implicit service-unavailable states retain their intended 503 response;
- selector choices and backend-generated HTML destinations using clean latest and explicit
  historical URLs.

Web verification must include the existing package scripts for formatting, lint, type checking,
unit/component tests, and production build, plus focused Playwright coverage for:

- primary navigation and regulation selection across latest and historical contexts, including
  browser back/forward behavior and preservation of unrelated query parameters;
- occupied-slot number behavior remaining unchanged;
- empty-slot `1` through `6` opening the correct palette, selecting a Pokémon into that exact slot,
  and preserving shortcut guards for editable targets, modifiers, repeats, and open dialogs.

`backend_reviewer` and `web_gui_reviewer` review their respective scopes. The architect reviews the
complete diff for a single server-owned URL rule, consistent status/redirect semantics, bootstrap
contract agreement, ownership compliance, and end-to-end coverage. The deployment agent runs
`.codex/lint.sh` and the repository's full local validation using only already-installed tools and
already-local runtime assets.

## Risks

- Redirecting before availability checks could turn an explicitly unavailable latest regulation
  into an implicit 503; ordering and regression tests must prevent that.
- Rebuilding query strings incorrectly could discard repeated filter values or leave a dangling
  separator. Tests must compare parsed destinations and exact clean-path cases.
- Leaving one backend-generated link or template branch on the old rule could reintroduce the
  latest query during cross-route navigation. Review all page-URL producers, not dataset paths.
- Opening a palette from the global key handler could interfere with typing or dialogs. Retain the
  existing guards and reuse the existing palette state and selection flow.
- The latest regulation can change in a future data cycle. Keep its identity entirely in the
  backend ordering/policy so that Web code and stored URLs require no corresponding update.

## Completion criteria

- All four query-free page routes resolve the server-selected latest regulation.
- Available explicit latest page URLs redirect temporarily to clean equivalents while preserving
  every unrelated query value; historical URLs do not redirect and propagate across navigation.
- Strict 400 and service-unavailable behavior matches the decisions above and is regression-tested.
- Global navigation, selector choices, and server-generated cross-feature page links share the
  backend URL policy with no browser-side default identifier.
- Team Builder numbers `1` through `6` retain occupied-slot behavior and open the existing picker
  for empty slots; selection creates the Pokémon in the requested slot.
- Focus, dirty-state, confirmation, accessibility, and shortcut guard behavior remain intact.
- Focused and full checks pass, both scope reviewers and the architect report no blocking findings,
  the cycle report names the exact feature commit after its narrow correction commit, and
  `./bagredex.sh human-review candidate` reports that feature commit as `available`.
