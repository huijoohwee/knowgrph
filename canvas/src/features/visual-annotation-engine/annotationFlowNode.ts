import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { GraphNode } from '@/lib/graph/types'
import type { AnnotationRunResult } from './annotationEngineSsot'
import { createAnnotationWorkerHandle, runAnnotationJob, type AnnotationWorkerHandle } from './annotationOrchestrator'

const readNodeProperties = (node: GraphNode): Record<string, unknown> => {
  return node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
    ? node.properties as Record<string, unknown>
    : {}
}

const readTasks = (value: unknown): string[] => {
  const scalar = unwrapGraphCellValue(value)
  if (Array.isArray(scalar)) return scalar.map(item => String(unwrapGraphCellValue(item) || '').trim()).filter(Boolean)
  if (typeof scalar !== 'string') return []
  const raw = scalar.trim()
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean)
    } catch {
      return []
    }
  }
  return raw.split(',').map(item => item.trim()).filter(Boolean)
}

const readInteger = (value: unknown): number | undefined => {
  const scalar = unwrapGraphCellValue(value)
  if (typeof scalar === 'number' && Number.isInteger(scalar)) return scalar
  if (typeof scalar === 'string' && scalar.trim()) {
    const parsed = Number(scalar)
    if (Number.isInteger(parsed)) return parsed
  }
  return undefined
}

const readString = (value: unknown): string => {
  const scalar = unwrapGraphCellValue(value)
  return typeof scalar === 'string' ? scalar.trim() : ''
}

export function buildAnnotationSpecCandidateFromNode(node: GraphNode): Record<string, unknown> {
  const properties = readNodeProperties(node)
  const frameTimestampMs = readInteger(properties.frame_timestamp_ms)
  return {
    assetUrl: readString(properties.asset_url),
    assetType: readString(properties.asset_type) || 'image',
    tasks: readTasks(properties.tasks),
    ...(readString(properties.model_hint) ? { modelHint: readString(properties.model_hint) } : {}),
    ...(typeof frameTimestampMs === 'number' ? { frameTimestampMs } : {}),
  }
}

export async function runAnnotationFlowNode(args: {
  node: GraphNode
  worker?: AnnotationWorkerHandle | null
  workspacePath?: string | null
  fs?: WorkspaceFs | null
}): Promise<AnnotationRunResult> {
  return runAnnotationJob({
    spec: buildAnnotationSpecCandidateFromNode(args.node),
    node: args.node,
    worker: args.worker || createAnnotationWorkerHandle(),
    workspacePath: args.workspacePath,
    fs: args.fs,
  })
}
