# Bagredex Web GUI

Editable Preact, TypeScript, and CSS sources live in `src` and `static/web/css`. They are the
authoritative frontend implementation.

Run `npm ci` for a reproducible install from `package-lock.json`, then `npm run build`. Vite writes
the Django-consumable manifest and content-hashed assets to `static/web/dist`. Files in that output
directory are generated: do not edit them manually. Django resolves both the JavaScript entry and
its extracted stylesheet through the manifest. Production packaging must run the locked build and
include the complete generated directory in static collection.

Django reads the manifest path from `settings.VITE_MANIFEST_PATH`. Its local default is
`src/web/static/web/dist/.vite/manifest.json`; production may set
`BAGREDEX_VITE_MANIFEST_PATH` to a manifest-only path in the application image. The template tags
validate the manifest but do not require hashed assets on Django's filesystem. The static server
must serve every referenced file under `/static/web/dist/`.
