import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphStoreActionAdaptersHelperIsReusedByD3Hooks() {
  const helperPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'graphStoreActionAdapters.ts')
  const sceneHookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const presentationHookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3PresentationUpdates2d.ts')
  const helperText = readFileSync(helperPath, 'utf8')
  const sceneHookText = readFileSync(sceneHookPath, 'utf8')
  const presentationHookText = readFileSync(presentationHookPath, 'utf8')

  if (!helperText.includes('export function buildGraphCanvasStoreActionAdapters')) {
    throw new Error('expected shared GraphCanvasRoot store action adapter helper to be defined upstream')
  }
  if (!helperText.includes('if (args.workspaceOverlayOpenRef?.current) return')) {
    throw new Error('expected shared GraphCanvasRoot store action adapter helper to centralize overlay-gated write blocking')
  }
  if (!helperText.includes("requestZoomSelection: () => readStore().requestZoom('selection')")) {
    throw new Error('expected shared GraphCanvasRoot store action adapter helper to centralize zoom-selection dispatch')
  }
  if (!sceneHookText.includes("import { buildGraphCanvasStoreActionAdapters } from '@/components/GraphCanvasRoot/utils/graphStoreActionAdapters'")) {
    throw new Error('expected useD3GraphScene2d to reuse the shared GraphCanvasRoot store action adapter helper')
  }
  if (!sceneHookText.includes('const graphStoreActions = useMemo(') || !sceneHookText.includes('addNode: graphStoreActions.addNode')) {
    throw new Error('expected useD3GraphScene2d to route scene callbacks through the shared GraphCanvasRoot store action adapter bundle')
  }
  if (!presentationHookText.includes("import { buildGraphCanvasStoreActionAdapters } from '@/components/GraphCanvasRoot/utils/graphStoreActionAdapters'")) {
    throw new Error('expected useD3PresentationUpdates2d to reuse the shared GraphCanvasRoot store action adapter helper')
  }
  if (!presentationHookText.includes('const graphStoreActions = useMemo(') || !presentationHookText.includes('addEdge: graphStoreActions.addEdge')) {
    throw new Error('expected useD3PresentationUpdates2d to route presentation callbacks through the shared GraphCanvasRoot store action adapter bundle')
  }
}
