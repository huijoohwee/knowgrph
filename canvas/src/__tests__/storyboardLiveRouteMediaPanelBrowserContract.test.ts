import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardLiveRouteMediaPanelBrowserContract() {
  const packagePath = resolve(process.cwd(), 'package.json')
  const runnerPath = resolve(process.cwd(), 'scripts', 'run_storyboard_live_route_media_panel_retention.mjs')
  const verifierPath = resolve(process.cwd(), 'scripts', 'verify_storyboard_live_route_media_panel_retention.py')

  const packageSource = readFileSync(packagePath, 'utf8')
  const runnerSource = readFileSync(runnerPath, 'utf8')
  const verifierSource = readFileSync(verifierPath, 'utf8')

  if (!packageSource.includes('"test:live:storyboard-media-panel-retention:browser": "node ./scripts/run_storyboard_live_route_media_panel_retention.mjs"')) {
    throw new Error('expected package.json to expose a source-owned live-route storyboard media panel retention command')
  }

  for (const snippet of [
    "const devServerPort = String(process.env.KG_STORYBOARD_LIVE_ROUTE_PORT || '4175')",
    "KG_STORYBOARD_LIVE_ROUTE_BASE_URL: devServerBaseUrl",
    "python3', ['scripts/verify_storyboard_live_route_media_panel_retention.py']",
  ]) {
    if (!runnerSource.includes(snippet)) {
      throw new Error(`expected live-route runner to own dev-server bootstrap and verifier invocation: ${snippet}`)
    }
  }

  for (const snippet of [
    "KG_STORYBOARD_LIVE_ROUTE_DOC_PATH",
    "MEDIA_CASES = (",
    "window.knowgrphWorkspaceCommand",
    "applyMarkdownDocument",
    "kg:media-pointer-drag-drop",
    '({ clientX, clientY, payload }) => {',
    '"clientX": client_x',
    '"clientY": client_y',
    "\"kind\": \"image\"",
    "\"kind\": \"video\"",
    "\"targetNodeId\": \"starter-storyboard-beats-card\"",
    "starter-elements-card",
    "\"targetNodeId\": \"starter-elements-card\"",
    "dispatch_media_panel_drop(page, media_case)",
    "def expect_rich_media_shell_center_near_target(box, target_x: float, target_y: float, label: str) -> None:",
    'expect_rich_media_shell_center_near_target(',
    'f"{str(media_case[\'kind\'])} initial drop"',
    "assert_live_route_media_panel_retention(",
    'str(media_case["kind"])',
    "baseline_shell_ids = set(read_visible_rich_media_shell_ids(page))",
    "baseline_edge_count = read_storyboard_edge_count(page)",
    "def assert_reapply_clears_live_route_residue(",
    "expected live-route Rich Media shells to return to baseline after source reapply",
    "expected created live-route Storyboard edge to disappear after source reapply",
    "expected live-route Storyboard edge count to return to baseline after source reapply",
    'expect_rich_media_shell_box_stable(selected_box, box_after_edge_create, f"{media_kind} after edge create")',
    'expect_rich_media_shell_box_stable(selected_box, reopened_box, f"{media_kind} after select/open retention")',
    'expected one new live-route {str(media_case[\'kind\'])} panel',
    'expected created live-route Storyboard edge to remain visible',
    'box = read_visible_rich_media_shell_box(page, node_id)',
    'page.mouse.click(click_x, click_y, delay=50)',
    'def click_visible_storyboard_card(page, node_id: str) -> None:',
    'click_visible_storyboard_card(page, target_node_id)',
    'page.mouse.move(preview_probe_x, preview_probe_y, steps=6)',
    'page.mouse.move(target_x, target_y, steps=8)',
  ]) {
    if (!verifierSource.includes(snippet)) {
      throw new Error(`expected live-route verifier to cover real-route image and video panel retention, size stability, and source reapply cleanup: ${snippet}`)
    }
  }

  if (verifierSource.includes("dispatchEvent(new PointerEvent('pointerdown'") || verifierSource.includes("dispatchEvent(new MouseEvent('click'")) {
    throw new Error('expected live-route verifier shell reselection to use real Playwright mouse input instead of synthetic DOM click dispatch')
  }
}
