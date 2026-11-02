# Logo and web icon

## Summary

Add the user-supplied Bagredex identity assets to the shared Django page shell. The colorful
Bagredex Classic Purple mark will appear to the left of the existing Bagredex name and version
stack, while the Bagredex Classic White mark will be the browser favicon on every page that
extends the base template.

## Goals

- Display the colorful logo beside the authenticated site-header brand text without changing the
  brand link destination or version label.
- Publish the white logo as a same-origin SVG favicon from Django static files on every page.
- Preserve the brand link's accessible name, keyboard focus treatment, and responsive containment.
- Record and test the exact first-party SVG assets supplied in `references/icons`.

## Non-goals

- Redesign the header, navigation, typography, or theme.
- Change the supplied SVG artwork, generate raster or platform-specific icon variants, or add a web
  app manifest.
- Add branding to Django administration, unauthenticated page content, or Preact islands.
- Change backend behavior, persistence, URLs, Pokémon data, or dependencies.

## User-visible behavior

- Authenticated pages show the colorful circular mark immediately left of a two-line text stack:
  `Bagredex` above the existing version label.
- The mark and text remain one home-page link, including the selected regulation query suffix.
- The decorative header image does not add repeated wording to the link's accessible name; the
  link remains announced from its visible Bagredex and version text.
- Browser tabs request the white Bagredex SVG as the document icon on authenticated and
  unauthenticated pages using the shared base template.
- The brand remains contained and usable at the existing desktop, tablet, and phone breakpoints and
  with long account identities.

## Decisions and assumptions

- Copy `references/icons/bagredex-classic-purple.svg` and
  `references/icons/bagredex-classic-white.svg` byte-for-byte into a dedicated directory below
  `src/web/static/web`; Django static URLs are the simplest shared-template delivery mechanism and
  do not require either asset to enter a Preact/Vite bundle.
- Render the header logo with an `<img>` inside the existing anchor and `alt=""` plus
  `aria-hidden="true"`, because the adjacent visible text already supplies the link name.
- Wrap the existing name and version elements in a text-stack element. Make the anchor a horizontal
  flex row and retain the current vertical rules on that nested stack.
- Declare the white SVG through `<link rel="icon" type="image/svg+xml">` in the common `<head>`.
  No fallback raster favicon is required for the approved scope.
- The reference fingerprints observed during planning are
  `39eb5b72c3658fac3c02633add5ce949b7e73ba3817d22a4a73177f9d89990ea` for Classic Purple and
  `d7791a259a361f2b9e757e16a17fe832698717982969abc15df3e12625d6c2cd` for Classic White.
- Both supplied assets are first-party user artwork. Their SVG geometry, embedded gradients,
  labels, and bytes remain unchanged when packaged.

## Scope and ownership

The `web_gui_coder` exclusively owns all implementation changes:

- `src/web/static/web/icons/bagredex-classic-purple.svg`: byte-for-byte packaged header asset.
- `src/web/static/web/icons/bagredex-classic-white.svg`: byte-for-byte packaged favicon asset.
- `src/web/templates/base.html`: shared favicon declaration and accessible brand composition.
- `src/web/static/web/css/site.css`: logo sizing, horizontal brand alignment, nested text stack, and
  responsive containment.
- `src/web/src/assets.test.ts`: exact-byte fingerprints and standalone-SVG safety regression coverage
  for both identity assets, or an equally focused Web-owned test file if separation is clearer.
- `src/web/tests/e2e/pokedex.spec.ts`: shared-shell assertions for image loading, favicon metadata,
  accessible name, link behavior, geometry, focus, and responsive containment.
- `src/web/ASSET_PROVENANCE.md`: first-party source date, packaged paths, fingerprints, and
  byte-for-byte handling.

The `architect` owns this plan, integration review, and the eventual cycle report. The
`web_gui_reviewer` owns independent Web GUI review. The `deployment_agent` owns final validation,
local commits, the report correction commit, and human-review candidate verification. No backend
or data owner changes are planned.

## Data and interface impact

- The base-template DOM gains one decorative image and one text-stack wrapper within the existing
  brand anchor. Existing selectors for `.site-header__brand-name` and `.site-header__version`
  remain stable; geometry tests must intentionally account for the wrapper and image.
- The document head gains a same-origin Django static URL for an SVG favicon.
- The brand URL, regulation suffix, visible wording, and accessible name remain compatible.
- No database, API, session, normalized-data, Vite-manifest, or deployment configuration interface
  changes.

## Implementation sequence

1. The `web_gui_coder` copies both reviewed reference SVGs into the planned static icon paths
   without rewriting them and documents their provenance and SHA-256 fingerprints.
2. The `web_gui_coder` adds the white icon link to the shared base-template head, then adds the
   decorative purple image and nested text stack to the existing brand anchor.
3. The `web_gui_coder` updates shared site CSS so the logo is visually balanced with the current
   two-line text, the stack retains its existing typography and gap, and the complete brand and
   focus outline remain inside the header across supported widths.
4. The `web_gui_coder` adds focused asset and browser regressions, adapting existing assertions
   that currently expect the brand anchor itself to be a column and to contain only two text
   elements.
5. The `web_gui_reviewer` reviews the complete Web diff. The `architect` separately checks plan
   compliance and cross-scope consistency. Actionable findings return to `web_gui_coder`, and both
   reviews repeat until no blocking findings remain.
6. The `architect` writes `docs/reports/2026-11-02-logo-and-web-icon.md`. The `deployment_agent`
   performs final checks and the feature commit, after which the architect records its exact hash
   and subject and the deployment agent commits that narrow correction and validates the human
   review candidate.

The implementation is a single Web GUI scope and has no safe coding work to parallelize.

## Review and verification

The `web_gui_reviewer` verifies:

- both packaged SVGs match their reference bytes and contain no scripts, event handlers, external
  resources, or unsafe standalone SVG content;
- the purple image is decorative and the brand link's accessible name remains `Bagredex` plus the
  configured version label exactly once;
- the favicon link is present in the shared document head, names the white asset with the SVG MIME
  type, resolves successfully, and applies to authenticated and login pages;
- the logo, text stack, link focus outline, navigation, and account controls do not overlap or
  escape the header in light and dark themes at representative desktop, tablet, and phone widths;
- existing regulation-preserving home navigation still works.

The architect verifies that the implementation stays entirely in the Web GUI scope, uses Django's
static page shell rather than a Preact island, and introduces no unplanned build or backend
contract.

The implementation owner runs and observes, using already-installed local tooling:

- `cd src/web && npm test -- --run src/assets.test.ts`
- `cd src/web && npm run check`
- `cd src/web && npm run build`
- the focused existing Playwright project/test selection covering the base header and login page,
  against the local Bagredex runtime;
- `.codex/lint.sh` before review handoff.

The deployment agent runs the repository-prescribed final validation, repeats `.codex/lint.sh`,
and, after both commits, runs `./bagredex.sh human-review candidate`. A managed-sandbox Playwright
launch failure may be retried only under the repository's exact local-tooling elevation rules.

## Risks

- The extra horizontal width can crowd navigation or account controls. Keep the logo modest,
  preserve flex shrink/containment behavior, and cover long-identity and narrow-viewport cases.
- The SVG's own `role` and `aria-label` could duplicate the brand when embedded as an image. An
  empty `alt` and `aria-hidden` on the HTML image must keep it out of the accessibility tree.
- Browser favicon rendering varies, especially against tab themes. The requested white artwork is
  authoritative; platform-specific fallbacks and theme switching remain outside scope.
- Static paths can silently drift from reference artwork. Exact-byte and fingerprint checks plus
  provenance documentation make later changes explicit and reviewable.

## Completion criteria

- The supplied purple mark appears left of the unchanged Bagredex/version stack as part of the one
  existing brand link.
- The supplied white mark is declared and served as the favicon on every base-template page.
- Packaged files match the documented references and hashes byte-for-byte.
- Automated checks cover asset safety and identity, favicon metadata and loading, accessible name,
  navigation, focus, and responsive layout.
- Required Web GUI and architect reviews report no blocking findings, and all required local checks
  pass with observed results.
- The cycle report names the exact feature commit, the report correction is committed separately,
  and `./bagredex.sh human-review candidate` reports that feature boundary as `available` with the
  exact feature commit.
