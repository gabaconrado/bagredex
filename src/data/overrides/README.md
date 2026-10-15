# Pokémon data overrides

This directory is intentionally empty of active overrides. An override is permitted only for an
observed upstream defect and must validate against `schema/overlay-v1.schema.json`. It must pin the
Showdown revision, identify the record, explain the evidence, preserve before and after values, and
name a regression fixture. The importer must list and hash every applied override in the manifest.

`record` uses `<data-file>:<key>` syntax, with composite key components in bundle-contract order
and separated by colons. The `before` and `after` values are complete records; an override cannot
change its key or shape. Candidate files are applied in filename order. Duplicate IDs or targets,
stale before-values, missing fixtures, unknown files, and malformed candidates fail the build.

Never correct a generated release file directly.
