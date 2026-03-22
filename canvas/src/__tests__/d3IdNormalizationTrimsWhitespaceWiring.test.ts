import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3IdNormalizationTrimsWhitespaceWiring() {
  const simPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'simulation.ts')
  const simText = readFileSync(simPath, 'utf8')
  if (!simText.includes(".forceLink<GraphNode, GraphEdge>(edgesForSim)\n    .id(d => String(d.id).trim())")) {
    throw new Error('expected d3 forceLink id accessor to trim node ids')
  }

  const handlersPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'sceneHandlers.ts')
  const handlersText = readFileSync(handlersPath, 'utf8')
  if (!handlersText.includes("nodeById.set(id, n)")) {
    throw new Error('expected sceneHandlers to populate nodeById with trimmed keys')
  }
  if (!handlersText.includes("nodeById.get(String(endpoint).trim())")) {
    throw new Error('expected sceneHandlers to resolve node ids with trim()')
  }
}

