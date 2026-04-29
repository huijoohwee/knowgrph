import fs from 'node:fs'
import path from 'node:path'

export function testFlowEditorOverlaysDoNotUseFloatingPanelZIndex() {
  const filePath = path.resolve(process.cwd(), 'src/components/FlowEditor/NodeOverlayEditor.tsx')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (text.includes('floatingPanelZIndex') || text.includes('Z_INDEX_FLOATING_PANEL_DEFAULT')) {
    throw new Error('Expected Flow Editor node overlays to not derive z-index from floating panel z-index')
  }
  if (!text.includes('FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_BASE') || !text.includes('FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_SELECTED')) {
    throw new Error('Expected Flow Editor node overlays to use bounded z-index constants')
  }
}

export function testFlowEditorOverlaySvgIsBoundedBelowToolbar() {
  const filePath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface.tsx')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (text.includes('Z_INDEX_FLOATING_PANEL_DEFAULT) - 100') || text.includes('floatingPanelZIndex') && text.includes('- 100')) {
    throw new Error('Expected Flow Editor overlay-only SVG to avoid floating-panel-derived z-index')
  }
  if (!text.includes('zIndex: 120')) {
    throw new Error('Expected Flow Editor overlay-only SVG to use a bounded z-index')
  }
}

export function testFlowEditorOverlayModeStillRendersGroups() {
  const filePath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface.tsx')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (text.includes('renderGroups={props.overlayOnlyActive ? false : true}')) {
    throw new Error('Expected Flow Editor group rendering to stay independent from overlay-only node rendering')
  }
  if (!text.includes('renderGroups={!props.geospatialWidgetPanelMode}')) {
    throw new Error('Expected Flow Editor groups to stay enabled outside geospatial widget-panel mode')
  }
}

export function testFlowEditorOverlayOnlyModeDoesNotBlankCanvasWhenNoOverlaysOpen() {
  const surfacePath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface.tsx')
  const overlaySurfacePath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas/runtime/useFlowEditorOverlaySurface.tsx')
  let surfaceText = ''
  let overlaySurfaceText = ''
  try {
    surfaceText = fs.readFileSync(surfacePath, { encoding: 'utf8' })
    overlaySurfaceText = fs.readFileSync(overlaySurfacePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${surfacePath} and ${overlaySurfacePath}`)
  }
  if (!overlaySurfaceText.includes('const overlayOnlyActive =')) {
    throw new Error('Expected Flow Editor overlay-only rendering to be gated by whether overlays exist')
  }
  if (!overlaySurfaceText.includes('hasOverlayEditors || Boolean(args.geospatialWidgetPanelMode)')) {
    throw new Error('Expected Flow Editor overlay-only mode to require visible overlays or geospatial panel mode')
  }
  if (!surfaceText.includes('renderEdges={!props.overlayOnlyActive}')) {
    throw new Error('Expected Flow Editor to keep canvas edges visible when no overlays are open')
  }
  if (!surfaceText.includes('renderNodes={!props.overlayOnlyActive}')) {
    throw new Error('Expected Flow Editor to keep canvas nodes visible when no overlays are open')
  }
  if (!surfaceText.includes('{props.overlayOnlyActive && (')) {
    throw new Error('Expected overlay-only SVG edges layer to be gated by overlayOnlyActive')
  }
}

export function testWorkspacePanesOutrankFlowEditorOverlays() {
  const filePath = path.resolve(process.cwd(), 'src/pages/Canvas.tsx')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (!text.includes('Workspace Toolbar Header') || !text.includes('z-[300]')) {
    throw new Error('Expected workspace header and panes to be elevated above canvas overlays in split views')
  }
}
