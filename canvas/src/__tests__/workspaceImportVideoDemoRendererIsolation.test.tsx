import React from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import FlowEditorCanvas from '@/components/FlowEditorCanvas'
import { activateFirstImportedWorkspaceFile } from '@/components/BottomPanel/markdownWorkspace/useWorkspaceFileActions/importActions'
import { importWorkspaceLocalFiles } from '@/components/BottomPanel/markdownWorkspace/workspaceImport'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { useGraphStore } from '@/hooks/useGraphStore'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'

const createFile = (name: string, text: string) => {
  const blob = new Blob([text], { type: 'text/plain' })
  return new File([blob], name, { type: 'text/plain' })
}

async function runImportedVideoDemoRuntimeLandingRendererIsolation(args?: {
  seedRenderers?: Array<'d3' | 'flowchart' | 'flow' | 'design'>
}) {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = anyWindow.requestAnimationFrame

    resetWorkspaceFsForTests()
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const store = useGraphStore.getState()
    const explorer = useMarkdownExplorerStore.getState()
    store.resetAll()
    store.setDocumentStructureBaselineLock(false)
    store.setCanvasRenderMode('2d')
    store.setDocumentSemanticMode('keyword')
    store.setFrontmatterModeEnabled(false)
    store.setGraphData({
      type: 'Graph',
      context: 'renderer-isolation-seed',
      nodes: [
        { id: 'prior-d3', type: 'Node', label: 'Prior D3', properties: {}, x: 0, y: 0, vx: 0, vy: 0 },
        { id: 'prior-flowchart', type: 'Node', label: 'Prior Flowchart', properties: {}, x: 1, y: 0, vx: 0, vy: 0 },
        { id: 'prior-flow', type: 'Node', label: 'Prior Flow', properties: {}, x: 2, y: 0, vx: 0, vy: 0 },
        { id: 'prior-design', type: 'Node', label: 'Prior Design', properties: {}, x: 3, y: 0, vx: 0, vy: 0 },
      ],
      edges: [],
    } as never)

    const seedRenderers = Array.isArray(args?.seedRenderers) && args.seedRenderers.length > 0
      ? args.seedRenderers
      : ['d3', 'flowchart', 'flow', 'design']
    const priorWidgetByRenderer: Record<'d3' | 'flowchart' | 'flow' | 'design', string> = {
      d3: 'prior-d3',
      flowchart: 'prior-flowchart',
      flow: 'prior-flow',
      design: 'prior-design',
    }
    for (const renderer of seedRenderers) {
      const nodeId = priorWidgetByRenderer[renderer]
      store.setCanvas2dRenderer(renderer)
      store.setOpenWidgetNodeIds([nodeId])
    }

    const seededByRenderer = useGraphStore.getState().openWidgetNodeIdsByRenderer || {}
    for (const renderer of seedRenderers) {
      const nodeId = priorWidgetByRenderer[renderer]
      const seeded = seededByRenderer[renderer] || []
      if (seeded.length !== 1 || seeded[0] !== nodeId) {
        throw new Error(`expected prior ${renderer} widget state to stay renderer-scoped before import, got ${JSON.stringify(seeded)}`)
      }
    }

    const videoText = readFileSync(resolve(process.cwd(), '..', 'knowgrph-video-demo.md'), 'utf8')
    const videoImport = await importWorkspaceLocalFiles({
      fs,
      files: [createFile('knowgrph-video-demo.md', videoText)],
      parentPath: '/',
    })
    const importedVideoPath = String(videoImport.createdPaths[0] || '').trim()
    if (!importedVideoPath) throw new Error('expected imported video path')

    explorer.setActivePath('/README.md')
    await activateFirstImportedWorkspaceFile({ fs, createdPaths: videoImport.createdPaths, applyToGraph: true })

    const afterImport = useGraphStore.getState()
    if (useMarkdownExplorerStore.getState().activePath !== importedVideoPath) {
      throw new Error(`expected import activation to focus imported video doc, got ${String(useMarkdownExplorerStore.getState().activePath || '')}`)
    }
    if (afterImport.canvasRenderMode !== '2d') {
      throw new Error(`expected video import to preserve 2d render mode, got ${String(afterImport.canvasRenderMode || '')}`)
    }
    if (afterImport.canvas2dRenderer !== 'flowEditor') {
      throw new Error(`expected video import to land on flowEditor, got ${String(afterImport.canvas2dRenderer || '')}`)
    }
    if (afterImport.documentSemanticMode !== 'document') {
      throw new Error(`expected video import to enable document mode, got ${String(afterImport.documentSemanticMode || '')}`)
    }
    if (afterImport.frontmatterModeEnabled !== true) {
      throw new Error('expected video import to enable frontmatter mode')
    }

    const priorWidgetIds = new Set(seedRenderers.map(renderer => priorWidgetByRenderer[renderer]))
    const activeWidgetIds = (afterImport.openWidgetNodeIds || []).map(id => String(id || '').trim()).filter(Boolean)
    if (activeWidgetIds.some(id => priorWidgetIds.has(id))) {
      throw new Error(`expected active Flow Editor widget state to reject non-flow-editor seepage, got ${JSON.stringify(activeWidgetIds)}`)
    }
    const flowEditorScopedWidgetIds = ((afterImport.openWidgetNodeIdsByRenderer || {}).flowEditor || [])
      .map(id => String(id || '').trim())
      .filter(Boolean)
    if (flowEditorScopedWidgetIds.some(id => priorWidgetIds.has(id))) {
      throw new Error(`expected flowEditor-scoped widget state to stay isolated from d3/flowchart/flow/design, got ${JSON.stringify(flowEditorScopedWidgetIds)}`)
    }

    const importedNodes = Array.isArray(afterImport.graphData?.nodes) ? afterImport.graphData.nodes : []
    const eligibleWidgetIds = Array.from(buildFlowWidgetEligibleNodeIdSet(importedNodes as never)).map(id => String(id || '').trim()).filter(Boolean)
    if (eligibleWidgetIds.length === 0) {
      throw new Error('expected imported knowgrph-video-demo graph to expose Flow Editor widget-eligible nodes')
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'runtime-root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(FlowEditorCanvas, { active: true } as never))

    const waitForFlowEditorOverlaySeed = async () => {
      const deadline = Date.now() + 1500
      while (Date.now() < deadline) {
        const state = useGraphStore.getState() as unknown as {
          canvas2dRenderer?: string
          openWidgetNodeIds?: string[]
          openWidgetNodeIdsByRenderer?: Partial<Record<string, string[]>>
          flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
        }
        if (String(state.canvas2dRenderer || '') !== 'flowEditor') {
          throw new Error(`expected mounted runtime to stay on flowEditor, got ${String(state.canvas2dRenderer || '')}`)
        }
        const activeIds = Array.isArray(state.openWidgetNodeIds) ? state.openWidgetNodeIds.map(id => String(id || '').trim()).filter(Boolean) : []
        if (activeIds.some(id => priorWidgetIds.has(id))) {
          throw new Error(`expected mounted Flow Editor runtime to reject non-flow-editor widget seepage, got ${JSON.stringify(activeIds)}`)
        }
        const flowEditorIds = Array.isArray(state.openWidgetNodeIdsByRenderer?.flowEditor)
          ? state.openWidgetNodeIdsByRenderer?.flowEditor?.map(id => String(id || '').trim()).filter(Boolean) || []
          : []
        if (flowEditorIds.some(id => priorWidgetIds.has(id))) {
          throw new Error(`expected mounted Flow Editor scoped widget state to reject non-flow-editor seepage, got ${JSON.stringify(flowEditorIds)}`)
        }
        const worldById = state.flowWidgetWorldPosByNodeId || {}
        const seededEligibleIds = eligibleWidgetIds.filter(id => {
          const pos = worldById[id]
          return !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)
        })
        if (seededEligibleIds.length > 0) return seededEligibleIds
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 5))
      }
      throw new Error('expected mounted Flow Editor runtime to seed imported video-demo widget overlay world positions')
    }

    const seededEligibleIds = await waitForFlowEditorOverlaySeed()
    if (seededEligibleIds.some(id => priorWidgetIds.has(id))) {
      throw new Error(`expected seeded Flow Editor overlay ids to belong to imported video-demo widgets only, got ${JSON.stringify(seededEligibleIds)}`)
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testImportedVideoDemoRuntimeLandingRejectsNonFlowEditorRendererWidgetSeepage() {
  await runImportedVideoDemoRuntimeLandingRendererIsolation()
}

export async function testImportedVideoDemoRuntimeLandingRejectsPriorFlowchartRendererWidgetSeepage() {
  await runImportedVideoDemoRuntimeLandingRendererIsolation({ seedRenderers: ['flowchart'] })
}

export async function testImportedVideoDemoRuntimeLandingRejectsPriorFlowRendererWidgetSeepage() {
  await runImportedVideoDemoRuntimeLandingRendererIsolation({ seedRenderers: ['flow'] })
}
