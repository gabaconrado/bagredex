---
name: bash-standards
description: Apply safe, portable Bash and rootless Podman standards to Bagredex automation.
---

# Bash standards

Apply these standards to maintained shell scripts and shell fragments.

## Baseline

- Use Bash explicitly and begin executable scripts with `#!/usr/bin/env bash`.
- Enable `set -euo pipefail` near the beginning.
- Quote expansions and use braces: `"${value}"`.
- Resolve paths relative to the script or repository root, not the caller's working directory.
- Assign values before marking them `readonly` so failures are not masked.
- Use lowercase local variables, uppercase exported configuration, and arrays for argument lists.
- Never construct commands with `eval`.

## Errors and safety

- Keep top-level flow short and place distinct operations in named functions.
- Use `local` variables and meaningful nonzero exit codes; send diagnostics to standard error.
- Check required tools explicitly. Never install or download a missing host tool.
- Use cleanup traps for temporary resources while preserving the original exit status.
- Validate exact paths and identifiers before destructive or privileged operations.
- Do not use broad globs or unresolved variables as destructive targets.
- Make repeated execution safe where practical.

## External boundary

- Never run a Git remote operation, including fetch, pull, push, or remote inspection.
- Never connect to a registry, VPS, cloud provider, or other operational service as an agent.
- Repository commands may describe user-invoked remote workflows, but agents only exercise local,
  non-operational paths.
- Stop and report permission failures in shell and Podman work. Do not request elevation or bypass
  the sandbox; approved local Git mutation is governed separately by `git-standards`.

## Podman and verification

- Prefer rootless Podman behavior and pin meaningful image versions.
- Keep persistent state in named, documented volumes with explicit health checks.
- Never remove resources outside the exact approved scope.
- Run `bash -n` and `shellcheck` for changed Bash scripts.
- Exercise safe dry-run or read-only paths when available and report checks not run.
