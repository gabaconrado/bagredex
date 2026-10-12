---
name: coding-standards
description: Apply shared implementation and review standards to any Bagredex source-code change.
---

# Coding standards

Apply these standards whenever implementing or reviewing source code in this repository.

## Priorities

Evaluate decisions in this order:

1. Correctness and data integrity.
2. Security and privacy.
3. Interaction latency and accessibility.
4. Simplicity and maintainability.
5. Performance supported by measurement.

Prefer the smallest design that completely satisfies the approved plan. Add dependencies only when
their concrete benefit exceeds their maintenance, security, and deployment cost.

## Ownership and boundaries

- Change only files owned by the assigned role unless the plan explicitly coordinates a
  cross-scope change.
- Treat documented interfaces between Django, the Web GUI, and normalized Pokémon data as
  contracts even when they are not described with OpenAPI.
- Keep domain and calculation policy independent from transport, persistence, and rendering code.
- Build a thin end-to-end slice before duplicating a pattern across modules.
- Preserve exact Pokémon forms, identifiers, regulation versions, and arithmetic semantics.

## Correctness and failure handling

- Validate data at trust boundaries and preserve invariants inside the domain layer.
- Make invalid states difficult to represent.
- Include useful diagnostic context without exposing secrets or private user data.
- Handle empty, malformed, duplicate, stale, and concurrent inputs deliberately.
- Never claim that a check passed unless it was run and its result was observed.

## Testing and readability

- Test public behavior and important invariants, not incidental implementation details.
- Cover successful behavior, expected failures, and regressions for corrected defects.
- Use mocks only at real external boundaries; prefer deterministic fakes for owned components.
- Use names that express domain intent and comments that explain non-obvious decisions.
- Keep formatting and lint suppressions local, rare, and justified.
- Remove obsolete code instead of retaining commented-out alternatives.
