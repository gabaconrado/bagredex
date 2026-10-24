# Team Builder empty-state E2E assertion

## Problem

An existing Team Builder desktop Playwright assertion uses a broad `/Regulation/i` text query to
check that a regulation label is absent. The correct empty-state copy also contains the word
“regulation,” so the assertion fails even though the page behavior is correct.

## Evidence

During final Item-information validation, the full browser run reached an assertion expecting
`sidebar.getByText(/Regulation/i)` to have count zero. The fresh database correctly rendered “No
teams in this regulation yet.”, which matched the query and caused the failure. The four focused
Item-information retained-version and touch scenarios passed across desktop and phone projects.

## Scope

- Replace the ambiguous text lookup with a selector or accessible query that targets the intended
  regulation label rather than arbitrary empty-state copy.
- Preserve the user-facing empty-state message and Team Builder behavior.
- Review nearby negative text assertions for the same ambiguity without broadening product scope.

## Acceptance criteria

- The assertion distinguishes the intended regulation label from “No teams in this regulation
  yet.”.
- The affected Team Builder Playwright test passes against a fresh local database.
- The relevant desktop project passes without weakening the assertion or changing correct UI copy.
- Existing Item-information retained-version and touch browser scenarios continue to pass.

## Deferral reason and dependencies

The failure predates and is behaviorally independent from Item information: it concerns an existing
selector and correct empty-state copy. The focused Item-information browser coverage passed, so
this correction can run as a separate Web GUI maintenance cycle with a local Playwright review
environment.
