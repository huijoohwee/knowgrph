import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterWorkspaceBlockedRichMediaLayoutStaysLive() {
  const overlaysPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const panelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(overlaysPath, 'utf8')
  const panelText = readFileSync(panelPath, 'utf8')

  if (!text.includes('const stopPassiveLayoutWhileWorkspaceOverlayOpen =\n      workspaceOverlayOpenRef.current && !flowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas media overlays to derive a frontmatter-aware passive layout exception while workspace mutation blocking is open')
  }
  if (!text.includes('if (stopPassiveLayoutWhileWorkspaceOverlayOpen) return')) {
    throw new Error('expected passive Rich Media layout scheduling to stay active for frontmatter document mode while workspace mutation blocking is open')
  }
  if (!text.includes('if (!active || mediaLayoutItems.length === 0 || stopPassiveLayoutWhileWorkspaceOverlayOpen)')) {
    throw new Error('expected Rich Media layout loop shutdown to exempt frontmatter document mode from workspace-open passive-layout parking')
  }
  if (!text.includes("style={{ position: 'absolute' }}")) {
    throw new Error('expected FlowCanvas rich media overlays to force absolute positioning so passive layout transforms do not stack in normal document flow')
  }
  if (!panelText.includes("position: flowEditorInteractionMode ? 'absolute' : 'relative'")) {
    throw new Error('expected shared Rich Media Panel root positioning to switch to absolute in Flow Editor interaction mode so passive layout transforms map directly to overlay boxes')
  }
  if (!panelText.includes("const bodySurfaceStyle: React.CSSProperties = {\n    ...PANEL_FRAME_BODY_STYLE,\n    position: flowEditorInteractionMode ? 'absolute' : 'relative',")) {
    throw new Error('expected shared Rich Media Panel merged body surface styles to preserve absolute positioning in Flow Editor interaction mode')
  }
  if (!text.includes('const overlayInteractionEnabled = flowEditorOverlayInteractionMode && !workspaceOverlayOpen')) {
    throw new Error('expected Rich Media overlay interactions to remain disabled while workspace mutation blocking is open')
  }
  if (!text.includes('if (!flowEditorOverlayInteractionMode || workspaceOverlayOpenRef.current) return')) {
    throw new Error('expected Rich Media runtime position writes to stay blocked while workspace mutation blocking is open')
  }
}
