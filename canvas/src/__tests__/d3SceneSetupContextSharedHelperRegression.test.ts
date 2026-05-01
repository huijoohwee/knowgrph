import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3SceneSetupContextHelperIsReusedByD3SceneHook() {
  const hookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const helperPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'd3SceneSetupContext.ts')
  const hookText = readFileSync(hookPath, 'utf8')
  const helperText = readFileSync(helperPath, 'utf8')

  if (!helperText.includes('export function buildD3SceneSetupContext')) {
    throw new Error('expected shared D3 scene setup context helper to be defined upstream')
  }
  if (!helperText.includes('buildGraphMetaKeyIgnoringPending(args.sceneGraphData)')) {
    throw new Error('expected D3 scene setup context helper to centralize graph meta key derivation')
  }
  if (!helperText.includes('const buildKey = [')) {
    throw new Error('expected D3 scene setup context helper to centralize D3 scene buildKey derivation')
  }
  if (!hookText.includes('const sceneSetup = buildD3SceneSetupContext({')) {
    throw new Error('expected useD3GraphScene2d to reuse the shared D3 scene setup context helper')
  }
  if (!hookText.includes('const { isBipartite, schemaForScene, hoverEnabled, zoomOnDoubleClick, graphMetaKey, buildKey, isMermaidLayout } = sceneSetup')) {
    throw new Error('expected useD3GraphScene2d to consume the shared scene setup context bundle instead of rebuilding it inline')
  }
}
