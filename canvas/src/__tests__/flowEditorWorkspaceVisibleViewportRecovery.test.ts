import fs from 'node:fs'
import path from 'node:path'
import {
  buildFlowOverlayBoundsFromRects,
  buildWorkspaceVisibleViewportFitRecoveryKey,
  computeWorkspaceOverlayVisibleViewportFitTransform,
  deriveFlowOverlayCollectiveViewportState,
  type FlowOverlayBounds,
  type FlowTransformLike,
  type VisibleFlowViewport,
} from '@/components/FlowCanvas/workspaceVisibleViewportRecovery'

const build = (codes: number[]): string => String.fromCharCode(...codes)

const projectBounds = (
  bounds: FlowOverlayBounds,
  current: FlowTransformLike,
  next: FlowTransformLike,
): FlowOverlayBounds => {
  const safeBaseK = Number.isFinite(current.k) && current.k > 0 ? current.k : 1
  const appliedScale = next.k / safeBaseK
  return {
    minX: next.x + (bounds.minX - current.x) * appliedScale,
    maxX: next.x + (bounds.maxX - current.x) * appliedScale,
    minY: next.y + (bounds.minY - current.y) * appliedScale,
    maxY: next.y + (bounds.maxY - current.y) * appliedScale,
    width: Math.max(1, bounds.width * appliedScale),
    height: Math.max(1, bounds.height * appliedScale),
    ids: bounds.ids,
  }
}

export function testFlowEditorWorkspaceRecoveryRejectsHugeCenteredCollective() {
  const visibleViewport: VisibleFlowViewport = {
    left: 440,
    top: 0,
    right: 860,
    bottom: 800,
    width: 420,
    height: 800,
    centerX: 650,
    centerY: 400,
  }
  const bounds: FlowOverlayBounds = {
    minX: 220,
    maxX: 1080,
    minY: -460,
    maxY: 1260,
    width: 860,
    height: 1720,
    ids: ['text-output', 'image-output', 'video-output', 'rich-media-panel'],
  }

  const state = deriveFlowOverlayCollectiveViewportState({ bounds, visibleViewport })
  if (!state) throw new Error('expected collective state')
  if (state.fitsVisibleViewport || state.centered || state.balanced) {
    throw new Error('expected huge centered-looking collective to require bounded visible-viewport recovery')
  }
}

export function testFlowEditorWorkspaceRecoveryBuildsSharedCollectiveBoundsFromRects() {
  const visibleViewport: VisibleFlowViewport = {
    left: 0,
    top: 0,
    right: 1000,
    bottom: 800,
    width: 1000,
    height: 800,
    centerX: 500,
    centerY: 400,
  }
  const bounds = buildFlowOverlayBoundsFromRects({
    items: [
      { id: 'a', left: 300, top: 280, width: 120, height: 160 },
      { id: 'b', left: 460, top: 280, width: 120, height: 160 },
      { id: 'c', left: 620, top: 280, width: 120, height: 160 },
    ],
  })
  if (!bounds) throw new Error('expected shared collective bounds from rects')
  if (bounds.minX !== 300 || bounds.maxX !== 740 || bounds.minY !== 280 || bounds.maxY !== 440) {
    throw new Error(`expected precise aggregate bounds, got ${JSON.stringify(bounds)}`)
  }
  if ((bounds.ids || []).join(',') !== 'a,b,c') {
    throw new Error('expected shared bounds helper to preserve semantic ids')
  }
  const state = deriveFlowOverlayCollectiveViewportState({ bounds, visibleViewport })
  if (!state?.visible || !state.centered || !state.balanced) {
    throw new Error('expected shared rect bounds to score as visible centered balanced')
  }
}

export function testFlowEditorWorkspaceRecoveryFitsGenericOverlayBoundsIntoVisibleViewport() {
  const visibleViewport: VisibleFlowViewport = {
    left: 440,
    top: 0,
    right: 860,
    bottom: 800,
    width: 420,
    height: 800,
    centerX: 650,
    centerY: 400,
  }
  const current: FlowTransformLike = { x: 97, y: 309, k: 0.178 }
  const bounds: FlowOverlayBounds = {
    minX: 5014,
    maxX: 5314,
    minY: 10352,
    maxY: 10852,
    width: 300,
    height: 500,
    ids: ['text-widget', 'image-widget', 'video-widget', 'rich-media-panel'],
  }

  const next = computeWorkspaceOverlayVisibleViewportFitTransform({
    current,
    overlayBounds: bounds,
    visibleViewport,
    scaleExtent: [0.000001, 24],
  })
  if (!next) throw new Error('expected fit transform')
  if (Math.abs(next.k - current.k) > 0.000001) {
    throw new Error(`expected screen-space workspace recovery to preserve current zoom scale, got ${next.k}`)
  }
  const projected = projectBounds(bounds, current, next)
  if (projected.minX < visibleViewport.left - 1 || projected.maxX > visibleViewport.right + 1) {
    throw new Error(`expected recovered overlay bounds to fit horizontally, got ${projected.minX}..${projected.maxX}`)
  }
  if (projected.minY < visibleViewport.top - 1 || projected.maxY > visibleViewport.bottom + 1) {
    throw new Error(`expected recovered overlay bounds to fit vertically, got ${projected.minY}..${projected.maxY}`)
  }
}

export function testFlowEditorWorkspaceRecoveryUsesSemanticKeyAndForbidsDocumentHardcodes() {
  const keyA = buildWorkspaceVisibleViewportFitRecoveryKey({
    zoomViewKey: 'graph-a',
    visibleViewport: { left: 440, top: 0, width: 420, height: 800 },
    overlayBounds: { ids: ['video', 'text', 'image'] },
  })
  const keyB = buildWorkspaceVisibleViewportFitRecoveryKey({
    zoomViewKey: 'graph-a',
    visibleViewport: { left: 441, top: 0, width: 420, height: 800 },
    overlayBounds: { ids: ['video', 'text', 'image'] },
  })
  if (!keyA || !keyB || keyA === keyB) {
    throw new Error('expected visible-viewport fit recovery key to be semantic and viewport-sensitive')
  }
  const keyC = buildWorkspaceVisibleViewportFitRecoveryKey({
    zoomViewKey: 'graph-a',
    visibleViewport: { left: 440, top: 0, width: 420, height: 800 },
    overlayBounds: {
      minX: 355,
      maxX: 517,
      minY: 376,
      maxY: 646,
      width: 162,
      height: 270,
      ids: ['video', 'text', 'image'],
    },
  })
  const keyD = buildWorkspaceVisibleViewportFitRecoveryKey({
    zoomViewKey: 'graph-a',
    visibleViewport: { left: 440, top: 0, width: 420, height: 800 },
    overlayBounds: {
      minX: 936,
      maxX: 1398,
      minY: 240,
      maxY: 690,
      width: 462,
      height: 450,
      ids: ['video', 'text', 'image'],
    },
  })
  if (!keyC || !keyD || keyC === keyD) {
    throw new Error('expected visible-viewport fit recovery key to include settled overlay bounds so early workspace-open fits cannot block corrective recovery')
  }

  const proxyText = fs.readFileSync(
    path.resolve(process.cwd(), 'src', 'lib', 'canvas', 'flow-editor-overlay-proxy.ts'),
    'utf8',
  )
  if (!proxyText.includes('overlayRoot.closest(`[${FLOW_EDITOR_OVERLAY_SURFACE_ATTR}]`)')) {
    throw new Error('expected Flow Editor overlay surface-id resolution to inherit the nearest surface id for rich media descendants')
  }
  const zoomFitText = fs.readFileSync(
    path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'applyZoomRequestNative.ts'),
    'utf8',
  )
  if (!zoomFitText.includes('const queryRoot: ParentNode = document')
    || !zoomFitText.includes('Flow Editor overlays are portal-mounted fixed elements')) {
    throw new Error('expected Flow Editor visible-viewport recovery to collect portal-mounted overlays by surface id instead of surface-root ancestry')
  }

  const forbidden = [
    build([107, 110, 111, 119, 103, 114, 112, 104, 45, 116, 111, 107, 101, 110, 45, 101, 99, 111, 110, 111, 109, 105, 99, 115, 45, 109, 111, 100, 101, 108, 45, 100, 101, 109, 111, 46, 109, 100]),
    build([47, 85, 115, 101, 114, 115, 47]),
    build([104, 117, 105, 106, 111, 111, 104, 119, 101, 101, 47, 100, 111, 99, 115]),
  ]
  const files = [
    path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasRuntime.ts'),
    path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'workspaceVisibleViewportRecovery.ts'),
    path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts'),
    path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx'),
    path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts'),
    path.resolve(process.cwd(), 'src', '__tests__', 'flowEditorOverlayOffscreenRecoveryRegression.test.ts'),
    path.resolve(process.cwd(), 'src', '__tests__', 'flowEditorWorkspaceVisibleViewportRecovery.test.ts'),
  ]

  for (let i = 0; i < files.length; i += 1) {
    const text = fs.readFileSync(files[i]!, 'utf8')
    const hit = forbidden.find(fragment => text.includes(fragment))
    if (hit) {
      throw new Error(`expected Flow Editor workspace recovery validation to avoid document/path hardcodes in ${path.relative(process.cwd(), files[i]!)}`)
    }
  }
}
