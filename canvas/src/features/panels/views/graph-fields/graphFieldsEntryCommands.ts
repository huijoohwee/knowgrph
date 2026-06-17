import type { GraphField, GraphFieldId } from '@/features/graph-fields/graphFields'
import { normalized } from '@/features/panels/utils/json'
import { INLINE_MEDIA_COMMAND_ENTRY_LABELS } from '@/lib/command-menu/inlineCommandMenuCatalog'

export const GRAPH_FIELDS_ENTRY_SHORTCUT_NODE_LABEL = 'Node' as const

export const GRAPH_FIELDS_COMMAND_ENTRY_LABELS = [
  'Renderer',
  GRAPH_FIELDS_ENTRY_SHORTCUT_NODE_LABEL,
  'Edges',
  'Clusters',
  'Layer Mode',
  ...INLINE_MEDIA_COMMAND_ENTRY_LABELS,
] as const

export const WORKFLOW_MANAGER_GRAPH_FIELDS_COMMAND_ENTRY_LABELS = [
  ...GRAPH_FIELDS_COMMAND_ENTRY_LABELS,
  'Workflow sections mode',
  'Workflow Sections',
  'Steps',
  'Tier B',
  'runtime',
  'pipeline',
  'mermaid',
  'flow',
  'Nodes · Widget Gallery',
  'Edges',
  'Clusters · Samples',
  'Inspector',
] as const

export function isGraphFieldsSelectionInspectorEntryLabel(entryLabel: string): boolean {
  const label = normalized(entryLabel).toLowerCase()
  return label.includes('node') || label.includes('inspector')
}

export function resolveGraphFieldsEntryCommandTarget(args: {
  entryLabel: string
  fields: ReadonlyArray<GraphField>
  selectedFieldId: GraphFieldId | null
}): GraphField | null {
  const { fields, selectedFieldId } = args
  if (fields.length === 0) return null

  const label = normalized(args.entryLabel).toLowerCase()
  const rendererHint = label.includes('renderer')
  const nodeHint = label.includes('node')
  const edgeOnly = label.includes('edge')
  const clusterHint = label.includes('cluster') || label.includes('sample') || label.includes('group')
  const layerHint = label.includes('layer')
  const flowHint = label.includes('workflow') || label.includes('step') || label.includes('tier b') || label.includes('runtime') || label.includes('pipeline') || label.includes('mermaid') || label.includes('flow')
  const inspectorHint = label.includes('inspector')
  const imageHint = label.includes('image')
  const videoHint = label.includes('video')
  const mediaHint = label.includes('media')

  const byScope = (scope: 'node' | 'edge') => fields.find(field => field.scope === scope) || null
  const byScopeNonChunkText = (scope: 'node' | 'edge') =>
    fields.find(field => field.scope === scope && !normalized(field.key).includes('chunk_text')) || null
  const byKeyContains = (parts: readonly string[]) => {
    for (const part of parts) {
      const hit = fields.find(field => normalized(field.key).includes(normalized(part)))
      if (hit) return hit
    }
    return null
  }

  if (edgeOnly) return byScope('edge') || fields[0] || null
  if (rendererHint) return byKeyContains(['renderer', 'layout', 'style', 'theme', 'color']) || byScopeNonChunkText('node') || byScope('node') || fields[0] || null
  if (layerHint) return byKeyContains(['layer', 'cluster', 'group', 'subgraph']) || byScopeNonChunkText('node') || byScope('node') || fields[0] || null
  if (nodeHint) return byScope('node') || fields[0] || null
  if (clusterHint) return byKeyContains(['cluster', 'group', 'layer']) || byScopeNonChunkText('node') || byScope('node') || fields[0] || null
  if (imageHint) return byKeyContains(['imageurl', 'image_url', 'image', 'media_url', 'media']) || byScopeNonChunkText('node') || byScope('node') || fields[0] || null
  if (videoHint) return byKeyContains(['videourl', 'video_url', 'video', 'media_url', 'media']) || byScopeNonChunkText('node') || byScope('node') || fields[0] || null
  if (mediaHint) return byKeyContains(['media_url', 'media', 'imageurl', 'videourl', 'image', 'video']) || byScopeNonChunkText('node') || byScope('node') || fields[0] || null
  if (flowHint || inspectorHint) return byKeyContains(['flow', 'pipeline', 'runtime', 'step', 'node']) || byScope('node') || fields[0] || null
  if (selectedFieldId) return fields.find(field => field.id === selectedFieldId) || fields[0] || null
  return fields[0] || null
}
