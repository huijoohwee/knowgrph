import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testRichMediaPanelEditorModeDisablesInteractiveContentForDragging() {
  const p = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("workspaceViewMode") || !text.includes("editorMode")) {
    throw new Error('expected RichMediaPanel to read workspaceViewMode to gate editor-mode drag behavior')
  }
  if (!text.includes("pointerEvents: editorMode ? 'none'")) {
    throw new Error('expected RichMediaPanel to disable media element pointerEvents in editor mode')
  }
  if (!text.includes('allowClickToOpenOverlay')) {
    throw new Error('expected RichMediaPanel to gate click-to-open overlay outside editor mode')
  }
}

export function testRichMediaPanelFlowEditorModifierWheelZoomKeepsInteractiveScroll() {
  const panelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const panelText = readFileSync(panelPath, 'utf8')
  if (!panelText.includes('const forwardModifierWheelZoomOnly = installWheelForwarding && flowEditorFrontmatterDocumentMode === true')) {
    throw new Error('expected RichMediaPanel to isolate explicit modifier-wheel zoom forwarding in Flow Editor frontmatter document mode')
  }
  if (!panelText.includes('shouldForwardWheel: forwardModifierWheelZoomOnly ? e => e.ctrlKey === true || e.metaKey === true : undefined')) {
    throw new Error('expected RichMediaPanel to forward only explicit ctrl/cmd wheel zoom while preserving normal panel scroll')
  }

  const wheelGuardsPath = resolve(process.cwd(), '..', 'grph-shared', 'src', 'dom', 'wheelGuards.ts')
  const wheelGuardsText = readFileSync(wheelGuardsPath, 'utf8')
  if (!wheelGuardsText.includes('shouldForwardWheel?: (e: WheelEvent) => boolean')) {
    throw new Error('expected shared wheel guards to accept a wheel-forwarding predicate')
  }
  if (!wheelGuardsText.includes('if (forwardTo && forwardAllowed)')) {
    throw new Error('expected shared wheel guards to gate forwarding through the shared predicate result')
  }
}
