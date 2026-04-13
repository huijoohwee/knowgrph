# Knowgrph Mobile-First PWA Responsiveness — Page Design

## Global Design (SSOT)
### Layout
- Approach: **mobile-first**.
- Primary system: hybrid **CSS Grid + Flexbox**.
  - Mobile: stacked regions with overlays (drawers/sheets) to prioritize the canvas.
  - Desktop: grid with persistent regions (sidebar + canvas + optional bottom panel).

### Breakpoints (SSOT)
- Define and reuse in one constants source (no duplicated magic numbers):
  - sm: 640px, md: 768px, lg: 1024px, xl: 1280px.

### Safe area & touch targets
- Apply `env(safe-area-inset-*)` padding for top/bottom UI on iOS.
- Minimum touch target: 44×44px for all primary controls (toolbar icons, panel toggles).

### Typography
- Mobile base: 16px; headings scale modestly to preserve vertical space.
- Docs: enforce readable line length on large screens (max-width constraint) while allowing full-width code blocks.

### Interaction states
- Buttons/controls: clear hover/focus/active; always-visible focus rings on keyboard navigation.
- Overlays: backdrop + escape/outside-click close; scroll locking only when an overlay is open.

### Motion
- Keep transitions short (150–200ms). Avoid animating layout-affecting properties on large canvases.

---

## Page: Canvas Workspace (Home)
### Meta Information
- Title: "knowgrph — Canvas"
- Description: "Explore and edit graphs with responsive panels and tools."
- Open Graph: title/description consistent with above.

### Page Structure
- Mobile (stacked):
  1. Top App Bar (compact)
  2. Canvas Stage (primary)
  3. Floating primary controls (e.g., zoom controls) anchored above safe-area
  4. Panels as overlays: Sidebar Drawer, Bottom Sheet
- Desktop (grid):
  - Left: Sidebar (fixed width, collapsible)
  - Center: Canvas Stage (fills)
  - Bottom: Bottom Panel (resizable; can collapse)

### Sections & Components
1. App Bar / Toolbar
   - Left: menu/panel toggles (sidebar, bottom panel)
   - Center: current document/graph name (truncate with ellipsis)
   - Right: key actions (load/export/settings)
   - Behavior: sticky; height reduces on mobile; avoids wrapping.

2. Canvas Stage
   - Always fills remaining viewport height.
   - Input: touch pan/zoom must not conflict with page scroll (explicit mode + visible toggles).
   - Resize handling: debounce layout recalculation; do not recompute heavy layouts on every pixel change.

3. Sidebar Drawer (mobile) / Sidebar (desktop)
   - Mobile: slide-in drawer from left; full height; dismiss via swipe/backdrop.
   - Desktop: persistent; collapsible to icon rail.
   - Content: node details / schema / settings entries reuse existing components; only presentation changes.

4. Bottom Panel (mobile sheet) / Bottom Panel (desktop)
   - Mobile: bottom sheet with snap points (25% / 50% / 90%).
   - Desktop: resizable panel; minimum height enforced; contains table/editor tabs.
   - Table: horizontal scroll enabled; columns can be prioritized or hidden on small screens.

---

## Page: Docs / Workflow Preview
### Meta Information
- Title: "knowgrph — Docs"
- Description: "Read workflow and pipeline documentation in a responsive layout."

### Page Structure
- Mobile: header + content; optional TOC in a drawer.
- Desktop: two-column layout (TOC left, content right) when space permits.

### Sections & Components
1. Content Container
   - Text column max width on large screens; padding scales by breakpoint.
   - Code blocks: allow horizontal scrolling; show copy button if already present.

2. Navigation
   - “Back to Canvas” is a primary button on mobile.
   - TOC toggles into a drawer on small screens.

---

## Page: Settings
### Meta Information
- Title: "knowgrph — Settings"
- Description: "Configure UI preferences for responsive behavior."

### Page Structure
- Mobile: single-column list of sections.
- Desktop: two-column (categories left, content right) when wide enough.

### Sections & Components
1. UI Preferences
   - Density: compact/comfortable.
   - Theme: follow system/light/dark (if already supported).

2. Responsiveness Diagnostics (read-only)
   - Show current breakpoint label.
   - Show detected base path (for verifying local vs GitHub Pages behavior).

3. Token Reference (read-only)
   - Display the canonical token values (spacing scale, panel widths, z-index layers) to reinforce SSOT and ease QA.