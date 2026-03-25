import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3SceneRebuildPreservesSimulationPositions() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const text = readFileSync(p, 'utf8')
  const occurrences = text.split('const sim = simulationRef.current').length - 1
  if (occurrences < 2) {
    throw new Error('expected useD3GraphScene2d to copy simulation positions both on teardown and on rebuild')
  }
  if (!text.includes('sim.nodes()')) {
    throw new Error('expected useD3GraphScene2d to copy sim node positions into prevPositions')
  }
  if (!text.includes('if (prevPositions[id]) continue')) {
    throw new Error('expected useD3GraphScene2d to read simulation positions on rebuild')
  }
}
