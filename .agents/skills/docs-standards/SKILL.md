---
name: docs-standards
description: Write concise human documentation and precise Bagredex agent documentation.
---

# Documentation standards

Apply these standards to Markdown, plans, tasks, reports, and agent-facing instructions.

## Audience and content

- Keep user-facing documents concise and easy to scan.
- Make agent-facing documents explicit about ownership, inputs, constraints, validation, and
  completion.
- Put outcomes first and include background only when it changes a decision.
- Keep one authoritative source for a decision instead of duplicating implementation detail.
- Clearly distinguish current behavior, intended architecture, and future ideas.

## Markdown

- Wrap prose at 100 columns without breaking URLs, code, or tables.
- Use sentence-case headings and descriptive link text.
- Include blank lines around headings, lists, and fenced code blocks.
- Keep domain terminology consistent with source code and data schemas.
- Never include credentials, tokens, private user data, or realistic secrets in examples.

## Artifacts and validation

- Store plans in `docs/plans`, deliberate deferrals in `docs/tasks`, and cycle reports in
  `docs/reports`.
- Name artifacts `YYYY-MM-DD-topic.md` with a short lowercase topic.
- Update an existing artifact for the same work rather than creating competing versions.
- Record facts, decisions, observed checks, and clearly labeled assumptions.
- Run the repository Markdown linter and correct findings before completion.
