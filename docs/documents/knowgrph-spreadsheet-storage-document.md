# Knowgrph Spreadsheet Storage Document

**Context**: Local-first, multi-table spreadsheet storage + grid rendering
**Intent**: Provide a NocoDB/Airtable-like relational spreadsheet backend without hosted DB/auth
**Directive**: Use RxDB + Dexie.js only for persistence; use AG Grid for the spreadsheet UI; forbid Supabase and any registration/auth flows.

---

## SSOT Types

- Canonical spreadsheet domain types live in `grph-shared/spreadsheet/types`.
- Core entities:
  - `SpreadsheetBase` → `SpreadsheetTable` → `SpreadsheetColumn` + `SpreadsheetRow` (+ optional `SpreadsheetView`)

---

## Storage Backend (RxDB + Dexie)

- Implementation: `canvas/src/features/spreadsheet-db/spreadsheetDb.ts`
- Storage behavior:
  - Primary storage: RxDB Dexie storage (IndexedDB)
  - Fallback: RxDB memory storage when IndexedDB is unavailable
  - Query builder plugin is enabled for indexed queries/sorting

---

## UI Surface (AG Grid)

- Route: `GET /spreadsheet`
- Implementation: `canvas/src/features/spreadsheet/ui/SpreadsheetPage.tsx`
- Binding strategy:
  - Initial seed creates a base/table with two columns and one row.
  - Grid column defs are derived from `SpreadsheetColumn.id` (stable keys).
  - Grid row objects are derived from `SpreadsheetRow.data` with `getRowId = row.id`.
  - Updates subscribe to RxDB change streams and refresh rows/columns without recomputing unrelated state.

---

## Tests (Bounded)

- CI test: `canvas/src/__tests__/rxdbSpreadsheetDb.test.ts`
- Coverage:
  - Seed creates default base/table/columns
  - Insert row and update a cell value via `updateRowCell`

