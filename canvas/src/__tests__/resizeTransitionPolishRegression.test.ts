import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readUtf8 = (filePath: string): string => readFileSync(filePath, 'utf8')

export function testResizeTransitionPolishKeepsSharedShapeAndLabelTransitions() {
  const groupsText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groups.ts'))
  const cssText = readUtf8(resolve(process.cwd(), 'src/index.css'))
  if (!cssText.includes('--kg-motion-fast: 140ms;')) {
    throw new Error('expected root CSS to define a shared fast motion token')
  }
  if (!cssText.includes('--kg-motion-ease: ease;')) {
    throw new Error('expected root CSS to define a shared motion easing token')
  }
  if (!cssText.includes('--kg-transition-action: transform var(--kg-motion-fast) var(--kg-motion-ease), box-shadow var(--kg-motion-fast) var(--kg-motion-ease), background var(--kg-motion-fast) var(--kg-motion-ease);')) {
    throw new Error('expected root CSS to define a shared action-button transition token')
  }
  if (!cssText.includes('--kg-transition-group-shape: stroke-width var(--kg-motion-fast) var(--kg-motion-ease), fill-opacity var(--kg-motion-fast) var(--kg-motion-ease);')) {
    throw new Error('expected root CSS to define a shared group-shape transition token')
  }
  if (!cssText.includes('--kg-transition-group-label: opacity var(--kg-motion-fast) var(--kg-motion-ease);')) {
    throw new Error('expected root CSS to define a shared group-label transition token')
  }
  if (!cssText.includes('@media (prefers-reduced-motion: reduce)')) {
    throw new Error('expected root CSS to override motion tokens for reduced-motion users')
  }
  if (!cssText.includes('--kg-motion-fast: 0ms;')) {
    throw new Error('expected reduced-motion CSS to zero fast motion durations')
  }
  if (!groupsText.includes("const groupShapeTransition = 'var(--kg-transition-group-shape)'")) {
    throw new Error('expected group resize polish to source shape transitions from the shared transition token SSOT')
  }
  if (!groupsText.includes("const groupLabelTransition = 'var(--kg-transition-group-label)'")) {
    throw new Error('expected group resize polish to source label transitions from the shared transition token SSOT')
  }
  if (!groupsText.includes(".style('transition', groupShapeTransition)")) {
    throw new Error('expected rect and geo groups to reuse the shared shape transition')
  }
  if (!groupsText.includes(".style('transition', groupLabelTransition)")) {
    throw new Error('expected group labels to reuse the shared label transition')
  }
  if (!cssText.includes('transition: var(--kg-transition-action);')) {
    throw new Error('expected app CSS action buttons to reuse the shared transition token SSOT')
  }
}

export function testResizeTransitionPolishKeepsChevronAndHandleDotTransitions() {
  const groupsText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groups.ts'))
  const cssText = readUtf8(resolve(process.cwd(), 'src/index.css'))
  const htmlViewerText = readUtf8(resolve(process.cwd(), 'src/lib/graph/htmlViewer/buildGraphHtmlViewerMarkup.ts'))
  const htmlViewerRuntimeText = readUtf8(resolve(process.cwd(), 'src/lib/graph/htmlViewer/runtimeScript.ts'))
  const htmlViewerLiveExportText = readUtf8(resolve(process.cwd(), 'src/lib/graph/htmlViewer/liveOverlayExport.ts'))
  const kanbanGroupText = readUtf8(resolve(process.cwd(), 'src/features/markdown/ui/kanban/KanbanGroup.tsx'))
  const kanbanCardText = readUtf8(resolve(process.cwd(), 'src/features/markdown/ui/kanban/KanbanCard.tsx'))
  if (!cssText.includes('--kg-transition-group-chevron: stroke-width var(--kg-motion-fast) var(--kg-motion-ease), opacity var(--kg-motion-fast) var(--kg-motion-ease);')) {
    throw new Error('expected root CSS to define a shared group-chevron transition token')
  }
  if (!cssText.includes('--kg-transition-group-resize-dot: stroke-width var(--kg-motion-fast) var(--kg-motion-ease), fill-opacity var(--kg-motion-fast) var(--kg-motion-ease);')) {
    throw new Error('expected root CSS to define a shared group resize-dot transition token')
  }
  if (!groupsText.includes("const groupChevronTransition = 'var(--kg-transition-group-chevron)'")) {
    throw new Error('expected group resize polish to source chevron transitions from the shared transition token SSOT')
  }
  if (!groupsText.includes("const groupResizeDotTransition = 'var(--kg-transition-group-resize-dot)'")) {
    throw new Error('expected group resize polish to source resize-dot transitions from the shared transition token SSOT')
  }
  if (!groupsText.includes(".style('transition', groupChevronTransition)")) {
    throw new Error('expected group chevrons to reuse the shared transition definition')
  }
  if (!groupsText.includes(".style('transition', groupResizeDotTransition)")) {
    throw new Error('expected group resize dots to reuse the shared transition definition')
  }
  if (htmlViewerText.includes('data-kg-panel-action="1"') || htmlViewerText.includes('.kg-mediaActionBtn') || htmlViewerText.includes('.kg-mediaActions')) {
    throw new Error('expected html viewer Rich Media export to remove the legacy inline action-button variant after toolbar consolidation')
  }
  if (htmlViewerRuntimeText.includes('data-kg-markdown-design-block')) {
    throw new Error('expected html viewer runtime patching to stop carrying the dead markdown overlay legacy alias branch after upstream canonicalization')
  }
  if (htmlViewerText.includes('data-kg-md-panel')) {
    throw new Error('expected html viewer markdown export cleanup to drop the dead data-kg-md-panel normalization branch after upstream canonicalization')
  }
  if (htmlViewerText.includes("data-kg-anchor-node-id') || readAttr(tag, 'data-node-id'") || htmlViewerText.includes("data-kg-anchor-node-id') || el.getAttribute('data-node-id'")) {
    throw new Error('expected html viewer markdown anchor handling to stop falling back to data-node-id after canonical producer cleanup')
  }
  if (htmlViewerLiveExportText.includes("data-kg-anchor-node-id') || el.getAttribute('data-node-id'")) {
    throw new Error('expected live overlay export markdown anchors to stop falling back to data-node-id after canonical producer cleanup')
  }
  if (htmlViewerText.includes("stripAttr(nextTag, 'data-node-id')")) {
    throw new Error('expected html viewer markdown canonicalization to stop carrying the dead data-node-id strip branch after producer cleanup')
  }
  if (htmlViewerRuntimeText.includes('n.open_url')) {
    throw new Error('expected html viewer media runtime payload handling to stop carrying the dead snake_case open_url fallback after canonical producer cleanup')
  }
  if (htmlViewerText.includes("el.getAttribute('data-kg-title')")) {
    throw new Error('expected html viewer rich-media parsing to stop carrying the dead data-kg-title metadata branch after producer cleanup')
  }
  if (htmlViewerRuntimeText.includes("var kind2 = '';") || htmlViewerRuntimeText.includes("mediaNodes.push({ id: xid2, kind: kind2 || 'iframe'")) {
    throw new Error('expected html viewer runtime to drop the dead rich-media DOM metadata merge branch while keeping the id-only fallback')
  }
  if (htmlViewerRuntimeText.includes("out = replaceOnceExact(\n    out,\n    'header.appendChild(title);\\n        var body = document.createElement(\\'div\\');'")) {
    throw new Error('expected html viewer runtime patching to stop carrying the dead no-op media header/body rewrite branch')
  }
  if (htmlViewerRuntimeText.includes("out = replaceOnceExact(\n    out,\n    'var mediaNodes = __KG_MEDIA_NODES__;\\n    var nodeMetaById = __KG_NODE_META__;")) {
    throw new Error('expected html viewer runtime patching to stop carrying the dead duplicate node-id helper injection branch before nodeMetaById')
  }
  if (htmlViewerRuntimeText.includes("out = replaceAllExact(\n    out,\n    \"var xid2 = String(ex2.getAttribute('data-node-id') || '').trim();\"")) {
    throw new Error('expected html viewer runtime patching to stop carrying the dead xid2 node-id rewrite branch once the upstream token is gone')
  }
  if (htmlViewerRuntimeText.split("\"var b = markdownBlocks[i];\\n        if (!b) continue;\\n        var id = String(b.id || '');\\n        if (!id) continue;\"").length - 1 !== 1) {
    throw new Error('expected html viewer runtime patching to keep only one live markdown block anchor-preload rewrite branch after duplicate cleanup')
  }
  if (htmlViewerRuntimeText.split("\"el.setAttribute('data-md-id', id);\"").length - 1 !== 1) {
    throw new Error('expected html viewer runtime patching to keep only one live markdown data-md-id anchor rewrite branch after duplicate cleanup')
  }
  if (htmlViewerRuntimeText.split("\"overlay.__kgMdById[id] = el;\"").length - 1 !== 1) {
    throw new Error('expected html viewer runtime patching to keep only one live markdown overlay map rewrite branch after duplicate cleanup')
  }
  if (htmlViewerRuntimeText.split("\"var xanchor = String(ex.getAttribute('data-kg-anchor-node-id') || '').trim();\"").length - 1 !== 1) {
    throw new Error('expected html viewer runtime patching to keep only one live markdown anchor rewrite branch after duplicate cleanup')
  }
  if (htmlViewerRuntimeText.includes("out = replaceAllExact(\n    out,\n    \"el.setAttribute('data-kg-canvas-wheel-ignore', 'true');\",\n    '',\n  )")) {
    throw new Error('expected html viewer runtime patching to stop carrying the dead wheel-ignore removal branch once the emitted runtime is already unchanged without it')
  }
  if (htmlViewerRuntimeText.split("var UI_IGNORE_SELECTOR = '#kg-hud, #kg-hud *';").length - 1 !== 1) {
    throw new Error('expected html viewer runtime patching to keep only one live HUD-only UI ignore selector rewrite after duplicate cleanup')
  }
  if (htmlViewerRuntimeText.split("\"var src = String(edgeEl.getAttribute('data-source-id') || edgeEl.getAttribute('data-source') || '').trim();\\n      var tgt = String(edgeEl.getAttribute('data-target-id') || edgeEl.getAttribute('data-target') || '').trim();\"").length - 1 !== 1) {
    throw new Error('expected html viewer runtime patching to keep only one live edge source-target resolver rewrite branch after duplicate cleanup')
  }
  if (htmlViewerRuntimeText.includes("out = replaceOnceExact(\n    out,\n    \"function updateEdgeGeometryByEl(edgeEl){\\n      if (!edgeEl || !edgeEl.getAttribute) return;\\n      var src = String(edgeEl.getAttribute('data-source-id') || edgeEl.getAttribute('data-source') || '').trim();")) {
    throw new Error('expected html viewer runtime patching to stop carrying the dead raw edgeEl geometry rewrite branch once earlier source-target canonicalization makes it unreachable')
  }
  if (htmlViewerRuntimeText.includes("out = replaceOnceExact(\n    out,\n    \"if (/(^|\\\\/\\\\/)twitframe\\\\.com\\\\//i.test(u)) return true;\\n        return false;\"")) {
    throw new Error('expected html viewer runtime patching to stop carrying the dead twitframe-to-bilibili allowlist rewrite branch once the upstream token is gone')
  }
  if (htmlViewerRuntimeText.includes("out = replaceOnceExact(\n    out,\n    'var offMap = svg.__kgNodeOffsetById || (svg.__kgNodeOffsetById = {});'")) {
    throw new Error('expected html viewer runtime patching to stop carrying the dead foreignObject markdown offMap injection branch once the emitted runtime is unchanged without it')
  }
  if (htmlViewerRuntimeText.includes("out = replaceOnceExact(\n    out,\n    \"if (overlayFollowAnimation && svg && (svg.__kgNodeOffsetById || (svg.__kgNodeOffsetById = {}))) {\\n          var map = svg.__kgNodeOffsetById;")) {
    throw new Error('expected html viewer runtime patching to stop carrying the dead overlayFollowAnimation offset-map guard rewrite once the emitted runtime is unchanged without it')
  }
  if (!cssText.includes('.kg-panel-action-btn {') || !cssText.includes('.kg-panel-icon-btn {')) {
    throw new Error('expected app CSS to expose shared panel action button classes for consumers like Kanban')
  }
  if (cssText.includes('button[data-kg-panel-action="1"]') || cssText.includes('button[data-kg-kanban-icon-action="1"]')) {
    throw new Error('expected app CSS to remove the legacy data-attribute action-button selectors after class-based consolidation')
  }
  if (kanbanGroupText.includes('data-kg-panel-action="1"') || kanbanCardText.includes('data-kg-panel-action="1"')) {
    throw new Error('expected Kanban action buttons to stop depending on the legacy shared data-kg-panel-action hook')
  }
  if (!kanbanGroupText.includes('kg-panel-action-btn kg-panel-icon-btn') || !kanbanCardText.includes('kg-panel-action-btn kg-panel-icon-btn')) {
    throw new Error('expected Kanban icon actions to reuse the shared panel action button classes')
  }
}
