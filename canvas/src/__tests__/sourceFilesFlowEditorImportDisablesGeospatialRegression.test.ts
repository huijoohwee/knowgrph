import fs from 'node:fs'
import path from 'node:path'

export const testSourceFilesWidgetRegistryImportDisablesGeospatialMode = () => {
  const workspaceActionPath = path.resolve(
    process.cwd(),
    'src',
    'features',
    'markdown-workspace',
    'useWorkspaceFileActions',
    'core.ts',
  )
  const workspaceText = fs.readFileSync(workspaceActionPath, 'utf8')
  const rendererIndex = workspaceText.indexOf("store.setCanvas2dRenderer('flowEditor')")
  const geoDisableIndex = workspaceText.indexOf('void setGeospatialModeEnabled(false).catch(() => void 0)')
  const viewModeIndex = workspaceText.indexOf("store.setWorkspaceViewMode('canvas')")
  if (rendererIndex < 0 || geoDisableIndex < 0 || viewModeIndex < 0) {
    throw new Error('Expected widget-registry import path to disable Geospatial Mode before switching to canvas Flow Editor view')
  }
  if (!(rendererIndex < geoDisableIndex && geoDisableIndex < viewModeIndex)) {
    throw new Error('Expected Geospatial Mode disable call to run after Flow Editor renderer selection and before canvas view switch')
  }
  const sourceInferApplyIndex = workspaceText.indexOf('const inferredApplyToGraph = shouldApplyImportedCanvasDocumentToGraph(')
  const sourceShouldApplyIndex = workspaceText.indexOf('const shouldApplyToGraph = opts?.applyToGraph === true || inferredApplyToGraph')
  if (sourceInferApplyIndex < 0 || sourceShouldApplyIndex < 0) {
    throw new Error('Expected Source Files sync path to infer apply-to-graph for frontmatter and flow markdown documents')
  }
  if (sourceInferApplyIndex > sourceShouldApplyIndex) {
    throw new Error('Expected Source Files apply-to-graph inference to be computed before apply-to-graph resolution')
  }

  const documentActionPath = path.resolve(
    process.cwd(),
    'src',
    'hooks',
    'store',
    'graph-data-slice',
    'graphDataDocumentActions.ts',
  )
  const documentActionText = fs.readFileSync(documentActionPath, 'utf8')
  const strictPresetIndex = documentActionText.indexOf('if (strictFlowEditorPreset) {')
  const strictRendererIndex = documentActionText.indexOf("nextState.setCanvas2dRenderer('flowEditor')")
  const strictGeoDisableIndex = documentActionText.indexOf('void setGeospatialModeEnabled(false).catch(() => void 0)')
  if (strictPresetIndex < 0 || strictRendererIndex < 0 || strictGeoDisableIndex < 0) {
    throw new Error('Expected strict Flow Editor frontmatter import path to disable Geospatial Mode for Source Files selections')
  }
  if (!(strictPresetIndex < strictRendererIndex && strictRendererIndex < strictGeoDisableIndex)) {
    throw new Error('Expected strict Flow Editor preset path to disable Geospatial Mode immediately after renderer selection')
  }
}
