# Pokémon data overrides

An override is permitted only for an observed upstream defect. It must pin the Showdown revision,
identify the record, explain the evidence, preserve before and after values, and name a regression
fixture. The importer lists and hashes every applied override in the manifest.

`m-a-item-text-compatibility.json` is one closed six-member set. The historical M-A revision makes
those Items legal before their text records exist, so the overlay pins their exact text from the
already-pinned current revision. The importer requires exact set equality, both revision pins, and
all six transition fixtures; it provides no general cross-revision fallback.

`record` uses `<data-file>:<key>` syntax, with composite key components in bundle-contract order
and separated by colons. The `before` and `after` values are complete records; an override cannot
change its key or shape. Duplicate IDs or targets, stale before-values, missing fixtures, unknown
files, and malformed candidates fail the build.

Never correct a generated release file directly.
