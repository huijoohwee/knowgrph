import type { GraphNode, JSONValue } from '@/lib/graph/types'

import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'

export const FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY = 'flow:quickEditorTypeId' as const
export const FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY = 'flow:quickEditorFormId' as const

const pickString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function resolveNodeQuickEditorRegistryEntry(args: {
  node: Pick<GraphNode, 'type' | 'properties'> | null | undefined
  registry: ReadonlyArray<NodeQuickEditorRegistryEntry> | null | undefined
}): NodeQuickEditorRegistryEntry | null {
  const nodeType = pickString(args.node?.type)
  if (!nodeType) return null
  const reg = Array.isArray(args.registry) ? args.registry : []
  if (reg.length === 0) return null

  const props = (args.node?.properties || {}) as Record<string, JSONValue | undefined>
  const wantType = pickString(props[FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY])
  const wantForm = pickString(props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY])

  let candidates = reg.filter(e => e && e.isEnabled && e.nodeTypeId === nodeType)
  if (candidates.length === 0) return null

  if (wantType) {
    const filtered = candidates.filter(e => e.quickEditorTypeId === wantType)
    if (filtered.length > 0) candidates = filtered
  }
  if (wantForm) {
    const filtered = candidates.filter(e => e.formId === wantForm)
    if (filtered.length > 0) candidates = filtered
  }

  const prefer = (typeId: string, formId?: string) => {
    const found = candidates.find(e => e.quickEditorTypeId === typeId && (!formId || e.formId === formId))
    return found || null
  }

  const preferred = prefer('default', wantForm || undefined) || prefer('default')
  if (preferred) return preferred

  const sorted = candidates
    .slice()
    .sort((a, b) => {
      const t = a.quickEditorTypeId.localeCompare(b.quickEditorTypeId)
      if (t !== 0) return t
      const f = a.formId.localeCompare(b.formId)
      if (f !== 0) return f
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    })
  return sorted[0] || null
}

