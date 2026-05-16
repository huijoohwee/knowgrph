import fs from 'node:fs'

import React from 'react'
import { createRoot } from 'react-dom/client'

import FlowEditorCanvas from './src/components/FlowEditorCanvas'
import { __flowCanvasDebug } from './src/components/FlowCanvas/flowCanvasDebug'
import { useMarkdownExplorerStore } from './src/features/markdown-explorer/store'
import { loadGraphDataFromTextViaParser } from './src/features/parsers/loader'
import { applyComposedGraphFromSourceFiles } from './src/features/source-files/applyComposedGraphFromSourceFiles'
import { useGraphStore } from './src/hooks/useGraphStore'
import { buildFlowWidgetEligibleNodeIdSet } from './src/lib/graph/flowWidgetEligibility'
import { KNOWGRPH_VIDEO_DEMO_BASENAME, readDocsSsotFixtureText } from './src/tests/lib/docsSsotFixture'
import { initJsdomHarness } from './src/tests/lib/jsdomHarness'
import { MemoryStorage } from './src/tests/lib/memoryStorage'
import { initWindowHarness } from './src/tests/lib/windowHarness'

const storage = new MemoryStorage()
const { restore: restoreWindow } = initWindowHarness({ storage })
const { dom, restore: restoreDom } = initJsdomHarness()
const targetViewport = { width: 1920, height: 1080 }

const elementProto = dom.window.HTMLElement.prototype
const originalElementRect = elementProto.getBoundingClientRect
elementProto.getBoundingClientRect = function patchedGetBoundingClientRect(this: HTMLElement): DOMRect {
  const shouldForceViewportRect =
    this.matches('[data-kg-canvas-viewport-root="1"]')
    || this.matches('[data-kg-flow-editor-surface-root]')
  if (!shouldForceViewportRect) return originalElementRect.call(this) as DOMRect
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: targetViewport.width,
    height: targetViewport.height,
    right: targetViewport.width,
    bottom: targetViewport.height,
    toJSON: () => ({}),
  } as DOMRect
}

const anyWindow = dom.window as unknown as {
  requestAnimationFrame?: (cb: (ts: number) => void) => number
  innerWidth?: number
  innerHeight?: number
}
anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame

const store = useGraphStore.getState()
const explorer = useMarkdownExplorerStore.getState()
store.resetAll()
store.setDocumentStructureBaselineLock(false)
store.setCanvasRenderMode('2d')
store.setCanvas2dRenderer('d3')
store.setDocumentSemanticMode('keyword')
store.setFrontmatterModeEnabled(false)
store.setWorkspaceViewMode('editor')
store.setWorkspaceCanvasPaneOpen(true)

const doc = dom.window.document
const container = doc.createElement('div')
container.setAttribute('data-kg-canvas-viewport-root', '1')
container.id = 'tmp-probe-root'
doc.body.appendChild(container)

const root = createRoot(container as unknown as HTMLElement)
root.render(React.createElement(FlowEditorCanvas, { active: true } as never))

anyWindow.innerWidth = targetViewport.width
anyWindow.innerHeight = targetViewport.height
dom.window.dispatchEvent(new dom.window.Event('resize'))

const sourcePath = '/docs/knowgrph-video-demo.md'
const sourceText = readDocsSsotFixtureText(KNOWGRPH_VIDEO_DEMO_BASENAME)
const parsed = await loadGraphDataFromTextViaParser(sourcePath, sourceText, { applyToStore: false, syncMarkdownDocument: false })
if (!parsed?.graphData) throw new Error('probe parse failed')

store.setSourceFiles([{
  id: 'sf-video-initial-open-probe',
  name: KNOWGRPH_VIDEO_DEMO_BASENAME,
  text: sourceText,
  enabled: true,
  status: 'parsed',
  parsedTextHash: 'tmp-probe',
  parsedGraphRevision: 1,
  parsedGraphData: parsed.graphData,
  source: { kind: 'local', path: sourcePath },
}])
explorer.setActivePath(sourcePath)
store.setMarkdownDocument(sourcePath, sourceText)
applyComposedGraphFromSourceFiles()

const postCompose = useGraphStore.getState()
const graphNodes = Array.isArray(postCompose.graphData?.nodes) ? postCompose.graphData.nodes : []
const eligibleWidgetIds = Array.from(buildFlowWidgetEligibleNodeIdSet(graphNodes as never))
  .map(id => String(id || '').trim())
  .filter(Boolean)
store.setOpenWidgetNodeIds(eligibleWidgetIds)
store.setFlowWidgetWorldPosByNodeId({})
dom.window.dispatchEvent(new dom.window.Event('resize'))

const capture = (label: string) => {
  const state = useGraphStore.getState() as unknown as {
    canvas2dRenderer?: string
    documentSemanticMode?: string
    frontmatterModeEnabled?: boolean
    openWidgetNodeIds?: string[]
    flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
    zoomState?: { k?: number; x?: number; y?: number }
    zoomStateByKey?: Record<string, { k?: number; x?: number; y?: number }>
  }
  const canvasEl = doc.querySelector('canvas')
  const flowSurfaceEl = doc.querySelector<HTMLElement>('[data-kg-flow-editor-surface-root]')
  const viewportRootEl = doc.querySelector<HTMLElement>('[data-kg-canvas-viewport-root="1"]')
  return {
    label,
    renderer: state.canvas2dRenderer,
    documentSemanticMode: state.documentSemanticMode,
    frontmatterModeEnabled: state.frontmatterModeEnabled,
    openWidgetCount: Array.isArray(state.openWidgetNodeIds) ? state.openWidgetNodeIds.length : 0,
    worldCount: Object.keys(state.flowWidgetWorldPosByNodeId || {}).length,
    canvasWidth: canvasEl?.width ?? null,
    canvasHeight: canvasEl?.height ?? null,
    flowSurfaceRect: flowSurfaceEl ? flowSurfaceEl.getBoundingClientRect() : null,
    viewportRootRect: viewportRootEl ? viewportRootEl.getBoundingClientRect() : null,
    zoomState: state.zoomState || null,
    keyedZoom: Object.values(state.zoomStateByKey || {})[0] || null,
    debug: { ...__flowCanvasDebug },
  }
}

setTimeout(() => {
  fs.writeFileSync('/tmp/kg-probe.json', JSON.stringify([
    capture('t+1s'),
  ], null, 2))
}, 1000)

setTimeout(() => {
  fs.writeFileSync('/tmp/kg-probe.json', JSON.stringify([
    capture('t+1s'),
    capture('t+4s'),
  ], null, 2))
  root.unmount()
  elementProto.getBoundingClientRect = originalElementRect
  restoreDom()
  restoreWindow()
  process.exit(0)
}, 4000)
