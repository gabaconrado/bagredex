# Human review workflow

## Summary

Add an explicit-only `$human-review` Codex skill for optional visual feedback after an ordinary
feature cycle is complete and committed. The skill starts or resumes one isolated local Bagredex
review session, gives the user its loopback URL and local credentials, routes feedback through the
existing owners, and refreshes the same disposable environment after each implementation round.

Normal `feature-development` remains unchanged through implementation, independent review, full
checks, report, and local commit. Human review is a separate, user-invoked follow-up phase. Its
focused feedback rounds intentionally defer independent reviewers, full validation, a session
report, and the follow-up commit until the user explicitly finishes. Finishing a changed session
returns to those normal workflow gates; finishing an unchanged session only removes that session's
local resources.

## Goals

- Make human browser review available only through explicit `$human-review` invocation.
- Default unambiguously to the most recently completed feature while allowing the user to identify
  another completed feature.
- Give every new session a fresh, disposable PostgreSQL database and isolated Bagredex containers,
  while preserving data across reloads and interruptions within that session.
- Support repeated feedback, focused implementation checks, automatic environment rebuild/reload,
  and return to the user for another visual pass.
- Preserve all ordinary review, report, validation, and commit gates once the user ends a changed
  session.
- Tear down only the explicitly finished human-review session and never delete it automatically.

## Non-goals

- Changing the required steps, ownership, or commit behavior of an ordinary feature cycle.
- Automatically opening a browser, changing Incus proxies, binding beyond loopback, or contacting a
  registry, remote host, cloud service, or Git remote.
- Running multiple human-review sessions concurrently.
- Turning ordinary feature completion into an implicit visual-review phase.
- Committing each feedback round, amending or rewriting the original feature commit, or editing the
  original feature plan/report.
- Persisting a human-review database after the user explicitly finishes the session.
- General-purpose container/session management or cleanup of unrelated Podman resources.

## User-visible behavior

### Invocation and target selection

- The skill appears as `$human-review` and cannot be selected implicitly. Mentioning visual review
  without explicitly invoking the skill does not start containers or alter the feature workflow.
- A new invocation resolves completed features from repository-local evidence: a matching plan and
  completed report plus the reported local commit or current committed history. By default it uses
  the most recently completed feature. It asks one concise question only when recency is genuinely
  ambiguous or the requested target cannot be identified safely.
- A feature still in its normal implementation/review/report/commit cycle is not eligible. The
  skill explains which completion gate is missing and does not start a session.
- If an active session exists, invocation resumes that session regardless of the newest completed
  feature. The skill reports the active target and does not silently replace it. Starting another
  target requires explicitly finishing the active session first.

### Session lifecycle

- Starting a new session creates a dedicated local Compose project and a fresh dedicated database
  volume, builds the current working tree, applies migrations, loads and activates the exact bundle
  pinned by `deploy/pokemon-data.env`, creates the local review account, starts the server detached,
  waits for readiness, and prints the loopback URL, username, password, target feature, and active
  data version.
- Only one session may be active. Reloading the site or rebuilding after a feedback round preserves
  the session database and user-entered review data.
- The lifecycle records an ignored local marker before mutating Podman state. If execution is
  interrupted or Codex stops, the next `$human-review` invocation reconciles that marker with the
  fixed Compose project, resumes or repairs startup without clearing the database, and prints the
  same connection information.
- Startup, status, and reload never delete the session. A failed or partially completed startup is
  retained for recovery and reported with an actionable state. The workflow never treats failure,
  interruption, inactivity, or a missing server process as permission to remove the volume.
- After each implemented feedback round, the deployment agent runs a reload operation that rebuilds
  frontend assets and the server image, reapplies migrations and the pinned data/account setup
  idempotently, restarts the detached server against the same volume, waits for readiness, and
  returns the URL and credentials. Control then returns to the user for visual inspection.
- Only an explicit user statement that human review is finished ends the loop. Finish stops and
  removes the session's containers/network and its dedicated database volume, then removes the
  marker only after Podman confirms the scoped teardown. It never targets the ordinary
  `bagredex-local` or production `bagredex` projects or their volumes.

### Feedback routing

- Straightforward feedback within the completed feature goes directly to the exclusive owning
  coder after a concise human-review plan entry identifies scope and acceptance behavior. Examples
  include copy, spacing, focus, validation messaging, or a contained defect in one owned scope.
- Ambiguous feedback uses `grill-me` one question at a time until the expected behavior is testable.
  Architectural, data-contract, deployment-contract, or cross-scope feedback uses the architect to
  resolve interfaces and update the session plan before coders act.
- Closely related fixes and UX/polish remain in the active review session. Feedback that materially
  expands beyond the completed feature's goal or introduces a separable product capability stops
  the human-review loop without tearing down its environment and starts a new ordinary
  `feature-development` cycle. The existing session is reported as active and may be finished or
  resumed later; its uncommitted changes are never folded silently into the new scope.
- Each coder changes only owned paths and runs focused formatting, lint, type, unit, or component
  checks appropriate to the round. Independent reviewers, architect integration review, full
  repository/integration tests, session report, final deployment validation, and Git mutation are
  deferred until explicit finish.

### Artifacts and completion

- Starting and inspecting a session creates no tracked artifact. On the first accepted feedback
  that will change tracked files, the architect creates
  `docs/plans/YYYY-MM-DD-<feature>-human-review.md`. Later rounds update that one plan with approved
  feedback, ownership, acceptance conditions, and round ordering. The original feature plan and
  report remain byte-for-byte unchanged.
- If the user finishes without requesting a tracked change, the skill tears down the environment
  and stops. It creates no plan, report, review cycle, test run, or commit.
- When a changed session is finished, matching reviewers inspect all accumulated follow-up changes,
  owners address findings until no blockers remain, and the architect performs integration review.
  The deployment agent runs the complete plan-required validation, then the architect writes one
  `docs/reports/YYYY-MM-DD-<feature>-human-review.md`. The deployment agent makes one final
  follow-up commit containing the accumulated reviewed changes and new plan/report. It does not
  amend the original feature commit.
- Teardown occurs on explicit finish even if the later review/check/commit phase finds a defect;
  that phase uses ordinary deterministic tests and may create a new local validation environment as
  required. A teardown failure stops completion, preserves the marker, and is reported rather than
  being hidden by artifact or commit work.

## Decisions and assumptions

- The completed interview is authoritative and leaves no material product question.
- The existing `./bagredex.sh review` command remains unchanged for ordinary foreground browser
  review. Its shared `bagredex-local` project and preserved `bagredex-local-database` volume do not
  satisfy fresh-session isolation, resumability, or explicit volume deletion.
- Add a separate top-level lifecycle, exposed as
  `./bagredex.sh human-review {start|status|reload|finish}`. The skill invokes these deterministic
  commands through the deployment agent instead of reconstructing Podman commands in prompts.
- Use one fixed, distinctive Compose project, `bagredex-human-review`, and one explicit named volume,
  `bagredex-human-review-database`. Fixed identifiers make the one-session invariant and destructive
  finish target inspectable. Compose overrides parameterize only this workflow and never rename the
  ordinary local or production volumes.
- Store session metadata under ignored `.cache/human-review/session`, created atomically with owner-
  only permissions. It contains a format version, target feature slug, original plan/report paths,
  base commit, port, local username, creation time, and lifecycle state. The default password may
  use the existing loopback-only review value; any stored credential remains in this ignored,
  mode-`0600` file and is never printed to command logs, committed, or embedded in Compose.
- The marker is created before the first Compose mutation and is removed only after explicit finish
  succeeds. Marker and Podman labels are reconciled; neither alone authorizes deletion. Unexpected
  resources, invalid identifiers, another process holding the session lock, missing tools, or
  marker/resource disagreement fail closed with diagnostics.
- A repository-local `flock` lock under `.cache/human-review` serializes lifecycle commands. It is
  an execution lock, not session state, and is released when the command exits.
- `start` is allowed only with no active marker and no matching fixed project resources. It creates
  the fresh named volume through Compose. Orphaned matching resources without a valid marker are a
  recovery error, not an invitation to delete them. `reload` never passes `--volumes`; `finish`
  uses only the exact validated project/files and `down --volumes --remove-orphans` after confirming
  matching Compose labels and the expected named volume.
- Session state is not a task queue. The skill and supplemental plan carry feedback/round history;
  the marker carries only operational facts needed for deterministic recovery.
- The base commit proves the original completed boundary and helps the deployment agent distinguish
  follow-up changes from unrelated work. It does not grant permission to reset, clean, stash, or
  overwrite the worktree.
- “Most recently completed” means the newest completed feature report/commit evidence, not filename
  ordering alone. Same-time candidates, missing report/plan pairs, an uncommitted original feature,
  or conflicting explicit context are ambiguous and require one question.

## Scope and ownership

### Architect

Owns:

- `docs/plans/2026-10-22-human-review-workflow.md`
- Human-review supplemental plans and reports created by later sessions
- Cross-scope review of this workflow implementation

The architect does not implement lifecycle shell code or mutate Git.

### Deployment agent

Exclusively owns:

- Workflow-policy amendments to `AGENTS.md`, `.agents/skills/feature-development/SKILL.md`, and
  `.agents/skills/feature-development/references/artifacts.md` after architect contract review
- `.agents/skills/human-review/SKILL.md`, its `agents/openai.yaml`, and a focused reference only if
  needed for progressive disclosure
- Human-review lifecycle implementation in `bagredex.sh` and, if separation improves testing,
  `deploy/scripts/human-review.sh`
- A dedicated override such as `deploy/compose.human-review.yaml`
- Lifecycle mocks and behavioral coverage in `deploy/tests/commands.bats` or a focused new Bats file
- Human-facing command documentation in `deploy/README.md` and the top-level `README.md`
- Final local Podman validation and all local Git commits

The deployment agent may inspect application setup interfaces but does not edit `src/backend`,
`src/web`, or `src/data` for this workflow feature. It follows the existing narrow elevation policy
for exact approved local Bagredex Podman commands and never pulls images or contacts a registry.
The new skill must set `policy.allow_implicit_invocation: false`, route to repository commands and
existing roles rather than duplicate shell implementation, and pass the available skill validator.

### Existing coders and reviewers

- No application/data/Web implementation is required to add this workflow.
- During a later human-review session, `backend_coder`, `web_gui_coder`,
  `pokemon_data_coder`, and `deployment_agent` retain their existing exclusive path ownership.
- On explicit changed-session finish, invoke only reviewers matching accumulated changed scopes,
  then the architect. Deployment-only or documentation/skill-only changes receive deployment and
  architect review; do not dispatch unrelated reviewers mechanically.

Implementation ordering is architect policy/skill contract first, then deployment lifecycle and
tests. Those scopes are not safely independent because the scripts must implement the exact skill
state machine.

## Data and interface impact

### Workflow policy

Update `AGENTS.md` and `feature-development` once, without duplicating the entire human-review
procedure:

- State that normal completion remains the current nine-step cycle and local commit.
- Add an optional post-completion phase entered only by explicit `$human-review` invocation.
- Define focused-round deferrals and the changed/unchanged finish branches.
- Link the detailed lifecycle/routing behavior to the `human-review` skill.
- Add the `*-human-review.md` plan/report naming case to the artifact reference while preserving
  existing standard feature artifacts.

The repository skill catalog discovers `.agents/skills/human-review`. Its frontmatter description
must say that it runs an optional review loop for an already completed Bagredex feature and requires
explicit invocation. `agents/openai.yaml` supplies matching display metadata and disables implicit
invocation. No custom agent is added; existing agents already encode the required ownership.

### Command contract

Expose exactly four subcommands through the existing entry point:

```text
./bagredex.sh human-review start TARGET
./bagredex.sh human-review status
./bagredex.sh human-review reload
./bagredex.sh human-review finish
```

`TARGET` is a validated lowercase artifact slug selected by the skill, not arbitrary shell or path
input. `start` validates a matching completed plan/report and records their repository-relative
paths and current commit before Podman mutation. `status`, `reload`, and `finish` take no target and
read the active marker. Reject extra arguments and identifiers outside a conservative
`[a-z0-9][a-z0-9-]*` form.

All successful `start`, `status`, and `reload` outputs use stable labeled lines for target, state,
URL, username, password, active bundle, project, and volume so the skill can relay them without
parsing prose. Diagnostics and exit codes distinguish no session, already active, busy, recoverable
partial startup, ready, teardown failure, and invalid state. Credentials must not appear in mock
command logs or Podman argument strings.

The dedicated Compose override:

- preserves the base PostgreSQL/server topology and loopback-only server port;
- names only the dedicated human-review volume;
- uses the existing development image and bind mounts so a rebuild reflects current source;
- has no production, Nginx, certificate, external-network, or registry behavior; and
- accepts the validated session port without modifying global environment or Compose configuration.

Factor existing review initialization helpers where useful: frontend locked install/build, pinned
bundle validation, database/server readiness, migrations, strict data load/activation, and account
creation. Do not create a second divergent embedded Python account implementation.

Lifecycle transitions are:

```text
absent -> starting -> ready -> reloading -> ready -> finishing -> absent
                    ^            |
                    |------------|
```

An interrupted `starting`, `reloading`, or `finishing` state remains recorded. Resume reconciles
actual labeled resources: it may repeat idempotent build/migrate/load/account/start/readiness steps
for starting/reloading, or repeat the same exact teardown for finishing. It never initializes a
fresh database while an active marker exists. State updates use write-to-temporary plus atomic
rename after each completed transition.

Freshness is observable: a successful finish removes the dedicated named volume; only a later
`start` may recreate it. Ordinary `review`, `run`, `test`, and production commands retain their
current volume names and semantics.

### Session artifact contract

The first changed round creates one supplemental plan with the ordinary implementation-plan
sections, narrowed to:

- original feature plan/report and base commit;
- user-observed feedback and resolved acceptance behavior;
- round number, affected owner/paths, focused checks, and whether feedback expanded scope;
- accumulated interfaces, risks, deferred full checks/reviews, and finish criteria.

Update that plan rather than creating one file per round. The final supplemental report links both
the original feature artifacts and this plan, summarizes all rounds and reviewer corrections, lists
observed final checks, and records the single pending/final follow-up commit. It must not claim that
interactive visual approval substitutes for automated or independent review.

No Django model, migration, Pokémon release, API, Web bundle, or production runtime interface
changes as part of this workflow feature.

## Implementation sequence

1. The architect updates the repository policy and artifact guidance, then creates the concise
   explicit-only skill and optional focused reference. Validate the skill structure before shell
   implementation relies on its command contract.
2. The deployment agent adds the dedicated Compose override and the four lifecycle commands with
   strict arguments, fixed scoped identifiers, atomic `0600` marker, locking, labeled output, and
   fail-closed reconciliation. Reuse existing local-review initialization functions rather than
   forking their behavior.
3. Add Bats mocks/tests for every lifecycle transition, interruption/recovery case, command
   isolation, credential handling, and exact destructive target. Keep the current `review` tests
   passing unchanged.
4. Document explicit skill invocation, command states, fresh-versus-preserved data behavior,
   recovery, finish semantics, loopback credentials, and the boundary from focused rounds back to
   normal completion.
5. The deployment agent runs shell/static/Bats checks and an approved local Podman smoke test using
   already-local images. Verify start, data persistence over reload, status/resume, explicit finish,
   volume removal, and a second fresh start; finish the smoke-test session explicitly.
6. The architect reviews the complete implementation and observed evidence for policy/script
   agreement, ownership, scope expansion, recovery, and destructive safety. Return findings to the
   owning architect or deployment agent and repeat checks/review until no blocker remains.
7. The architect writes `docs/reports/2026-10-22-human-review-workflow.md`. The deployment agent
   runs final checks, stages only this feature, and creates the ordinary local feature commit.

## Review and verification

### Skill and policy checks

- Run the skill creator validator against `.agents/skills/human-review` and inspect that the
  frontmatter name matches its directory, description is discriminating, referenced resources
  exist, and no scaffold placeholders remain.
- Assert `agents/openai.yaml` contains `policy.allow_implicit_invocation: false`; validate an
  explicit `$human-review` routes to the skill while an ordinary visual-feedback request does not.
- Review `AGENTS.md`, `feature-development`, and artifact guidance for one consistent rule: ordinary
  feature cycles still complete before optional human review; only changed finished sessions enter
  review/test/report/commit; original artifacts and commits are immutable.
- Exercise routing scenarios without source edits: clear single-scope feedback, ambiguous feedback,
  architectural feedback, material expansion, interrupted session, unchanged finish, and changed
  finish.

### Shell and mocked lifecycle checks

Run:

```text
bash -n bagredex.sh deploy/scripts/*.sh
shellcheck bagredex.sh deploy/scripts/*.sh
bats deploy/tests
.codex/lint.sh
```

Bats coverage proves:

- help and strict argument/target validation occur before mutation;
- start rejects an incomplete target, second active session, invalid marker, occupied port, missing
  pin/tool, unexpected fixed-name resource, and concurrent lock holder;
- marker creation precedes Compose mutation, uses atomic replacement and mode `0600`, and contains
  only validated repository-relative/session values;
- new start uses `bagredex-human-review` and `bagredex-human-review-database`, initializes in order,
  withholds credentials until readiness, and never targets ordinary/production projects;
- status is read-only, reports ready/stopped/partial facts, and performs no build, start, down, or
  volume operation;
- reload preserves the volume, rebuilds assets/image, repeats migrate/load/activate/account setup
  safely, restarts the server, and reports readiness;
- interrupted/failing start and reload retain marker and volume; the next invocation resumes
  idempotently without fresh initialization or deletion;
- finish requires the valid marker plus matching Compose labels/volume, issues one exact scoped
  `down --volumes --remove-orphans`, removes the marker only after success, and retains it after
  failure;
- no start/status/reload/error/signal path invokes `down --volumes`, `volume rm`, `prune`, or another
  account-wide/destructive command;
- credentials containing shell metacharacters never enter command strings/logs, and marker/output
  values cannot inject shell or Compose arguments;
- current `review`, `run`, `test`, migration, and production command behavior remains unchanged.

### Local Podman smoke test

Before any elevated command, confirm required images are already local and the operation cannot
pull. In the dedicated project only:

1. Start a session for a known completed feature and observe readiness, URL, authentication, pinned
   active data, and exact target metadata.
2. Create a recognizable database record through the application, reload the session, and verify
   the record remains.
3. Stop only the human-review server or interrupt a reload, invoke the skill/status again, and
   verify it recovers the same volume and record.
4. Finish explicitly and prove the human-review containers, network, and dedicated volume are gone
   while ordinary local/production named resources are untouched.
5. Start a second session and prove the recognizable record is absent, then finish it explicitly.

Record exact commands and observed results; do not claim Podman coverage when only mocks ran.

### Final review and Git checks

- The architect inspects the full diff, original local-review tests, workflow docs, and smoke-test
  evidence. Findings include path/location, failure mode, owner, and acceptance condition.
- The deployment agent runs `.codex/lint.sh`, deployment Bats, shell syntax/ShellCheck, skill
  validation, `git diff --check`, and the plan-required local smoke test before commit.
- Inspect staged content to exclude `.cache/human-review`, credentials, runtime markers, generated
  database state, unrelated changes, and original feature artifact modifications.

## Risks

- A teardown command can delete valuable state if its target is derived loosely. Fixed names,
  validated marker values, Compose-label checks, a lock, and exact project/volume assertions gate
  the only `--volumes` operation.
- A marker can survive a crash while containers are stopped, or resources can survive marker loss.
  Idempotent reconciliation resumes the first case and fails closed on the second; it never guesses
  that unmarked resources are disposable.
- Existing local review shares a persistent volume. Reusing it would violate fresh sessions and
  risk deleting ordinary developer data, so the new project/override must remain isolated.
- Long-lived uncommitted feedback rounds increase worktree ambiguity. The session plan, base commit,
  path ownership, and deployment agent's final staged-diff review prevent unrelated changes from
  being absorbed. The workflow never stashes, resets, cleans, or switches branches automatically.
- A user may describe a new feature as polish. The skill compares feedback to the original plan's
  goals/non-goals and sends uncertain boundaries to the architect; material expansion becomes a
  normal feature cycle before implementation.
- Deferring reviewers/full tests speeds the visual loop but can accumulate defects. Focused coder
  checks are mandatory each round, and explicit finish cannot commit until matching reviewers,
  integration review, full validation, and fixes complete.
- Stored local credentials are sensitive even on loopback. The marker is ignored and mode `0600`,
  output occurs only after readiness, tests prevent command-log leakage, and teardown removes it.
- An explicit-only skill can be misconfigured and begin matching ordinary requests. The UI policy
  field and behavioral routing check are completion gates, not documentation alone.

## Completion criteria

- `$human-review` exists in `.agents/skills`, validates successfully, and is callable explicitly but
  never implicitly selected.
- Repository policy preserves the normal completed-and-committed feature cycle and defines one
  consistent optional changed/unchanged human-review finish path.
- The deterministic start/status/reload/finish commands enforce one isolated session, fresh data on
  new start, preserved data within a session, interruption recovery, stable connection output, and
  explicit-only scoped deletion.
- Mocked lifecycle coverage and an observed already-local Podman smoke test prove reload persistence,
  resume, finish removal, second-session freshness, and isolation from ordinary/production state.
- Feedback routing uses the proper coder, `grill-me`, or architect; material expansion becomes a new
  normal feature; each round runs focused checks and automatically reloads before returning to the
  user.
- Unchanged sessions create no artifacts, review work, tests, or commit. Changed sessions accumulate
  one `*-human-review.md` plan, then on explicit finish complete matching reviews, architect review,
  full validation, one report, teardown, and one separate follow-up commit without modifying the
  original feature artifacts or commit.
- Documentation, shell, Bats, skill validation, lint, diff, scope reviews, and final integration
  review have no blocking findings, and the deployment agent reports the ordinary local workflow-
  feature commit without any Git remote operation.
