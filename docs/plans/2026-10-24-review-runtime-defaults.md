# Review runtime defaults

## Summary

Make Bagredex's two local browser-review paths consistently reachable through the host proxy and
easier to enter. Ordinary `./bagredex.sh review` keeps its configurable loopback port and existing
`8000` default. Explicit human-review sessions use fixed loopback port `8000`. Both paths default
their local administrator username and password to `admin` while retaining intentional credential
environment overrides.

The currently active Basic Team Builder human-review session was created with the old port and
password defaults. Upgrade it through the supported reload lifecycle without editing or deleting
its marker directly and without replacing its dedicated database volume.

## Goals

- Make a default human-review session reachable through the host proxy on port `8000`.
- Keep `BAGREDEX_PORT` as the supported way to choose another port for ordinary review.
- Prevent the explicit `$human-review` workflow from injecting a port override when it asks the
  deployment agent to run lifecycle commands.
- Default both review accounts to username `admin` and password `admin`.
- Preserve explicit `BAGREDEX_REVIEW_USERNAME` and `BAGREDEX_REVIEW_PASSWORD` overrides for direct
  shell-command use.
- Migrate the active human-review session to the new endpoint and credentials through an
  idempotent, data-preserving reload.

## Non-goals

- Changing application authentication, production credentials, production port bindings, or
  non-review Compose projects.
- Making ordinary review and human review run concurrently on the same host port.
- Binding either review server beyond loopback, changing the proxy device, or opening a browser.
- Changing human-review target selection, feature eligibility, database isolation, finish
  semantics, or feedback routing.
- Deleting or recreating the active human-review database volume.
- Adding dependencies or contacting a registry, remote host, operational service, or Git remote.

## User-visible behavior

### Ordinary review

- Running `./bagredex.sh review` without environment overrides continues to publish the application
  at `http://127.0.0.1:8000/`.
- `BAGREDEX_PORT` continues to accept a valid port from `1` through `65535`; the ready output and
  health probe use the selected value.
- The local account defaults to username `admin` and password `admin`. Existing username and
  password overrides remain validated and supported.

### Human review

- A newly started human-review session always publishes at `http://127.0.0.1:8000/`. The lifecycle
  no longer accepts `BAGREDEX_HUMAN_REVIEW_PORT` as a user-facing port-selection interface.
- The `$human-review` skill asks the deployment agent to run the exact repository lifecycle command
  and does not prefix it with, export, or otherwise inject a port value.
- Starting a session fails before marker or Podman mutation when port `8000` is occupied. The
  diagnostic identifies the occupied fixed human-review port.
- New sessions default to username `admin` and password `admin`. Explicit review-credential
  overrides remain supported, are persisted privately for reloads, and never appear in Podman
  arguments or command logs.
- Successful `start`, `status`, and `reload` retain the stable labeled connection fields and report
  port `8000` for the default session.

### Active-session upgrade

- The existing ready session and its marker remain intact until the deployment agent runs the
  supported `./bagredex.sh human-review reload` command after implementation.
- Reload recognizes a marker carrying the retired human-review port default, checks that port
  `8000` is free before changing lifecycle state, and then records the fixed port through the
  existing atomic marker writer. It removes and recreates only the human-review server container;
  the database container, network, named volume, target, plan/report paths, base commit, active
  bundle, and creation time remain unchanged.
- A session carrying the former default `admin` / `bagredex-local` account is migrated to the new
  `admin` / `admin` default during that reload. A marker containing intentional custom credentials
  preserves them.
- If port `8000` is occupied, upgrade reload fails before altering the marker or containers and
  leaves the old session recoverable on its recorded port. If reload fails after the atomic marker
  transition, it remains in the existing recoverable `reloading` state and a later reload resumes
  against port `8000` without clearing review data.
- `status` remains operationally read-only. For a healthy legacy-port marker, it reports a
  resumable non-ready state already routed by the skill to `reload`, rather than declaring the old
  endpoint compliant with the new fixed-port contract.

## Decisions and assumptions

- The completed interview is authoritative and leaves no material question.
- “The `$human-review` command should never set any override” means the agent skill invokes
  `./bagredex.sh human-review ...` without a port environment assignment, while the lifecycle owns
  one fixed host-port constant. Internal Compose environment wiring may still pass that validated
  constant to `deploy/compose.human-review.yaml`; it is an implementation detail, not a supported
  user override.
- Ordinary review remains configurable because its long-running foreground command may need to
  coexist with unrelated local listeners. Human review is fixed because the user's host proxy
  forwards only port `8000`.
- Two Bagredex review stacks cannot bind port `8000` simultaneously. Existing occupied-port checks
  fail closed; the implementation does not stop an ordinary review stack or unrelated listener.
- The old human-review default values are known: port `8001`, username `admin`, and password
  `bagredex-local`. Only that exact credential pair is automatically migrated. This avoids
  overwriting intentional custom credentials persisted by an active session.
- The active marker is lifecycle state, not a tracked artifact. Migration uses
  `human_review_write_marker`; no agent edits `.cache/human-review/session` directly.
- No Django, Web GUI, Pokémon data, schema, migration, or normalized release changes are required.

## Scope and ownership

### Deployment agent

Exclusively owns implementation and validation in:

- `bagredex.sh`
- `deploy/scripts/human-review.sh`
- `deploy/compose.human-review.yaml` only if the fixed-port contract requires a narrow adjustment
- `deploy/tests/commands.bats`
- `deploy/tests/human-review.bats`
- `deploy/README.md` and the top-level `README.md` where review defaults are documented
- `.agents/skills/human-review/SKILL.md` for the no-port-override invocation contract
- final local-only Podman validation and all local Git staging and commits

The deployment agent must preserve unrelated work and the active session volume. It must use only
already-local images and may use the repository's narrow escalation rule only for an exact blocked
Bagredex Podman validation command or approved local Git mutation.

### Architect

Owns:

- `docs/plans/2026-10-24-review-runtime-defaults.md`
- cross-scope and plan-compliance review after implementation
- `docs/reports/2026-10-24-review-runtime-defaults.md` after all findings are resolved

No backend, Web GUI, or Pokémon data coder or reviewer is needed. Deployment-only implementation
receives independent architect review before final validation and commit.

## Data and interface impact

### Shell command contract

`review_local` retains `BAGREDEX_PORT` validation and changes only its password fallback. Username
and credential override names remain stable.

The human-review lifecycle centralizes fixed port `8000` instead of reading
`BAGREDEX_HUMAN_REVIEW_PORT` during `start`. All port checks, Compose publication, health probes,
marker output, and labeled URL output derive from that one fixed value. An externally supplied
`BAGREDEX_HUMAN_REVIEW_PORT` has no effect on the lifecycle and should not be documented as an
interface.

The marker schema may remain format version 1 because `PORT`, `USERNAME`, and `PASSWORD` already
represent the effective connection contract. If implementation evidence requires a format bump,
the reader must accept and safely migrate the existing format-1 marker; rejecting the active
marker or requiring manual edits is not acceptable.

### Reload migration contract

Before normal reload mutation, reconcile resources using the recorded marker. When the recorded
port differs from fixed port `8000`:

1. Check port `8000` while the existing server is still intact.
2. Fail without marker or Podman mutation if the fixed port is occupied.
3. Select port `8000`; migrate only the exact former default credential pair; set state to
   `reloading`; and write the marker atomically.
4. Run the existing idempotent initialization, including account configuration, replacing only the
   server container and preserving the database volume.
5. Reconcile health and print the stable connection fields from the upgraded marker.

The existing interrupted-reload contract remains authoritative after step 3. A retry consumes the
new marker values and converges on the same endpoint and account.

`status` must not mutate this state. It should surface a legacy-port ready marker as a state the
human-review skill already sends to `reload`, preferably `partial-ready`, while reporting its
currently recorded connection fields accurately until migration succeeds.

### Documentation contract

Operator documentation distinguishes the configurable ordinary port from the fixed human-review
port, records both local credential defaults, removes the human-review port override from supported
examples, and explains the port-conflict failure. Documentation treats these as loopback-only
development credentials, never production configuration.

## Implementation sequence

1. The deployment agent updates focused Bats expectations first for ordinary default credentials,
   configurable ordinary port, fixed human-review port, ignored external human-review port input,
   no skill-injected override, and legacy-marker reload migration.
2. Update `review_local`'s default password without changing `BAGREDEX_PORT` or credential override
   validation.
3. Centralize the human-review fixed port and new credential defaults. Keep internal Compose
   parameterization narrow and remove the external human-review port override from the supported
   command contract.
4. Implement read-only legacy detection and the preflighted, atomic reload migration. Preserve
   custom credentials and all database resources; retain interrupted-reload recovery.
5. Update the human-review skill and operator documentation to match the exact invocation and
   defaults.
6. Run focused static and mocked lifecycle checks. Return failures to the deployment owner until
   they pass.
7. The architect reviews the complete diff for plan compliance, migration safety, command-output
   stability, and documentation consistency. The deployment agent resolves every actionable
   finding and repeats focused checks and review as needed.
8. With port `8000` confirmed free and required images confirmed local, the deployment agent runs
   a local-only real reload of the existing session. Verify the same target, active bundle,
   project, volume, and persisted review data remain, while URL and default credentials change to
   the approved values. Do not finish the session.
9. The deployment agent runs the full required validation. The architect writes the cycle report,
   then the deployment agent stages only this cycle's files and creates one local commit.

## Review and verification

Focused automated checks must include:

- `bash -n bagredex.sh deploy/scripts/human-review.sh`
- `shellcheck bagredex.sh deploy/scripts/human-review.sh`
- focused `deploy/tests/commands.bats` coverage proving ordinary review defaults to port `8000` and
  accepts another valid `BAGREDEX_PORT`, with default and overridden credentials handled as data;
- focused `deploy/tests/human-review.bats` coverage proving new sessions use port `8000` and
  `admin` / `admin`, an externally supplied former human-review port variable cannot change the
  selected port, occupied port `8000` rejects before mutation, and credentials do not enter Podman
  command logs;
- migration tests proving status is read-only, a legacy `8001` marker routes to reload, occupied
  `8000` preserves the old marker and containers, successful reload preserves the volume and
  custom credentials, exact old defaults migrate, and failure after marker transition remains
  resumable;
- a skill-contract assertion that lifecycle invocations contain no injected port override; and
- `.codex/lint.sh` plus `git diff --check` before review handoff and before commit.

Final validation includes the complete deployment Bats suite through `./bagredex.sh check-deploy`.
Run a real local-only Podman smoke against the active session only after confirming every required
image is local. Observe successful HTTP readiness on `127.0.0.1:8000`, container health, the stable
labeled output, active bundle, and preservation of the fixed project and volume. Confirm the
ordinary project and unrelated Podman resources were not changed. Never pull, log in, prune, or
contact a registry.

The architect reviews:

- one authoritative fixed human-review port across start, reload, status, Compose, health, marker,
  output, tests, skill, and documentation;
- failure atomicity before and after legacy-marker transition;
- preservation of custom credentials and the active database volume;
- absence of unplanned application/data/Web changes; and
- no drift in finish authorization, target resolution, or ordinary review port configurability.

## Risks

- Port `8000` may already be occupied. Failing before mutation preserves the active session; the
  user must free the proxy target before migration can complete.
- A careless migration could make the marker describe port `8000` while the old server remains on
  `8001`. The explicit `reloading` state and existing retry behavior make this interruption
  recoverable, and tests must cover it.
- Treating all stored credentials as old defaults could overwrite an intentional password. Limit
  automatic credential migration to the exact known former default pair.
- Ordinary review and human review share credential environment names. Tests and documentation
  must make clear that overrides remain data inputs and are not embedded into Compose arguments.
- Changing only displayed output would leave the proxy path broken. The real smoke must prove the
  published listener and health endpoint are on port `8000`.

## Completion criteria

- Default ordinary review is reachable on port `8000`, remains configurable with `BAGREDEX_PORT`,
  and reports `admin` / `admin` by default.
- New and reloaded human-review sessions publish only on fixed port `8000` by default, and the
  explicit skill never injects a port override.
- The active Basic Team Builder session is reloaded successfully on port `8000` with its target,
  bundle, database volume, and review data preserved and its old default credentials migrated.
- Port conflicts and interrupted migration fail safely with a recoverable marker and no database
  deletion.
- Focused Bash, ShellCheck, Bats, skill-contract, lint, diff, and local-only Podman checks pass and
  are reported from observed runs.
- Architect review has no unresolved blocking findings, the cycle report exists, and the
  deployment agent reports the new local commit hash.
- No remote operation, registry access, dependency installation, unrelated resource mutation, or
  deferred approved work remains.
