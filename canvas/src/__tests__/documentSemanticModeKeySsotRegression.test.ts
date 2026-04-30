import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testRendererModeCachesUseDocumentSemanticModeKeySsot() {
  const files = [
    ['active2dZoomViewKey', resolve(process.cwd(), 'src', 'lib', 'canvas', 'active-2d-zoom-view-key.ts')],
    ['activeViewGraph', resolve(process.cwd(), 'src', 'hooks', 'active-graph-data', 'activeViewGraph.ts')],
    ['graphCanvasRoot', resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')],
    ['sceneDerivation', resolve(process.cwd(), 'src', 'lib', 'scene', 'sceneDerivation.ts')],
    ['minimap', resolve(process.cwd(), 'src', 'features', 'minimap', 'Minimap.tsx')],
    ['exportHtmlCanvas', resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'main', 'exports', 'exportHtmlCanvas.ts')],
    ['exportHtmlFallback', resolve(process.cwd(), 'src', 'features', 'toolbar', 'exportHtmlFallback.ts')],
    ['snapshotExportHandlers', resolve(process.cwd(), 'src', 'lib', 'panels', 'hooks', 'export-handlers', 'useSnapshotExportHandlers.impl.ts')],
  ] as const

  for (let i = 0; i < files.length; i += 1) {
    const [name, path] = files[i]!
    const text = readFileSync(path, 'utf8')
    if (!text.includes('buildDocumentSemanticModeKey') && !text.includes('buildDocumentSemanticViewModeKey')) {
      throw new Error(`expected ${name} to use shared document semantic mode key builder`)
    }
  }
}
