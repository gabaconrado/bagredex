# Streamlined login form

## Summary

Remove the decorative heading block and administrator guidance from the Bagredex login card so
the visible form contains only credential controls, relevant validation errors, and the submit
button. Preserve a visually hidden login heading for screen-reader navigation and leave all
authentication behavior unchanged.

## Goals

- Remove the visible `Pokémon VGC companion`, `Log in to Bagredex`, and `Use the account created
  for you by an administrator.` copy from the login card.
- Retain a semantic `h1` named `Log in` and hide it only visually with a reusable accessible CSS
  utility.
- Keep the login card's accessible name through its existing `aria-labelledby` relationship.
- Remove CSS selectors that become obsolete with the deleted visible heading block.
- Preserve the current light and dark themes, responsive layout, focus treatment, and form error
  presentation.

## Non-goals

- Changes to authentication, authorization, login redirects, sessions, logout, Django admin, or
  account provisioning.
- Changes to field labels, the `Log in` button, generic credential errors, or field-level errors.
- Backend, deployment, Pokémon data, database, or dependency changes.
- JavaScript, a Preact island, or broader redesign of the login card and application shell.
- Static-asset fingerprinting or browser cache policy changes.

## User-visible behavior

- The default login card visibly shows the username field, password field, and `Log in` button.
- When validation fails, the existing generic or field-level errors appear with the same placement,
  styling, alert semantics, and control associations as today.
- The prior eyebrow, visible page heading, and administrator guidance are absent.
- Screen-reader heading navigation still exposes one level-one `Log in` heading, and the login
  section remains named by that heading.
- The browser document title remains `Log in | Bagredex`.
- Autofocus starts on the username field, both inputs retain their current autocomplete values,
  and keyboard focus remains visibly indicated.

## Decisions and assumptions

- Keep the existing `section.login-card` and `aria-labelledby="login-title"`. Place a single
  `<h1 id="login-title" class="visually-hidden">Log in</h1>` directly inside it before errors and
  the form.
- Implement `visually-hidden` as a general-purpose plain CSS utility using the established clipped
  one-pixel pattern. It must hide content visually without `display: none`, `visibility: hidden`,
  `hidden`, or `aria-hidden`, all of which would remove the heading from assistive navigation.
- Delete the entire visible `.login-card__heading` block, including the existing eyebrow. The
  agreed visible-card constraint supersedes retaining that decorative text.
- Delete `.login-card__heading`, `.login-card__heading h1`,
  `.login-card__heading > :last-child`, and `.login-card__eyebrow` rules because nothing else uses
  them. Do not alter unrelated global heading or card styles.
- Preserve the existing form markup and Django template behavior exactly: CSRF token, safe `next`
  hidden value, username value redisplay, `required`, `maxlength`, autofocus, autocomplete,
  generic errors, field errors, `aria-invalid`, and `aria-describedby` remain intact.
- No material product questions remain; the user approved the visually hidden heading explicitly.

## Scope and ownership

### Web GUI coder

Own only these `src/web` changes:

- `templates/registration/login.html`: replace the visible heading block with the accessible
  visually hidden `Log in` heading while leaving the form and validation markup unchanged.
- `static/web/css/site.css`: add the reusable visually hidden utility and remove only the obsolete
  login-heading selectors.

The Web GUI coder must preserve unrelated user changes and must not edit `src/backend`, `src/data`,
deployment files, documentation artifacts, or the untracked `debug/` screenshots.

### Reviewers, architect, and deployment agent

- `web_gui_reviewer` reviews `src/web` without editing it, emphasizing heading semantics,
  accessible naming, error associations, keyboard focus, responsive spacing, and both themes.
- The architect reviews the complete feature diff and reviewer result for plan compliance and
  confirms that no authentication or cross-scope contract changed.
- The architect owns the cycle report under `docs/reports` after findings are resolved.
- The `deployment_agent` runs final checks and owns the justified local commit. It must not include
  the unrelated `debug/` screenshots unless the user separately requests that.
- Backend, Pokémon data, and deployment implementation or specialist review agents are not needed
  because their owned behavior and files do not change.

## Data and interface impact

There are no database, data-version, URL, request, response-status, form-submission, authentication,
session, or deployment-interface changes. The server-rendered HTML changes only in presentation:
the login section retains `aria-labelledby="login-title"`, while its referenced heading text
changes from visible `Log in to Bagredex` to visually hidden `Log in`.

The stylesheet gains one reusable accessibility utility and drops selectors that have no remaining
markup consumer. Existing class names for the card, form, controls, submit button, and errors remain
stable. No compatibility migration or rollback step is required; reverting the template and CSS
changes restores the prior presentation.

## Implementation sequence

1. The Web GUI coder updates the login template, replacing the visible heading wrapper and all
   three pieces of introductory copy with the visually hidden `Log in` `h1`.
2. The Web GUI coder adds the general visually hidden utility to `site.css` and removes the four
   now-unused login-heading rule sets without changing login form spacing or error styling.
3. The Web GUI coder verifies the rendered login response and runs the scoped and repository
   checks before review handoff.
4. The Web GUI reviewer inspects the complete `src/web` diff and the rendered normal and invalid
   states. Any actionable findings return to the Web GUI coder and review repeats until no blockers
   remain.
5. The architect performs integration review, then writes the cycle report after all findings are
   resolved.
6. The deployment agent runs final validation and creates the local feature commit while excluding
   unrelated files.

Only one implementation scope changes, so coding work is sequential and no parallel ownership split
is useful.

## Review and verification

The Web GUI coder and reviewer must verify:

- The rendered anonymous `GET /login/` keeps the document title `Log in | Bagredex` and contains
  exactly one `h1`, whose accessible text is `Log in` and whose `id` matches the login section's
  `aria-labelledby` value.
- The heading is visually hidden but remains in the accessibility tree; it is not hidden with
  `display`, `visibility`, the HTML `hidden` attribute, or `aria-hidden`.
- The rendered page no longer contains `Pokémon VGC companion`, `Log in to Bagredex`, or
  `Use the account created for you by an administrator.`
- The visible default card contains only the username and password controls and submit button;
  invalid submission additionally shows the existing associated validation errors.
- Username retains autofocus and `autocomplete="username"`; password retains
  `autocomplete="current-password"`; labels, CSRF, safe `next`, and error IDs/ARIA associations
  are unchanged.
- The card remains usable at desktop, tablet, and phone widths in both light and dark color schemes,
  with no unexpected empty heading space and with visible keyboard focus.
- Removed CSS selectors have no remaining consumers and the new utility does not change unrelated
  layout.

Run and observe at minimum:

```bash
uv run --project src/backend pytest -c src/backend/pyproject.toml \
  src/backend/tests/test_authentication.py
.codex/lint.sh
git diff --check
```

If the repository's established command syntax differs, use the equivalent checked-in command
without changing environment or cache configuration. The deployment agent runs the complete final
validation required by the repository before committing.

## Risks

- Removing the visible heading without a screen-reader equivalent would weaken page navigation;
  the retained semantic `h1` and explicit section label prevent that regression.
- Incorrect visually hidden CSS could create overflow, a visible one-pixel artifact, or remove the
  heading from assistive technology; review includes visual and accessibility-tree inspection.
- Editing the form while simplifying adjacent markup could accidentally drop CSRF, safe redirect,
  autocomplete, autofocus, or error associations; the implementation deliberately leaves the form
  subtree unchanged and verification covers those contracts.
- Browser caching can temporarily retain the prior stylesheet after deployment. This feature does
  not change the existing static-asset caching architecture; a refresh remains an operational
  workaround, and fingerprinting would require separately approved work.

## Completion criteria

- The three introductory strings are absent from the rendered login page.
- The visible normal-state card contains only the credential controls and `Log in` button.
- A visually hidden level-one `Log in` heading remains exposed to assistive technology and names
  the login section.
- Existing form behavior, errors, security controls, document title, themes, responsiveness, and
  authentication semantics remain unchanged.
- The Web GUI reviewer and architect report no blocking findings.
- Required checks pass with observed results, the cycle report exists, unrelated `debug/` content
  remains untouched, and the deployment agent creates and reports the local commit.
