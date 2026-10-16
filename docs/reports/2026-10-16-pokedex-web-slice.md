# Regulation-aware Pokédex web slice report

## Outcome

Bagredex now opens on an authenticated, regulation-aware Pokédex for M-C and M-B. The page keeps
search, AND filtering, and stat sorting in the browser while Django serves version-consistent index,
detail, and exact sprite responses from the active immutable data release.

See the [regulation-aware Pokédex plan](../plans/2026-10-15-pokedex-web-slice.md).

## Changes

- Replaced the authenticated placeholder with the Pokédex shell, explicit M-C and M-B navigation,
  unavailable and stale-data states, and one focused Preact and TypeScript island.
- Added the complete legal-form list, grouped Pokémon, move, ability, and type search, removable AND
  filters, deterministic three-state stat sorting, keyboard interaction, and empty-result handling.
- Added exact-form details with normal and shiny sprites, bidirectional base and Mega navigation,
  level-50 stat ranges, abilities, the complete legal learnset, and move or ability information.
- Added authenticated, GET-only index, detail, and sprite endpoints with strict identifiers, active
  version checks, deterministic contracts, private ETags, safe sprite containment, and bounded
  database queries. No data model, migration, importer, or generated release changed.
- Added a locked Vite build, TypeScript checks, frontend unit and component tests, Playwright flows,
  Django manifest resolution, and rootless Podman packaging of verified hashed assets.
- Added responsive desktop, tablet, and phone layouts plus light and dark themes, visible focus,
  touch-sized controls, live status announcements, and reduced-motion behavior.

## Review cycles

Backend review approved authentication, regulation and version scoping, response contracts, exact
stat calculations, query bounds, conditional responses, and sprite path safety after owner
corrections. Web GUI review approved the typed transport boundary, local interaction behavior,
accessibility states, responsive styling, and tests after owner corrections.

Initial cross-scope review rejected browser timings gathered across automation IPC and two animation
frames as unsuitable evidence for the one-frame ordinary-control target. The Web GUI owner then
memoized keyed Pokémon rows and stabilized callbacks. A corrected in-page diagnostic measured from
immediately before activation to the deterministic DOM mutation. Across 12 post-warm-up samples,
filter work had a 1.10 ms median and 2.30 ms maximum; HP sorting had a 5.30 ms median and 8.20 ms
maximum. The Web GUI reviewer approved the correction and final integration review found no
remaining blocker.

The dependency installation was explicitly authorized by the user and remained project-local. Ten
direct packages resolve to 267 unique package versions through the integrity-bearing lockfile; a
clean `npm ci` installed 198 package paths. The reviewed build disables lifecycle scripts and
requires no registry at runtime.

## Verification

- All 173 PostgreSQL backend tests passed, including authentication, M-C and M-B scoping, stale
  versions, exact details and stats, ETags, sprite containment, and bounded queries.
- All 65 frontend tests passed. The optimized JavaScript bundle is 35.04 kB raw and 12.70 kB gzip;
  CSS is 8.12 kB raw and 2.16 kB gzip.
- The offline npm audit reported zero vulnerabilities at every severity. Its metadata reported two
  production, 248 development, 54 optional, and three peer dependencies, whose npm categories
  overlap. License inspection of the 198 installed package instances found 173 MIT, eight
  Apache-2.0, six ISC, one CC-BY-4.0, eight BSD-2-Clause, and two BSD-3-Clause declarations, with
  none undeclared.
- All 37 deployment tests passed. Offline application and Nginx image builds contained the Vite
  manifest and referenced assets with matching hashes.
- Six Chromium end-to-end flows passed at desktop and phone viewports against the local stack,
  covering both regulations, keyboard selection, combined filters, sorting, Mega navigation,
  shiny sprites, and detail replacement.
- After installing the project-pinned Playwright WebKit 26.5 revision 2336, all three
  `tablet-dark-reduced` flows passed against the loaded and active local stack in 7.6 seconds:
  regulation navigation and keyboard selection in 2.7 seconds, filters and sorting in 2.0 seconds,
  and Mega navigation and detail replacement in 2.1 seconds.
- The M-C index is 411,860 bytes raw and 50,808 bytes gzip. Serialization used eight database
  queries and took 131.75 ms; initial visible rendering took 454.61 ms.
- Corrected synchronous in-page interaction measurements remained within one animation frame:
  filter median 1.10 ms and maximum 2.30 ms; sort median 5.30 ms and maximum 8.20 ms.
- Repository checks, documentation lint, frontend type, format, test and production-build checks,
  backend checks, deployment checks, and `git diff --check` passed.

A separate next-animation-frame observation measured filter median 3.75 ms and maximum 5.30 ms,
and sort median 26.45 ms and maximum 41.50 ms. That signal is phase- and scheduler-dependent and had
no no-op or dropped-frame baseline, so it is not evidence that synchronous control work missed the
target. It remains useful comparison data if future profiling shows visible frame loss.

The WebKit follow-up reused existing local images with pulling disabled and no image build. Its
ephemeral account, browser output, and test artifacts were removed afterward; the validation made
no source changes.

## Deferred work

No focused implementation task is required from this cycle. Team building, damage calculation,
journey logging, persistent Pokédex state, and animated sprites remain outside this feature.

## Commits

This report is included in the pending cycle commit.
