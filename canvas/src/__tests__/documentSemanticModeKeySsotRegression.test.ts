import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testRendererModeCachesUseDocumentSemanticModeKeySsot() {
  const documentViewModePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'documentViewMode.ts')
  const files = [
    ['active2dZoomViewKey', resolve(process.cwd(), 'src', 'lib', 'canvas', 'active-2d-zoom-view-key.ts')],
    ['activeViewGraph', resolve(process.cwd(), 'src', 'hooks', 'active-graph-data', 'activeViewGraph.ts')],
    ['flowCanvasSnapshots', resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasSnapshots.ts')],
    ['graphCanvasRoot', resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')],
    ['persistLayoutOnDeactivate2d', resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'usePersistLayoutOnDeactivate2d.ts')],
    ['sceneDerivation', resolve(process.cwd(), 'src', 'lib', 'scene', 'sceneDerivation.ts')],
    ['minimap', resolve(process.cwd(), 'src', 'features', 'minimap', 'Minimap.tsx')],
    ['threeLayout', resolve(process.cwd(), 'src', 'features', 'three', 'layout.ts')],
    ['exportHtmlCanvas', resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'main', 'exports', 'exportHtmlCanvas.ts')],
    ['exportHtmlFallback', resolve(process.cwd(), 'src', 'features', 'toolbar', 'exportHtmlFallback.ts')],
    ['snapshotExportHandlers', resolve(process.cwd(), 'src', 'lib', 'panels', 'hooks', 'export-handlers', 'useSnapshotExportHandlers.impl.ts')],
  ] as const

  const documentViewModeText = readFileSync(documentViewModePath, 'utf8')
  if (!documentViewModeText.includes('export function readDocumentViewModeContext')) {
    throw new Error('expected documentViewMode to expose readDocumentViewModeContext as the document-view SSOT')
  }
  if (
    documentViewModeText.includes('export function normalizeDocumentSemanticMode')
    || documentViewModeText.includes('function normalizeDocumentSemanticMode')
    || documentViewModeText.includes('export const normalizeDocumentSemanticMode')
    || documentViewModeText.includes('const normalizeDocumentSemanticMode')
    || documentViewModeText.includes('export function resolveActiveDocumentViewMode')
    || documentViewModeText.includes('function resolveActiveDocumentViewMode')
    || documentViewModeText.includes('export const resolveActiveDocumentViewMode')
    || documentViewModeText.includes('const resolveActiveDocumentViewMode')
    || documentViewModeText.includes('export function buildDocumentSemanticModeKey')
    || documentViewModeText.includes('export function buildDocumentSemanticViewModeKey')
    || documentViewModeText.includes('export function readMarkdownPanelAllowedKinds')
    || documentViewModeText.includes('export function readShouldForceDocumentStructureGroups')
  ) {
    throw new Error('expected documentViewMode to keep readDocumentViewModeContext as the only public runtime derivation entrypoint once callers stop reusing thin wrappers')
  }

  for (let i = 0; i < files.length; i += 1) {
    const [name, path] = files[i]!
    const text = readFileSync(path, 'utf8')
    if (!text.includes('readDocumentViewModeContext')) {
      throw new Error(`expected ${name} to reuse the shared document view mode context SSOT for semantic mode keys`)
    }
  }
}
