import React from 'react'

import { buildNodeZKeyById, compareNodeZKey } from '@/lib/canvas/groupZOrder'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { getEffectiveZoomStateForKey, getZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { clampOverlayTopLeftFullyInViewport } from '@/lib/ui/overlayClamp'
import { computeOverlayMaxAnchorShiftPx } from '@/lib/ui/overlayAnchorShift'
import { relaxOverlayPanelsWithCollision } from '@/lib/ui/relaxOverlayPanelsWithCollision'
import { readFlowLayoutKnobs } from '@/lib/graph/layoutDefaults'
import { FLOW_EDITOR_OVERLAY_ROOT_SELECTOR } from '@/lib/canvas/flow-editor-overlay-proxy'
import { worldToScreen } from '@/lib/zoom/viewport'
import { computeWidgetScale, computeWidgetScaleKey, computeWidgetScaledSize, WIDGET_BASE_SIZE } from '@/components/FlowEditor/widgetZoom'
import { readWidgetGridLayoutSettings, shouldAutoPlaceFlowEditorWidget, snapToGridPx } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import {
  BALANCED_OVERLAY_SPREAD_TARGET_ASPECT,
  clampBalancedCollectiveScaleToViewport,
  computeBalancedSpreadGrid,
  computeBalancedSpreadSpacingPx,
  isVerticalOverlayCluster,
} from '@/lib/ui/overlayBalancedSpread'

function hasOverlap(
  a: { left: number; top: number; width?: number; height?: number },
  b: { left: number; top: number; width?: number; height?: number },
  fallback: { width: number; height: number },
  gapPx: number,
) {
  const aw = a.width ?? fallback.width
  const ah = a.height ?? fallback.height
  const bw = b.width ?? fallback.width
  const bh = b.height ?? fallback.height
  const ax2 = a.left + aw + gapPx
  const ay2 = a.top + ah + gapPx
  const bx2 = b.left + bw + gapPx
  const by2 = b.top + bh + gapPx
  return a.left < bx2 && b.left < ax2 && a.top < by2 && b.top < ay2
}

const OVERLAY_POSITION_QUANTUM_PX = 1

function quantizeOverlayPos(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.round(v / OVERLAY_POSITION_QUANTUM_PX) * OVERLAY_POSITION_QUANTUM_PX
}

function normalizeOverlaySignatureIds(ids: string[]): string[] {
  if (ids.length === 0) return []
  const next = new Set<string>()
  for (let i = 0; i < ids.length; i += 1) {
    const id = String(ids[i] || '').trim()
    if (!id) continue
    next.add(id)
  }
  return Array.from(next).sort((a, b) => a.localeCompare(b))
}

function buildPosSignature(
  ids: string[],
  posById: Record<string, { top: number; left: number }> | null | undefined,
): string {
  const signatureIds = normalizeOverlaySignatureIds(ids)
  if (signatureIds.length === 0) return ''
  const byId = posById || {}
  return signatureIds
    .map(id => {
      const pos = byId[id]
      const left = pos && Number.isFinite(pos.left) ? Math.round(pos.left) : 'na'
      const top = pos && Number.isFinite(pos.top) ? Math.round(pos.top) : 'na'
      return `${id}:${left},${top}`
    })
    .join('|')
}

export function useFlowEditorOverlayCollision(args: {
  editorRuntimeActive: boolean
  overlayOnlyModeEnabled: boolean
  renderGraphDataOverride: GraphData | null
  schema: any
  selectedNodeId: string | null
  viewportW: number
  viewportH: number
  canvasWindowOffset: { left: number; top: number }
  canvasWindowOffsetRef: React.MutableRefObject<{ left: number; top: number }>
  zoomViewKeyRef: React.MutableRefObject<string | null>
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  frontmatterFlowRenderSettings: { rankdir?: string } | null
  getLiveNodeWorldPos: (nodeId: string) => { x: number; y: number } | null
  getLiveZoomTransform: () => { k: number; x: number; y: number } | null
}) {
  const {
    editorRuntimeActive,
    overlayOnlyModeEnabled,
    renderGraphDataOverride,
    schema,
    selectedNodeId,
    viewportW,
    viewportH,
    canvasWindowOffset,
    canvasWindowOffsetRef,
    zoomViewKeyRef,
    draftGraphDataRef,
    frontmatterFlowRenderSettings,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
  } = args
  const overlayCollisionResolveRafRef = React.useRef<number | null>(null)
  const overlayCollisionResolveKeyRef = React.useRef<string>('')
  const overlayRectCacheRef = React.useRef<Map<string, { left: number; top: number; width: number; height: number }>>(new Map())
  const overlayCollisionIterKeyRef = React.useRef<string>('')
  const overlayCollisionIterCountRef = React.useRef<number>(0)
  const overlayCollisionWarmupStartedAtMsRef = React.useRef<number | null>(null)
  const overlayCollisionWarmupAttemptsRef = React.useRef<number>(0)
  const scheduleOverlayCollisionResolveRef = React.useRef<() => void>(() => void 0)
  const selfCommittedPosSignatureRef = React.useRef<string>('')
  const overlayCollisionSettleBaseKeyRef = React.useRef<string>('')
  const overlayCollisionBestUnresolvedRef = React.useRef<number>(Number.POSITIVE_INFINITY)
  const overlayCollisionRecentSigRef = React.useRef<string[]>([])

  const scheduleOverlayCollisionResolve = React.useCallback(() => {
    if (!editorRuntimeActive) return
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    if (overlayCollisionResolveRafRef.current != null) return
    if (overlayCollisionWarmupStartedAtMsRef.current == null) overlayCollisionWarmupStartedAtMsRef.current = Date.now()

    overlayCollisionResolveRafRef.current = window.requestAnimationFrame(() => {
      overlayCollisionResolveRafRef.current = null
      if (!editorRuntimeActive) return

      const overlayEls = Array.from(document.querySelectorAll<HTMLElement>(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR))
      if (overlayEls.length < 2) {
        const st = useGraphStore.getState()
        const wantsResolve = (st.openWidgetNodeIds || []).length >= 2 || overlayOnlyModeEnabled
        overlayCollisionWarmupAttemptsRef.current += 1
        const startedAt = overlayCollisionWarmupStartedAtMsRef.current || Date.now()
        const elapsed = Date.now() - startedAt
        if (wantsResolve && overlayCollisionWarmupAttemptsRef.current < 60 && elapsed < 1600) {
          scheduleOverlayCollisionResolveRef.current()
          return
        }
        overlayCollisionWarmupStartedAtMsRef.current = null
        overlayCollisionWarmupAttemptsRef.current = 0
        return
      }
      overlayCollisionWarmupStartedAtMsRef.current = null
      overlayCollisionWarmupAttemptsRef.current = 0

      const graphKind = String(((renderGraphDataOverride?.metadata || {}) as Record<string, unknown>).kind || '').trim()
      const isFrontmatterFlow = graphKind === 'frontmatter-flow'
      const nodes = Array.isArray(renderGraphDataOverride?.nodes) ? (renderGraphDataOverride!.nodes as GraphNode[]) : []
      const nodeById = new Map<string, GraphNode>()
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const id = String(n?.id || '').trim()
        if (!id || nodeById.has(id)) continue
        nodeById.set(id, n)
      }
      const nodeZKeyById = buildNodeZKeyById({ nodes, groups: [] })
      const compareByVisualIndex = (aId: string, bId: string): number => {
        if (!aId || !bId) return String(aId || '').localeCompare(String(bId || ''))
        if (aId === bId) return 0
        const aKey = nodeZKeyById.get(aId)
        const bKey = nodeZKeyById.get(bId)
        if (aKey && bKey) return compareNodeZKey(aKey, bKey)
        if (aKey || bKey) return aKey ? -1 : 1
        return aId.localeCompare(bId)
      }

      const overlayNodeIds = (() => {
        const next: string[] = []
        const seen = new Set<string>()
        for (let i = 0; i < overlayEls.length; i += 1) {
          const id = String(overlayEls[i]?.dataset?.kgWidget || '').trim()
          if (!id || seen.has(id)) continue
          seen.add(id)
          next.push(id)
        }
        return isFrontmatterFlow ? next.sort(compareByVisualIndex) : next.sort((a, b) => a.localeCompare(b))
      })()
      if (overlayNodeIds.length < 2) return

      const st = useGraphStore.getState()
      if (st.flowWidgetDraggingNodeId) return
      const liveZoom = args.getLiveZoomTransform()
      const zoomKRaw =
        (liveZoom?.k ??
          getEffectiveZoomStateForKey({
            zoomViewKey: zoomViewKeyRef.current,
            zoomStateByKey: st.zoomStateByKey,
            zoomState: st.zoomState,
          })?.k) ?? null
      const zoomK = typeof zoomKRaw === 'number' && Number.isFinite(zoomKRaw) ? zoomKRaw : 1
      const panelScaleBase = computeWidgetScale(zoomK, null, { mode: 'floating' })
      const unpinnedCount = overlayNodeIds.reduce((acc, id) => acc + (st.flowWidgetPinnedByNodeId?.[id] === true ? 0 : 1), 0)
      const panelScale = clampBalancedCollectiveScaleToViewport({
        scale: panelScaleBase,
        viewportW: args.viewportW,
        viewportH: args.viewportH,
        count: Math.max(1, unpinnedCount),
        baseWidth: WIDGET_BASE_SIZE.width,
        baseHeight: WIDGET_BASE_SIZE.height,
        quantizeStep: 0.02,
        hardMinScale: 0.68,
        hardMaxScale: 1.06,
      })
      const panelScaleKey = computeWidgetScaleKey(panelScale)
      const canvasOffset = canvasWindowOffsetRef.current || canvasWindowOffset
      const offL = Number.isFinite(canvasOffset.left) ? Math.round(canvasOffset.left * 10) / 10 : 0
      const offT = Number.isFinite(canvasOffset.top) ? Math.round(canvasOffset.top * 10) / 10 : 0
      const widgetGrid = readWidgetGridLayoutSettings(schema)
      const pinSig = overlayNodeIds.map(id => (st.flowWidgetPinnedByNodeId?.[id] === true ? '1' : '0')).join('')
      const posSig = buildPosSignature(overlayNodeIds, st.flowWidgetPosByNodeId)
      const settleBaseKey =
        `${overlayNodeIds.join(',')}|${panelScaleKey}|${viewportW}x${viewportH}|${overlayOnlyModeEnabled ? 1 : 0}`
        + `|${offL},${offT}|${pinSig}|balanced:${Math.round(BALANCED_OVERLAY_SPREAD_TARGET_ASPECT * 1000) / 1000}`
      const key = `${settleBaseKey}|${posSig}`
      if (overlayCollisionResolveKeyRef.current === key) return
      overlayCollisionResolveKeyRef.current = key
      if (overlayCollisionIterKeyRef.current !== key) {
        overlayCollisionIterKeyRef.current = key
        overlayCollisionIterCountRef.current = 0
      }

      const floatingScaled = computeWidgetScaledSize(panelScale)
      const pinnedById = st.flowWidgetPinnedByNodeId || {}
      const posById = st.flowWidgetPosByNodeId || {}
      const canvasOffsetLeft = Number.isFinite(canvasOffset.left) ? canvasOffset.left : 0
      const canvasOffsetTop = Number.isFinite(canvasOffset.top) ? canvasOffset.top : 0
      const rectByNodeId = new Map<string, { left: number; top: number; width: number; height: number }>()
      for (let i = 0; i < overlayEls.length; i += 1) {
        const el = overlayEls[i]
        const id = String(el.dataset.kgWidget || '').trim()
        if (!id) continue
        const rect = el.getBoundingClientRect()
        const width = Number.isFinite(rect.width) ? rect.width : 0
        const height = Number.isFinite(rect.height) ? rect.height : 0
        const leftRaw = Number.isFinite(rect.left) ? rect.left : 0
        const topRaw = Number.isFinite(rect.top) ? rect.top : 0
        const left = leftRaw - canvasOffsetLeft
        const top = topRaw - canvasOffsetTop
        if (width > 0 && height > 0) {
          const resolved = { left, top, width, height }
          overlayRectCacheRef.current.set(id, resolved)
          rectByNodeId.set(id, resolved)
          continue
        }
        const cached = overlayRectCacheRef.current.get(id) || null
        if (cached) {
          rectByNodeId.set(id, cached)
          continue
        }
        if (Number.isFinite(left) && Number.isFinite(top)) rectByNodeId.set(id, { left, top, width: floatingScaled.width, height: floatingScaled.height })
      }

      let sumW = 0
      let sumH = 0
      let count = 0
      for (let i = 0; i < overlayNodeIds.length; i += 1) {
        const r = rectByNodeId.get(overlayNodeIds[i]!)
        if (!r || !(r.width > 0 && r.height > 0)) continue
        sumW += r.width
        sumH += r.height
        count += 1
      }
      const typicalSize = count > 0
        ? {
            width: Math.max(120, Math.min(floatingScaled.width, sumW / count)),
            height: Math.max(160, Math.min(floatingScaled.height, sumH / count)),
          }
        : floatingScaled
      const gapBase = typeof args.schema?.layout?.flow?.overlay?.collisionGapPx === 'number' ? args.schema.layout.flow.overlay.collisionGapPx : 12
      const configuredGapPx = Math.max(0, Math.min(80, Math.floor(widgetGrid.gridEnabled ? Math.max(gapBase, widgetGrid.gapPx) : gapBase)))
      const adaptiveGapPx = computeBalancedSpreadSpacingPx({
        baseGapPx: configuredGapPx,
        zoomK,
        count: Math.max(1, unpinnedCount),
      })
      const gapPx = Math.max(configuredGapPx, adaptiveGapPx)
      const snapStepPx = widgetGrid.gridEnabled ? Math.max(1, widgetGrid.stepPx) : 1
      const snapScreen = (v: number): number => (snapStepPx > 1 ? snapToGridPx(v, snapStepPx) : v)
      const cellSize = {
        width: Math.max(1, snapScreen(typicalSize.width + gapPx)),
        height: Math.max(1, snapScreen(Math.round(typicalSize.height * 0.76) + gapPx)),
      }
      const marginLeft = isFrontmatterFlow ? Math.max(20, Math.floor(args.viewportW * 0.1)) : 20
      const marginRight = isFrontmatterFlow ? Math.max(20, Math.floor(args.viewportW * 0.1)) : 20
      const marginTop = isFrontmatterFlow ? Math.max(64, Math.floor(args.viewportH * 0.1)) : 96
      const marginBottom = isFrontmatterFlow ? Math.max(24, Math.floor(args.viewportH * 0.1)) : 24
      const usableW = Math.max(1, args.viewportW - marginLeft - marginRight)
      const usableH = Math.max(1, args.viewportH - marginTop - marginBottom)
      const computeGrid = () =>
        computeBalancedSpreadGrid({
          count: Math.max(1, unpinnedCount),
          viewportW: usableW,
          viewportH: usableH,
          cellW: cellSize.width,
          cellH: cellSize.height,
          zoomK,
        })
      const baseGrid = computeGrid()
      let rowsMax = baseGrid.rows
      let dockCols = baseGrid.cols
      let dockWidth = dockCols * cellSize.width - gapPx
      let dockLeft = Math.max(marginLeft, args.viewportW - marginRight - dockWidth)
      let dockTop = marginTop
      if (isFrontmatterFlow || widgetGrid.gridEnabled) {
        const centeredGrid = computeGrid()
        const cols = centeredGrid.cols
        const rows = centeredGrid.rows
        dockCols = cols
        rowsMax = rows
        dockWidth = cols * cellSize.width - gapPx
        dockLeft = marginLeft + Math.max(0, Math.floor((usableW - dockWidth) / 2))
        dockTop = marginTop + Math.max(0, Math.floor((usableH - (rows * cellSize.height - gapPx)) / 2))
      }

      const pinnedObstacles: Array<{ id: string; left: number; top: number; width: number; height: number }> = []
      const items: Array<{ id: string; top: number; left: number; movable: boolean; width?: number; height?: number }> = []
      let stack = 0
      for (let i = 0; i < overlayNodeIds.length; i += 1) {
        const id = String(overlayNodeIds[i] || '').trim()
        if (!id) continue
        const rect = rectByNodeId.get(id) || null
        if (pinnedById[id] === true) {
          if (rect) pinnedObstacles.push({ id, left: rect.left, top: rect.top, width: rect.width, height: rect.height })
          continue
        }
        if (!shouldAutoPlaceFlowEditorWidget({ graphMetaKind: graphKind, pinnedInCanvas: false, floatingPos: posById[id] })) {
          if (rect) pinnedObstacles.push({ id, left: rect.left, top: rect.top, width: rect.width, height: rect.height })
          continue
        }
        const stored = posById[id]
        const hasStored = Boolean(stored && Number.isFinite(stored.top) && Number.isFinite(stored.left))
        const rawCol = Math.floor(stack / rowsMax)
        const col = Math.min(rawCol, dockCols - 1)
        const row = rawCol < dockCols ? stack % rowsMax : stack - (dockCols - 1) * rowsMax
        stack += 1
        const fallback = { left: dockLeft + col * cellSize.width, top: dockTop + row * cellSize.height }
        const base = !hasStored
          ? fallback
          : (() => {
              const left = stored.left
              const top = stored.top
              const okX = isFrontmatterFlow ? left >= -12 && left <= args.viewportW - 12 : left >= marginLeft - 12 && left <= args.viewportW - marginRight - 12
              const okY = isFrontmatterFlow ? top >= -12 && top <= args.viewportH - 12 : top >= marginTop - 12 && top <= args.viewportH - marginBottom - 12
              return okX && okY ? stored : fallback
            })()
        const snappedBase = snapStepPx > 1 ? { left: snapScreen(base.left), top: snapScreen(base.top) } : base
        const clamped = clampOverlayTopLeftFullyInViewport({
          pos: snappedBase,
          size: rect ? { width: rect.width, height: rect.height } : floatingScaled,
          viewport: { width: args.viewportW, height: args.viewportH },
          snapPx: 1,
        })
        items.push({ id, top: clamped.top, left: clamped.left, movable: true, width: rect?.width, height: rect?.height })
      }
      if (items.length === 0) return

      const fixedId = (() => {
        const sel = String(args.selectedNodeId || '').trim()
        if (sel && items.some(it => it.id === sel)) return sel
        if (args.overlayOnlyModeEnabled) return [...items].map(it => it.id).sort((a, b) => a.localeCompare(b))[0] || ''
        return items[0]?.id || ''
      })()

      const shouldResolveItems = (candidates: Array<{ id: string; left: number; top: number; width?: number; height?: number }>) => {
        for (let i = 0; i < candidates.length; i += 1) for (let j = i + 1; j < candidates.length; j += 1) {
          if (hasOverlap(candidates[i]!, candidates[j]!, floatingScaled, gapPx)) return true
        }
        return false
      }
      const shouldResolveItemsAgainstObstacles = (candidates: Array<{ id: string; left: number; top: number; width?: number; height?: number }>) => {
        for (let i = 0; i < candidates.length; i += 1) for (let j = 0; j < pinnedObstacles.length; j += 1) {
          if (hasOverlap(candidates[i]!, pinnedObstacles[j]!, floatingScaled, gapPx)) return true
        }
        return false
      }
      const shouldRebalanceCluster = (candidates: Array<{ id: string; left: number; top: number; width?: number; height?: number }>) =>
        isVerticalOverlayCluster({
          items: candidates.map(it => ({
            left: it.left,
            top: it.top,
            width: it.width ?? floatingScaled.width,
            height: it.height ?? floatingScaled.height,
          })),
          gapPx,
        })

      const next = { ...posById }
      const seedGridAroundFixed = (worldIn: Array<{ id: string; left: number; top: number; width: number; height: number; movable: boolean }>) => {
        const cols = Math.max(1, dockCols)
        const rows = Math.max(1, Math.ceil(Math.max(worldIn.length, 1) / cols))
        const maxRows = Math.max(rows, Math.ceil(Math.max(1, args.viewportH - dockTop - marginBottom) / Math.max(1, cellSize.height)))
        const fixed = worldIn.find(it => it.id === fixedId) || worldIn[0]
        const fixedCol = Math.max(0, Math.min(cols - 1, Math.round(((fixed?.left ?? dockLeft) - dockLeft) / cellSize.width)))
        const fixedRow = Math.max(0, Math.min(maxRows - 1, Math.round(((fixed?.top ?? dockTop) - dockTop) / cellSize.height)))
        const cells: Array<{ idx: number; left: number; top: number; row: number; col: number }> = []
        for (let idx = 0; idx < Math.max(worldIn.length + 8, cols * maxRows); idx += 1) {
          const row = Math.floor(idx / cols)
          const col = idx % cols
          cells.push({ idx, row, col, left: dockLeft + col * cellSize.width, top: dockTop + row * cellSize.height })
        }
        const sortedCells = [...cells].sort((a, b) => {
          const da = Math.abs(a.row - fixedRow) + Math.abs(a.col - fixedCol)
          const db = Math.abs(b.row - fixedRow) + Math.abs(b.col - fixedCol)
          if (da !== db) return da - db
          if (a.row !== b.row) return a.row - b.row
          return a.col - b.col
        })
        const used = new Set<number>()
        const fixedCell = cells[Math.max(0, Math.min(cells.length - 1, fixedRow * cols + fixedCol))]
        if (fixedCell) used.add(fixedCell.idx)
        for (let i = 0; i < worldIn.length; i += 1) {
          const it = worldIn[i]!
          if (it.id === fixedId || it.movable) continue
          const col = Math.max(0, Math.min(cols - 1, Math.round((it.left - dockLeft) / cellSize.width)))
          const row = Math.max(0, Math.min(maxRows - 1, Math.round((it.top - dockTop) / cellSize.height)))
          used.add(row * cols + col)
        }
        const pickNextCell = () => {
          for (let i = 0; i < sortedCells.length; i += 1) {
            const c = sortedCells[i]!
            if (used.has(c.idx)) continue
            used.add(c.idx)
            return c
          }
          const idx = used.size
          const row = Math.floor(idx / cols)
          const col = idx % cols
          return { idx, row, col, left: dockLeft + col * cellSize.width, top: dockTop + row * cellSize.height }
        }
        return [...worldIn].sort((a, b) => a.id.localeCompare(b.id)).map(it => {
          if (it.id === fixedId || !it.movable) return it
          const cell = pickNextCell()
          return { ...it, left: cell.left, top: cell.top }
        })
      }
      const toWorld = () => items.map(it => ({
        id: it.id,
        left: it.left,
        top: it.top,
        width: it.width ?? floatingScaled.width,
        height: it.height ?? floatingScaled.height,
        movable: it.movable && it.id !== fixedId,
      }))
      const clampWorld = (world: Array<{ id: string; left: number; top: number; width: number; height: number; movable: boolean }>) =>
        world.map(it => {
          const clamped0 = clampOverlayTopLeftFullyInViewport({
            pos: { top: it.top, left: it.left },
            size: { width: it.width, height: it.height },
            viewport: { width: args.viewportW, height: args.viewportH },
            snapPx: 1,
          })
          const snapped = snapStepPx > 1 ? { left: snapScreen(clamped0.left), top: snapScreen(clamped0.top) } : clamped0
          const clamped = snapStepPx > 1
            ? clampOverlayTopLeftFullyInViewport({
                pos: snapped,
                size: { width: it.width, height: it.height },
                viewport: { width: args.viewportW, height: args.viewportH },
                snapPx: 1,
              })
            : clamped0
          return { ...it, left: clamped.left, top: clamped.top }
        })

      let world = clampWorld(toWorld())
      const graph = args.draftGraphDataRef.current
      const rawNodes = Array.isArray(graph?.nodes) ? (graph!.nodes as Array<{ id?: unknown; x?: unknown; y?: unknown }>) : []
      const nodeObstacles: Array<{ id: string; left: number; top: number; width: number; height: number }> = []
      const overlayNodeIdSet = new Set<string>(overlayNodeIds)
      const allowNodeObstacleCollision = !args.overlayOnlyModeEnabled
      if (allowNodeObstacleCollision && args.schema && rawNodes.length > 0) {
        const t = args.getLiveZoomTransform() || getZoomStateForKey({ zoomViewKey: args.zoomViewKeyRef.current, zoomStateByKey: st.zoomStateByKey }) || null
        const k = typeof t?.k === 'number' && Number.isFinite(t.k) ? t.k : 1
        const knobs = readFlowLayoutKnobs({ schema: args.schema, rankdir: args.frontmatterFlowRenderSettings?.rankdir || 'TB' })
        const handleExtra = args.schema.behavior?.portHandles?.enabled === true ? Math.max(0, knobs.handle.sizePx) : 0
        const nodeW = Math.max(1, Math.floor(knobs.node.widthPx + handleExtra * 2))
        const nodeH = Math.max(1, Math.floor(knobs.node.heightPx + handleExtra * 2))
        for (let i = 0; i < rawNodes.length; i += 1) {
          const n = rawNodes[i]
          const id = String(n?.id || '').trim()
          if (!id) continue
          if (overlayNodeIdSet.has(id)) continue
          const live = args.getLiveNodeWorldPos(id)
          const x = live?.x ?? (typeof n?.x === 'number' && Number.isFinite(n.x) ? n.x : null)
          const y = live?.y ?? (typeof n?.y === 'number' && Number.isFinite(n.y) ? n.y : null)
          if (x == null || y == null) continue
          const s = worldToScreen({ transform: t, x, y })
          nodeObstacles.push({ id, left: s.sx, top: s.sy, width: nodeW * k, height: nodeH * k })
        }
      }
      const obstacles = [...nodeObstacles, ...pinnedObstacles]
      const wantsResolve = shouldResolveItems(world) || shouldResolveItemsAgainstObstacles(world) || shouldRebalanceCluster(world)
      if (wantsResolve) {
        if (shouldResolveItems(world) || shouldRebalanceCluster(world)) world = clampWorld(seedGridAroundFixed(world))
        const resolvePass = (strength: number, iterations: number, steps: number) =>
          args.schema
            ? relaxOverlayPanelsWithCollision({
                schema: args.schema,
                items: world,
                obstacles,
                gapPx,
                strength,
                iterations,
                steps,
                anchorStrength: 0.08,
                maxAnchorShiftPx: computeOverlayMaxAnchorShiftPx(args.viewportW, args.viewportH),
                maxSpeedPxPerStep: 180,
              })
            : world.map(r => ({ id: r.id, left: r.left, top: r.top }))
        const pass1 = resolvePass(0.85, 12, 14)
        world = clampWorld(world.map(it => ({ ...it, ...(pass1.find(x => x.id === it.id) || {}) })))
        if (shouldResolveItems(world) || shouldResolveItemsAgainstObstacles(world)) {
          const pass2 = resolvePass(0.78, 10, 12)
          world = clampWorld(world.map(it => ({ ...it, ...(pass2.find(x => x.id === it.id) || {}) })))
        }
      }
      const finalById = new Map(world.map(it => [
        it.id,
        {
          left: quantizeOverlayPos(it.left),
          top: quantizeOverlayPos(it.top),
        },
      ]))
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        const p = finalById.get(item.id)
        if (p) next[item.id] = { top: p.top, left: p.left }
      }

      let changed = false
      for (const it of items) {
        const prev = posById[it.id]
        const cur = next[it.id]
        if (!cur) continue
        const prevTop = prev ? quantizeOverlayPos(prev.top) : null
        const prevLeft = prev ? quantizeOverlayPos(prev.left) : null
        if (prevTop == null || prevLeft == null || prevTop !== cur.top || prevLeft !== cur.left) {
          changed = true
          break
        }
      }
      if (!changed) return
      selfCommittedPosSignatureRef.current = buildPosSignature(overlayNodeIds, next)
      st.setFlowWidgetPosByNodeId(next)

      const stillOverlaps =
        shouldResolveItems(world.map(it => ({ id: it.id, left: it.left, top: it.top, width: it.width, height: it.height })))
        || shouldResolveItemsAgainstObstacles(world.map(it => ({ id: it.id, left: it.left, top: it.top, width: it.width, height: it.height })))
        || shouldRebalanceCluster(world.map(it => ({ id: it.id, left: it.left, top: it.top, width: it.width, height: it.height })))
      if (stillOverlaps && changed) {
        if (overlayCollisionSettleBaseKeyRef.current !== settleBaseKey) {
          overlayCollisionSettleBaseKeyRef.current = settleBaseKey
          overlayCollisionBestUnresolvedRef.current = Number.POSITIVE_INFINITY
          overlayCollisionRecentSigRef.current = []
        }
        overlayCollisionIterCountRef.current += 1
        const unresolvedPairCount = (() => {
          let count = 0
          const candidates = world.map(it => ({ id: it.id, left: it.left, top: it.top, width: it.width, height: it.height }))
          for (let i = 0; i < candidates.length; i += 1) {
            for (let j = i + 1; j < candidates.length; j += 1) {
              if (hasOverlap(candidates[i]!, candidates[j]!, floatingScaled, gapPx)) count += 1
            }
          }
          for (let i = 0; i < candidates.length; i += 1) {
            for (let j = 0; j < pinnedObstacles.length; j += 1) {
              if (hasOverlap(candidates[i]!, pinnedObstacles[j]!, floatingScaled, gapPx)) count += 1
            }
          }
          if (shouldRebalanceCluster(candidates)) count += 1
          return count
        })()
        const finalSig = buildPosSignature(overlayNodeIds, next)
        const seenBefore = overlayCollisionRecentSigRef.current.includes(finalSig)
        const improved = unresolvedPairCount < overlayCollisionBestUnresolvedRef.current
        if (improved) {
          overlayCollisionBestUnresolvedRef.current = unresolvedPairCount
          overlayCollisionRecentSigRef.current = [finalSig]
        } else {
          const recent = overlayCollisionRecentSigRef.current
          recent.push(finalSig)
          while (recent.length > 4) recent.shift()
        }
        const allowReschedule =
          overlayCollisionIterCountRef.current <= 10
          && (improved || (!seenBefore && overlayCollisionIterCountRef.current <= 4))
        if (allowReschedule) {
          overlayCollisionResolveKeyRef.current = ''
          scheduleOverlayCollisionResolveRef.current()
        }
      }
    })
  }, [
    canvasWindowOffset,
    canvasWindowOffsetRef,
    draftGraphDataRef,
    editorRuntimeActive,
    frontmatterFlowRenderSettings,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    overlayOnlyModeEnabled,
    renderGraphDataOverride,
    schema,
    selectedNodeId,
    viewportH,
    viewportW,
    zoomViewKeyRef,
  ])
  scheduleOverlayCollisionResolveRef.current = scheduleOverlayCollisionResolve

  React.useEffect(() => {
    if (!editorRuntimeActive) return
    scheduleOverlayCollisionResolve()
  }, [
    canvasWindowOffset.left,
    canvasWindowOffset.top,
    editorRuntimeActive,
    overlayOnlyModeEnabled,
    viewportH,
    viewportW,
    scheduleOverlayCollisionResolve,
  ])

  React.useEffect(() => {
    if (!editorRuntimeActive) return
    const unsubPos = useGraphStore.subscribe(s => s.flowWidgetPosByNodeId, () => {
      const state = useGraphStore.getState()
      const overlayEls = typeof document === 'undefined'
        ? []
        : Array.from(document.querySelectorAll<HTMLElement>(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR))
      const nodeIds = normalizeOverlaySignatureIds(overlayEls.map(el => String(el?.dataset?.kgWidget || '').trim()))
      const currentSig = buildPosSignature(nodeIds, state.flowWidgetPosByNodeId)
      if (currentSig && currentSig === selfCommittedPosSignatureRef.current) {
        selfCommittedPosSignatureRef.current = ''
        return
      }
      scheduleOverlayCollisionResolveRef.current()
    })
    const unsubPinned = useGraphStore.subscribe(s => s.flowWidgetPinnedByNodeId, () => {
      scheduleOverlayCollisionResolveRef.current()
    })
    return () => {
      try {
        unsubPos()
      } catch {
        void 0
      }
      try {
        unsubPinned()
      } catch {
        void 0
      }
    }
  }, [editorRuntimeActive])

  React.useEffect(() => {
    return () => {
      if (overlayCollisionResolveRafRef.current != null) {
        try {
          cancelAnimationFrame(overlayCollisionResolveRafRef.current)
        } catch {
          void 0
        }
        overlayCollisionResolveRafRef.current = null
      }
    }
  }, [])

  return { scheduleOverlayCollisionResolve }
}
