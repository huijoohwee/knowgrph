import type { JSONValue } from '@/lib/graph/types'

import type {
  FlowNodePortSpec,
  FlowNodeSpec,
  FlowSpecDirection,
  FlowSpecValueType,
  FlowWorkflowNodeBindingV1,
  FlowWorkflowSpec,
} from '@/features/flow-editor-manager/spec/specTypes'

const clean = (v: unknown): string => String(v || '').trim()

const isValueType = (v: unknown): v is FlowSpecValueType =>
  v === 'string' || v === 'number' || v === 'boolean' || v === 'json' || v === 'any'

const isDirection = (v: unknown): v is FlowSpecDirection => v === 'input' || v === 'output'

export function validateFlowNodeSpec(raw: unknown): { ok: true; value: FlowNodeSpec } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Node spec must be an object.' }
  const rec = raw as Record<string, unknown>
  if (rec.kind !== 'kg:flow:nodeSpec') return { ok: false, error: "Node spec kind must be 'kg:flow:nodeSpec'." }
  if (rec.version !== 1) return { ok: false, error: 'Node spec version must be 1.' }
  const nodeTypeId = clean(rec.nodeTypeId)
  if (!nodeTypeId) return { ok: false, error: 'nodeTypeId is required.' }
  const portsRaw = Array.isArray(rec.ports) ? rec.ports : []
  const seen = new Set<string>()
  const ports: FlowNodePortSpec[] = []
  for (let i = 0; i < portsRaw.length; i += 1) {
    const p = portsRaw[i]
    if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, error: 'ports[] entries must be objects.' }
    const pr = p as Record<string, unknown>
    const key = clean(pr.key)
    if (!key) return { ok: false, error: 'Every port needs a key.' }
    const dir = pr.direction
    if (!isDirection(dir)) return { ok: false, error: `Invalid port direction for ${key}.` }
    const vt = pr.valueType
    if (!isValueType(vt)) return { ok: false, error: `Invalid valueType for ${key}.` }
    const uniq = `${dir}:${key}`
    if (seen.has(uniq)) return { ok: false, error: `Duplicate port: ${uniq}` }
    seen.add(uniq)

    const required = typeof pr.required === 'boolean' ? pr.required : undefined
    const description = clean(pr.description) || undefined
    const defaultValue = (pr.defaultValue as JSONValue | undefined)
    ports.push({
      key,
      direction: dir,
      valueType: vt,
      ...(required != null ? { required } : {}),
      ...(typeof defaultValue !== 'undefined' ? { defaultValue } : {}),
      ...(description ? { description } : {}),
    })
  }
  const displayName = clean(rec.displayName) || undefined
  const category = clean(rec.category) || undefined
  const description = clean(rec.description) || undefined
  return {
    ok: true,
    value: {
      kind: 'kg:flow:nodeSpec',
      version: 1,
      nodeTypeId,
      ...(displayName ? { displayName } : {}),
      ...(category ? { category } : {}),
      ...(description ? { description } : {}),
      ports,
    },
  }
}

export function validateFlowWorkflowSpec(raw: unknown): { ok: true; value: FlowWorkflowSpec } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Workflow spec must be an object.' }
  const rec = raw as Record<string, unknown>
  if (rec.kind !== 'kg:flow:workflowSpec') return { ok: false, error: "Workflow spec kind must be 'kg:flow:workflowSpec'." }
  if (rec.version !== 1) return { ok: false, error: 'Workflow spec version must be 1.' }
  const workflowId = clean(rec.workflowId)
  if (!workflowId) return { ok: false, error: 'workflowId is required.' }
  const nodesRaw = Array.isArray(rec.nodes) ? rec.nodes : []
  const ids = new Set<string>()
  const nodes: FlowWorkflowNodeBindingV1[] = []
  for (let i = 0; i < nodesRaw.length; i += 1) {
    const n = nodesRaw[i]
    if (!n || typeof n !== 'object' || Array.isArray(n)) return { ok: false, error: 'nodes[] entries must be objects.' }
    const nr = n as Record<string, unknown>
    const id = clean(nr.id)
    const nodeTypeId = clean(nr.nodeTypeId)
    if (!id) return { ok: false, error: 'Every workflow node needs an id.' }
    if (!nodeTypeId) return { ok: false, error: `Workflow node ${id} needs nodeTypeId.` }
    if (ids.has(id)) return { ok: false, error: `Duplicate workflow node id: ${id}` }
    ids.add(id)

    const title = clean(nr.title) || undefined
    const inputs = (nr.inputs && typeof nr.inputs === 'object' && !Array.isArray(nr.inputs)) ? (nr.inputs as Record<string, JSONValue>) : undefined
    nodes.push({ id, nodeTypeId, ...(title ? { title } : {}), ...(inputs ? { inputs } : {}) })
  }
  const title = clean(rec.title) || undefined
  const description = clean(rec.description) || undefined
  return {
    ok: true,
    value: {
      kind: 'kg:flow:workflowSpec',
      version: 1,
      workflowId,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      nodes,
    },
  }
}

export function buildDefaultFlowNodeSpec(args: { nodeTypeId: string }): FlowNodeSpec {
  const nodeTypeId = clean(args.nodeTypeId)
  return {
    kind: 'kg:flow:nodeSpec',
    version: 1,
    nodeTypeId: nodeTypeId || 'Node',
    ports: [],
  }
}

export function buildDefaultFlowWorkflowSpec(args: { workflowId: string }): FlowWorkflowSpec {
  const workflowId = clean(args.workflowId)
  return {
    kind: 'kg:flow:workflowSpec',
    version: 1,
    workflowId: workflowId || 'workflow',
    nodes: [],
  }
}
