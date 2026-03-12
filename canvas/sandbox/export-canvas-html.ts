import fs from 'node:fs/promises'
import path from 'node:path'
import { JSDOM } from 'jsdom'

import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { defaultSchema } from '@/lib/graph/schema'
import { exportGraphAsCentered3dSvgMarkup } from '@/lib/graph/graphCenteredSvg3d'
import { buildGraphHtmlViewerMarkup } from '@/lib/graph/graphHtmlViewer'
import { ensureKgTokensInstalled } from '@/lib/ui/tokens-ssot'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { readPanSpeed, readWheelBehavior, readZoomSpeed } from '@/lib/canvas/camera-options-2d'
import {
  FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_DEFAULT,
  FLOW_WHEEL_ZOOM_SMOOTH_MAX_DURATION_DEFAULT_MS,
  FLOW_WHEEL_ZOOM_SMOOTH_MIN_DURATION_DEFAULT_MS,
  FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT,
} from '@/lib/canvas/flow-zoom-tuning'
import { setupGraphScene } from '@/components/GraphCanvas/scene'
import { normalizeEdgesForSim } from '@/components/GraphCanvas/simulation'
import { deriveSceneGroups } from '@/lib/scene/sceneDerivation'

function readArg(name: string): string {
  const ix = process.argv.indexOf(name)
  const v = ix >= 0 ? process.argv[ix + 1] : ''
  const out = String(v || '').trim()
  if (!out) throw new Error(`Missing ${name}`)
  return out
}

function readOptionalArg(name: string): string {
  const ix = process.argv.indexOf(name)
  const v = ix >= 0 ? process.argv[ix + 1] : ''
  return String(v || '').trim()
}

async function main() {
  const input = readArg('--input')
  const output = readArg('--output')
  const modeRaw = readOptionalArg('--mode')
  const mode = modeRaw === '3d' ? '3d' : '2d'

  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' })
  ;(globalThis as unknown as { window?: unknown }).window = dom.window
  ;(globalThis as unknown as { document?: unknown }).document = dom.window.document
  ;(globalThis as unknown as { DOMParser?: unknown }).DOMParser = dom.window.DOMParser
  ;(globalThis as unknown as { XMLSerializer?: unknown }).XMLSerializer = dom.window.XMLSerializer
  ;(globalThis as unknown as { getComputedStyle?: unknown }).getComputedStyle = dom.window.getComputedStyle
  ;(globalThis as unknown as { Element?: unknown }).Element = dom.window.Element
  ;(globalThis as unknown as { HTMLElement?: unknown }).HTMLElement = dom.window.HTMLElement
  ;(globalThis as unknown as { SVGElement?: unknown }).SVGElement = (dom.window as unknown as { SVGElement?: unknown }).SVGElement
  ;(globalThis as unknown as { SVGSVGElement?: unknown }).SVGSVGElement = (dom.window as unknown as { SVGSVGElement?: unknown }).SVGSVGElement
  ;(globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame = dom.window.requestAnimationFrame
  ;(globalThis as unknown as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = dom.window.cancelAnimationFrame

  ensureKgTokensInstalled('light')

  const text = await fs.readFile(input, 'utf8')
  const name = path.basename(input)

  const loaded = await loadGraphDataFromTextViaParser(name, text, { applyToStore: false, syncMarkdownDocument: false })
  const graphData = loaded?.graphData || null
  if (!graphData) throw new Error('No graphData produced from input')

  const svgMarkup = await (async () => {
    const widthPx = 1920
    const heightPx = 1080
    if (mode === '3d') {
      return exportGraphAsCentered3dSvgMarkup({
        graphData,
        schema: defaultSchema,
        widthPx,
        heightPx,
        paddingPx: 96,
        includeXmlDeclaration: false,
        animated: true,
        exportAutoRotate: true,
        exportAutoRotateSpeed: 1.2,
        exportMotionIntensityMultiplier: 2.2,
        exportTiltXRad: 0.45,
        exportCameraZ: 200,
      })
    }

    const svgEl = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svgEl.setAttribute('width', String(widthPx))
    svgEl.setAttribute('height', String(heightPx))
    svgEl.setAttribute('viewBox', `0 0 ${widthPx} ${heightPx}`)

    try {
      Object.defineProperty(svgEl, 'width', { value: { baseVal: { value: widthPx } }, configurable: true })
    } catch {
      void 0
    }
    try {
      Object.defineProperty(svgEl, 'height', { value: { baseVal: { value: heightPx } }, configurable: true })
    } catch {
      void 0
    }
    try {
      Object.defineProperty(svgEl, 'viewBox', {
        value: { baseVal: { x: 0, y: 0, width: widthPx, height: heightPx } },
        configurable: true,
      })
    } catch {
      void 0
    }
    dom.window.document.body.appendChild(svgEl)

    const ref = <T>(current: T | null) => ({ current })
    const svgRef = ref(svgEl)

    const edgesForSim = normalizeEdgesForSim((graphData.nodes ?? []) as any, (graphData.edges ?? []) as any)
    const groupsDerivation = deriveSceneGroups({
      graphData,
      graphDataRevision: 0,
      schema: defaultSchema,
      documentSemanticMode: 'document',
      frontmatterModeEnabled: false,
    })

    const gRef = ref<unknown>(null)
    const nodesSelRef = ref<any>(null)
    const groupChevronSelRef = ref<any>(null)
    const mediaSelRef = ref<any>(null)
    const portHandlesSelRef = ref<any>(null)
    const linksHitSelRef = ref<any>(null)
    const linksSelRef = ref<any>(null)
    const labelsSelRef = ref<any>(null)
    const zoomRef = ref<any>(null)
    const tempLinkSelRef = ref<any>({})
    const linkDragRef = ref<any>(null)
    const simulationRef = ref<any>(null)
    const sceneGraphDataRef = ref<any>(null)
    const beforeRenderFrameRef = ref<(() => void) | null>(null)
    const selectedEdgeIdRef = ref<string | null>(null)
    const selectedNodeIdRef = ref<string | null>(null)
    const selectedNodeIdsRef = ref<string[] | undefined>(undefined)
    const selectedEdgeIdsRef = ref<string[] | undefined>(undefined)

    const cleanup = setupGraphScene({
      svgEl,
      svgRef,
      graphData,
      graphDataRevision: 0,
      schema: defaultSchema,
      documentSemanticMode: 'document',
      edgesForSim,
      width: widthPx,
      height: heightPx,
      hoverEnabled: true,
      zoomOnDoubleClick: false,
      renderMediaAsNodes: true,
      mediaPanelDensity: 'default',
      enableTightInitialLayout: true,
      fitToScreenMode: false,
      viewportControlsPreset: 'map',
      initialZoomTransform: { k: 1, x: 0, y: 0 },
      layoutPositionsForMode: null,
      baselineLayoutPositions: null,
      prevPositions: null,
      skipInitialLayout: false,
      freezeSimulation: true,
      groupsForBboxCollide: groupsDerivation?.allGroups || [],
      layoutGroupKeyByNodeId: groupsDerivation?.layoutGroupKeyByNodeId || null,
      gRef: gRef as any,
      nodesSelRef,
      groupChevronSelRef,
      mediaSelRef,
      portHandlesSelRef,
      linksHitSelRef,
      linksSelRef,
      labelsSelRef,
      zoomRef,
      tempLinkSelRef,
      linkDragRef,
      simulationRef,
      sceneGraphDataRef,
      beforeRenderFrameRef,
      selectedEdgeIdRef,
      selectedNodeIdRef,
      selectedNodeIdsRef,
      selectedEdgeIdsRef,
      selectNode: () => {},
      selectEdge: () => {},
      selectGroup: () => {},
      selectGroupExpanded: () => {},
      toggleGroupCollapsed: () => {},
      setSelectionSource: () => {},
      addEdge: () => {},
      updateEdge: () => {},
      addNode: () => {},
      updateNode: () => {},
      setHoverInfo: () => {},
      setLifecycleStageRendering: () => {},
      requestZoomSelection: () => {},
      onZoomTransform: () => {},
      edgeScrollEnabled: () => true,
      getSchema: () => defaultSchema,
      getRenderMediaAsNodes: () => true,
      enableEditorGestures: false,
      layoutCacheKey: null,
      setLayoutPositionsForMode: null,
    })

    try {
      const sim = simulationRef.current
      if (sim) {
        try {
          sim.alpha(1)
        } catch {
          void 0
        }
        const ticks = Math.min(420, Math.max(60, Math.floor(((graphData.nodes?.length || 0) + (graphData.edges?.length || 0)) * 4)))
        for (let i = 0; i < ticks; i += 1) sim.tick()
        const tickHandler = sim.on('tick')
        if (typeof tickHandler === 'function') tickHandler()
      }
    } catch {
      void 0
    }

    const markup = svgEl.outerHTML
    cleanup()
    return markup
  })()
  if (!svgMarkup || !svgMarkup.trim()) throw new Error('Failed to build SVG')
  if (mode === '2d' && !svgMarkup.includes('data-kg-layer')) {
    throw new Error('2d SVG build did not include GraphCanvas layers (data-kg-layer); sandbox export is not aligned')
  }

  const html = await buildGraphHtmlViewerMarkup({
    title: `${name} (Canvas)`,
    svgMarkup,
    graphData,
    includeRichMediaOverlays: true,
    mediaPanelDensity: 'default',
    viewportWidthPx: 1920,
    viewportHeightPx: 1080,
    viewportScaleToFit: true,
    enableDecorativeAnimation: true,
    zoomMinK: readZoomScaleExtent(defaultSchema)[0],
    zoomMaxK: readZoomScaleExtent(defaultSchema)[1],
    wheelBehavior: readWheelBehavior(defaultSchema),
    viewportControlsPreset: 'map',
    panSpeed: readPanSpeed(defaultSchema),
    zoomSpeed: readZoomSpeed(defaultSchema),
    flowWheelZoomSpeedMultiplier: FLOW_WHEEL_ZOOM_SPEED_MULTIPLIER_DEFAULT,
    flowWheelZoomIncrementMultiplier: FLOW_WHEEL_ZOOM_INCREMENT_MULTIPLIER_DEFAULT,
    flowWheelZoomSmoothMinDurationMs: FLOW_WHEEL_ZOOM_SMOOTH_MIN_DURATION_DEFAULT_MS,
    flowWheelZoomSmoothMaxDurationMs: FLOW_WHEEL_ZOOM_SMOOTH_MAX_DURATION_DEFAULT_MS,
    wheelZoomCtrlMetaBoostMultiplier: 120,
    canvasInteractionSpeedMultiplier: 1,
    canvasPanSpeedMultiplier: 1,
    snapGridEnabled: !!defaultSchema.behavior?.snapGrid?.enabled,
    snapGridSize: defaultSchema.behavior?.snapGrid?.size,
    dragConstraint: (defaultSchema.behavior?.dragConstraint as any) || 'free',
    allowNodeDrag: defaultSchema.behavior?.allowNodeDrag !== false,
    allowEdgeDrag: defaultSchema.behavior?.allowNodeDrag !== false,
    allowGroupDrag: defaultSchema.behavior?.allowGroupDrag !== false,
  })
  if (!html || !html.trim()) throw new Error('Failed to build HTML')

  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, html, 'utf8')
  process.stdout.write(output + '\n')
}

main().catch(err => {
  process.stderr.write(String(err?.stack || err) + '\n')
  process.exit(1)
})
