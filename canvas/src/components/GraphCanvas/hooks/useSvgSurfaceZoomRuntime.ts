import React from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/react/shallow'
import { createZoom } from '@/components/GraphCanvas/zoom'
import { useZoomEffects } from '@/components/GraphCanvas/hooks/useZoomEffects'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { useAutoZoomModes2d } from '@/features/zoom/useAutoZoomModes2d'
import { useContainerDims } from '@/hooks/useContainerDims'
import { useGraphStore } from '@/hooks/useGraphStore'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { commitZoomTransformToStore } from '@/lib/canvas/zoom-commit'
import type { Canvas2dRendererId } from '@/lib/config.render'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { createRafLatestScheduler } from '@/lib/react/rafLatestScheduler'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'

type SvgSurfaceBounds = {
  minX: number
  minY: number
  width: number
  height: number
}

type SvgSurfaceRuntime = {
  revision: number
  bounds: SvgSurfaceBounds
}

type SvgElementSelectionController = {
  cleanup: () => void
  clearSelectedElement: () => void
  setSelectedElementByLabel: (label: string | null | undefined) => void
}

type UseSvgSurfaceZoomRuntimeArgs = {
  active: boolean
  rootRef: React.RefObject<HTMLElement | null>
  svgHostRef: React.RefObject<HTMLElement | null>
  svgMarkup: string
  rendererId: Canvas2dRendererId
  graphData: GraphData | null
  graphDataRevision: number
  selectedElementLabel?: string
  readSelectedElementLabel?: (args: {
    svgEl: SVGSVGElement
    target: Element
    candidate: Element
  }) => string
  resolveSelectedElementByLabel?: (args: {
    svgEl: SVGSVGElement
    label: string
  }) => Element | null
  readSelectedElementPeers?: (args: {
    svgEl: SVGSVGElement
    selectedElement: Element
    label: string
  }) => Element[]
  onSelectedElementLabelChange?: (label: string) => void
}

const SVG_NS = 'http://www.w3.org/2000/svg'

const parseFiniteNumber = (raw: unknown): number | null => {
  const value = typeof raw === 'number' ? raw : Number(String(raw || '').trim())
  return Number.isFinite(value) ? value : null
}

const parseViewBoxBounds = (raw: string | null): SvgSurfaceBounds | null => {
  const parts = String(raw || '')
    .trim()
    .split(/[\s,]+/)
    .map(parseFiniteNumber)
  if (parts.length < 4 || parts.some(value => value == null)) return null
  const minX = parts[0] as number
  const minY = parts[1] as number
  const width = Math.max(1, parts[2] as number)
  const height = Math.max(1, parts[3] as number)
  return { minX, minY, width, height }
}

const readSvgVisualBounds = (svgEl: SVGSVGElement): SvgSurfaceBounds => {
  const fromViewBox = parseViewBoxBounds(svgEl.getAttribute('viewBox'))
  if (fromViewBox) return fromViewBox
  const width = parseFiniteNumber(svgEl.getAttribute('width')) || svgEl.clientWidth || 960
  const height = parseFiniteNumber(svgEl.getAttribute('height')) || svgEl.clientHeight || 540
  return {
    minX: 0,
    minY: 0,
    width: Math.max(1, width),
    height: Math.max(1, height),
  }
}

const isSvgViewportMetadataElement = (node: ChildNode): boolean => {
  if (!(node instanceof SVGElement)) return false
  const tag = node.tagName.toLowerCase()
  return tag === 'defs' || tag === 'style' || tag === 'title' || tag === 'desc' || tag === 'metadata'
}

const ensureSvgZoomContentGroup = (svgEl: SVGSVGElement): SVGGElement => {
  const existing = svgEl.querySelector(':scope > g[data-kg-svg-zoom-content="1"]')
  if (existing instanceof SVGGElement) return existing

  const hitbox = document.createElementNS(SVG_NS, 'rect')
  hitbox.setAttribute('data-kg-svg-viewport-hitbox', '1')
  hitbox.setAttribute('x', '0')
  hitbox.setAttribute('y', '0')
  hitbox.setAttribute('width', '100%')
  hitbox.setAttribute('height', '100%')
  hitbox.setAttribute('fill', 'transparent')
  hitbox.setAttribute('pointer-events', 'all')

  const group = document.createElementNS(SVG_NS, 'g')
  group.setAttribute('data-kg-svg-zoom-content', '1')

  const children = Array.from(svgEl.childNodes)
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]
    if (isSvgViewportMetadataElement(child)) continue
    group.appendChild(child)
  }

  svgEl.insertBefore(hitbox, svgEl.firstChild)
  svgEl.appendChild(group)
  return group
}

const prepareSvgForInteractiveViewport = (svgEl: SVGSVGElement): { group: SVGGElement; bounds: SvgSurfaceBounds } => {
  const bounds = readSvgVisualBounds(svgEl)
  svgEl.setAttribute('data-kg-svg-surface-root', '1')
  svgEl.setAttribute('width', '100%')
  svgEl.setAttribute('height', '100%')
  svgEl.removeAttribute('viewBox')
  svgEl.style.display = 'block'
  svgEl.style.width = '100%'
  svgEl.style.height = '100%'
  svgEl.style.maxWidth = 'none'
  svgEl.style.overflow = 'hidden'
  svgEl.style.touchAction = 'none'
  return { group: ensureSvgZoomContentGroup(svgEl), bounds }
}

const buildSvgSurfaceGraphData = (args: {
  bounds: SvgSurfaceBounds | null
  graphData: GraphData | null
  rendererId: Canvas2dRendererId
}): GraphData | null => {
  const bounds = args.bounds
  if (!bounds) return null
  const width = Math.max(1, bounds.width)
  const height = Math.max(1, bounds.height)
  const node: GraphNode = {
    id: `svg-surface:${args.rendererId}:bounds`,
    label: 'SVG Surface Bounds',
    type: 'SvgSurfaceBounds',
    x: bounds.minX + width / 2,
    y: bounds.minY + height / 2,
    properties: {
      'visual:width': width,
      'visual:height': height,
      'visual:shape': 'rect',
    },
  }
  return {
    type: 'Graph',
    context: 'svg-surface',
    nodes: [node],
    edges: [],
    metadata: {
      kind: 'svg-surface',
      rendererId: args.rendererId,
      sourceGraphKind: String(((args.graphData?.metadata || {}) as Record<string, unknown>).kind || ''),
    },
  }
}

const readSvgElementLabel = (element: Element | null): string => {
  if (!element) return ''
  const label =
    element.getAttribute('aria-label') ||
    element.getAttribute('data-id') ||
    element.getAttribute('id') ||
    element.textContent ||
    ''
  return String(label).replace(/\s+/g, ' ').trim()
}

const normalizeSvgComparableLabel = (value: string | null | undefined): string => {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

const SVG_SELECTABLE_ELEMENT_SELECTOR = 'text, tspan, circle, rect, path, g'
const SVG_LABEL_PREFERRED_ELEMENT_SELECTOR = 'text, tspan, [aria-label], [data-id], [id]'
const SVG_DIMMABLE_ELEMENT_SELECTOR = 'text, tspan, circle, rect, path'

const readSvgSelectionCandidates = (svgEl: SVGSVGElement): Element[] => {
  const contentEl = svgEl.querySelector('[data-kg-svg-zoom-content="1"]') || svgEl
  return Array.from(contentEl.querySelectorAll(SVG_SELECTABLE_ELEMENT_SELECTOR)).filter(element => {
    return element.closest('[data-kg-svg-viewport-hitbox="1"]') == null
  })
}

const findSvgSelectionCandidateByLabel = (svgEl: SVGSVGElement, label: string | null | undefined): Element | null => {
  const normalized = normalizeSvgComparableLabel(label)
  if (!normalized) return null
  const candidates = readSvgSelectionCandidates(svgEl)
  const exact = candidates.find(element => normalizeSvgComparableLabel(readSvgElementLabel(element)) === normalized)
  if (exact) return exact
  const preferred = candidates.filter(element => element.matches(SVG_LABEL_PREFERRED_ELEMENT_SELECTOR))
  return preferred.find(element => normalizeSvgComparableLabel(readSvgElementLabel(element)).includes(normalized)) || null
}

const updateSvgSelectionDimming = (
  svgEl: SVGSVGElement,
  selectedEl: Element | null,
  selectedPeers: ReadonlyArray<Element> = [],
): void => {
  svgEl.querySelectorAll('[data-kg-svg-dimmed="1"]').forEach(element => {
    element.removeAttribute('data-kg-svg-dimmed')
  })
  if (!selectedEl) {
    svgEl.removeAttribute('data-kg-svg-has-selection')
    return
  }
  svgEl.setAttribute('data-kg-svg-has-selection', '1')
  const selectedElements = [selectedEl, ...selectedPeers].filter((element): element is Element => element instanceof Element)
  const contentEl = svgEl.querySelector('[data-kg-svg-zoom-content="1"]') || svgEl
  Array.from(contentEl.querySelectorAll(SVG_DIMMABLE_ELEMENT_SELECTOR)).forEach(element => {
    if (element.closest('[data-kg-svg-viewport-hitbox="1"]')) return
    if (
      selectedElements.some(selected => {
        return element === selected || selected.contains(element) || element.contains(selected)
      })
    ) return
    element.setAttribute('data-kg-svg-dimmed', '1')
  })
}

const installSvgElementSelection = (args: {
  svgEl: SVGSVGElement
  readSelectedElementLabel?: (args: {
    svgEl: SVGSVGElement
    target: Element
    candidate: Element
  }) => string
  resolveSelectedElementByLabel?: (args: {
    svgEl: SVGSVGElement
    label: string
  }) => Element | null
  readSelectedElementPeers?: (args: {
    svgEl: SVGSVGElement
    selectedElement: Element
    label: string
  }) => Element[]
  onSelectedElementLabelChange?: (label: string) => void
}): SvgElementSelectionController => {
  let selectedEl: Element | null = null
  const readSelectionPeers = (el: Element | null, label: string): Element[] => {
    if (!el || !label) return []
    return args.readSelectedElementPeers?.({
      svgEl: args.svgEl,
      selectedElement: el,
      label,
    }) || []
  }
  const setSelected = (el: Element | null, labelOverride?: string) => {
    const label = String(labelOverride || readSvgElementLabel(el)).replace(/\s+/g, ' ').trim()
    if (selectedEl === el) {
      updateSvgSelectionDimming(args.svgEl, selectedEl, readSelectionPeers(selectedEl, label))
      args.svgEl.setAttribute('data-kg-svg-selected-label', label)
      args.onSelectedElementLabelChange?.(label)
      return
    }
    if (selectedEl) selectedEl.removeAttribute('data-kg-svg-selected')
    selectedEl = el
    if (selectedEl) selectedEl.setAttribute('data-kg-svg-selected', '1')
    updateSvgSelectionDimming(args.svgEl, selectedEl, readSelectionPeers(selectedEl, label))
    args.svgEl.setAttribute('data-kg-svg-selected-label', label)
    args.onSelectedElementLabelChange?.(label)
  }

  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null
    if (!target || target.closest('[data-kg-svg-viewport-hitbox="1"]')) {
      setSelected(null)
      return
    }
    const candidate = target.closest('text, tspan, circle, rect, path, g')
    if (!(candidate instanceof Element)) {
      setSelected(null)
      return
    }
    if (candidate.closest('[data-kg-svg-zoom-content="1"]') == null) return
    const label = args.readSelectedElementLabel?.({ svgEl: args.svgEl, target, candidate }) || readSvgElementLabel(candidate)
    setSelected(candidate, label)
  }

  args.svgEl.addEventListener('click', onClick)
  return {
    cleanup: () => {
      args.svgEl.removeEventListener('click', onClick)
      if (selectedEl) selectedEl.removeAttribute('data-kg-svg-selected')
      updateSvgSelectionDimming(args.svgEl, null)
    },
    clearSelectedElement: () => setSelected(null),
    setSelectedElementByLabel: label => {
      const normalizedLabel = String(label || '').replace(/\s+/g, ' ').trim()
      const candidate =
        args.resolveSelectedElementByLabel?.({ svgEl: args.svgEl, label: normalizedLabel }) ||
        findSvgSelectionCandidateByLabel(args.svgEl, normalizedLabel)
      setSelected(candidate, normalizedLabel)
    },
  }
}

export function useSvgSurfaceZoomRuntime(args: UseSvgSurfaceZoomRuntimeArgs): { selectedElementLabel: string } {
  const {
    active,
    rootRef,
    svgHostRef,
    svgMarkup,
    rendererId,
    graphData,
    graphDataRevision,
    selectedElementLabel,
    readSelectedElementLabel,
    resolveSelectedElementByLabel,
    readSelectedElementPeers,
    onSelectedElementLabelChange,
  } = args
  const dims = useContainerDims(rootRef)
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const groupRef = React.useRef<SVGGElement | null>(null)
  const zoomRef = React.useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const selectionControllerRef = React.useRef<SvgElementSelectionController | null>(null)
  const labelsSelRef = React.useRef<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>(null)
  const [runtime, setRuntime] = React.useState<SvgSurfaceRuntime | null>(null)
  const [internalSelectedElementLabel, setInternalSelectedElementLabel] = React.useState('')
  const selectedLabel = typeof selectedElementLabel === 'string' ? selectedElementLabel : internalSelectedElementLabel

  const {
    canvasRenderMode,
    canvas2dRenderer,
    collapsedGroupIds,
    documentSemanticMode,
    documentStructureBaselineLock,
    frontmatterModeEnabled,
    mediaPanelDensity,
    renderMediaAsNodes,
    schema,
    viewportControlsPreset,
  } = useGraphStore(useShallow(s => ({
    canvasRenderMode: s.canvasRenderMode,
    canvas2dRenderer: s.canvas2dRenderer,
    collapsedGroupIds: s.collapsedGroupIds,
    documentSemanticMode: s.documentSemanticMode,
    documentStructureBaselineLock: s.documentStructureBaselineLock,
    fitToScreenMode: s.fitToScreenMode,
    frontmatterModeEnabled: s.frontmatterModeEnabled,
    mediaPanelDensity: s.mediaPanelDensity,
    renderMediaAsNodes: s.renderMediaAsNodes,
    schema: s.schema,
    viewportControlsPreset: s.viewportControlsPreset,
  })))

  const effectiveSchema = (schema || defaultSchema) as GraphSchema
  const visualGraphData = React.useMemo(
    () => buildSvgSurfaceGraphData({ bounds: runtime?.bounds || null, graphData, rendererId }),
    [graphData, rendererId, runtime?.bounds],
  )

  const zoomViewKey = React.useMemo(
    () =>
      buildActive2dZoomViewKey({
        canvasRenderMode,
        canvas2dRenderer,
        schema: effectiveSchema,
        graphData,
        documentSemanticMode,
        frontmatterModeEnabled,
        documentStructureBaselineLock,
        renderMediaAsNodes,
        mediaPanelDensity,
        collapsedGroupIds,
      }),
    [
      canvas2dRenderer,
      canvasRenderMode,
      collapsedGroupIds,
      documentSemanticMode,
      documentStructureBaselineLock,
      effectiveSchema,
      frontmatterModeEnabled,
      graphData,
      mediaPanelDensity,
      renderMediaAsNodes,
    ],
  )
  const zoomViewKeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    zoomViewKeyRef.current = zoomViewKey
  }, [zoomViewKey])

  const dimsRef = React.useRef({ width: dims.width, height: dims.height })
  React.useEffect(() => {
    dimsRef.current = { width: dims.width, height: dims.height }
  }, [dims.height, dims.width])

  const zoomCommitSchedulerRef = React.useRef(
    createRafLatestScheduler<{ k: number; x: number; y: number }>(pending => {
      const store = useGraphStore.getState()
      const key = zoomViewKeyRef.current
      if (!key) return
      const currentDims = dimsRef.current
      commitZoomTransformToStore({
        state: {
          viewPinned: store.viewPinned,
          zoomState: store.zoomState,
          zoomStateByKey: store.zoomStateByKey,
          setZoomState: store.setZoomState,
          setZoomStateForKey: store.setZoomStateForKey,
        },
        zoomViewKey: key,
        transform: pending,
        viewportW: currentDims.width,
        viewportH: currentDims.height,
        graphDataRevision: store.graphDataRevision,
      })
    }),
  )

  React.useLayoutEffect(() => {
    if (!active) return
    const host = svgHostRef.current
    const svgEl = host?.querySelector('svg')
    if (!(svgEl instanceof SVGSVGElement)) {
      svgRef.current = null
      groupRef.current = null
      setRuntime(null)
      return
    }
    const prepared = prepareSvgForInteractiveViewport(svgEl)
    svgRef.current = svgEl
    groupRef.current = prepared.group
    setRuntime(prev => {
      const prevBounds = prev?.bounds
      if (
        prevBounds &&
        prevBounds.minX === prepared.bounds.minX &&
        prevBounds.minY === prepared.bounds.minY &&
        prevBounds.width === prepared.bounds.width &&
        prevBounds.height === prepared.bounds.height
      ) {
        return prev
      }
      return { revision: (prev?.revision || 0) + 1, bounds: prepared.bounds }
    })
  }, [active, svgHostRef, svgMarkup])

  useZoomEffects({
    svgRef,
    zoomRef,
    width: dims.width,
    height: dims.height,
    paused: !active,
    graphDataOverride: visualGraphData,
  })

  useAutoZoomModes2d({
    viewportW: dims.width,
    viewportH: dims.height,
    paused: !active,
    getGraph: React.useCallback(
      () => ({ graphData: visualGraphData, graphDataRevision }),
      [graphDataRevision, visualGraphData],
    ),
  })

  React.useEffect(() => {
    if (!active) return
    const svgEl = svgRef.current
    const groupEl = groupRef.current
    if (!svgEl || !groupEl || !runtime) return
    const svg = d3.select(svgEl)
    const group = d3.select(groupEl)
    const scheduler = zoomCommitSchedulerRef.current
    const zoom = createZoom(
      svg,
      group,
      labelsSelRef,
      effectiveSchema,
      viewportControlsPreset,
      transform => {
        if (!active) return
        svgEl.setAttribute('data-kg-svg-zoom-k', String(Number.isFinite(transform.k) ? transform.k : 1))
        svgEl.setAttribute('data-kg-svg-zoom-x', String(Number.isFinite(transform.x) ? transform.x : 0))
        svgEl.setAttribute('data-kg-svg-zoom-y', String(Number.isFinite(transform.y) ? transform.y : 0))
        scheduler.schedule({ k: transform.k, x: transform.x, y: transform.y })
      },
      undefined,
      () => active,
    )
    zoomRef.current = zoom

    const store = useGraphStore.getState()
    const initialZoomState = pickZoomStateForView({
      zoomViewKey,
      zoomStateByKey: store.zoomStateByKey,
      viewPinned: store.viewPinned === true,
      fitToScreenMode: store.fitToScreenMode === true,
      zoomToSelectionMode: store.zoomToSelectionMode === true,
    })
    const initial = pickInitialZoomTransform({
      zoomState: initialZoomState,
      pinned: store.viewPinned === true,
      graphDataRevision,
      nextViewportW: dims.width,
      nextViewportH: dims.height,
    })
    if (initial) {
      svg.call(zoom.transform as never, d3.zoomIdentity.translate(initial.x, initial.y).scale(initial.k))
    } else if (visualGraphData && dims.width > 80 && dims.height > 80) {
      const fitted = fitAllTransform(visualGraphData.nodes, dims.width, dims.height, {
        graphData: visualGraphData,
        schema: effectiveSchema,
        targetFillRatio: store.viewportFitFillRatio,
        centerMode: 'bbox',
      })
      svg.call(zoom.transform as never, fitted)
    } else {
      svg.call(zoom.transform as never, d3.zoomIdentity)
    }

    const selectionController = installSvgElementSelection({
      svgEl,
      readSelectedElementLabel,
      resolveSelectedElementByLabel,
      readSelectedElementPeers,
      onSelectedElementLabelChange: label => {
        setInternalSelectedElementLabel(label)
        onSelectedElementLabelChange?.(label)
      },
    })
    selectionControllerRef.current = selectionController
    if (typeof selectedElementLabel === 'string') {
      selectionController.setSelectedElementByLabel(selectedElementLabel)
    }

    return () => {
      if (selectionControllerRef.current === selectionController) {
        selectionControllerRef.current = null
      }
      selectionController.cleanup()
      const any = svgEl as unknown as { __kgViewportControllerDestroy?: (() => void) | null; __kgWindowGestureDestroy?: (() => void) | null }
      if (typeof any.__kgViewportControllerDestroy === 'function') {
        try {
          any.__kgViewportControllerDestroy()
        } catch {
          void 0
        }
        any.__kgViewportControllerDestroy = null
      }
      if (typeof any.__kgWindowGestureDestroy === 'function') {
        try {
          any.__kgWindowGestureDestroy()
        } catch {
          void 0
        }
        any.__kgWindowGestureDestroy = null
      }
      try {
        svg.on('.zoom', null)
        svg.on('.kgInfiniteViewport', null)
        svg.on('.kgGestureZoom', null)
      } catch {
        void 0
      }
      scheduler.cancel()
      zoomRef.current = null
    }
  }, [
    active,
    dims.height,
    dims.width,
    effectiveSchema,
    graphDataRevision,
    onSelectedElementLabelChange,
    readSelectedElementLabel,
    readSelectedElementPeers,
    resolveSelectedElementByLabel,
    runtime,
    svgMarkup,
    viewportControlsPreset,
    visualGraphData,
    zoomViewKey,
  ])

  React.useEffect(() => {
    if (!active) return
    const selectionController = selectionControllerRef.current
    if (!selectionController || typeof selectedElementLabel !== 'string') return
    selectionController.setSelectedElementByLabel(selectedElementLabel)
  }, [active, selectedElementLabel, svgMarkup])

  return { selectedElementLabel: selectedLabel }
}
