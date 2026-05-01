import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3SceneRebuildPreservesSimulationPositions() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const captureHelperPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'capturePrevNodePositions.ts')
  const helperPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'mergeSimulationPositions.ts')
  const text = readFileSync(p, 'utf8')
  const captureHelperText = readFileSync(captureHelperPath, 'utf8')
  const helperText = readFileSync(helperPath, 'utf8')
  const occurrences = text.split('capturePrevNodePositions({').length - 1
  if (occurrences < 2) {
    throw new Error('expected useD3GraphScene2d to reuse the shared previous-position capture helper both on teardown and on rebuild')
  }
  if (!captureHelperText.includes('export function capturePrevNodePositions')) {
    throw new Error('expected GraphCanvasRoot previous-position capture helper to be defined upstream')
  }
  if (!captureHelperText.includes('mergeSimulationPositionsIntoLayoutCache(prevPositions, args.simulation)')) {
    throw new Error('expected shared previous-position capture helper to reuse the simulation-position merge helper')
  }
  if (!helperText.includes('export function mergeSimulationPositionsIntoLayoutCache')) {
    throw new Error('expected GraphCanvasRoot simulation-position merge helper to be defined upstream')
  }
  if (!helperText.includes('if (!id || prevPositions[id]) continue')) {
    throw new Error('expected shared simulation-position merge helper to preserve existing cached positions while copying finite sim positions')
  }
}
