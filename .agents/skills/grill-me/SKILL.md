---
name: grill-me
description: Interview the user one question at a time before planning a Bagredex feature.
---

# Grill me

Use this skill before the architect writes an implementation plan for a feature.

## Interview method

- Ask exactly one focused question per message.
- Resolve answers available from the repository and prior conversation before asking.
- Briefly explain a recommendation when choosing among meaningful alternatives.
- Continue until behavior is testable and no material decision is silently assumed.
- Do not implement or write the plan during the interview.

## Topics

Cover only relevant topics, including:

- desired behavior, completion criteria, non-goals, and boundaries;
- Pokémon forms, regulations, data versions, source provenance, and update behavior;
- team, matchup, replay, stat, and damage-calculation semantics;
- persistence, migration, concurrency, idempotency, privacy, and recovery;
- desktop, tablet, keyboard, touch, accessibility, and interaction-latency expectations;
- deployment effects, verification, and representative edge cases;
- the simplest design and fewest dependencies that satisfy the requirement.

Probe vague terms until they have observable meanings. For calculations, resolve levels, formats,
field conditions, rounding, random ranges, and mechanics/data versions.

## Architect handoff

Provide confirmed requirements and non-goals, decisions and rationale, accepted assumptions,
affected ownership scopes, constraints, and an empty list of remaining material questions.
