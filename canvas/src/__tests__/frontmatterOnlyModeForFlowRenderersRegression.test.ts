import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasRemainsFrontmatterOnlyButFlowEditorIsStandalone() {
  const modeSelectPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'DocumentModeSelect.tsx')
  const uiSettingsSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'uiSettingsSlice.ts')
  const canvasSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'canvasSlice.ts')
  const canvasViewActionsPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'canvasViewActions.ts')
  const renderConfigPath = resolve(process.cwd(), 'src', 'lib', 'config.render.ts')

  const modeSelectText = readFileSync(modeSelectPath, 'utf8')
  const uiSettingsSliceText = readFileSync(uiSettingsSlicePath, 'utf8')
  const canvasSliceText = readFileSync(canvasSlicePath, 'utf8')
  const canvasViewActionsText = readFileSync(canvasViewActionsPath, 'utf8')
  const renderConfigText = readFileSync(renderConfigPath, 'utf8')

  if (!renderConfigText.includes('isFrontmatterOnlyCanvas2dRenderer')) {
    throw new Error('expected shared renderer helper to identify frontmatter-only renderers')
  }
  if (!renderConfigText.includes("return id === 'flow'")) {
    throw new Error('expected only Flow Canvas to remain frontmatter-only')
  }
  if (!modeSelectText.includes('isFrontmatterOnlyPolicyActive')) {
    throw new Error('expected document mode selector to use centralized frontmatter-only policy helper')
  }
  if (!modeSelectText.includes('disabled: frontmatterOnlyAllowed')) {
    throw new Error('expected only frontmatter-only renderer mode options to be disabled')
  }
  if (!uiSettingsSliceText.includes('isFrontmatterOnlyPolicyActive')) {
    throw new Error('expected semantic-mode store setter to block keyword mode only for frontmatter-only renderer')
  }
  if (!canvasSliceText.includes('isFrontmatterOnlyPolicyActive')) {
    throw new Error('expected renderer switch logic to enforce frontmatter-only state only for the frontmatter-only renderer')
  }
  if (!canvasSliceText.includes('nextFrontmatterModeEnabled = enforceFrontmatterOnly ? true')) {
    throw new Error('expected frontmatter-only renderer switch to auto-enable frontmatter mode')
  }
  if (!canvasViewActionsText.includes('isFrontmatterOnlyCanvas2dRenderer(nextRenderer)')) {
    throw new Error('expected canvas view actions to use the shared frontmatter-only renderer helper for renderer switches')
  }
}

export function testFlowEditorStandaloneIgnoresDocumentModeAndYamlCoupling() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const flowEditorCanvasText = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!flowEditorCanvasText.includes('const flowEditorViewActive = active')) {
    throw new Error('expected FlowEditor view activation to stay standalone and renderer-scoped')
  }
  if (!flowEditorCanvasText.includes('const canEdit = active && !documentStructureBaselineLock')) {
    throw new Error('expected FlowEditor editability to be gated only by active state and View Lock')
  }
  if (flowEditorCanvasText.includes('extractYamlFrontmatterBlock')) {
    throw new Error('expected FlowEditor standalone path to avoid markdown YAML-frontmatter coupling')
  }
  if (flowEditorCanvasText.includes('flowEditorYamlFrontmatterRequiredToast')) {
    throw new Error('expected FlowEditor standalone path to avoid frontmatter requirement toasts')
  }
}

export function testCanvasViewRendererSwitchToFlowEditorDoesNotForceDocumentModes() {
  const canvasViewActionsPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'canvasViewActions.ts')
  const text = readFileSync(canvasViewActionsPath, 'utf8')
  if (!text.includes('isFrontmatterOnlyCanvas2dRenderer(nextRenderer)')) {
    throw new Error('expected canvas view renderer switch to detect only frontmatter-only renderer')
  }
  if (text.includes("nextRenderer === 'flowEditor'") && text.includes("setDocumentSemanticMode('document')")) {
    throw new Error('expected Flow Editor renderer switch to avoid forcing document semantic mode')
  }
  if (!text.includes('const frontmatterOnlyAllowed = isFrontmatterOnlyPolicyActive({ canvasRenderMode, canvas2dRenderer })')) {
    throw new Error('expected canvas view actions to compute frontmatter-only guard from centralized policy helper')
  }
  if (!text.includes("if (geospatialEnabled || frontmatterOnlyAllowed) return")) {
    throw new Error('expected canvas view actions to block keyword/table document modes only when geospatial or frontmatter-only renderer is active')
  }
  if (!text.includes("if (geospatialEnabled) return")) {
    throw new Error('expected canvas view actions to block document-mode mutations while geospatial mode is active')
  }
}
