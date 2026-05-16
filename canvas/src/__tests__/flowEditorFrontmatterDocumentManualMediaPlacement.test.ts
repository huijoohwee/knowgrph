import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterDocumentUsesManualMediaPlacement() {
  const flowCanvasMediaOverlaysPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const layoutLoopPath = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const overlaysText = readFileSync(flowCanvasMediaOverlaysPath, 'utf8')
  const loopText = readFileSync(layoutLoopPath, 'utf8')

  if (!overlaysText.includes('manualPlacement: flowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas media overlays to enable manual placement in Flow Editor frontmatter document mode')
  }
  if (!overlaysText.includes('const stopPassiveLayoutWhileWorkspaceOverlayOpen =\n      workspaceOverlayOpenRef.current && !flowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas media overlays to keep passive layout active for frontmatter document mode while workspace mutation blocking is open')
  }
  if (!overlaysText.includes('if (!active || mediaLayoutItems.length === 0 || stopPassiveLayoutWhileWorkspaceOverlayOpen)')) {
    throw new Error('expected FlowCanvas media overlay loop shutdown to exempt frontmatter document mode from workspace-open passive-layout parking')
  }
  if (!loopText.includes('manualPlacement?: boolean')) {
    throw new Error('expected shared media overlay layout loop to expose a manual placement contract')
  }
  if (!loopText.includes('const manualPlacement = args.manualPlacement === true')) {
    throw new Error('expected shared media overlay layout loop to read manual placement mode')
  }
  if (!loopText.includes('const collisionEnabled = args.collision?.enabled !== false')) {
    throw new Error('expected shared media overlay layout loop to keep collision enablement gated by collision config')
  }
}
