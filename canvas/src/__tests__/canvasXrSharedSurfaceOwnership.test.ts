import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'
import { applyCanvasFrontmatterPreset } from '@/features/parsers/canvasFrontmatterPreset'
import { readMediaCatalogMode, setMediaCatalogMode } from '@/features/command-menu/mediaCatalogModeRuntime'
import {
  activateXrSceneSurface,
  XR_SCENE_FLOATING_PANEL_VIEWS,
} from '@/features/three/xrSceneSurfaceRuntime'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  applyCanvasSurfaceModeSelection,
  getCanvasSurfaceModeDisabledCopy,
  normalizeCanvas3dMode,
} from '@/lib/canvas/canvas3dMode'
import type { GraphSchema } from '@/lib/graph/schema'

const BLOCK_SCHEMA = {
  layout: { mode: 'block' },
  behavior: {
    allowEdgeCreation: true,
    allowNodeDrag: true,
  },
  nodeStyles: {},
  edgeStyles: {},
  rules: [],
} as unknown as GraphSchema

const NOOP_BOTTOM_SURFACE_ACTIONS = {
  bottomSurfaceCollapsed: true,
  bottomSurfaceTab: 'stats' as const,
  setBottomSurfaceCollapsed: () => {},
  setBottomSurfaceTab: () => {},
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), 'src', relativePath), 'utf8')
}

export function testXrModeNormalizesAndCanvasViewSelectionActivatesSurface() {
  if (normalizeCanvas3dMode('xr') !== 'xr') {
    throw new Error('Expected XR Mode to normalize as a first-class 3D canvas mode')
  }

  const rawSurfaceCalls: string[] = []
  let sharedXrRequestCount = 0
  applyCanvasViewSelection({
    id: 'surface:xr',
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: false,
    onOpenGeospatialMode: () => {
      throw new Error('Expected XR Mode selection to avoid opening Geospatial Mode when geospatial is disabled')
    },
    onOpenShared3dPanel: mode => {
      if (mode !== 'xr') throw new Error(`Expected the shared XR owner request, got ${mode}`)
      sharedXrRequestCount += 1
    },
    canvas2dRenderer: 'd3',
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    renderMediaAsNodes: false,
    timelineEnabled: true,
    ...NOOP_BOTTOM_SURFACE_ACTIONS,
    schema: BLOCK_SCHEMA,
    setCanvas2dRenderer: () => {},
    setCanvasRenderMode: mode => rawSurfaceCalls.push(`render:${mode}`),
    setCanvas3dMode: mode => rawSurfaceCalls.push(`3d:${mode}`),
    setSchema: () => {},
    setRenderMediaAsNodes: () => {},
    setTimelineEnabled: () => {},
    setDocumentSemanticMode: () => {},
    setFrontmatterModeEnabled: () => {},
    setMultiDimTableModeEnabled: () => {},
  })
  if (sharedXrRequestCount !== 1 || rawSurfaceCalls.length !== 0) {
    throw new Error(`Expected XR Mode selection to delegate once without raw surface setters, got ${JSON.stringify({ sharedXrRequestCount, rawSurfaceCalls })}`)
  }

  const previous = useGraphStore.getState()
  const previousMediaMode = readMediaCatalogMode()
  try {
    for (const panelView of XR_SCENE_FLOATING_PANEL_VIEWS) {
      useGraphStore.setState({
        canvasRenderMode: '2d',
        canvas3dMode: '3d',
        floatingPanelOpen: false,
        floatingPanelView: 'propsPanel',
      })
      if (!activateXrSceneSurface({ panelView, openPanel: true })) {
        throw new Error(`Expected ${panelView} to activate through the shared XR scene surface owner`)
      }
      const active = useGraphStore.getState()
      if (active.canvasRenderMode !== '3d'
        || active.canvas3dMode !== 'xr'
        || !active.floatingPanelOpen
        || active.floatingPanelView !== panelView) {
        throw new Error(`Expected ${panelView} to retain one XR surface, got ${JSON.stringify({
          canvasRenderMode: active.canvasRenderMode,
          canvas3dMode: active.canvas3dMode,
          floatingPanelOpen: active.floatingPanelOpen,
          floatingPanelView: active.floatingPanelView,
        })}`)
      }
    }
    if (readMediaCatalogMode() !== 'xr-3d') {
      throw new Error('Expected Media to reuse the shared XR scene catalog projection')
    }
    useGraphStore.setState({
      canvasRenderMode: '2d',
      canvas3dMode: '3d',
      canvasRenderModeLastFree: '2d',
      canvasRenderModeIsAuto: false,
      schema: { ...BLOCK_SCHEMA, layout: { mode: 'radial' } },
      floatingPanelOpen: false,
      floatingPanelView: 'propsPanel',
    } as never)
    const beforeRejectedXr = useGraphStore.getState()
    if (activateXrSceneSurface({ panelView: 'camera', openPanel: true })) {
      throw new Error('Expected radial layout to reject shared XR activation')
    }
    const afterRejectedXr = useGraphStore.getState()
    for (const key of ['canvasRenderMode', 'canvas3dMode', 'canvasRenderModeLastFree', 'canvasRenderModeIsAuto', 'floatingPanelOpen', 'floatingPanelView'] as const) {
      if (afterRejectedXr[key] !== beforeRejectedXr[key]) {
        throw new Error(`Expected rejected XR activation to restore ${key}`)
      }
    }
  } finally {
    useGraphStore.setState({
      canvasRenderMode: previous.canvasRenderMode,
      canvas3dMode: previous.canvas3dMode,
      canvasRenderModeLastFree: previous.canvasRenderModeLastFree,
      canvasRenderModeIsAuto: previous.canvasRenderModeIsAuto,
      floatingPanelOpen: previous.floatingPanelOpen,
      floatingPanelView: previous.floatingPanelView,
      schema: previous.schema,
    } as never)
    setMediaCatalogMode(previousMediaMode)
  }
}

export function testCanvasStoreRoutesXrActivationThroughSharedOwner() {
  const previous = useGraphStore.getState()
  try {
    useGraphStore.setState({
      canvasRenderMode: '3d',
      canvas3dMode: '3d',
      canvasRenderModeLastFree: '3d',
      canvasRenderModeIsAuto: false,
      documentStructureBaselineLock: false,
      documentSemanticMode: 'document',
      frontmatterModeEnabled: false,
      multiDimTableModeEnabled: false,
      schema: BLOCK_SCHEMA,
    } as never)
    useGraphStore.getState().setCanvas3dMode('xr')
    const blockActivation = useGraphStore.getState()
    if (blockActivation.canvasRenderMode !== '3d' || blockActivation.canvas3dMode !== 'xr') {
      throw new Error(`Expected direct block-layout XR mode to activate the shared surface, got ${JSON.stringify({
        canvasRenderMode: blockActivation.canvasRenderMode,
        canvas3dMode: blockActivation.canvas3dMode,
      })}`)
    }

    useGraphStore.setState({
      canvasRenderMode: '2d',
      canvas3dMode: 'xr',
      canvasRenderModeLastFree: '2d',
      canvasRenderModeIsAuto: false,
      schema: BLOCK_SCHEMA,
    } as never)
    useGraphStore.getState().setCanvasRenderMode('3d')
    const latentActivation = useGraphStore.getState()
    if (latentActivation.canvasRenderMode !== '3d' || latentActivation.canvas3dMode !== 'xr') {
      throw new Error(`Expected latent XR mode to enter 3D through the shared surface owner, got ${JSON.stringify({
        canvasRenderMode: latentActivation.canvasRenderMode,
        canvas3dMode: latentActivation.canvas3dMode,
      })}`)
    }

    useGraphStore.setState({
      canvasRenderMode: '3d',
      canvas3dMode: '3d',
      canvasRenderModeLastFree: '3d',
      canvasRenderModeIsAuto: false,
      schema: { ...BLOCK_SCHEMA, layout: { mode: 'radial' } },
    } as never)
    const radialBefore = useGraphStore.getState()
    radialBefore.setCanvas3dMode('xr')
    const radialAfter = useGraphStore.getState()
    for (const key of ['canvasRenderMode', 'canvas3dMode', 'canvasRenderModeLastFree', 'canvasRenderModeIsAuto'] as const) {
      if (radialAfter[key] !== radialBefore[key]) {
        throw new Error(`Expected direct radial XR activation to fail closed without changing ${key}`)
      }
    }
  } finally {
    useGraphStore.setState({
      canvasRenderMode: previous.canvasRenderMode,
      canvas3dMode: previous.canvas3dMode,
      canvasRenderModeLastFree: previous.canvasRenderModeLastFree,
      canvasRenderModeIsAuto: previous.canvasRenderModeIsAuto,
      documentStructureBaselineLock: previous.documentStructureBaselineLock,
      documentSemanticMode: previous.documentSemanticMode,
      frontmatterModeEnabled: previous.frontmatterModeEnabled,
      multiDimTableModeEnabled: previous.multiDimTableModeEnabled,
      schema: previous.schema,
    } as never)
  }
}

export function testCanvasSurfaceMode3dSelectionUsesSharedOwner() {
  const canvasViewActionsText = readSource('components/toolbar/canvasViewActions.ts')
  const canvas2dRendererSelectText = readSource('components/toolbar/Canvas2dRendererSelect.tsx')
  const canvasViewMenuText = readSource('components/toolbar/canvasViewMenu.ts')
  if (!canvasViewActionsText.includes('applyCanvasSurfaceModeSelection')) {
    throw new Error('Expected Canvas View Surface Mode actions to reuse the shared surface-mode selection owner')
  }
  if (!canvasViewMenuText.includes('getCanvasSurfaceModeDisabledCopy') || !canvasViewMenuText.includes('listCanvasSurfaceModeSpecs')) {
    throw new Error('Expected Canvas View Surface Mode to reuse shared specs and disabled copy')
  }
  if (canvasViewMenuText.includes('view:geospatial')) {
    throw new Error('Expected Geospatial Mode to be owned by Surface Mode, not a stale view-scoped option id')
  }
  const xrDelegationStart = canvasViewActionsText.indexOf("if (mode === 'xr') {")
  const genericActivationStart = canvasViewActionsText.indexOf('const activated = applyCanvasSurfaceModeSelection', xrDelegationStart)
  const xrDelegationBranch = xrDelegationStart >= 0 && genericActivationStart > xrDelegationStart
    ? canvasViewActionsText.slice(xrDelegationStart, genericActivationStart)
    : ''
  const xrPanelBranchStart = canvas2dRendererSelectText.indexOf("if (mode === 'xr') {")
  const plain3dPanelBranchStart = canvas2dRendererSelectText.indexOf('if (!state.floatingPanelOpen)', xrPanelBranchStart)
  const xrPanelBranch = xrPanelBranchStart >= 0 && plain3dPanelBranchStart > xrPanelBranchStart
    ? canvas2dRendererSelectText.slice(xrPanelBranchStart, plain3dPanelBranchStart)
    : ''
  if (canvasViewActionsText.includes("setCanvas3dMode('3d')")
    || !xrDelegationBranch.includes("onOpenShared3dPanel?.('xr')")
    || !xrDelegationBranch.includes('return')
    || /set(?:Canvas|Floating|Bottom|Media)/.test(xrDelegationBranch)
    || !xrPanelBranch.includes('XR_SCENE_FLOATING_PANEL_VIEWS.find')
    || !xrPanelBranch.includes("currentXrView !== 'gameMode'")
    || !xrPanelBranch.includes("activateXrSceneSurface({ panelView, openPanel: true, timeline: true })")
    || /set(?:Canvas|Floating|Bottom|Media)/.test(xrPanelBranch)
    || !canvas2dRendererSelectText.includes('if (!state.floatingPanelOpen)')) {
    throw new Error('Expected XR selection to route through the shared scene-surface owner while plain 3D retains Camera panel behavior')
  }

  const calls: string[] = []
  const selected = applyCanvasSurfaceModeSelection({
    mode: '3d',
    canvas2dRenderer: 'storyboard',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    geospatialEnabled: false,
    layoutMode: 'block',
    schema: BLOCK_SCHEMA,
    onOpenGeospatialMode: () => {
      throw new Error('Expected direct 3D selection to avoid opening Geospatial Mode when geospatial is disabled')
    },
    setCanvas2dRenderer: () => calls.push('renderer'),
    setCanvas3dMode: mode => calls.push(`3d:${mode}`),
    setCanvasRenderMode: mode => calls.push(`render:${mode}`),
    setSchema: () => calls.push('schema'),
  })
  if (!selected || calls.join('|') !== '3d:3d|render:3d') {
    throw new Error(`Expected shared 3D surface selection to activate 3D exactly once, got selected=${String(selected)} calls=${calls.join('|')}`)
  }

  const radialDisabled = getCanvasSurfaceModeDisabledCopy({
    canvas2dRenderer: 'storyboard',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    geospatialEnabled: false,
    layoutMode: 'radial',
    schema: { ...BLOCK_SCHEMA, layout: { mode: 'radial' } } as GraphSchema,
  }, '3d')
  if (radialDisabled?.reason !== '3D Mode is disabled in Radial Layout') {
    throw new Error(`Expected shared 3D disabled copy to cover radial layout, got ${JSON.stringify(radialDisabled)}`)
  }
}

export function testXrSurfaceFrontmatterPresetActivatesXrCanvasMode() {
  const store = useGraphStore.getState()
  for (const panelView of XR_SCENE_FLOATING_PANEL_VIEWS) {
    store.resetAll()
    store.setCanvasRenderMode('2d')
    store.setCanvas3dMode('3d')
    store.setFloatingPanelView('propsPanel')
    store.setFloatingPanelOpen(false)
    const changed = applyCanvasFrontmatterPreset({
      rawText: [
        '---',
        'kgCanvasSurfaceMode: "xr"',
        'kgFloatingPanelOpen: true',
        `kgFloatingPanelView: "${panelView}"`,
        '---',
        '',
        '# XR Demo',
      ].join('\n'),
    })
    const next = useGraphStore.getState()
    if (!changed
      || next.canvasRenderMode !== '3d'
      || next.canvas3dMode !== 'xr'
      || next.floatingPanelView !== panelView
      || next.floatingPanelOpen !== true) {
      throw new Error(`expected XR frontmatter to route ${panelView} through one shared surface, got ${JSON.stringify({
        changed,
        canvasRenderMode: next.canvasRenderMode,
        canvas3dMode: next.canvas3dMode,
        floatingPanelView: next.floatingPanelView,
        floatingPanelOpen: next.floatingPanelOpen,
      })}`)
    }
  }
}

export function testXrSceneSurfaceOwnershipSourceBoundaries() {
  const toolbar = readSource('lib/toolbar/ToolbarToolMenu.impl.tsx')
  const toolbarRouting = readSource('features/three/toolbarXrScenePanelRouting.ts')
  const surfaceRuntime = readSource('features/three/xrSceneSurfaceRuntime.ts')
  const rendererSelect = readSource('components/toolbar/Canvas2dRendererSelect.tsx')
  const frontmatter = readSource('features/parsers/canvasFrontmatterPreset.ts')
  const physicsRuntime = readSource('features/canvas/XrPhysicsRunReadyDemoRuntime.tsx')
  const canvasSlice = readSource('hooks/store/canvasSlice.ts')
  const surfaceOwnership = readSource('lib/canvas/canvasSurfaceOwnershipRuntime.ts')
  if (!['media', 'animation', 'motionControl', 'gameMode', 'camera'].every(view => surfaceRuntime.includes(`'${view}'`))
    || !surfaceRuntime.includes('activateCanvasGraphSurfaceMode')
    || !surfaceRuntime.includes('registerXrSceneGameModeExitHandler')
    || !toolbar.includes('routeToolbarXrScenePanel({ view, canvasRenderMode, canvas3dMode })')
    || !toolbarRouting.includes('XR_SCENE_FLOATING_PANEL_VIEWS.find')
    || !toolbarRouting.includes('activateXrSceneSurface({ panelView })')
    || /set(?:Canvas|Floating|Bottom|Media)/.test(toolbarRouting)) {
    throw new Error('expected one shared XR scene-surface owner for all five FloatingPanel projections')
  }
  const transitionInterceptionCount = canvasSlice.match(/interceptSharedXrSurfaceTransition\(/g)?.length ?? 0
  if (!surfaceRuntime.includes('registerSharedXrActivationHandler(() => activateXrSceneSurface())')
    || !surfaceOwnership.includes('export function requestSharedXrSurfaceActivation()')
    || !surfaceOwnership.includes('export function interceptSharedXrSurfaceTransition(')
    || transitionInterceptionCount !== 2
    || !canvasSlice.includes('{ canvasRenderMode: m }')
    || !canvasSlice.includes('{ canvas3dMode: normalizeCanvas3dMode(mode) }')
    || !surfaceOwnership.includes("canvasRenderMode !== '3d' || canvas3dMode !== 'xr'")
    || !surfaceOwnership.includes('requestSharedXrSurfaceActivation()')) {
    throw new Error('expected both raw Canvas store setters to route XR entry through the registered shared owner and transaction gate')
  }
  const canvasXrSelectionStart = rendererSelect.indexOf("if (mode === 'xr') {")
  const canvasPlain3dSelectionStart = rendererSelect.indexOf('if (!state.floatingPanelOpen)', canvasXrSelectionStart)
  const canvasXrSelection = canvasXrSelectionStart >= 0 && canvasPlain3dSelectionStart > canvasXrSelectionStart
    ? rendererSelect.slice(canvasXrSelectionStart, canvasPlain3dSelectionStart)
    : ''
  if (!canvasXrSelection.includes('XR_SCENE_FLOATING_PANEL_VIEWS.find')
    || !canvasXrSelection.includes("activateXrSceneSurface({ panelView, openPanel: true, timeline: true })")
    || /set(?:Canvas|Floating|Bottom|Media)/.test(canvasXrSelection)) {
    throw new Error('expected Canvas View XR selection to invoke the shared scene owner without a raw surface setter variant')
  }
  const frontmatterXrStart = frontmatter.indexOf('if (sharedXrSurfaceRouted) {')
  const frontmatterXrEnd = frontmatter.indexOf('} else {', frontmatterXrStart)
  const frontmatterXrSelection = frontmatterXrStart >= 0 && frontmatterXrEnd > frontmatterXrStart
    ? frontmatter.slice(frontmatterXrStart, frontmatterXrEnd)
    : ''
  if (!frontmatter.includes('xrSceneSurfaceRuntime')
    || !frontmatter.includes('XR_SCENE_FLOATING_PANEL_VIEWS.find')
    || !frontmatter.includes('const sharedXrSurfaceRouted = sharedXrSurfaceRequested || sharedXrPanelRequested')
    || !frontmatterXrSelection.includes('activateXrSceneSurface({')
    || /set(?:Canvas|Floating|Bottom|Media)/.test(frontmatterXrSelection)) {
    throw new Error('expected XR frontmatter presets to invoke the shared scene owner for all five panels without raw surface setters')
  }
  const sharedSceneConsumers = {
    Media: 'features/three/xrSceneMcpRuntime.ts',
    Animation: 'features/three/xrAnimationMcpRuntime.ts',
    'Motion Control': 'features/three/motionControlSurfaceRuntime.ts',
    'Game Mode': 'features/game-fps/gameModeRuntime.ts',
    Camera: 'features/strybldr/cameraMcpRuntime.ts',
  } as const
  for (const [label, relativePath] of Object.entries(sharedSceneConsumers)) {
    const runtimeSource = readSource(relativePath)
    if (!runtimeSource.includes('xrSceneSurfaceRuntime') || !runtimeSource.includes('activateXrSceneSurface')) {
      throw new Error(`expected ${label} activation to reuse xrSceneSurfaceRuntime.ts`)
    }
    if (label === 'Camera' && !runtimeSource.includes("panelView: 'camera'")) {
      throw new Error('expected Camera activation to leave Game ownership through the shared Camera panel route')
    }
  }
  if (!physicsRuntime.includes('activateXrSceneSurface()') || physicsRuntime.includes("setCanvas3dMode('xr')")) {
    throw new Error('expected the XR run-ready bootstrap to reuse the shared scene-surface activation owner')
  }
  const panelProjectionSources = {
    Media: 'features/command-menu/MediaCatalogPanelView.tsx',
    'Media XR': 'features/command-menu/XrMediaLibraryPanel.tsx',
    Animation: 'features/three/XrAnimationFloatingPanelView.tsx',
    'Motion Control': 'features/three/MotionControlFloatingPanelView.tsx',
    'Game Mode': 'features/game-fps/GameModeFloatingPanelView.tsx',
    Camera: 'features/strybldr/StrybldrCameraFloatingPanelView.tsx',
  } as const
  for (const [label, relativePath] of Object.entries(panelProjectionSources)) {
    const panelSource = readSource(relativePath)
    if (/@react-three\/fiber|<Canvas(?:\s|>)|new\s+(?:THREE\.)?Scene\s*\(|<(?:Scene|XrGraphStage|GameFpsMissionStage)(?:\s|>)/.test(panelSource)) {
      throw new Error(`expected ${label} panel to project controls only, never own a Three scene or R3F Canvas`)
    }
  }
  const cameraMotion = readSource('features/three/XrCameraMotionSection.tsx')
  const simulationWorkbenchStart = cameraMotion.indexOf('const openSimulationWorkbench')
  const simulationWorkbenchEnd = cameraMotion.indexOf('const nativeControllerActive', simulationWorkbenchStart)
  const simulationWorkbench = simulationWorkbenchStart >= 0 && simulationWorkbenchEnd > simulationWorkbenchStart
    ? cameraMotion.slice(simulationWorkbenchStart, simulationWorkbenchEnd)
    : ''
  if (!simulationWorkbench.includes('activateXrSceneSurface')
    || /set(?:Canvas|Floating|Bottom|Media)/.test(simulationWorkbench)) {
    throw new Error('expected the Media workbench launcher to forbid raw Canvas/FloatingPanel/Timeline setter variants')
  }
}
