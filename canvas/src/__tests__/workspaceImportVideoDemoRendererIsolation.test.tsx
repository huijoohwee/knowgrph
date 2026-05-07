import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import FlowEditorCanvas from '@/components/FlowEditorCanvas'
import { activateFirstImportedWorkspaceFile } from '@/features/markdown-workspace/useWorkspaceFileActions/importActions'
import { importWorkspaceLocalFiles } from '@/features/markdown-workspace/workspaceImport'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { useGraphStore } from '@/hooks/useGraphStore'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { KNOWGRPH_VIDEO_DEMO_BASENAME, readDocsSsotFixtureText } from '@/tests/lib/docsSsotFixture'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'

type NonFlowEditorRenderer = 'd3' | 'flowchart' | 'flow' | 'design'

const ALL_NON_FLOW_EDITOR_RENDERERS: NonFlowEditorRenderer[] = ['d3', 'flowchart', 'flow', 'design']
const PRIOR_WIDGET_BY_RENDERER: Record<NonFlowEditorRenderer, string> = {
  d3: 'prior-d3',
  flowchart: 'prior-flowchart',
  flow: 'prior-flow',
  design: 'prior-design',
}

const createFile = (name: string, text: string) => {
  const blob = new Blob([text], { type: 'text/plain' })
  return new File([blob], name, { type: 'text/plain' })
}

const readScopedWidgetIds = (ids: unknown[] | null | undefined): string[] => {
  return Array.isArray(ids) ? ids.map(id => String(id || '').trim()).filter(Boolean) : []
}

const buildPriorWidgetIdSet = (renderers: NonFlowEditorRenderer[]): Set<string> => {
  return new Set(renderers.map(renderer => PRIOR_WIDGET_BY_RENDERER[renderer]))
}

function assertRendererScopedSeeds(renderers: NonFlowEditorRenderer[]) {
  const seededByRenderer = useGraphStore.getState().openWidgetNodeIdsByRenderer || {}
  for (const renderer of renderers) {
    const expectedNodeId = PRIOR_WIDGET_BY_RENDERER[renderer]
    const seeded = readScopedWidgetIds(seededByRenderer[renderer])
    if (seeded.length !== 1 || seeded[0] !== expectedNodeId) {
      throw new Error(`expected prior ${renderer} widget state to stay renderer-scoped before import, got ${JSON.stringify(seeded)}`)
    }
  }
}

function assertNoWidgetSeepage(args: {
  priorWidgetIds: Set<string>
  activeWidgetIds?: unknown[] | null
  flowEditorWidgetIds?: unknown[] | null
  context: string
}) {
  const activeWidgetIds = readScopedWidgetIds(args.activeWidgetIds)
  if (activeWidgetIds.some(id => args.priorWidgetIds.has(id))) {
    throw new Error(`expected ${args.context} active Flow Editor widget state to reject non-flow-editor seepage, got ${JSON.stringify(activeWidgetIds)}`)
  }
  const flowEditorWidgetIds = readScopedWidgetIds(args.flowEditorWidgetIds)
  if (flowEditorWidgetIds.some(id => args.priorWidgetIds.has(id))) {
    throw new Error(`expected ${args.context} flowEditor-scoped widget state to stay isolated from d3/flowchart/flow/design, got ${JSON.stringify(flowEditorWidgetIds)}`)
  }
}

async function runVideoDemoRuntimeLandingRendererIsolation(args?: {
  seedRenderers?: NonFlowEditorRenderer[]
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
      : ALL_NON_FLOW_EDITOR_RENDERERS
    for (const renderer of seedRenderers) {
      const nodeId = PRIOR_WIDGET_BY_RENDERER[renderer]
      store.setCanvas2dRenderer(renderer)
      store.setOpenWidgetNodeIds([nodeId])
    }

    assertRendererScopedSeeds(seedRenderers)

    const videoText = readDocsSsotFixtureText(KNOWGRPH_VIDEO_DEMO_BASENAME)
    const videoImport = await importWorkspaceLocalFiles({
      fs,
      files: [createFile(KNOWGRPH_VIDEO_DEMO_BASENAME, videoText)],
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

    const priorWidgetIds = buildPriorWidgetIdSet(seedRenderers)
    assertNoWidgetSeepage({
      priorWidgetIds,
      activeWidgetIds: afterImport.openWidgetNodeIds,
      flowEditorWidgetIds: (afterImport.openWidgetNodeIdsByRenderer || {}).flowEditor,
      context: 'imported',
    })
    const importedLayoutCache = afterImport.layoutPositionCacheByMode || {}
    const importedLayoutKeys = Object.keys(importedLayoutCache)
    const foreignRendererLayoutKeys = importedLayoutKeys.filter(key => /:2d:(d3|flowchart|flow|design)(:|$)/.test(key))
    if (foreignRendererLayoutKeys.length > 0) {
      throw new Error(`expected imported Flow Editor landing to avoid seeding foreign 2D renderer layout cache keys, got ${JSON.stringify(foreignRendererLayoutKeys)}`)
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
    await act(async () => {
      root = createRoot(container as unknown as HTMLElement)
      root.render(React.createElement(FlowEditorCanvas, { active: true } as never))
      await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
    })

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
        assertNoWidgetSeepage({
          priorWidgetIds,
          activeWidgetIds: state.openWidgetNodeIds,
          flowEditorWidgetIds: state.openWidgetNodeIdsByRenderer?.flowEditor,
          context: 'mounted runtime',
        })
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
      await act(async () => {
        root?.unmount()
        await new Promise<void>(resolveWait => setTimeout(resolveWait, 0))
      })
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}

export async function testVideoDemoRuntimeLandingRejectsRendererWidgetSeepage() {
  await runVideoDemoRuntimeLandingRendererIsolation()
}

export async function testVideoDemoRuntimeLandingRejectsFlowchartWidgetSeepage() {
  await runVideoDemoRuntimeLandingRendererIsolation({ seedRenderers: ['flowchart'] })
}

export async function testVideoDemoRuntimeLandingRejectsFlowWidgetSeepage() {
  await runVideoDemoRuntimeLandingRendererIsolation({ seedRenderers: ['flow'] })
}
