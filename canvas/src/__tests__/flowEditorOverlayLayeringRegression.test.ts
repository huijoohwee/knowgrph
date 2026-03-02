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
  const filePath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas.tsx')
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

