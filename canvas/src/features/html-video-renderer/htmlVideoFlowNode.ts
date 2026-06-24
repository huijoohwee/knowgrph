import type { WorkspaceFs } from '@/features/workspace-fs/types'
import type { GraphNode } from '@/lib/graph/types'
import type { HtmlVideoEngineRegistry } from './htmlVideoEngineRegistry'
import { runHtmlVideoRenderJob, type HtmlVideoRunResult } from './htmlVideoRenderJob'

const readNodeProperties = (node: GraphNode): Record<string, unknown> => {
  return node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
    ? node.properties as Record<string, unknown>
    : {}
}

const readInteger = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return undefined
}

const readDataJson = (value: unknown): Record<string, unknown> | undefined => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

export async function runHtmlVideoFlowNode(args: {
  node: GraphNode
  registry: HtmlVideoEngineRegistry
  workspacePath?: string | null
  fs?: WorkspaceFs | null
}): Promise<HtmlVideoRunResult> {
  const properties = readNodeProperties(args.node)
  const spec = {
    html: typeof properties.html === 'string' ? properties.html : '',
    ...(typeof properties.css === 'string' ? { css: properties.css } : {}),
    ...(readDataJson(properties.data_json) ? { data: readDataJson(properties.data_json) } : {}),
    ...(readInteger(properties.duration_ms) != null ? { durationMs: readInteger(properties.duration_ms) } : {}),
    ...(readInteger(properties.fps) != null ? { fps: readInteger(properties.fps) } : {}),
    ...(readInteger(properties.width) != null ? { width: readInteger(properties.width) } : {}),
    ...(readInteger(properties.height) != null ? { height: readInteger(properties.height) } : {}),
    ...(typeof properties.engine_hint === 'string' && properties.engine_hint.trim() ? { engineHint: properties.engine_hint.trim() } : {}),
  }
  return runHtmlVideoRenderJob({
    spec,
    node: args.node,
    registry: args.registry,
    workspacePath: args.workspacePath,
    fs: args.fs,
  })
}
