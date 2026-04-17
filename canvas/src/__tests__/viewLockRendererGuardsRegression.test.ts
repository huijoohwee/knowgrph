import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testViewLockCopyAndRendererGuardsStayConsistent() {
  const interactionPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'InteractionModeSelect.tsx')
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const flowEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const graphRootPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')
  const designPath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas.tsx')
  const minimapPath = resolve(process.cwd(), 'src', 'features', 'minimap', 'Minimap.tsx')
  const threeLayoutPath = resolve(process.cwd(), 'src', 'features', 'three', 'layout.ts')
  const canvasSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'canvasSlice.ts')
  const activeGraphDataPath = resolve(process.cwd(), 'src', 'hooks', 'useActiveGraphData.ts')
  const copyPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiCopy.ts')

  const interactionText = readFileSync(interactionPath, 'utf8')
  const flowCanvasText = readFileSync(flowCanvasPath, 'utf8')
  const flowEditorText = readFileSync(flowEditorPath, 'utf8')
  const graphRootText = readFileSync(graphRootPath, 'utf8')
  const designText = readFileSync(designPath, 'utf8')
  const minimapText = readFileSync(minimapPath, 'utf8')
  const threeLayoutText = readFileSync(threeLayoutPath, 'utf8')
  const canvasSliceText = readFileSync(canvasSlicePath, 'utf8')
  const activeGraphDataText = readFileSync(activeGraphDataPath, 'utf8')
  const copyText = readFileSync(copyPath, 'utf8')

  if (!interactionText.includes("documentStructureBaselineLock ? 'View Lock: ON' : 'View Lock: OFF'")) {
    throw new Error('expected Interaction menu lock option to be renamed to View Lock ON/OFF')
  }
  if (interactionText.includes("label: 'Mode switch: Lock'")) {
    throw new Error('unexpected legacy Mode switch label in Interaction menu')
  }
  if (!flowCanvasText.includes("const allowMutations = allowNodeDragOverride !== false && documentStructureBaselineLock !== true")) {
    throw new Error('expected Flow renderer to block drag mutations while View Lock is ON')
  }
  if (!flowEditorText.includes("const canEdit = active && !documentStructureBaselineLock")) {
    throw new Error('expected Flow Editor to disable edit mode while View Lock is ON')
  }
  if (!graphRootText.includes("allowNodeDrag: documentStructureBaselineLock !== true && schema?.behavior?.allowNodeDrag !== false")) {
    throw new Error('expected D3/Flowchart drag binding to honor View Lock state')
  }
  if ((designText.match(/snapshot\.documentStructureBaselineLock === true\) return/g) || []).length < 3) {
    throw new Error('expected Design renderer drag/resize entry points to guard on View Lock')
  }
  if (!copyText.includes('View Lock is ON. Turn it OFF to drag or edit graph elements.')) {
    throw new Error('expected View Lock toast copy to describe drag/edit gating')
  }
  const coupledFrontmatterGuard = /frontmatterModeEnabled:\s*[^,\n]*documentStructureBaselineLock/
  if (coupledFrontmatterGuard.test(flowCanvasText)) throw new Error('unexpected View Lock coupling in Flow renderer frontmatter view derivation')
  if (coupledFrontmatterGuard.test(flowEditorText)) throw new Error('unexpected View Lock coupling in Flow Editor frontmatter view derivation')
  if (coupledFrontmatterGuard.test(designText)) throw new Error('unexpected View Lock coupling in Design renderer frontmatter view derivation')
  if (coupledFrontmatterGuard.test(minimapText)) throw new Error('unexpected View Lock coupling in Minimap frontmatter layout derivation')
  if (coupledFrontmatterGuard.test(threeLayoutText)) throw new Error('unexpected View Lock coupling in 3D layout frontmatter derivation')
  if (coupledFrontmatterGuard.test(canvasSliceText)) throw new Error('unexpected View Lock coupling in canvas slice frontmatter cache keying')
  if (activeGraphDataText.includes('if (documentStructureBaselineLock === true) return')) {
    throw new Error('unexpected View Lock gate in active graph geometry derivation effect')
  }
}
