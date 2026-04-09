import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowRenderersDisableKeywordSelectionAndForceFrontmatterMode() {
  const modeSelectPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'DocumentModeSelect.tsx')
  const uiSettingsSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'uiSettingsSlice.ts')
  const canvasSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'canvasSlice.ts')
  const renderConfigPath = resolve(process.cwd(), 'src', 'lib', 'config.render.ts')

  const modeSelectText = readFileSync(modeSelectPath, 'utf8')
  const uiSettingsSliceText = readFileSync(uiSettingsSlicePath, 'utf8')
  const canvasSliceText = readFileSync(canvasSlicePath, 'utf8')
  const renderConfigText = readFileSync(renderConfigPath, 'utf8')

  if (!renderConfigText.includes('isFlowCanvas2dRenderer')) {
    throw new Error('expected shared renderer helper to identify Flow/Flow Editor renderers')
  }
  if (!modeSelectText.includes('frontmatterOnlyAllowed')) {
    throw new Error('expected document mode selector to gate mode options under flow/frontmatter-only behavior')
  }
  if (!modeSelectText.includes("setDocumentSemanticMode('document')")) {
    throw new Error('expected document mode selector to coerce to document semantic mode in frontmatter-only flow renderers')
  }
  if (!modeSelectText.includes('disabled: frontmatterOnlyAllowed')) {
    throw new Error('expected keyword/document/table mode options to be disabled in flow/frontmatter-only mode')
  }
  if (!uiSettingsSliceText.includes('keywordBlockedForRenderer')) {
    throw new Error('expected semantic-mode store setter to block keyword mode under flow/frontmatter-only renderers')
  }
  if (!canvasSliceText.includes('enforceFrontmatterOnly')) {
    throw new Error('expected renderer switch logic to enforce frontmatter-only state for flow renderers')
  }
  if (!canvasSliceText.includes('nextFrontmatterModeEnabled = enforceFrontmatterOnly ? true')) {
    throw new Error('expected renderer switch logic to auto-enable frontmatter mode for flow renderers')
  }
}
