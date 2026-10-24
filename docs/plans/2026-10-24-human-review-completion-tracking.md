# Durable human-review completion tracking

## Summary

Make human-review completion durable, explicit, and recoverable. A successful runtime teardown no
longer erases the only session evidence. It transitions the session into a local
`completion-pending` state until a repository-tracked completion receipt records the reviewed
feature boundary and result commit. Only then does the lifecycle remove its local marker and report
the review complete.

Bare `$human-review` invocation uses a read-only repository candidate query. If the newest eligible
feature already has a valid completion receipt, it reports that fact and requires an explicitly
named target instead of silently selecting an older feature or opening the same review again. An
explicit target remains eligible for intentional re-review.

Repair the completed Damage Calculator history in the same cycle: record the actual layout and
human-review commits, create durable completion records for the reviewed calculator boundaries,
and ensure a future bare invocation stops instead of selecting the calculator again.

## Goals

- Record every successful human-review completion in committed repository history, including an
  unchanged session with no accepted feedback.
- Make teardown, review/check/commit work, completion recording, and marker removal a recoverable
  multi-phase workflow rather than conflating teardown with completion.
- Make bare target selection deterministic and completion-aware while preserving explicit
  re-review of an already reviewed target.
- Record the actual changed-session follow-up commit in its supplemental report and completion
  receipt; leave no completed human-review report saying that its commit is pending.
- Preserve the original feature commit and original feature artifacts except for narrowly scoped
  corrections to inaccurate **Commits** sections.
- Repair the current Damage Calculator completion state using result commit
  `f9ad9b168f0431cb9e13bec90ef32d72bca693cf`.
- Preserve strict local-only operation, exact Podman teardown boundaries, exclusive Git ownership,
  and recovery after interruption or commit failure.

## Non-goals

- Preventing an explicitly requested second human review of a completed feature.
- Automatically choosing an older unreviewed feature when the newest eligible feature is already
  reviewed.
- Amending, rebasing, or otherwise rewriting the Damage Calculator or any prior feature commit.
- Persisting the disposable human-review database after teardown.
- Adding an application model, Django view, Web UI, external service, Git remote, or hosting API.
- Treating the completion receipt as operational session state or storing credentials in tracked
  files.
- Automatically inferring a human-review finish without an explicit user statement.

## User-visible behavior

### Bare and explicit invocation

- With no active or completion-pending marker, bare `$human-review` asks the deployment agent to run
  `./bagredex.sh human-review candidate`.
- `candidate` resolves the newest eligible ordinary feature from committed matching plan/report
  artifacts and the last full commit hash in the report's **Commits** section. It excludes
  supplemental human-review plans/reports and completion receipts from ordinary candidates.
- If exactly one newest candidate is available and has no completion record, the skill starts it
  with the existing explicit `start TARGET` command.
- If that newest candidate is recorded complete, `candidate` prints stable labeled fields including
  `STATE: reviewed` and `EXPLICIT_TARGET_REQUIRED: true`. The skill stops and tells the user to name
  the target; it does not fall back to an older feature.
- If the newest boundary is genuinely ambiguous, the command fails without Podman mutation and the
  skill asks one focused target question.
- `$human-review TARGET` is explicit. It may run `start TARGET` even when completion history already
  contains that target, creating a new review round. A conflicting active or completion-pending
  marker still takes precedence and must be resumed.

### Finish and recovery

- `./bagredex.sh human-review finish` retains the existing authorization and exact teardown order.
  A teardown failure keeps state `finishing`, preserves the marker, creates no completion claim,
  and must be retried with `finish`.
- After teardown is confirmed, `finish` changes the marker to a non-secret logical state displayed
  as `STATE: completion-pending`. It does not remove the marker or claim the feature is complete.
  Repeating `finish` in this state is idempotent and never repeats destructive Podman work.
- `status` recognizes completion-pending state without requiring deleted Podman resources. It is
  read-only and reports the target, original plan/report, reviewed feature commit, and that tracked
  completion recording remains. It does not print stale credentials after teardown.
- `start` and `reload` refuse while completion is pending. A later `$human-review` invocation resumes
  finalization rather than opening or rebuilding a browser session.
- Commit, validation, documentation, or agent interruption after teardown leaves the marker
  recoverable. No path, including an unchanged review, silently drops it.

### Changed completion

- The existing matching review, architect review, validation, and supplemental report gates run
  after teardown.
- The deployment agent first creates the reviewed follow-up commit containing accepted changes,
  the supplemental plan, and the supplemental report. The report may say pending only in this
  intermediate commit because its own commit hash is not knowable beforehand.
- After that commit exists, the architect replaces the supplemental report's pending statement with
  the exact full follow-up hash and creates or appends the target's completion receipt. The receipt
  records the original target boundary and the actual follow-up result.
- The deployment agent creates a second, narrow completion-record commit containing the receipt and
  report hash correction. It never amends the reviewed follow-up commit.
- `./bagredex.sh human-review complete` validates that the receipt and corrected report are tracked,
  committed, unchanged, reachable, and consistent with the pending marker. Only then does it remove
  the marker and print `STATE: complete`.

### Unchanged completion

- After successful teardown, the architect creates or appends the same durable completion receipt
  with outcome `unchanged`, the original reviewed feature commit as the result, and no supplemental
  report.
- No independent feature review or product test cycle is invented for an unchanged session. The
  deployment agent validates the receipt contract and creates one narrow completion-record commit.
- `complete` performs the same committed-record validation and marker removal. Thus an unchanged
  review produces no feature-change artifact, but it always produces the repository-tracked
  completion receipt and commit explicitly approved by the user.

### Repeat review history

- Completion receipts are append-only histories. An explicit re-review adds a new record rather
  than replacing the earlier one.
- A completion record is valid for candidate suppression only when its target, original plan/report
  paths, and original reported feature commit match the currently resolved feature boundary and its
  result commit is reachable from `HEAD`.
- A repeated session must be completed by a record whose timestamp is not older than that session's
  creation time. An earlier record cannot accidentally clear a later completion-pending marker.

## Decisions and assumptions

- The completed interview is authoritative. The user chose repository-tracked persistence even for
  unchanged reviews, bare invocation that stops on an already-reviewed newest feature, and explicit
  opt-in for re-review.
- Use one human-readable completion receipt per logical feature target under
  `docs/reports/YYYY-MM-DD-<target>-human-review-completion.md`. The first completion creates it;
  later explicit reviews append records to the same file even on a later date. This follows the
  one-authoritative-artifact rule and avoids a global high-conflict ledger.
- Each receipt contains concise prose plus an append-only fenced machine-record section. The exact
  version-1 record is a pipe-delimited line with these fields:

  ```text
  v1|COMPLETED_AT|TARGET|PLAN|REPORT|FEATURE_COMMIT|OUTCOME|RESULT_COMMIT|SUPPLEMENTAL_REPORT
  ```

  `OUTCOME` is `changed` or `unchanged`; `SUPPLEMENTAL_REPORT` is a repository-relative report path
  for changed sessions and `-` for unchanged sessions. Target/path/hash/timestamp validation is
  strict. Prose is never parsed as lifecycle authority.
- Completion receipt paths are discovered by their `*-human-review-completion.md` suffix and
  machine records carry the target explicitly. Multiple receipt files claiming the same target are
  invalid. Unknown versions, malformed fields, duplicate identical records, conflicting records,
  untracked or dirty receipts, unreachable commits, and path mismatches fail closed.
- Keep the operational marker at format version 1 unless implementation evidence requires a bump;
  add `recording` to the valid state set. Existing format-1 active markers remain readable.
  Credentials stay mode `0600` locally but are withheld from completion-pending output.
- The marker's existing `CREATED_AT`, target, plan/report paths, and base commit are sufficient to
  bind a pending session to a later receipt. No feedback text or tracked-file list enters the
  marker.
- The completion receipt commit cannot contain its own hash. It does not need to: the receipt records
  the reviewed result commit, while Git history proves the later receipt commit. This removes the
  circular dependency cleanly.
- The changed-session two-commit close is intentional. The first commit is the reviewed product
  result; the second records that known hash and durable completion. An unchanged review has only
  the second kind of commit.
- Candidate recency follows reachable local Git history, not file modification time. Walk `HEAD` in
  topological order and select the first eligible reported feature commit. Two eligible targets at
  the same boundary are ambiguous and require explicit selection.
- `start TARGET` is always the explicit CLI form and therefore permits a reviewed target. The new
  read-only `candidate` action implements bare-skill policy; it never mutates Podman, the marker,
  files, or Git.
- `complete` is an operational acknowledgment, not a Git mutation. It validates repository state
  after the deployment agent's completion-record commit, then removes only the local marker.
- The Damage Calculator migration uses the actual reviewed history rather than pretending the old
  lifecycle recorded it. Correct
  `docs/reports/2026-10-24-damage-calculator-layout-refinement.md` to name commit `4b57ca9...`, correct
  `docs/reports/2026-10-24-damage-calculator-human-review.md` to name `f9ad9b1...`, and create one
  completion receipt with version-1 records for both the original calculator target at `7170b60...`
  and the later layout-refinement target at `4b57ca9...`, each with result `f9ad9b1...`. This makes
  the newest eligible layout-refinement boundary reviewed while retaining explicit access to both
  historical targets.
- The modified screenshot under `references/screenshots` is user-owned evidence. It remains
  untouched, unstaged, and outside every commit in this cycle.

## Scope and ownership

### Architect

Owns:

- `docs/plans/2026-10-24-human-review-completion-tracking.md`;
- `docs/reports/2026-10-24-human-review-completion-tracking.md` after reviews;
- the new Damage Calculator completion receipt under `docs/reports`;
- the narrow **Commits** corrections in the Damage Calculator layout and human-review reports; and
- cross-scope review of lifecycle, skill, policy, records, tests, and recovery behavior.

The architect does not edit lifecycle code, shell tests, policy/skill files, or Git state.

### Deployment agent

Exclusively owns implementation and validation in:

- `deploy/scripts/human-review.sh`;
- `deploy/tests/human-review.bats` and `deploy/tests/commands.bats` only if entry-point coverage is
  needed;
- `bagredex.sh` for usage text only if the new actions require it;
- `.agents/skills/human-review/SKILL.md` and
  `.agents/skills/human-review/agents/openai.yaml`;
- `AGENTS.md`, `.agents/skills/feature-development/SKILL.md`, and
  `.agents/skills/feature-development/references/artifacts.md` for the changed completion policy;
- `README.md` and `deploy/README.md` for operator-facing candidate, finish, and complete behavior;
- final local-only lifecycle validation and every local Git mutation.

No backend, Web GUI, Pokémon data, schema, release, or application reviewer change is required.
The architect performs independent plan-compliance and integration review of deployment-owned
implementation.

## Data and interface impact

### Lifecycle command contract

The command interface becomes:

```text
./bagredex.sh human-review candidate
./bagredex.sh human-review start TARGET
./bagredex.sh human-review status
./bagredex.sh human-review reload
./bagredex.sh human-review finish
./bagredex.sh human-review complete
```

`candidate` requires local Git and repository files but no Podman tool. It prints only stable
labeled repository fields and returns success for `available` and `reviewed` states; malformed or
ambiguous repository evidence returns nonzero before mutation. `start TARGET` remains the explicit
review override.

`finish` still owns teardown and is idempotent across `finishing` and `recording`. After confirmed
teardown it writes `recording` atomically and prints `STATE: completion-pending`. `reload` rejects
`finishing` and `recording`. `status` does not call Podman reconciliation for `recording` because
the resources must already be absent.

`complete` requires state `recording`, confirms no fixed human-review resources exist, loads and
validates the committed receipt record newer than or equal to `CREATED_AT`, validates changed or
unchanged outcome-specific artifacts, removes the marker, and prints target, `STATE: complete`,
feature commit, outcome, and result commit. It is safe to rerun only while the marker remains; an
absent marker reports no pending completion rather than manufacturing success.

### Candidate and completion-record contract

Candidate discovery:

1. Enumerate exact date-prefixed Markdown files directly under `docs/plans` and `docs/reports`.
2. Exclude slugs ending in `-human-review` and `-human-review-completion`.
3. Require exactly one matching plan and report, both tracked and unchanged.
4. Read only full hashes from the report's **Commits** section and use its last hash.
5. Require the commit to exist, be reachable from `HEAD`, and contain both artifacts.
6. Rank candidates by their first appearance in `git rev-list --topo-order HEAD`.
7. Fail as ambiguous when more than one target resolves to the same newest commit.
8. Look for a valid completion record matching target, paths, and feature commit. Any matching
   record makes the newest candidate `reviewed`; do not consider older candidates.

Receipt validation repeats the critical target/path/hash checks in the lifecycle script. The
receipt file and, for changed outcomes, the supplemental report must be tracked and unchanged.
The supplemental report's **Commits** section must contain the exact result hash. For unchanged
outcomes, result equals feature commit and supplemental report is `-`. For changed outcomes, result
exists, is reachable, and descends from the feature commit.

### Policy and documentation contract

Update repository and skill policy so it no longer says an unchanged finish stops after teardown or
creates no commit. Document the universal completion receipt, two-commit changed close, one-commit
unchanged close, `completion-pending` recovery, bare candidate behavior, explicit re-review syntax,
and final `complete` acknowledgment in one authoritative workflow.

Supplemental reports may use a pending commit statement only inside the intermediate reviewed
result commit. Before the workflow reports completion, the completion-record commit must replace it
with the full actual result hash. Original feature plans/reports remain unchanged except an
explicitly planned correction of an inaccurate **Commits** section such as the current migration.

## Implementation sequence

1. The architect creates the Damage Calculator completion receipt and corrects only the two
   inaccurate **Commits** sections with full known hashes. These files remain uncommitted until the
   whole workflow implementation passes review.
2. The deployment agent updates focused Bats fixtures first for candidate discovery, reviewed
   refusal, explicit reviewed-target start, completion-pending teardown, unchanged and changed
   receipt validation, repeat history, and recovery failures.
3. Add strict receipt parsing and repository validation helpers, then implement the read-only
   `candidate` action.
4. Extend marker reconciliation, `finish`, `status`, and `reload` for `recording`; implement the
   validating `complete` action and stable output.
5. Update the explicit skill, metadata prompt, repository workflow policy, artifact guidance, and
   operator documentation to match the new state machine and two-phase commit order.
6. Run focused shell/static/Bats checks. Return every ordinary failure to the deployment owner until
   clean.
7. The architect reviews the full diff and test evidence for selection correctness, teardown
   authorization, record validation, Git-boundary integrity, retry behavior, current migration, and
   documentation consistency. The deployment owner resolves all findings and repeats review.
8. The deployment agent runs final complete deployment validation and a read-only candidate query
   against the migration records. It verifies the newest candidate is
   `damage-calculator-layout-refinement`, state is `reviewed`, and explicit target syntax remains
   available. No real session is opened merely to test record selection.
9. The architect writes the cycle report. The deployment agent stages only approved workflow,
   documentation, migration receipt/report, plan, and report files; excludes the user screenshot;
   and creates one local workflow feature commit. This commit itself supplies the durable migration
   receipt state because its records point to the already-known `4b57ca9` and `f9ad9b1` commits.

## Review and verification

Focused validation must include:

- `bash -n bagredex.sh deploy/scripts/human-review.sh`;
- `shellcheck bagredex.sh deploy/scripts/human-review.sh`;
- the complete focused `deploy/tests/human-review.bats` suite;
- `deploy/tests/commands.bats` when entry-point usage changes;
- the repository skill validator or the existing `.codex/lint.sh` skill checks;
- `.codex/lint.sh` and `git diff --check` before architect review and before commit; and
- the complete `./bagredex.sh check-deploy` suite before delivery.

Bats coverage must prove:

- candidate selection uses commit history rather than mtime or filename order, excludes supplemental
  artifacts, detects same-boundary ambiguity, and rejects dirty/malformed/unreachable evidence;
- a valid newest completion record yields `reviewed` and never falls back to an older candidate;
- explicit start accepts a reviewed target while all existing eligibility and Podman preflight
  checks remain;
- failed teardown retains `finishing`, creates no completion claim, and is retryable;
- successful teardown removes only scoped resources, retains the marker as `recording`, withholds
  credentials, and makes finish/status idempotent without Podman resource requirements;
- reload/start refuse completion-pending state;
- `complete` rejects missing, dirty, malformed, duplicate, conflicting, old, mismatched, pending-
  report, unreachable-result, and wrong-outcome records without removing the marker;
- changed completion accepts only an exact committed supplemental report/result pair;
- unchanged completion requires result equal to the feature commit and no supplemental report;
- an earlier completion record cannot satisfy a later explicit re-review; a newer repeat record can;
- successful `complete` removes the marker only after all validation and reports stable final fields;
  and
- legacy active markers, fixed-port migration, credential secrecy, lock behavior, interrupted
  start/reload/finish, resource labels, and data-preserving reload remain covered.

Architect review verifies:

- bare and explicit invocation cannot be confused at either skill or command boundary;
- no state says complete before both teardown and committed receipt validation;
- failure after teardown remains recoverable without restoring deleted review data;
- the receipt parser uses only strict committed machine records and never trusts prose;
- changed reports contain the actual follow-up hash before completion acknowledgment;
- unchanged sessions produce exactly the approved completion artifact/commit and no invented product
  review work;
- current Damage Calculator records suppress the newest repaired candidate while preserving
  explicit re-review;
- original commits are not rewritten and the user screenshot remains outside the diff; and
- documentation, skill instructions, shell output, tests, and implementation describe one state
  machine.

No new dependency, backend check, Web build, Pokémon data import, or browser matrix is required.

## Risks

- A completion receipt written before teardown would falsely mark a live or failed session done.
  The lifecycle enters `recording` only after exact teardown confirmation, and `complete` requires
  that state.
- A Git or validation failure after teardown cannot restore disposable review data. The marker
  therefore records only that durable completion work remains and routes recovery to reports,
  checks, and commits rather than reload.
- A prior receipt could clear a later repeat review. Timestamp comparison against marker
  `CREATED_AT` and exact boundary matching prevent reuse.
- A malformed tracked record could suppress a candidate. Parsing and repository validation fail the
  whole query closed rather than skipping suspicious data.
- A self-referential receipt cannot know its own commit hash. Recording the already-created reviewed
  result commit and proving the receipt is committed at `HEAD` avoids self-reference.
- Two commits for changed review add process overhead, but one commit cannot both contain a report
  and truthfully name its own hash. The narrow completion commit makes the boundary reviewable and
  retryable.
- Updating the same per-target receipt on explicit re-review can conflict with unrelated local
  edits. Normal dirty-file validation and Git ownership rules stop rather than overwrite.
- Candidate ranking can be ambiguous when one commit completes multiple plans. The command reports
  ambiguity and requires an explicit target instead of guessing.

## Completion criteria

- Every successful changed or unchanged finish reaches `STATE: complete` only after a committed,
  valid, clone-surviving completion receipt exists.
- A teardown or Git/recording interruption leaves an accurate resumable marker and never reports a
  false completion.
- Bare candidate selection reports the newest already-reviewed feature and requires an explicit
  target; it never silently chooses an older feature.
- Explicit target invocation can intentionally re-review a completed feature and requires a newer
  completion record before clearing that repeat session.
- Changed supplemental reports record their actual full follow-up commit before completion; no
  delivered human-review report remains pending.
- Damage Calculator layout and human-review reports name `4b57ca9...` and `f9ad9b1...`; durable
  completion records make the repaired newest layout-refinement candidate `reviewed`.
- All focused Bash, ShellCheck, Bats, skill, lint, diff, and full deployment checks pass; architect
  review has no unresolved finding; the cycle report and local workflow commit exist.
- Prior commits remain unchanged, no remote/registry/operational access occurs, and the user-owned
  screenshot remains unstaged and untouched.
