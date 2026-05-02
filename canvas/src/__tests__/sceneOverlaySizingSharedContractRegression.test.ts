import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testScenePathsReuseSharedOverlaySizingContract() {
  const scenePath = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'scene.ts')
  const tickPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'sceneHandlers.simulationTick2d.ts')
  const d3SceneHookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const htmlExportPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlCanvasSvgExport.ts')

  const sceneText = readFileSync(scenePath, 'utf8')
  const tickText = readFileSync(tickPath, 'utf8')
  const d3SceneHookText = readFileSync(d3SceneHookPath, 'utf8')
  const htmlExportText = readFileSync(htmlExportPath, 'utf8')

  if (!sceneText.includes('overlaySizing?: OverlayDensitySizingConfigInput | null')) {
    throw new Error('expected setupGraphScene to accept the shared overlay sizing contract instead of six raw sizing fields')
  }
  if (!sceneText.includes('overlaySizing: overlaySizing || null,')) {
    throw new Error('expected setupGraphScene to pass the shared overlay sizing contract through both overlay sizing call sites')
  }
  if (!tickText.includes('overlaySizing?: OverlayDensitySizingConfigInput | null')) {
    throw new Error('expected attachSimulationTick to accept the shared overlay sizing contract instead of six raw sizing fields')
  }
  if (!tickText.includes("const cfg = readOverlaySizingConfigForDensity({ density, sizing: overlaySizing || null })")) {
    throw new Error('expected attachSimulationTick to normalize overlay sizing from the shared contract')
  }
  if (!d3SceneHookText.includes('overlaySizing?: OverlayDensitySizingConfigInput | null') || !d3SceneHookText.includes('overlaySizing,')) {
    throw new Error('expected useD3GraphScene2d to accept and pass the shared overlay sizing contract into setupGraphScene')
  }
  if (!htmlExportText.includes('overlaySizing,')) {
    throw new Error('expected HTML export scene setup to pass the shared overlay sizing contract into setupGraphScene')
  }
}
