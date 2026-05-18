import { Vector3, type Camera, type Matrix4, type WebGLRenderer } from 'three'
import type { GraphSchema } from '@/lib/graph/schema'
import { applyMediaPanelCssVars, applyPanelBox, computeMediaPanelCssVars3d, computePanelRect, computePanelSizeFromContent16x9 } from '@/lib/render/mediaPanelLayout'
import { normalizeRichMediaPanelDensity } from '@/lib/render/richMediaSsot'

type OverlayNodeLike = { id: string }

type LayoutCandidate = {
  id: string
  sx: number
  sy: number
  dist: number
  sizeScale: number
  opacity: number
}

export type ThreeMediaOverlayLayoutScratch = {
  world: Vector3
  v3: Vector3
  camSpace: Vector3
  dir: Vector3
  nearPoint: Vector3
  candidates: LayoutCandidate[]
  selectedIds: Set<string>
  candidateById: Map<string, LayoutCandidate>
}

export const createThreeMediaOverlayLayoutScratch = (): ThreeMediaOverlayLayoutScratch => ({
  world: new Vector3(),
  v3: new Vector3(),
  camSpace: new Vector3(),
  dir: new Vector3(),
  nearPoint: new Vector3(),
  candidates: [],
  selectedIds: new Set<string>(),
  candidateById: new Map<string, LayoutCandidate>(),
})

const finiteNumberOrNull = (value: unknown): number | null => {
  const next = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(next) ? next : null
}

export function updateThreeMediaOverlayLayout(args: {
  camera: Camera | null
  gl: WebGLRenderer | null
  overlayNodesPool: ReadonlyArray<OverlayNodeLike>
  positions: Record<string, [number, number, number]>
  dragOverrides: Record<string, [number, number, number]>
  overlayEls: Map<string, HTMLElement>
  missFrames: Map<string, number>
  prevVisibleIds: Set<string>
  effectiveSchema: GraphSchema
  scratch: ThreeMediaOverlayLayoutScratch
  selectedNodeId?: unknown
  selectedNodeIds?: unknown
  mediaPanelDensity?: unknown
  threeIframeOverlayMaxVisibleDefault?: unknown
  threeIframeOverlayMaxVisibleCompact?: unknown
  threeIframeOverlayMaxDistanceDefault?: unknown
  threeIframeOverlayMaxDistanceCompact?: unknown
  threeIframeOverlayBaseWidthRatioDefault?: unknown
  threeIframeOverlayBaseWidthRatioCompact?: unknown
  threeIframeOverlayBaseWidthMinPxDefault?: unknown
  threeIframeOverlayBaseWidthMinPxCompact?: unknown
  threeIframeOverlayBaseWidthMaxPxDefault?: unknown
  threeIframeOverlayBaseWidthMaxPxCompact?: unknown
  threeIframeOverlaySizeScaleFactor?: unknown
}): Set<string> {
  const { camera, gl, scratch } = args
  if (!camera || !gl) return args.prevVisibleIds
  const w = Math.max(1, gl.domElement.clientWidth || 1)
  const h = Math.max(1, gl.domElement.clientHeight || 1)
  const density = normalizeRichMediaPanelDensity(args.mediaPanelDensity)
  const maxCountRaw = density === 'compact' ? args.threeIframeOverlayMaxVisibleCompact : args.threeIframeOverlayMaxVisibleDefault
  const maxCountFinite = finiteNumberOrNull(maxCountRaw)
  const maxCount = maxCountFinite == null ? 0 : Math.max(0, Math.floor(maxCountFinite))
  const maxDistanceRaw = density === 'compact' ? args.threeIframeOverlayMaxDistanceCompact : args.threeIframeOverlayMaxDistanceDefault
  const maxDistanceFinite = finiteNumberOrNull(maxDistanceRaw)
  const maxDistance = maxDistanceFinite == null ? 0 : Math.max(0, maxDistanceFinite)
  const labelDepthFadeEnabled = args.effectiveSchema.three?.globeLabelDepthFade !== false
  const labelBackfaceCullingEnabled = args.effectiveSchema.three?.globeLabelBackfaceCulling !== false
  if (maxCount === 0 || maxDistance <= 0) {
    for (const id of args.prevVisibleIds) {
      const el = args.overlayEls.get(id)
      if (el) applyPanelBox(el, { left: -99999, top: -99999, w: 1, h: 1, display: 'block', zIndex: 1 })
    }
    args.missFrames.clear()
    return new Set<string>()
  }

  const widthRatioRaw = density === 'compact' ? args.threeIframeOverlayBaseWidthRatioCompact : args.threeIframeOverlayBaseWidthRatioDefault
  const widthRatioFinite = finiteNumberOrNull(widthRatioRaw)
  const widthRatio = widthRatioFinite == null ? 0.2 : Math.max(0.001, widthRatioFinite)
  const widthMinRaw = density === 'compact' ? args.threeIframeOverlayBaseWidthMinPxCompact : args.threeIframeOverlayBaseWidthMinPxDefault
  const widthMinFinite = finiteNumberOrNull(widthMinRaw)
  const widthMin = widthMinFinite == null ? 200 : Math.max(1, Math.floor(widthMinFinite))
  const widthMaxRaw = density === 'compact' ? args.threeIframeOverlayBaseWidthMaxPxCompact : args.threeIframeOverlayBaseWidthMaxPxDefault
  const widthMaxFinite = finiteNumberOrNull(widthMaxRaw)
  const widthMax = widthMaxFinite == null ? 360 : Math.max(1, Math.floor(widthMaxFinite))
  const baseW = Math.min(widthMax, Math.max(widthMin, w * widthRatio))
  const margin = 12
  const { world, v3, camSpace, dir, nearPoint, candidates, selectedIds, candidateById } = scratch
  selectedIds.clear()
  const selOne = String(args.selectedNodeId || '').trim()
  if (selOne) selectedIds.add(selOne)
  if (Array.isArray(args.selectedNodeIds)) {
    for (let i = 0; i < args.selectedNodeIds.length; i += 1) {
      const id = String(args.selectedNodeIds[i] || '').trim()
      if (id) selectedIds.add(id)
    }
  }
  candidates.length = 0
  for (let i = 0; i < args.overlayNodesPool.length; i += 1) {
    const node = args.overlayNodesPool[i]
    const pos3 = args.dragOverrides[node.id] || args.positions[node.id] || null
    if (!pos3) continue
    world.set(pos3[0], pos3[1], pos3[2])
    const dist = camera.position.distanceTo(world)
    if (!Number.isFinite(dist) || dist > maxDistance) continue
    if (labelBackfaceCullingEnabled) {
      const cameraDot = world.dot(camera.position)
      if (!Number.isFinite(cameraDot) || cameraDot < 0) continue
    }
    try {
      camSpace.copy(world).applyMatrix4((camera as unknown as { matrixWorldInverse: Matrix4 }).matrixWorldInverse)
    } catch {
      camSpace.set(0, 0, -1)
    }
    if (camSpace.z > 1e-6) continue
    const nearRaw = (camera as unknown as { near?: unknown }).near
    const near = typeof nearRaw === 'number' && Number.isFinite(nearRaw) && nearRaw > 0 ? nearRaw : 0.1
    const tooNear = Math.abs(camSpace.z) < near * 1.1
    const initialPoint = (() => {
      if (!tooNear) return world
      dir.subVectors(world, camera.position)
      const len = dir.length()
      if (len < 1e-6) return world
      dir.multiplyScalar(1 / len)
      nearPoint.copy(camera.position).addScaledVector(dir, near * 1.01)
      return nearPoint
    })()
    v3.copy(initialPoint).project(camera)
    let ndcX = v3.x
    let ndcY = v3.y
    let ndcZ = v3.z
    const unstable =
      !Number.isFinite(ndcX) ||
      !Number.isFinite(ndcY) ||
      !Number.isFinite(ndcZ) ||
      Math.abs(ndcX) > 8 ||
      Math.abs(ndcY) > 8 ||
      Math.abs(ndcZ) > 8
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY) || !Number.isFinite(ndcZ)) {
      dir.subVectors(world, camera.position)
      const len = dir.length()
      if (len < 1e-6) {
        ndcX = 0
        ndcY = 0
        ndcZ = 0
      } else {
        dir.multiplyScalar(1 / len)
        nearPoint.copy(camera.position).addScaledVector(dir, near * 1.01)
        v3.copy(nearPoint).project(camera)
        ndcX = v3.x
        ndcY = v3.y
        ndcZ = v3.z
      }
    }
    if (unstable) {
      dir.subVectors(world, camera.position)
      const len = dir.length()
      if (len >= 1e-6) {
        dir.multiplyScalar(1 / len)
        nearPoint.copy(camera.position).addScaledVector(dir, near * 1.01)
        v3.copy(nearPoint).project(camera)
        ndcX = v3.x
        ndcY = v3.y
        ndcZ = v3.z
      }
    }
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY) || !Number.isFinite(ndcZ)) continue
    const sx = (ndcX * 0.5 + 0.5) * w
    const sy = (-ndcY * 0.5 + 0.5) * h
    const sizeFactor =
      typeof args.threeIframeOverlaySizeScaleFactor === 'number' &&
      Number.isFinite(args.threeIframeOverlaySizeScaleFactor) &&
      args.threeIframeOverlaySizeScaleFactor > 0
        ? args.threeIframeOverlaySizeScaleFactor
        : 260
    const sizeScale = Math.max(0.001, Math.min(256, sizeFactor / Math.max(0.001, dist)))
    const opacity = labelDepthFadeEnabled ? Math.max(0.14, Math.min(1, 1 - Math.pow(dist / Math.max(1, maxDistance), 1.24))) : 1
    candidates.push({ id: node.id, sx, sy, dist, sizeScale, opacity })
  }

  candidates.sort((a, b) => a.dist - b.dist || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const nextVisibleIds = new Set<string>()
  candidateById.clear()
  for (let i = 0; i < candidates.length; i += 1) candidateById.set(candidates[i]!.id, candidates[i]!)
  const tryAdd = (id: string) => {
    if (nextVisibleIds.size >= maxCount) return
    if (!args.overlayEls.has(id) || !candidateById.has(id)) return
    nextVisibleIds.add(id)
  }
  for (const id of selectedIds) tryAdd(id)
  for (const id of args.prevVisibleIds) tryAdd(id)
  for (let i = 0; i < candidates.length && nextVisibleIds.size < maxCount; i += 1) {
    const c = candidates[i]!
    if (args.overlayEls.has(c.id) && !nextVisibleIds.has(c.id)) nextVisibleIds.add(c.id)
  }
  for (const id of args.prevVisibleIds) {
    if (nextVisibleIds.has(id)) continue
    const el = args.overlayEls.get(id)
    if (!el) continue
    const missCount = (args.missFrames.get(id) || 0) + 1
    if (missCount <= 10) {
      args.missFrames.set(id, missCount)
      continue
    }
    args.missFrames.delete(id)
    applyPanelBox(el, { left: -99999, top: -99999, w: 1, h: 1, display: 'block', zIndex: 1 })
  }
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i]!
    if (!nextVisibleIds.has(c.id)) continue
    args.missFrames.delete(c.id)
    const el = args.overlayEls.get(c.id)
    if (!el) continue
    applyEagerMediaLoading(el)
    const MAX_PANEL_PX = 2048
    const STEP_PX = 16
    const maxW = Math.max(2, Math.min(MAX_PANEL_PX, Math.floor(w - margin * 2)))
    const maxH = Math.max(2, Math.min(MAX_PANEL_PX, Math.floor(h - margin * 2)))
    let contentW = Math.min(MAX_PANEL_PX, Math.max(2, Math.round((baseW * c.sizeScale) / STEP_PX) * STEP_PX))
    let sizeScale = Math.max(0.001, contentW / Math.max(1, baseW))
    let computed = computeMediaPanelCssVars3d({ density, sizeScale })
    let panel = computePanelSizeFromContent16x9({ contentW, metrics: computed.metrics })
    if (panel.panelW > maxW || panel.panelH > maxH) {
      const ratio = Math.min(maxW / panel.panelW, maxH / panel.panelH)
      contentW = Math.min(MAX_PANEL_PX, Math.max(2, Math.round((contentW * ratio) / STEP_PX) * STEP_PX))
      sizeScale = Math.max(0.001, contentW / Math.max(1, baseW))
      computed = computeMediaPanelCssVars3d({ density, sizeScale })
      panel = computePanelSizeFromContent16x9({ contentW, metrics: computed.metrics })
    }
    const rect = computePanelRect({ cx: c.sx, cy: c.sy, w: panel.panelW, h: panel.panelH })
    applyMediaPanelCssVars(el, computed.vars)
    applyPanelBox(el, {
      left: Math.round(rect.left * 10) / 10,
      top: Math.round(rect.top * 10) / 10,
      w: panel.panelW,
      h: panel.panelH,
      zIndex: 2000 - Math.max(0, Math.min(1500, Math.floor(c.dist))),
      display: 'block',
    })
    try {
      el.style.opacity = String(c.opacity)
    } catch {
      void 0
    }
  }
  return nextVisibleIds
}

function applyEagerMediaLoading(el: HTMLElement) {
  try {
    const applied = (el as unknown as { dataset?: Record<string, string> }).dataset?.kgMediaEagerApplied
    if (applied) return
    for (const node of [el.querySelector('iframe'), el.querySelector('img')]) {
      if (!node) continue
      try {
        ;(node as unknown as { loading?: string }).loading = 'eager'
      } catch {
        void 0
      }
      try {
        node.setAttribute('loading', 'eager')
      } catch {
        void 0
      }
    }
    ;(el as unknown as { dataset?: Record<string, string> }).dataset!.kgMediaEagerApplied = '1'
  } catch {
    void 0
  }
}
