# Version label layout

## Summary

Make the global Bagredex version label an explicit, compact second line beneath the brand name. Keep
the existing single brand link and backend-provided text contract unchanged while making the label
visibly quieter and reliably aligned in every supported layout.

## Goals

- Guarantee that the version label is below, never beside, the Bagredex name.
- Left-align both lines with deliberate compact spacing and no overlap or clipping.
- Reduce the label's visual emphasis through smaller type, lower weight, and a muted but accessible
  color in light and dark themes.
- Preserve the single brand-link hit target, header/account alignment, focus treatment, and phone
  wrapping.

## Non-goals

- Changing `BAGREDEX_VERSION_LABEL`, its Django context processor, template variable name, escaping,
  or local/production values.
- Adding version data to the Pokédex bootstrap or client state.
- Splitting the brand and version into separate links or making the version interactive.
- Redesigning global navigation, account controls, header height, or the Pokédex toolbar.
- Changing backend, data, deploy, dependencies, build configuration, or package files.

## User-visible behavior

- `Bagredex` remains the prominent first line of the home link. The configured label, such as
  `development` or `v1.2.3`, appears on a true second line directly below it.
- The two lines share the same left edge. A small visible gap separates them without making the
  header feel taller than necessary.
- The label is clearly subordinate: smaller, lower weight, and more muted than the brand name while
  remaining readable against the header in light and dark themes.
- Hovering, focusing, or activating either line uses the same link. The visible focus outline
  encloses the complete two-line hit target.
- Header controls and account content keep their existing alignment. At tablet and phone widths the
  two-line brand stays intact while established header/account wrapping continues without overlap.

## Decisions and assumptions

- Keep the existing semantic structure: one `.site-header__brand` anchor containing a brand-name
  `<span>` and version `<small>`. A class may be added to either child only if it improves explicit
  selectors and tests; no extra interactive element is needed.
- Use an explicit vertical flex layout on the anchor: `display: inline-flex`,
  `flex-direction: column`, and `align-items: flex-start`. Do not rely on implicit grid placement,
  whitespace, `<br>`, width pressure, or browser line wrapping.
- Use an explicit small row gap around `0.1rem` rather than margins that can collapse. Rendered
  acceptance is a positive gap of approximately 1-4 CSS pixels.
- Give the two lines explicit line heights. The label remains materially smaller than the current
  1.25rem/800 brand treatment and uses a weight at or below 600.
- Use the existing muted text token if its measured contrast is at least 4.5:1 against the rendered
  header background in both themes. If it does not meet that threshold, select the nearest existing
  semantic token or a theme-token adjustment rather than a one-theme literal color.
- The complete anchor remains its own focusable hit target. Do not put `pointer-events: none`,
  independent focus styling, or accessibility-hiding attributes on either visible text line.

## Scope and ownership

### Web GUI coder

Own all implementation and tests under `src/web`:

- Update `static/web/css/site.css` to replace the implicit grid brand layout with explicit vertical
  flex, left alignment, compact gap/line heights, and lower-emphasis label typography.
- Update `templates/base.html` only if a child class is needed for durable selection; preserve one
  anchor and the exact `{{ bagredex_version_label }}` output.
- Extend `tests/e2e/pokedex.spec.ts` or the narrowest existing global-header browser coverage with
  rendered geometry, computed-style, contrast, focus, and responsive assertions.
- Add a focused template/static regression only if needed to protect the one-anchor/two-child
  semantic structure. Do not duplicate backend context/value tests in Web code.
- Do not edit `src/backend`, `src/data`, `deploy`, dependencies, lockfiles, or generated Vite output.

### Web GUI reviewer

Review `src/web` read-only for explicit vertical layout, single-link semantics, measured geometry,
theme contrast and emphasis, focus enclosure, header/account stability, responsive wrapping, and
test strength in Firefox and Chromium.

### Architect

Own this plan, final plan-completion review, and the cycle report. Confirm that the existing backend
context interface and version values remain untouched.

### Deployment agent

Own no source change. Run final offline Web/build/browser checks with already-local inputs, clean
temporary artifacts, and create the justified local commit after reviews.

## Data and interface impact

There is no data, backend, setting, template-context, API, bootstrap, persistence, URL, or deployment
change. `base.html` continues to consume `bagredex_version_label` through ordinary Django escaping.

The only observable change is CSS layout and visual hierarchy inside the existing brand anchor.

## Implementation sequence

1. The Web owner records current desktop/tablet/phone rendered brand/name/label/header/account boxes
   and computed colors in light and dark themes.
2. The Web owner applies the minimal explicit vertical-flex and subordinate-label CSS, adding a
   child class in `base.html` only if needed.
3. The Web owner adds focused geometry/style/focus assertions and runs static tests, the production
   build, and Firefox/Chromium responsive browser coverage.
4. The Web reviewer inspects source and rendered evidence. The owner resolves every actionable
   finding and reruns affected checks.
5. The architect verifies plan completion and writes the report. The deployment agent runs final
   validation, cleanup, and the pending local commit.

## Review and verification

- Assert `.site-header__brand` computes to an explicit vertical flex container with start alignment,
  and still contains exactly one Bagredex name and one version label inside one anchor.
- Measure rendered boxes in Firefox and Chromium. Require
  `label.top >= brandName.bottom + 1px`, a gap no larger than 4px, and left edges equal within 1px.
  Require neither text box to overlap or escape the anchor/header box.
- Assert the label's computed font size and weight are both lower than the brand name's and its
  computed color is distinct from the brand color.
- Resolve the rendered header background and assert label-to-background contrast is at least 4.5:1
  in light and dark themes. Record computed colors and ratios rather than relying on token names.
- Focus the brand by keyboard and assert one visible focus outline encloses both child boxes without
  clipping. Activate it and retain the existing home destination/accessibility name.
- Run geometry checks at desktop, tablet, and phone widths in light and dark themes. Confirm header
  controls/account boxes retain their established order/alignment, long identity wrapping remains
  contained, and the brand label never moves beside the name.
- Check authenticated server shell and loaded Pokédex states for stable header geometry; the island
  must not affect the server-rendered brand.
- Run the complete frontend unit/component/accessibility/performance suite, TypeScript and format
  checks, offline Vite build, `.codex/lint.sh`, and `git diff --check`; clean browser/build artifacts
  before handoff.

## Risks

- An implicit grid or inline layout can place the label beside the name under engine- or width-
  specific conditions. Explicit column flex plus rendered geometry assertions removes ambiguity.
- Making the label too muted can fail small-text contrast, especially over the translucent header.
  Measure the composited rendered background in both themes and retain at least 4.5:1.
- Tight line height or focus outlines can clip the second line. Assert child and outline containment
  rather than relying only on screenshots.
- Added brand height can disturb phone account wrapping. Compare header/control/account boxes across
  the supported viewport matrix.

Rollback restores the preceding brand CSS and any matching selector-only template/test change in
one Web-only commit. No server, data, or runtime rollback is required.

## Completion criteria

- The version is always a true second line with a positive compact gap and shared left edge in
  Firefox and Chromium across desktop, tablet, and phone.
- It is measurably smaller, lower weight, and color-distinct from Bagredex while meeting at least
  4.5:1 rendered contrast in both themes.
- One brand link and focus target encloses both lines without overlap, clipping, destination, or
  accessible-name regression.
- Header controls/account alignment and responsive wrapping remain green; the backend context/value
  contract and all non-Web scopes remain unchanged.
- All Web, build, browser, documentation, and diff checks pass with no blocking review findings.
- The cycle report records observed evidence, no hidden deferrals remain, temporary artifacts are
  cleaned, and the deployment agent reports the local commit.

Remaining material questions: none.
