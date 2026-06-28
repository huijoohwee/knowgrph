# Debug Session: rich-media-edge-regression
- **Status**: [VERIFIED]
- **Issue**: Storyboard Card ↔ Rich Media Panel edges disappeared after create/reopen and the Rich Media panel suddenly enlarged or zoomed in.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-rich-media-edge-regression.ndjson

## Canonical Commands
- Smoke route seam proof: `npm run test:smoke:storyboard-rich-media-drop:source`
- Smoke route browser proof: `npm run test:smoke:storyboard-rich-media-drop:browser`
- Real app-route SSOT restoration proof: `npm run test:live:storyboard-media-panel-retention:browser`

## Verification Lanes
### Smoke Route
1. Open the Storyboard rich media drop smoke route.
2. Drop a Rich Media panel onto the Storyboard canvas.
3. Select/open the dropped panel.
4. Create an edge between the dropped Rich Media panel and a Storyboard card.
5. Wait through retention, then reselect/open the panel again.
6. Observe whether the edge disappears or the panel box enlarges.

### Real Route
1. Open the normal Canvas app route.
2. Inject `huijoohwee/docs/knowgrph-strybldr-starter-template.md` through `window.knowgrphWorkspaceCommand.applyMarkdownDocument(...)`.
3. Create one image panel and one video panel on the Storyboard surface.
4. Create an edge from each dropped panel to its target Storyboard card.
5. Verify panel box stability through edge create and reopen retention.
6. Reapply the markdown SSOT and verify the transient panels and created edges disappear back to the baseline live-route state.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Edge retention breaks when selection/open-state rebuilds the overlay graph. | High | Med | Rejected on smoke route: edge `e1` remains visible after retention and reopen. |
| B | Panel enlargement occurs because reopen switches Storyboard overlay sizing from stable world geometry to a different size source. | High | Med | Rejected on smoke route: panel box stays `x=851.5 y=120.5 w=324 h=468` before and after reopen. |
| C | Pending-to-canonical node identity changes invalidate edge endpoint matching after reopen. | Med | Med | Rejected on smoke route: dropped panel id remains `n1` across create and reopen. |
| D | A Storyboard layout commit or runtime-scene reseed still fires after edge creation and mutates both edge visibility and panel geometry. | Med | Med | Inconclusive: whole-frontmatter collective reseed logged during drop initialization, not during edge loss/reopen. |
| E | The edge remains in graph data but the overlay renderer suppresses it when the panel re-registers on the shared overlay surface. | Med | Med | Inconclusive: empty filtered-edge logs occurred only before any edges existed. |

## Smoke-Route Evidence
- `useFlowEditorRuntimeScene.ts:1327`: whole-frontmatter collective reseed logged during drop initialization with `pendingIds=["n1"]` and `fullFrontmatterCollectiveIds=["existing-rich-media","n1","storyboard-card-alpha","storyboard-card-beta"]`.
- `verify_storyboard_rich_media_drop_browser_smoke.py:267`: selected dropped panel `n1` had box `{x:851.5,y:120.5,width:324,height:468}` and open state `openWidgetNodeIds=["n1"]`, `selectedNodeId="n1"`.
- `verify_storyboard_rich_media_drop_browser_smoke.py:273`: created edge `e1` remained present after retention with the same panel box.
- `verify_storyboard_rich_media_drop_browser_smoke.py:283`: reopened panel kept the same box and retained edge `e1`.
- `verify_storyboard_rich_media_drop_browser_smoke.py`: upgraded smoke coverage now runs both image and video drop paths through the same edge-retention and panel-box stability cycle.

## Real-Route Evidence
- `/Users/huijoohwee/Documents/GitHub/huijoohwee/docs/knowgrph-strybldr-starter-template.md`: confirmed authored runtime residue in the real document path:
  - duplicated authored edge id `e1`,
  - authored `RichMediaPanel` runtime nodes `n1` and `n2`,
  - hardcoded `localhost` media URLs with `kg_media_token`,
  - runtime `cards:` payload overrides,
  - repeated broken guardrail lines at the end of the file.
- `/Users/huijoohwee/Documents/GitHub/huijoohwee/docs/knowgrph-strybldr-starter-template.md`: cleanup completed upstream so the starter template is runnable and neutral again.
- `verify_storyboard_live_route_media_panel_retention.py`: canonical real-route verifier now injects the starter markdown on the normal Canvas route, creates one image panel and one video panel, verifies panel box stability during edge retention, reapplies the markdown SSOT, and proves transient panel/edge residue disappears.
- `test:live:storyboard-media-panel-retention:browser`: exits `0` against the canonical real-route verifier.

## Source Fixes
- `useFlowEditorOverlayEdges.ts`: confirmed code-level preview bug:
  - pending edge preview rendering sat below the `edges.length === 0` early-return path, so Card ↔ Rich Media edge-in-progress could be non-visible whenever no committed overlay edges existed yet.
  - transient empty filtered-edge windows could clear committed overlay paths before the next retry frame.
- `useFlowEditorOverlayEdges.ts`: stable-graph fallback is now restricted to true same-revision metadata-less handoff frames so stale overlay edges do not survive source reapply.
- `FlowCanvasMediaOverlays.tsx`: confirmed code-level size fallback bug:
  - `mediaOverlayPanelLastKnownWorldSizeRef` could reuse a stale cached size by bare node id when current node props existed but lacked authored `visual:width`/`visual:height`, allowing reused ids like `n1` to inherit old panel dimensions.
- `useFlowEditorGraphActions.ts`: auto-zoom-on-edge-selection is disabled for user gesture edge create/select paths so edge creation no longer zooms the Rich Media panel unexpectedly.

## Verification Conclusion
- Smoke-route contract is stable for drop -> edge create -> retention -> reopen.
- Real-route SSOT restoration is stable for image/video panel create -> edge retention -> markdown reapply cleanup.
- The failing live path had two root causes:
  - stale authored runtime residue in the starter template,
  - renderer/runtime gaps around pending-edge preview, transient overlay-edge retention, stale size reuse, and auto-zoom on edge selection.
- Applied source fixes:
  - decoupled pending overlay-edge preview from committed-edge existence,
  - preserved connected overlay paths across transient empty-edge frames,
  - constrained Rich Media last-known-size reuse to true transient missing-props gaps instead of bare node-id reuse,
  - restricted metadata-less stable-graph fallback so stale edges do not survive source reapply,
  - disabled auto-zoom-on-edge-selection during user edge gestures.
- Verification:
  - `testStrybldrStarterTemplateStaysRunnableAndNeutral` passes against the real starter-template path.
  - `npm run test:smoke:storyboard-rich-media-drop:source` passes with the pending-edge contract.
  - `npm run test:smoke:storyboard-rich-media-drop:browser` exits `0` after the cleanup and verifier upgrade.
  - `npm run test:live:storyboard-media-panel-retention:browser` exits `0` for the canonical real-route image/video retention plus SSOT restoration proof.
