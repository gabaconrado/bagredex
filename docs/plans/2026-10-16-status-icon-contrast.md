# Status move icon contrast

## Summary

Darken the packaged Status move icon's pale-blue half and outline from `#B7D9EB` to the approved
deep blue-gray `#4F6F82`. Preserve the user-supplied source reference, white half, geometry, title,
category semantics, and move-table layout.

## Goals

- Improve the Status icon's contrast at its actual rendered move-row size in light and dark themes.
- Change only the packaged SVG's `#B7D9EB` fill and outer stroke to `#4F6F82`.
- Record the new Bagredex color adjustment and packaged SHA-256 accurately.
- Prove the built, content-hashed asset is served locally and decodes successfully.

## Non-goals

- Changing `references/icons/status-move.svg`, its recorded source fingerprint, or its provenance.
- Changing the icon's paths, dimensions, `viewBox`, white half, title, or move-category meaning.
- Recoloring Physical, Special, Shiny, or Mega assets.
- Changing move-table tracks, alignment, sorting, modal behavior, accessibility names, or responsive
  layout.
- Adding dependencies or changing backend, Pokémon data, deployment automation, package files, or
  generated Vite output checked into source.

## User-visible behavior

- Status move rows display the existing yin/yang-like category icon with a deep blue-gray half and
  outline and an unchanged white half.
- At the existing rendered row size, both halves remain distinguishable from each other and from
  the surrounding move-table surface in light and dark themes.
- Status retains its existing accessible category name and remains visually distinct from Physical
  and Special. No row size, column position, interaction, or sorting behavior changes.

## Decisions and assumptions

- `#4F6F82` is the approved replacement for every packaged Status declaration currently using
  `#B7D9EB`: the ellipse fill and the matching outer stroke.
- `references/icons/status-move.svg` remains the immutable user-supplied source. The packaged asset
  remains a documented Bagredex derivative; provenance must retain the source SHA-256
  `8cc0aec5fe120ab7c21034cbe84e8f18f5349dcba7453c25c1313cb57381e331` and replace only the prior
  derivative color/hash description.
- The existing `.icon` size is the acceptance size. Browser review measures the rendered image in a
  real Status move row rather than enlarging it or judging the source SVG in isolation.
- The image stays decorative (`alt=""`, `aria-hidden="true"`) because the surrounding move row
  already provides the accessible `Status` category name.

## Scope and ownership

### Web GUI coder

Own all implementation and test changes under `src/web`:

- In `src/web/src/assets/pokedex-icons/status-move.svg`, replace only both `#B7D9EB` declarations
  with `#4F6F82`.
- Update `src/web/ASSET_PROVENANCE.md` with the newly computed packaged SHA-256 and the exact
  source-black to packaged-deep-blue-gray adjustment. Retain the original source hash and
  user-supplied attribution.
- Update `src/web/src/assets.test.ts` to pin the new packaged hash and assert deep blue-gray plus
  white are present while pale blue and black are absent. Preserve standalone-SVG safety,
  reviewed-filename, no-external-reference, and no-`Zone.Identifier` checks.
- Extend the existing component/browser coverage only as needed to verify the Status mapping,
  decorative semantics, real rendered dimensions, theme contrast observation, production asset
  URL, successful HTTP response, and browser decode.
- Do not edit `references`, `src/backend`, `src/data`, `deploy`, dependencies, or lockfiles.

### Web GUI reviewer

Review `src/web` read-only for the exact two-color substitution, unchanged SVG geometry/title and
source provenance, accurate derivative hash, asset safety, category semantics, real-size light/dark
contrast, and absence of layout or interaction regressions.

### Architect

Own this plan, final scope/plan-completion review, and the cycle report after implementation and
review. No cross-scope interface change is expected.

### Deployment agent

Run final local checks, an offline production build and browser smoke using already-local project
inputs, clean temporary artifacts, and create the justified local commit after reviews. No deploy
source change is planned.

## Data and interface impact

There is no data, schema, endpoint, serialization, URL, state, or deployment-contract change. Vite
will emit a new content-hashed URL for the changed SVG during the build; application source
continues to import it through the existing `CategoryIcon` mapping.

The source-reference hash remains stable while the packaged derivative hash changes. The packaged
hash recorded in provenance, the unit-test fixture, and the bytes served from the production build
must agree exactly.

## Implementation sequence

1. The Web owner records the current source and packaged hashes, then performs only the approved
   two-declaration color substitution.
2. The Web owner computes the new packaged hash and updates provenance and asset safety tests.
3. The Web owner runs static/component checks and the production build, identifies the emitted
   content-hashed Status URL, and verifies its bytes/hash and SVG decode.
4. The Web owner runs focused browser coverage with a selected Pokémon that has a Status move in
   light and dark themes, measuring the rendered icon and checking its surrounding table surface.
5. The Web reviewer performs read-only source and rendered review. The owner resolves every
   actionable finding and repeats checks.
6. The architect checks plan completion and writes the report. The deployment agent performs final
   validation, cleanup, and the pending local commit.

## Review and verification

- Assert the packaged SVG retains `viewBox="0 0 48 48"`, `<title>Status move</title>`, all existing
  geometry/path attributes, and `#FFFFFF`; only both former `#B7D9EB` values become `#4F6F82`.
- Pin and independently verify the new packaged SHA-256. Assert `#B7D9EB`, black declarations,
  scripts, event handlers, external URLs/references, foreign objects, and metadata artifacts are
  absent.
- Run the complete frontend unit/component/asset suite, TypeScript checks, formatting checks, and
  the offline Vite production build.
- In the built application, verify the Status `<img>` resolves to the emitted local hashed asset,
  returns HTTP 200, decodes with nonzero natural dimensions, has empty alt text and decorative
  semantics, and causes no console or network errors.
- In Chromium and Firefox, inspect at least one actual Status move row in light and dark themes at
  desktop and phone widths. Record the rendered icon width/height and confirm the deep half is
  distinguishable from the table background while the white half remains visible against both the
  deep half and its surrounding row. Tablet may use the existing responsive matrix if already
  covered by the full Pokédex browser suite.
- Confirm move-row height, category-column bounds, centered alignment, full Power header, sorting,
  modal activation, focus, and responsive overflow remain unchanged within the existing one-pixel
  geometry tolerance.
- Run the repository Web checks, `.codex/lint.sh`, and `git diff --check`; clean build/browser
  artifacts before handoff.

## Risks

- A source SVG can look acceptable when enlarged while losing separation at the 20-pixel rendered
  size. Real-row measurement and both-theme browser inspection are the acceptance evidence.
- Updating the bytes without synchronizing provenance and the pinned test hash would make the
  derivative unauditable. All three values must be reviewed together.
- A stale browser or Vite asset could conceal the old color. The production hashed URL, HTTP body,
  hash, and decode check distinguish the new artifact from cached output.

Rollback restores the preceding packaged SVG, provenance hash/description, and matching tests in
one Web-only commit; no data or runtime rollback is required.

## Completion criteria

- The packaged Status SVG uses `#4F6F82` for its dark half and outer stroke and otherwise matches
  the prior reviewed geometry, title, and white half.
- Provenance retains the unchanged supplied-source record and accurately records the new derivative
  color and SHA-256; safety tests pin the same bytes.
- Light/dark Chromium and Firefox evidence at the real move-row size demonstrates visible halves,
  correct local asset loading/decoding, preserved semantics, and unchanged layout/interactions.
- All affected frontend, build, browser, documentation, and diff checks pass with no blocking
  review findings.
- The architect report records observed evidence, no hidden deferrals remain, temporary artifacts
  are removed, and the deployment agent reports the local commit.

Remaining material questions: none.
