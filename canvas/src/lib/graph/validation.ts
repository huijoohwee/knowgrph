import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { validateNodeProperties, validateEdgeProperties } from '@/features/schema/validation'

export type GraphMetricsSummary = {
  nodeCount: number
  edgeCount: number
  duplicateNodeIdCount: number
  danglingEdgeCount: number
  maxDegree: number
  nodesWithoutTypeCount: number
  edgesWithoutLabelCount: number
  nodeTypeCounts: Record<string, number>
  edgeLabelCounts: Record<string, number>
  degreeHistogram: number[]
}

export type GraphValidationSummary = {
  errors: string[]
  warnings: string[]
  metrics: GraphMetricsSummary
}

export const emptyGraphValidationSummary: GraphValidationSummary = {
  errors: [],
  warnings: [],
  metrics: {
    nodeCount: 0,
    edgeCount: 0,
    duplicateNodeIdCount: 0,
    danglingEdgeCount: 0,
    maxDegree: 0,
    nodesWithoutTypeCount: 0,
    edgesWithoutLabelCount: 0,
    nodeTypeCounts: {},
    edgeLabelCounts: {},
    degreeHistogram: [],
  },
}

export function validateGraphDataWithSchema(data: GraphData | null, schema: GraphSchema | null): GraphValidationSummary {
  if (!data || !schema || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    return emptyGraphValidationSummary
  }

  const nodeCount = data.nodes.length
  const edgeCount = data.edges.length

  const nodeIdCounts = new Map<string, number>()
  const nodeTypeCounts: Record<string, number> = {}
  let nodesWithoutTypeCount = 0

  data.nodes.forEach(n => {
    const id = String(n.id)
    const prev = nodeIdCounts.get(id) || 0
    nodeIdCounts.set(id, prev + 1)

    const t = n.type || ''
    if (!t) {
      nodesWithoutTypeCount += 1
    }
    const key = t || '(missing)'
    nodeTypeCounts[key] = (nodeTypeCounts[key] || 0) + 1
  })

  let duplicateNodeIdCount = 0
  nodeIdCounts.forEach(v => {
    if (v > 1) duplicateNodeIdCount += v - 1
  })

  const nodeIdSet = new Set<string>(data.nodes.map(n => String(n.id)))
  let danglingEdgeCount = 0
  const degreeByNodeId = new Map<string, number>()
  const edgeLabelCounts: Record<string, number> = {}
  let edgesWithoutLabelCount = 0

  data.edges.forEach(e => {
    const s = String(e.source)
    const t = String(e.target)
    const hasSource = nodeIdSet.has(s)
    const hasTarget = nodeIdSet.has(t)
    if (!hasSource || !hasTarget) {
      danglingEdgeCount += 1
    }
    if (hasSource) {
      const prev = degreeByNodeId.get(s) || 0
      degreeByNodeId.set(s, prev + 1)
    }
    if (hasTarget) {
      const prev = degreeByNodeId.get(t) || 0
      degreeByNodeId.set(t, prev + 1)
    }

    const label = e.label || ''
    if (!label) {
      edgesWithoutLabelCount += 1
    }
    const key = label || '(missing)'
    edgeLabelCounts[key] = (edgeLabelCounts[key] || 0) + 1
  })

  let maxDegree = 0
  degreeByNodeId.forEach(v => {
    if (v > maxDegree) maxDegree = v
  })

  const degreeHistogram: number[] = []
  degreeByNodeId.forEach(degree => {
    const idx = degree >= 0 ? degree : 0
    degreeHistogram[idx] = (degreeHistogram[idx] || 0) + 1
  })

  const errors: string[] = []
  const warnings: string[] = []

  if (duplicateNodeIdCount > 0) {
    errors.push(`Duplicate node IDs detected (${duplicateNodeIdCount} duplicates)`)
  }
  if (danglingEdgeCount > 0) {
    warnings.push(`Edges with missing endpoints detected (${danglingEdgeCount} edges)`)
  }

  const nodeValidation = schema.validation?.node || {}
  Object.entries(nodeValidation).forEach(([type, rules]) => {
    const severity = rules?.severity === 'warn' ? 'warn' : 'error'
    let invalidCount = 0
    data.nodes.forEach(n => {
      if (n.type !== type) return
      const ok = validateNodeProperties(schema, n.id, n, data)
      if (!ok) invalidCount += 1
    })
    if (invalidCount > 0) {
      const msg = `Node validation failed for type "${type}" (${invalidCount} nodes)`
      if (severity === 'warn') warnings.push(msg)
      else errors.push(msg)
    }
  })

  const edgeValidation = schema.validation?.edge || {}
  Object.entries(edgeValidation).forEach(([label, rules]) => {
    const severity = rules?.severity === 'warn' ? 'warn' : 'error'
    let invalidCount = 0
    data.edges.forEach(e => {
      if (e.label !== label) return
      const ok = validateEdgeProperties(schema, e.id, e)
      if (!ok) invalidCount += 1
    })
    if (invalidCount > 0) {
      const msg = `Edge validation failed for label "${label}" (${invalidCount} edges)`
      if (severity === 'warn') warnings.push(msg)
      else errors.push(msg)
    }
  })

  return {
    errors,
    warnings,
    metrics: {
      nodeCount,
      edgeCount,
      duplicateNodeIdCount,
      danglingEdgeCount,
      maxDegree,
      nodesWithoutTypeCount,
      edgesWithoutLabelCount,
      nodeTypeCounts,
      edgeLabelCounts,
      degreeHistogram,
    },
  }
}
