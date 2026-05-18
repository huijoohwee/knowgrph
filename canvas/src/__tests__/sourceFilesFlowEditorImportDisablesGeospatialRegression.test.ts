import fs from 'node:fs'
import path from 'node:path'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyCanvasWorkspacePresetForSwitch } from '@/lib/markdown-workspace-runtime/workspaceSwitchPreset'

export const testCanvasWorkspacePresetForSwitchClearsStaleBaselineLock = () => {
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setCanvasRenderMode('2d')
  useGraphStore.getState().setCanvas3dMode('3d')
  useGraphStore.getState().setDocumentStructureBaselineLock(true)

  const changed = applyCanvasWorkspacePresetForSwitch({
    text: [
      '---',
      'title: "XR Surface Preset"',
      'kgCanvasSurfaceMode: "3d"',
      'kgCanvas3dMode: "xr"',
      '---',
      '',
      '# XR Surface Preset',
    ].join('\n'),
  })

  const state = useGraphStore.getState()
  if (changed !== true) throw new Error('expected workspace switch preset to apply explicit XR canvas frontmatter')
  if (state.documentStructureBaselineLock !== false) {
    throw new Error('expected explicit XR canvas frontmatter to clear stale baseline lock')
  }
  if (state.canvasRenderMode !== '3d') {
    throw new Error(`expected explicit XR canvas frontmatter to switch to 3d, got ${String(state.canvasRenderMode)}`)
  }
  if (state.canvas3dMode !== 'xr') {
    throw new Error(`expected explicit XR canvas frontmatter to switch to XR mode, got ${String(state.canvas3dMode)}`)
  }
}

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
  const sourceShouldApplyIndex = workspaceText.indexOf('const shouldApplyToGraph =')
  const sourcePolicyIndex = workspaceText.indexOf('shouldApplyImportedCanvasDocumentToGraph({ path: docKey || String(path || \'\'), text: content })')
  if (sourceShouldApplyIndex < 0 || sourcePolicyIndex < 0) {
    throw new Error('Expected Source Files sync path to infer apply-to-graph for frontmatter and flow markdown documents')
  }
  if (sourceShouldApplyIndex > sourcePolicyIndex) {
    throw new Error('Expected Source Files apply-to-graph policy to stay in the shared graph-apply resolution')
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
  if (documentActionText.includes("nextState.setCanvas2dRenderer('flowEditor')")
    || documentActionText.includes('void setGeospatialModeEnabled(false).catch(() => void 0)')) {
    throw new Error('Expected active markdown graph apply to avoid stale Flow Editor-only geospatial patches')
  }

  const presetPath = path.resolve(process.cwd(), 'src', 'features', 'parsers', 'canvasFrontmatterPreset.ts')
  const presetText = fs.readFileSync(presetPath, 'utf8')
  if (!presetText.includes('function disableGeospatialForDocumentPreset(): void')
    || !presetText.includes('readGeospatialOverlayEnabledPreferenceRaw()')
    || !presetText.includes("(!raw || raw === '0' || raw === 'false')")
    || !presetText.includes('void setGeospatialModeEnabled(false).catch(() => void 0)')) {
    throw new Error('Expected shared canvas frontmatter preset application to disable Geospatial Mode without repeated no-op toggles')
  }

  const seedScriptPath = path.resolve(process.cwd(), '..', 'scripts', 'seed-storage-docs-to-cloudflare.mjs')
  const seedScriptText = fs.readFileSync(seedScriptPath, 'utf8')
  if (!seedScriptText.includes("SUPPORTED_DOCS_FILE_EXTENSIONS = new Set(['.md', '.gltf', '.glb'])")
    || !seedScriptText.includes("docType: ext === '.gltf' ? 'gltf' : 'markdown'")
    || !seedScriptText.includes("docType: 'glb'")) {
    throw new Error('Expected D1 docs seeding to include Markdown, GLTF, and GLB source files')
  }

  const workspaceSeedProviderPath = path.resolve(process.cwd(), 'src', 'features', 'workspace-fs', 'workspaceSeedProvider.ts')
  const workspaceSeedProviderText = fs.readFileSync(workspaceSeedProviderPath, 'utf8')
  if (!workspaceSeedProviderText.includes("WORKSPACE_SOURCE_MIRROR_EXT_SET = new Set(['.md', '.markdown', '.mdx', '.mmd', '.gltf', '.glb'])")
    || workspaceSeedProviderText.includes('MARKDOWN_MIRROR_EXT_SET')
    || workspaceSeedProviderText.includes('isMarkdownMirrorFileName')) {
    throw new Error('Expected D1 docs mirror materialization to include GLTF/GLB without stale Markdown-only filters')
  }

  const geospatialBridgePath = path.resolve(
    process.cwd(),
    'src',
    'features',
    'geospatial',
    'gympgrphBridge.ts',
  )
  const geospatialBridgeText = fs.readFileSync(geospatialBridgePath, 'utf8')
  if (!geospatialBridgeText.includes('function publishGeospatialModeEnabled(enabled: boolean')
    || !geospatialBridgeText.includes('emitGeospatialModeChanged({ enabled: next })')
    || !geospatialBridgeText.includes('publishGeospatialModeEnabled(next, { emitAlways: true })')) {
    throw new Error('Expected geospatial bridge toggles to publish immediate local geospatial mode state before async module handoff so toolbar mode labels do not lag')
  }
}
