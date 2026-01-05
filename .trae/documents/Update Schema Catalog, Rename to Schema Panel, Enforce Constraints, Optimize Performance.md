## Steps

* Replace `knowgrph-codebase-responsibility-flow.md` with the contents of `.trae/documents/Rewrite Responsibility Flow_ Configurable Settings Catalog.md`.

* Update the Settings Panel registry to include new store-backed keys:

  * `historyDebounceMs` (number; writable via `setHistoryDebounceMs`)

  * `enableVirtualTables` (boolean; writable via `setEnableVirtualTables`)

* Treat build/backend configs as read-only (already wired: `CLICK_URL`, `PUBLIC_FALLBACK_JSON`, `KG_INPUT_PATH`, `KG_OUTPUT_DIR`, `max-lines`).

* Verify the Settings Panel renders the new keys and preserves read-only behavior for non-store configs.

