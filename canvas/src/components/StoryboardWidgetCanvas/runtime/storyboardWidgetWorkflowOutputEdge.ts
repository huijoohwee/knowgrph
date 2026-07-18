export const WORKFLOW_OUTPUT_EDGE_MODE_PROPERTY = 'workflowOutputEdgeMode' as const
export const WORKFLOW_OUTPUT_EDGE_MODE_MANUAL = 'manual' as const

const cleanEdgePart = (value: unknown): string => String(value ?? '').trim()

export function buildStoryboardWidgetWorkflowOutputEdgeId(args: {
  sourceNodeId: string
  targetNodeId: string
  outputKey?: string | null
  usedEdgeIds: ReadonlySet<string>
}): string {
  const slug = ['workflow-output', args.sourceNodeId, cleanEdgePart(args.outputKey) || 'output', args.targetNodeId]
    .join('-')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180) || 'workflow-output-edge'
  if (!args.usedEdgeIds.has(slug)) return slug
  let suffix = 2
  while (args.usedEdgeIds.has(`${slug}-${suffix}`)) suffix += 1
  return `${slug}-${suffix}`
}
