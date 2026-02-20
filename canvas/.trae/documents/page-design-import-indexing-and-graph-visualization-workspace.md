# Page Design Spec — Import/Indexing + Graph Visualization Workspace (Desktop-first)

## Global Styles
- Layout system: CSS Grid for app shell (header/toolbar + main + side/bottom panels), Flexbox inside panels.
- Spacing: 8px base; panel gutters 12–16px; canvas is edge-to-edge behind overlays.
- Typography: 12–14px UI text; 16px section titles; monospace for hashes/logs.
- Colors: follow existing theme tokens; primary accent reserved for active mode; warning accent reserved for baseline-lock and truncation.
- Buttons: icon-first in toolbar; hover = subtle bg tint; active = accent ring + stronger bg.

---

## Page 1: Workspace Import & Indexing
### Meta Information
- Title: "Workspace Import & Index"
- Description: "Import a repo, index documents, and prepare graphs for fast rendering."
- Open Graph: title/description match; generic app image.

### Page Structure
- Top: global toolbar (mode/layout/zoom switches) unchanged.
- Bottom panel: “Workspace” tab (file tree + import actions) and “Indexing” subpanel.
- Right side panel (optional): diagnostics/timings summary.

### Sections & Components
1) Import Controls (bottom panel header row)
- Primary actions: “Import GitHub Repo/Folder”, “Cancel”, “Clear Imported Folder”.
- Secondary: “Max files” numeric input (shows truncation policy).

2) Progress Timeline (sticky in bottom panel)
- Three labeled phases: Listing → Fetching → Writing.
- Progress bar with current/total; current file path label (truncated with tooltip).
- Error summary pill: count of failed/skipped; clicking opens details table.

3) Indexing Controls
- “Build/Refresh Index” primary button.
- Status line: last run time, cache hit rate, baseline source hash.
- “Rebuild (ignore cache)” as dangerous secondary action.

4) Diagnostics Summary
- Timing table: import ms, index ms, load ms, first render ms.
- “Slowest stage” callout with file name/parser id.

---

## Page 2: Graph Visualization Workspace
### Meta Information
- Title: "Graph Workspace"
- Description: "Explore document structure and derived keyword relationships with consistent view behavior."
- Open Graph: title/description match; generic app image.

### Page Structure
- Center: canvas viewport.
- Top overlay: toolbar (semantic mode toggle, layout mode controls, renderer toggle, zoom controls, baseline lock).
- Side/bottom panels: selection inspector, stats, workflow (existing tabs).

### Sections & Components
1) Semantic Mode Toggle (toolbar)
- Two-state icon toggle: Document Structure (default) ↔ Keyword.
- Tooltip explains that Keyword is derived from baseline.

2) Layout Controls
- Layout dropdown/stepper (e.g., force vs other modes per schema).
- Apply behavior: staged (compute then commit) with small non-blocking spinner.

3) Zoom / Viewport Controls
- Fit-to-screen, Pin-to-view, Zoom-to-selection controls remain visible at all times.
- Interaction states:
  - Pin-to-view active: show “pinned” badge.
  - Zoom-to-selection active: show “focused” badge.

4) Invariants UX (consistency feedback)
- If selection cannot be mapped across mode/layout change: show a one-time toast explaining the clear.
- If baseline lock blocks a switch: show warning toast (no state change).

### Responsive behavior (desktop-first)
- Desktop: bottom panel docked; side panel optional; canvas uses remaining space.
- Narrow widths: collapse diagnostics to a single “timings” chip; panels become tabbed overlays.
