# Use the latest regulation as the server URL default

## Problem

Global menu links currently append the active regulation query, such as `?regulation=m-c`, even
when that regulation is the latest/default context. The preferred behavior is for clean routes to
omit the query and for Django to resolve the latest regulation as the default.

## Evidence

The behavior was observed during the active Battle Mode human-review session. It affects global
navigation and regulation resolution across routes rather than the reviewed Battle Mode feature,
so the user explicitly deferred it to a follow-up.

## Scope

- Define one server-owned rule for resolving the latest regulation when no regulation query is
  present.
- Update global menu-link generation so the latest/default regulation does not add a query string.
- Confirm whether an explicitly selected historical regulation continues to propagate its query
  through navigation; this remains a product question when work resumes.
- Specify canonical URL, redirect, browser-history, and invalid or unavailable regulation behavior
  where current route contracts require it.
- Coordinate Django URL/context ownership with Web GUI navigation ownership without duplicating
  default-selection logic in the browser.
- Add backend and Web coverage for query-free default navigation, explicit non-default navigation,
  the global selector, and cross-route context consistency.

## Acceptance criteria

- Routes without a regulation query consistently resolve the server-selected latest regulation.
- Menu links omit the regulation query while the active regulation is the latest/default.
- Explicit non-default regulation navigation behavior is confirmed with the user and covered by
  tests.
- The global regulation selector and all regulation-aware routes retain the intended context.
- Canonicalization and browser-history behavior are consistent and tested where applicable.

## Deferral reason and dependencies

The user explicitly asked to record this as follow-up work and return to the active Battle Mode
human review. Implementation depends on resolving the historical-regulation propagation question
and requires coordinated backend and Web GUI ownership in a separate feature cycle.
