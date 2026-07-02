import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphState } from '@/hooks/store/types'
import { isWorkspaceGraphMutationBlocked, type WorkspaceGraphMutationState } from '@/features/workspace-table/workspaceTableSsot'
import {
  CANVAS_OVERLAY_PROXY_ROOT_SELECTOR,
  collectCanonicalStoryboardWidgetOverlayRectEntries,
  queryStoryboardWidgetOverlayRootsForSurface,
  readCanvasOverlayNodeId,
  readCanvasOverlayPinnedState,
} from '@/lib/canvas/storyboard-widget-overlay-proxy'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { resolveScopedFlowWidgetNodeMap } from '@/lib/storyboardWidget/widgetStateScope'
import { screenToWorld } from '@/lib/zoom/viewport'
import { isStoryboardWidgetFrontmatterDocumentModeRequested } from '@/lib/graph/frontmatterMode'
import { isStoryboardCanvas2dRenderer, resolveCanvas2dRendererId } from '@/lib/config.render'

export type StoryboardWidgetScreenAuthorityPanSnapshot = {
  surfaceId: string
  screenByNodeId: Record<string, { left: number; top: number }>
  worldByNodeId: Record<string, { x: number; y: number }>
}

export const STORYBOARD_WIDGET_SCREEN_AUTHORITY_COLLECTIVE_PAN_EVENT = 'kg-storyboard-widget-screen-authority-collective-pan'

export function isStoryboardWidgetSurfaceRenderer(canvas2dRenderer: unknown): boolean {
  return isStoryboardCanvas2dRenderer(resolveCanvas2dRendererId(canvas2dRenderer))
}

export function shouldUseStoryboardWidgetScreenAuthorityCollectivePan(args: {
  canvas2dRenderer?: unknown
  frontmatterModeEnabled?: boolean
  documentSemanticMode?: unknown
}): boolean {
  const canvas2dRenderer = String(args.canvas2dRenderer || '')
  return isStoryboardWidgetSurfaceRenderer(canvas2dRenderer)
    || isStoryboardWidgetFrontmatterDocumentModeRequested({
      canvas2dRenderer,
      frontmatterModeEnabled: args.frontmatterModeEnabled === true,
      documentSemanticMode: String(args.documentSemanticMode || ''),
    })
}

function readOverlayTransformPosition(el: HTMLElement): { left: number; top: number } | null {
  const transform = String(el.style.transform || '').trim()
  const matrix = transform.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([-0-9.]+),\s*([-0-9.]+)\)/)
  if (matrix) {
    const left = Number(matrix[1])
    const top = Number(matrix[2])
    if (Number.isFinite(left) && Number.isFinite(top)) return { left, top }
  }
  const translate = transform.match(/translate(?:3d)?\(\s*([-0-9.]+)px,\s*([-0-9.]+)px/)
  if (translate) {
    const left = Number(translate[1])
    const top = Number(translate[2])
    if (Number.isFinite(left) && Number.isFinite(top)) return { left, top }
  }
  const rect = el.getBoundingClientRect()
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null
  return { left: rect.left, top: rect.top }
}

function readOverlayTransformScale(el: HTMLElement): number {
  const transform = String(el.style.transform || '').trim()
  const matrix = transform.match(/matrix\(\s*([-0-9.]+),/)
  if (matrix) {
    const scale = Number(matrix[1])
    if (Number.isFinite(scale) && scale > 0) return scale
  }
  const scaleFunction = transform.match(/(?:^|\s)scale\(\s*([-0-9.]+)\s*\)/)
  if (scaleFunction) {
    const scale = Number(scaleFunction[1])
    if (Number.isFinite(scale) && scale > 0) return scale
  }
  return 1
}

function applyOverlayTransformPosition(el: HTMLElement, pos: { left: number; top: number }): void {
  if (!Number.isFinite(pos.left) || !Number.isFinite(pos.top)) return
  const scale = readOverlayTransformScale(el)
  el.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${pos.left}, ${pos.top})`
}

function applyScreenAuthorityPanDomPositions(args: {
  surfaceId: string
  screenByNodeId: Record<string, { left: number; top: number }>
}): void {
  const surfaceId = String(args.surfaceId || '').trim()
  if (!surfaceId || Object.keys(args.screenByNodeId).length === 0) return
  const roots = collectCanonicalStoryboardWidgetOverlayRectEntries(queryStoryboardWidgetOverlayRootsForSurface({
    surfaceId,
    selector: CANVAS_OVERLAY_PROXY_ROOT_SELECTOR,
  })).map(entry => entry.el)
  for (let i = 0; i < roots.length; i += 1) {
    const root = roots[i]
    const id = readCanvasOverlayNodeId(root)
    if (!id) continue
    const next = args.screenByNodeId[id]
    if (!next) continue
    applyOverlayTransformPosition(root, next)
  }
}

type StoryboardWidgetScreenAuthorityPanState = GraphState & WorkspaceGraphMutationState

function commitScreenAuthorityPanPositions(args: {
  state: StoryboardWidgetScreenAuthorityPanState
  graphKey: string
  changedScreen: boolean
  changedWorld: boolean
  nextScreen: Record<string, { top: number; left: number }>
  nextWorld: Record<string, { x: number; y: number }>
}): void {
  if (!args.changedScreen && !args.changedWorld) return
  if (!isWorkspaceGraphMutationBlocked(args.state)) {
    if (args.changedScreen) args.state.setFlowWidgetPosByNodeId(args.nextScreen)
    if (args.changedWorld) args.state.setFlowWidgetWorldPosByNodeId(args.nextWorld)
    return
  }
  useGraphStore.setState(prev => {
    const prevState = prev as unknown as StoryboardWidgetScreenAuthorityPanState
    const nextState: Partial<GraphState> = {}
    if (args.changedScreen) {
      nextState.flowWidgetPosByNodeId = args.nextScreen
      if (args.graphKey) {
        nextState.flowWidgetPosByNodeIdByGraphMetaKey = {
          ...(prevState.flowWidgetPosByNodeIdByGraphMetaKey || {}),
          [args.graphKey]: args.nextScreen,
        }
      }
    }
    if (args.changedWorld) {
      nextState.flowWidgetWorldPosByNodeId = args.nextWorld
      if (args.graphKey) {
        nextState.flowWidgetWorldPosByNodeIdByGraphMetaKey = {
          ...(prevState.flowWidgetWorldPosByNodeIdByGraphMetaKey || {}),
          [args.graphKey]: args.nextWorld,
        }
      }
    }
    return nextState
  })
}

export function readStoryboardWidgetScreenAuthorityPanSnapshot(args: {
  storyboardWidgetSurfaceId?: string | null
  transform: { k: number; x: number; y: number }
}): StoryboardWidgetScreenAuthorityPanSnapshot | null {
  const surfaceId = String(args.storyboardWidgetSurfaceId || '').trim()
  const roots = collectCanonicalStoryboardWidgetOverlayRectEntries(queryStoryboardWidgetOverlayRootsForSurface({
    surfaceId,
    selector: CANVAS_OVERLAY_PROXY_ROOT_SELECTOR,
  })).map(entry => entry.el)
  if (roots.length === 0) return null

  const screenByNodeId: Record<string, { left: number; top: number }> = {}
  const worldByNodeId: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < roots.length; i += 1) {
    const root = roots[i]
    const id = readCanvasOverlayNodeId(root)
    if (!id) continue
    const pos = readOverlayTransformPosition(root)
    if (!pos) continue
    if (readCanvasOverlayPinnedState(root)) {
      const world = screenToWorld({ transform: args.transform, sx: pos.left, sy: pos.top })
      if (Number.isFinite(world.x) && Number.isFinite(world.y)) worldByNodeId[id] = world
      continue
    }
    screenByNodeId[id] = pos
  }

  if (Object.keys(screenByNodeId).length === 0 && Object.keys(worldByNodeId).length === 0) return null
  return { surfaceId, screenByNodeId, worldByNodeId }
}

export function applyStoryboardWidgetScreenAuthorityPanSnapshot(args: {
  snapshot: StoryboardWidgetScreenAuthorityPanSnapshot
  dx: number
  dy: number
  transform: { k: number; x: number; y: number }
  canvasTransformShifted?: boolean
}): boolean {
  const dx = Number(args.dx)
  const dy = Number(args.dy)
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false

  const state = useGraphStore.getState() as StoryboardWidgetScreenAuthorityPanState
  const graphKey = buildGraphMetaKeyIgnoringPending(state.graphData || null)
  let changedScreen = false
  let changedWorld = false
  const shiftedScreenByNodeId: Record<string, { left: number; top: number }> = {}

  const nextScreen = {
    ...resolveScopedFlowWidgetNodeMap({
      graphMetaKey: graphKey,
      keyedByGraphMetaKey: state.flowWidgetPosByNodeIdByGraphMetaKey,
      globalByNodeId: state.flowWidgetPosByNodeId,
    }),
  }
  const nextWorld = {
    ...resolveScopedFlowWidgetNodeMap({
      graphMetaKey: graphKey,
      keyedByGraphMetaKey: state.flowWidgetWorldPosByNodeIdByGraphMetaKey,
      globalByNodeId: state.flowWidgetWorldPosByNodeId,
    }),
  }
  const canvasTransformShifted = args.canvasTransformShifted === true
  for (const [id, pos] of Object.entries(args.snapshot.screenByNodeId)) {
    const next = { left: pos.left + dx, top: pos.top + dy }
    shiftedScreenByNodeId[id] = next
    const prev = nextScreen[id]
    if (!prev || Math.abs(prev.left - next.left) > 0.001 || Math.abs(prev.top - next.top) > 0.001) {
      nextScreen[id] = next
      changedScreen = true
    }
    const shiftedWorld = screenToWorld({
      transform: args.transform,
      sx: next.left,
      sy: next.top,
    })
    if (!Number.isFinite(shiftedWorld.x) || !Number.isFinite(shiftedWorld.y)) continue
    const prevWorld = nextWorld[id]
    if (!prevWorld || Math.abs(prevWorld.x - shiftedWorld.x) > 0.001 || Math.abs(prevWorld.y - shiftedWorld.y) > 0.001) {
      nextWorld[id] = shiftedWorld
      changedWorld = true
    }
  }

  for (const [id, pos] of Object.entries(args.snapshot.worldByNodeId)) {
    if (canvasTransformShifted) {
      shiftedScreenByNodeId[id] = {
        left: pos.x * args.transform.k + args.transform.x,
        top: pos.y * args.transform.k + args.transform.y,
      }
      const prev = nextWorld[id]
      if (!prev || Math.abs(prev.x - pos.x) > 0.001 || Math.abs(prev.y - pos.y) > 0.001) {
        nextWorld[id] = pos
        changedWorld = true
      }
      continue
    }
    shiftedScreenByNodeId[id] = {
      left: pos.x * args.transform.k + args.transform.x + dx,
      top: pos.y * args.transform.k + args.transform.y + dy,
    }
    const shifted = screenToWorld({
      transform: args.transform,
      sx: shiftedScreenByNodeId[id]!.left,
      sy: shiftedScreenByNodeId[id]!.top,
    })
    if (!Number.isFinite(shifted.x) || !Number.isFinite(shifted.y)) continue
    const prev = nextWorld[id]
    if (!prev || Math.abs(prev.x - shifted.x) > 0.001 || Math.abs(prev.y - shifted.y) > 0.001) {
      nextWorld[id] = shifted
      changedWorld = true
    }
  }

  const changedVisual = Object.keys(shiftedScreenByNodeId).length > 0
  if (!changedScreen && !changedWorld && !changedVisual) return false
  commitScreenAuthorityPanPositions({
    state,
    graphKey,
    changedScreen,
    changedWorld,
    nextScreen,
    nextWorld,
  })
  applyScreenAuthorityPanDomPositions({
    surfaceId: args.snapshot.surfaceId,
    screenByNodeId: shiftedScreenByNodeId,
  })
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      applyScreenAuthorityPanDomPositions({
        surfaceId: args.snapshot.surfaceId,
        screenByNodeId: shiftedScreenByNodeId,
      })
    })
  }
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new window.CustomEvent(STORYBOARD_WIDGET_SCREEN_AUTHORITY_COLLECTIVE_PAN_EVENT, {
        detail: { screenByNodeId: shiftedScreenByNodeId },
      }))
    }
  } catch {
    void 0
  }
  return true
}
