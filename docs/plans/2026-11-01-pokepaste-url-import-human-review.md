# PokéPaste URL import human review

## Original boundary

- Target: `pokepaste-url-import`
- Original plan: [PokéPaste URL import](2026-11-01-pokepaste-url-import.md)
- Original report:
  [PokéPaste URL import report](../reports/2026-11-01-pokepaste-url-import.md)
- Feature commit: `093fc415870ce27783bc8bfa5691ac894bee6459`
  (`feat(teams): import PokéPaste URLs`)
- Review state: active; do not finish, report, review, validate the full repository, or mutate Git
  until the user explicitly finishes `$human-review`.

## Summary

Correct the human-review runtime so Django can perform the approved server-side PokéPaste fetch.
The current server container is attached only to an internal Podman network, which prevents
outbound connectivity even when the same paste is reachable from the user's host browser. Preserve
the fixed-origin backend boundary, database isolation, and five-attempt rolling limiter.

## Goals

- Confirm locally that the observed initial unavailable response is the expected mapping for a
  server network failure rather than a URL, parser, or Web defect.
- Give only the Bagredex server the minimum outbound network path required for its existing fixed
  `https://pokepast.es/<id>/raw` request.
- Keep PostgreSQL isolated on the internal application network with no host or outbound exposure.
- Preserve authentication, CSRF, fixed-origin URL construction, verified TLS, redirect rejection,
  timeout/size/content checks, response privacy, and per-session throttling.
- Reload the active human-review runtime after focused local checks so the user can retry the same
  interaction.

## Non-goals

- Do not weaken, remove, reset, or change the five-attempt-per-minute limiter because repeated
  requests correctly reached HTTP 429 after the original fetch failure.
- Do not add browser-direct fetching, CORS workarounds, arbitrary outbound URLs, proxy bypasses,
  insecure TLS settings, redirect following, retries, or live-service tests.
- Do not change the import grammar, two-step review behavior, saved-team persistence, normalized
  Pokémon data, or PokéPaste export scope.
- Do not expose PostgreSQL to the host, the outbound network, or any public interface.
- Do not make a Web change unless backend or runtime evidence identifies a separate browser defect.
- Do not perform independent review, full validation, reporting, commits, or human-review finish in
  this focused round.

## User-visible behavior

- After runtime reload and limiter-window expiry, entering one canonical PokéPaste URL and choosing
  **Import** should retrieve its raw team text for review instead of reporting that PokéPaste is
  unavailable solely because the server lacks an outbound route.
- The first successful request still only replaces the dialog text. The user must choose
  **Import** again to parse the team and later choose **Save** to persist it.
- Genuine upstream, DNS, TLS, timeout, invalid-content, and rate-limit failures retain their
  existing safe messages and preserve the draft and dialog contents.
- Repeated attempts within the rolling minute continue to return the existing rate-limit message.

## Round evidence

### Round 1: server reports unavailable for a browser-reachable paste

- The user entered `https://pokepast.es/1bd859563988ccc2` in the active review runtime.
- The first server retrieval reported that PokéPaste was unavailable, while the user confirmed the
  paste page was reachable in their browser.
- Repeated attempts then produced the expected five-per-minute HTTP 429 message. This shows that
  the same-origin request reached Django and that the throttle behaved as designed; it does not
  indicate a Web URL-detection failure.
- `deploy/compose.yaml` attaches `server` and `database` only to `application`, and declares that
  network with `internal: true`. An internal Podman network intentionally lacks an external route,
  which explains the difference between host-browser and server-container reachability.
- `src/backend/bagredex/teams/pokepaste.py` maps DNS, connection, TLS, and other `URLError`/`OSError`
  failures to the safe unavailable response. Existing deterministic tests exercise that mapping.

## Decisions and assumptions

- The runtime network boundary is the primary evidenced cause. `backend_coder` confirms this using
  local source/configuration inspection and deterministic fakes; agents must not probe live
  PokéPaste or another external service.
- The deployment correction should add a distinct non-internal egress network to `server` while
  retaining the internal `application` network for server-to-database traffic. `database` remains
  attached only to `application`.
- Do not publish ports or attach `database` to the egress network. Do not grant extra capabilities,
  host networking, privileged mode, registry access, or broader filesystem access.
- The egress network enables normal container outbound routing but does not replace the backend's
  application-layer host allowlist. The only user-influenced remote operation remains the fixed
  PokéPaste raw path derived from a validated 16-character lowercase hexadecimal ID.
- No backend change is expected. If deterministic diagnosis reveals a separate classification or
  request-construction defect, `backend_coder` may correct only
  `src/backend/bagredex/teams/pokepaste.py` and focused `src/backend/tests/test_teams.py` coverage.
  Return any broader behavior change to the architect before editing.
- No Web change is planned. The observed Django response and later 429 establish that the existing
  browser request path reached the intended endpoint.

## Scope and ownership

`backend_coder` owns the first diagnostic pass:

- Inspect `src/backend/bagredex/teams/pokepaste.py`, its focused tests, and the rendered local
  runtime configuration without contacting an external service.
- Confirm that an unavailable outbound route deterministically becomes the observed safe response
  and that the submitted canonical URL reaches the fixed raw URL construction.
- Report whether any backend classification defect exists. Edit only the backend files named above
  if evidence proves a separate defect; otherwise make no backend source change.

`deployment_agent` exclusively owns the evidenced runtime correction:

- Update `deploy/compose.yaml` so `server` joins both the internal database/application network and
  one narrowly purposed non-internal egress network, while `database` remains application-only.
- Update the most focused existing deployment/Bats validation under `deploy/tests/**` to assert
  the rendered network topology and prevent regression of database isolation.
- Run only local, already-available Podman and deployment checks allowed by repository policy.
  Never pull an image, log in, access a registry, or use a live remote endpoint as a test oracle.

`web_gui_coder` has no assigned work. Dispatch it only if backend/runtime evidence disproves the
current diagnosis and demonstrates a separate Web failure. Source ownership remains exclusive.

Independent reviewers, architect integration review, the supplemental report, full validation,
and Git mutation are intentionally deferred until the user explicitly finishes the active review
session.

## Data and interface impact

- No Django, TypeScript, JSON, database, importer, or normalized-data contract changes are planned.
- The existing PokéPaste endpoint, bootstrap v3 field, response schema, text parser, Save boundary,
  and throttle session data remain unchanged.
- Runtime topology changes only: `server` gains outbound routing through a separate network and
  retains its private application connection; `database` retains only the internal network.
- Rollback removes the server's egress-network attachment and its network declaration. It does not
  require data recovery or migration rollback.

## Implementation sequence

1. `backend_coder` performs the deterministic diagnostic and reports whether the network evidence
   fully explains the failure. Do not wait for or reset the limiter by mutating session state.
2. If no separate backend defect exists, `deployment_agent` adds the isolated egress network and
   focused topology tests. If a backend defect is proven, correct and focused-test it first, then
   apply the runtime correction only if the internal-network blocker still exists.
3. Each owner runs only its focused checks. No check contacts PokéPaste or another live service.
4. `deployment_agent` runs `./bagredex.sh human-review reload` after focused checks pass. Relay the
   stable URL and active-session fields, then return control to the user for another manual attempt
   after the limiter window expires.
5. Keep the session active for further feedback. Do not dispatch reviewers or proceed to finish
   unless the user explicitly requests it.

## Review and verification

Backend diagnosis or any narrow backend correction must use deterministic tests for:

- exact canonical URL-to-fixed-raw-request construction;
- simulated DNS/connection/TLS/unavailable failures producing the safe existing error;
- redirects, timeouts, oversized or invalid content, and response privacy remaining unchanged; and
- five successful attempt reservations followed by the existing 429 behavior.

Deployment-focused checks must prove from local rendered configuration and/or already-local
containers that:

- `database` joins only the internal application network;
- `server` joins the internal application network and the distinct egress network;
- no database or server port is newly published and no privileged/host-network capability appears;
- the existing server-to-database path and health/readiness checks remain functional; and
- the human-review runtime reloads successfully without pulling images or contacting a registry.

Run the smallest applicable local checks during this active round:

```text
cd src/backend && uv run pytest tests/test_teams.py -k pokepaste
./deploy/test.sh
./.codex/lint.sh
```

The backend command requires local PostgreSQL only if selected tests cross the database boundary;
run pure URL/fetch tests separately if the managed runtime is not yet available. The deployment
owner may narrow `./deploy/test.sh` to the directly affected Bats file during the focused round.
Full backend, Web, Playwright, deployment, and repository validation waits for explicit finish.

## Risks

- Adding general container egress increases the effect of a future server-side request defect.
  Preserve the fixed-origin application boundary and use a separate egress network without host
  networking, privilege, published ports, or database attachment.
- Removing `internal: true` from the existing application network would unnecessarily broaden the
  database network. Keep it internal and add a second server-only network instead.
- Testing against live PokéPaste would be nondeterministic and violate the local-agent boundary.
  Use fakes and topology assertions; the active user review supplies the manual external evidence.
- The current session may remain throttled briefly after reload depending on session/database
  preservation. Wait for the rolling window rather than deleting or bypassing limiter state.
- A successful network route could reveal a separate upstream-response compatibility issue. Keep
  the session active and record that evidence as another round instead of silently expanding scope.

## Completion criteria

This focused round is ready for user re-review when:

- deterministic diagnosis confirms the network cause or documents and corrects a separate narrow
  backend defect;
- the server has the minimum outbound route while PostgreSQL remains isolated on the internal
  application network;
- focused backend/deployment checks pass without live external access or security weakening; and
- the active human-review runtime reloads successfully for the user's next attempt.

The human-review cycle itself remains incomplete until the user explicitly finishes it. Only then
may matching reviewers, architect integration review, full validation, the supplemental report,
reviewed-result commit, completion receipt/correction commit, and final lifecycle acknowledgment
run.
