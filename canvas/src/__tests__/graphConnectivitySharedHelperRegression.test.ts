import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { GraphNode } from '@/lib/graph/types'
import { defaultSchema } from '@/lib/graph/schema'
import {
  buildConnectedNodeIdComponents,
  buildNodeAdjacencyFromIncidentEdges,
  buildNodeNeighborSetFromIncidentEdges,
  deriveConnectivityComponents,
} from '@/components/GraphCanvas/layout/graphConnectivity'

export function testGraphConnectivityHelpersBuildAdjacencyAndComponents() {
  const n1 = { id: 'n1', type: 'Node', x: 0, y: 0, properties: {} } as GraphNode
  const n2 = { id: 'n2', type: 'Node', x: 100, y: 0, properties: {} } as GraphNode
  const n3 = { id: 'n3', type: 'Node', x: 500, y: 0, properties: {} } as GraphNode
  const nodeById = new Map([
    ['n1', n1],
    ['n2', n2],
    ['n3', n3],
  ])
  const incidentEdgesByNodeId = new Map([
    ['n1', [{ id: 'e1', source: 'n1', target: 'n2', label: 'link', properties: {} }]],
    ['n2', [{ id: 'e1', source: 'n1', target: 'n2', label: 'link', properties: {} }]],
  ])

  const adjacencyByNodeId = buildNodeAdjacencyFromIncidentEdges({
    nodes: [n1, n2, n3],
    nodeById,
    incidentEdgesByNodeId,
  })
  const neighborIdsByNodeId = buildNodeNeighborSetFromIncidentEdges({
    nodes: [n1, n2, n3],
    nodeById,
    incidentEdgesByNodeId: new Map([
      ['n1', [
        { id: 'e1', source: 'n1', target: 'n2', label: 'link', properties: {} },
        { id: 'e1-dup', source: 'n1', target: 'n2', label: 'link', properties: {} },
      ]],
      ['n2', [{ id: 'e1', source: 'n1', target: 'n2', label: 'link', properties: {} }]],
    ]),
  })
  const componentNodeIds = buildConnectedNodeIdComponents({
    nodeIds: ['n1', 'n2', 'n3', 'n4'],
    adjacencyByNodeId: new Map<string, string[] | Set<string>>([
      ['n1', ['n2']],
      ['n2', ['n1']],
      ['n3', new Set<string>()],
    ]),
  })
  const components = deriveConnectivityComponents({
    nodes: [n1, n2, n3],
    nodeById,
    adjacencyByNodeId,
    schema: defaultSchema,
  })

  if ((adjacencyByNodeId.get('n1') || []).join(',') !== 'n2') {
    throw new Error('expected connectivity helper to build adjacency from incident edges')
  }
  if ((neighborIdsByNodeId.get('n1') ? Array.from(neighborIdsByNodeId.get('n1')!) : []).join(',') !== 'n2') {
    throw new Error('expected connectivity helper to expose deduped neighbor sets from incident edges')
  }
  if (componentNodeIds.length !== 3 || componentNodeIds[0]?.join(',') !== 'n1,n2' || componentNodeIds[1]?.join(',') !== 'n3' || componentNodeIds[2]?.join(',') !== 'n4') {
    throw new Error('expected connectivity helper to derive ordered connected node-id components from mixed adjacency collections')
  }
  if (components.length !== 2) {
    throw new Error(`expected connectivity helper to derive two connected components, got ${components.length}`)
  }
}

export function testCollectiveFitReusesGraphConnectivityHelpers() {
  const helperText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'graphConnectivity.ts'),
    'utf8',
  )
  const collectiveFitText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'collectiveFit.ts'),
    'utf8',
  )
  const initializationText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'initialization.ts'),
    'utf8',
  )
  const collectivePackPositionsText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'collectivePackPositions.ts'),
    'utf8',
  )
  const radialText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'radial.ts'),
    'utf8',
  )

  if (
    !helperText.includes('export function buildConnectedNodeIdComponents')
    || !helperText.includes('export function buildNodeAdjacencyFromIncidentEdges')
    || !helperText.includes('export function buildNodeNeighborSetFromIncidentEdges')
    || !helperText.includes('export function deriveConnectivityComponents')
  ) {
    throw new Error('expected shared graph connectivity helper to export connected-component, adjacency, neighbor-set, and component derivation utilities')
  }
  if (!collectiveFitText.includes('buildNodeAdjacencyFromIncidentEdges') || !collectiveFitText.includes('deriveConnectivityComponents')) {
    throw new Error('expected collectiveFit to reuse shared graph connectivity helpers instead of inlining adjacency and component traversal')
  }
  if (!initializationText.includes('buildNodeNeighborSetFromIncidentEdges')) {
    throw new Error('expected initialization layout seeding to reuse the shared graph connectivity neighbor-set helper instead of rebuilding incident-edge neighbors inline')
  }
  if (!collectivePackPositionsText.includes('buildConnectedNodeIdComponents')) {
    throw new Error('expected collectivePackPositions to reuse the shared connected-component helper instead of inlining component traversal')
  }
  if (!radialText.includes('buildConnectedNodeIdComponents')) {
    throw new Error('expected radial layout to reuse the shared connected-component helper for component partitioning')
  }
}
