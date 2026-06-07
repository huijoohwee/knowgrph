import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { filterGraphCanvasViewportFitNodes } from '@/components/GraphCanvas/viewportFitNodes'
import {
  resolveWorkspaceVisibleViewportFromOccluders,
  WORKSPACE_VISIBLE_VIEWPORT_OCCLUDER_ATTR,
} from '@/lib/zoom/workspaceVisibleViewport'
import type { GraphNode } from '@/lib/graph/types'

const node = (id: string): GraphNode => ({
  id,
  label: id,
  type: 'Entity',
  x: 0,
  y: 0,
  properties: {},
})

export function testWorkspaceVisibleViewportSubtractsLeftOccluderForD3Fit() {
  const viewport = resolveWorkspaceVisibleViewportFromOccluders({
    viewportW: 937,
    viewportH: 962,
    workspaceEditorOverlayOpen: true,
    surfaceRect: { left: 0, top: 0, right: 937, bottom: 962, width: 937, height: 962 },
    occluderRects: [
      { left: 0, top: 0, right: 568, bottom: 962, width: 568, height: 962 },
    ],
  })

  if (viewport.left !== 568 || viewport.right !== 937 || viewport.width !== 369) {
    throw new Error(`expected workspace visible viewport to start after left occluder, got ${JSON.stringify(viewport)}`)
  }
  if (viewport.centerX !== 752.5 || viewport.centerY !== 481) {
    throw new Error(`expected D3 fit target to use unobscured canvas centroid, got ${viewport.centerX},${viewport.centerY}`)
  }
}

export function testWorkspaceVisibleViewportFallsBackWhenCanvasIsFullyOccluded() {
  const viewport = resolveWorkspaceVisibleViewportFromOccluders({
    viewportW: 937,
    viewportH: 962,
    workspaceEditorOverlayOpen: true,
    surfaceRect: { left: 0, top: 0, right: 937, bottom: 962, width: 937, height: 962 },
    occluderRects: [
      { left: 0, top: 0, right: 937, bottom: 962, width: 937, height: 962 },
    ],
  })

  if (viewport.left !== 0 || viewport.width !== 937 || viewport.centerX !== 468.5) {
    throw new Error(`expected fully occluded canvas to keep the stable full viewport fallback, got ${JSON.stringify(viewport)}`)
  }
}

export function testGraphCanvasViewportFitNodesKeepsVisibleMediaOverlayNodes() {
  const nodes = [node('visible-a'), node('panel-only'), node('visible-b'), node('media-overlay')]
  const filtered = filterGraphCanvasViewportFitNodes({
    nodes,
    panelOnlyNodeIdSet: new Set(['panel-only']),
    mediaOverlayNodeIdSet: new Set(['media-overlay']),
  })
  const ids = filtered.map(n => n.id).join(',')
  if (ids !== 'visible-a,visible-b,media-overlay') {
    throw new Error(`expected D3 viewport fit to keep visible rich-media overlay anchors while excluding panel-only nodes, got ${ids}`)
  }
}

export function testD3WorkspaceVisibleViewportFitUsesSharedOccluderContract() {
  const sceneText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'scene.ts'),
    'utf8',
  )
  const canvasText = readFileSync(
    resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx'),
    'utf8',
  )
  const d3PresentationUpdatesText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3PresentationUpdates2d.ts'),
    'utf8',
  )
  const richMediaOverlaysText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useRichMediaOverlays2d.ts'),
    'utf8',
  )
  const markdownDesignOverlayText = readFileSync(
    resolve(process.cwd(), 'src', 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx'),
    'utf8',
  )
  const markdownPanelOverlayLoopText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'markdown-edgeless', 'markdownPanelOverlayLoop2d.ts'),
    'utf8',
  )
  const helperText = readFileSync(
    resolve(process.cwd(), 'src', 'lib', 'zoom', 'workspaceVisibleViewport.ts'),
    'utf8',
  )

  if (!sceneText.includes("import { resolveWorkspaceVisibleViewport } from '@/lib/zoom/workspaceVisibleViewport'")) {
    throw new Error('expected D3 scene fit to reuse the shared workspace visible viewport resolver')
  }
  if (!sceneText.includes('const displayNodesForViewportFit = filterGraphCanvasViewportFitNodes({')) {
    throw new Error('expected D3 scene fit fallback to exclude panel-only nodes before the node layer mounts')
  }
  if (!sceneText.includes('surfaceElement: svgEl,')) {
    throw new Error('expected D3 scene fit to resolve workspace occlusion against the active SVG surface')
  }
  if (!sceneText.includes('Math.max(1, visibleViewport.width),') || !sceneText.includes('Math.max(1, Math.floor(visibleViewport.height)),')) {
    throw new Error('expected D3 fit scale to use the unobscured visible viewport dimensions')
  }
  if (!sceneText.includes('return { k, x: x + visibleViewport.left, y: y + visibleViewport.top }')) {
    throw new Error('expected D3 fit transform to offset the visible-viewport-local transform back into SVG coordinates')
  }
  if (!sceneText.includes('const overlayFitViewport = readVisibleViewportFitFrame()')
    || !sceneText.includes('viewportW: Math.max(1, Math.floor(overlayFitViewport.width)),')
    || !sceneText.includes('viewportH: Math.max(1, Math.floor(overlayFitViewport.height)),')) {
    throw new Error('expected D3 overlay collision extents to size against the same visible viewport as collective fit')
  }
  if (!d3PresentationUpdatesText.includes('resolveWorkspaceVisibleViewport({')
    || !d3PresentationUpdatesText.includes('viewportW: Math.max(1, Math.floor(visibleViewport.width)),')
    || !d3PresentationUpdatesText.includes('viewportH: Math.max(1, Math.floor(visibleViewport.height)),')) {
    throw new Error('expected D3 presentation updates to size rich-media overlay collision extents against the visible viewport')
  }
  if (!richMediaOverlaysText.includes('const readVisibleOverlayLayoutViewport = useCallback(() => {')
    || !richMediaOverlaysText.includes('readLayoutViewport: readVisibleOverlayLayoutViewport,')) {
    throw new Error('expected D3 rich-media overlay layout to reuse the visible viewport for collective spread and sizing')
  }
  if (!markdownDesignOverlayText.includes("import { resolveWorkspaceVisibleViewport } from '@/lib/zoom/workspaceVisibleViewport'")
    || !markdownDesignOverlayText.includes('const readVisibleOverlayViewport = React.useCallback(() => {')
    || !markdownDesignOverlayText.includes('getViewport: readVisibleOverlayViewport,')
    || !markdownDesignOverlayText.includes('collectiveFitToViewport: false,')
    || !markdownDesignOverlayText.includes('clampToViewport: null,')) {
    throw new Error('expected D3 markdown design panels to use the visible viewport for sizing while staying node-aligned and unclamped')
  }
  if (!markdownPanelOverlayLoopText.includes('getViewport: () => { left?: number; top?: number; w: number; h: number }')
    || !markdownPanelOverlayLoopText.includes('collectiveFitToViewport?: boolean')
    || !markdownPanelOverlayLoopText.includes('left: viewportLeft,')
    || !markdownPanelOverlayLoopText.includes('top: viewportTop,')) {
    throw new Error('expected markdown panel overlay loop to keep explicit origin-aware viewport support for callers that opt into clamping')
  }
  if (!canvasText.includes('WORKSPACE_VISIBLE_VIEWPORT_OCCLUDER_ATTR') || !canvasText.includes(`[WORKSPACE_VISIBLE_VIEWPORT_OCCLUDER_ATTR]: 'left'`)) {
    throw new Error('expected Workspace left pane to declare the shared visible-viewport occluder attribute')
  }
  if (!helperText.includes(WORKSPACE_VISIBLE_VIEWPORT_OCCLUDER_ATTR)) {
    throw new Error('expected helper to own the visible-viewport occluder attribute')
  }
  if (helperText.includes('kg-markdown-workspace') || helperText.includes('data-kg-workspace-left-pane')) {
    throw new Error('expected visible viewport resolver to avoid Markdown-workspace class or legacy left-pane hardcodes')
  }
}
