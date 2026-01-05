## Panel Sizing
- Size the Settings panel to 80% of the current canvas SVG: width = `canvasDims.w * 0.8`, height = `canvasDims.h * 0.8`.
- Keep it as a translucent centered overlay and close on outside click.

## Config Catalog (Side Panel)
- Left side: a scrollable navigation with categories:
  - From-Zero-to-One
  - From-Concept-to-Deploy
- Right side: detail pane listing settings under the selected category.

## Category Contents
### From-Zero-to-One
- Runtime UI & Editor (editable via store):
  - `historyDebounceMs` (store)
  - `codeHighlightDurationMs` (store)
  - `codeSelectThrottleMs` (store)
  - `codeHighlightUntilClick` (store)
- Canvas Behavior (initially read-only, with plan to expose as store):
  - Zoom scale extent `[0.1, 4]` (GraphCanvas.tsx:46–53)
  - ForceLink distance `100` (GraphCanvas.tsx:63–67)
  - ForceManyBody strength `-300` (GraphCanvas.tsx:65–67)
  - Node radius `10`, label font-size `12` (GraphCanvas.tsx:102–118, 171–179)
- Shortcuts (read-only list):
  - Cmd/Ctrl+S, Cmd/Ctrl+Enter, Cmd/Ctrl+Shift+F, Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z

### From-Concept-to-Deploy
- Import/Export (file-based configs, read-only with “Open”):
  - Import handlers and type detection (file.ts:5–44, 71–89)
  - Export JSON/CSV formats and columns (file.ts:118–217)
- Theme & Styling:
  - `tailwind.config.js` (darkMode, content, container)
  - `postcss.config.js` (plugins)
  - `useTheme.ts` (theme toggling)
- Build & Tooling:
  - `vite.config.ts` (plugins, sourcemap)
  - `tsconfig.json` (compiler options, paths)
  - `eslint.config.js` (rules)
  - `package.json` (scripts, deps)

## UI Behavior
- Items show current value, source file, and code location. For store-backed settings, provide input controls with Apply/Reset.
- For file-based settings, show “Open File” to navigate to the path.
- Persist recent changes to store settings.

## Implementation Steps
1. Resize Settings panel to 80% of canvas.
2. Add side navigation with the two categories.
3. Build a settings registry that maps items to either store getters/setters or file references (path + line range).
4. Render the registry in the detail pane with appropriate controls.
5. Keep everything non-blocking and read-only for file-based settings initially.

## Future Enhancements (Optional)
- Promote canvas physics and zoom parameters to store with live re-application in GraphCanvas.
- Add export column customization.

## References (for development)
- Store settings: canvas/src/hooks/useGraphStore.ts:1–194
- Canvas physics & zoom: canvas/src/components/GraphCanvas.tsx:45–118, 232–336
- Code editor & shortcuts: canvas/src/components/BottomPanel.tsx:214–330
- Import/export: canvas/src/lib/graph/file.ts:1–217
- Theme & tooling: tailwind.config.js, postcss.config.js, vite.config.ts, tsconfig.json, eslint.config.js, package.json

