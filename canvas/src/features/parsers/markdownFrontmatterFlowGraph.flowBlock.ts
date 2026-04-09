import { load as parseYaml } from 'js-yaml'
import { isUnsafeFlowComputeSource } from '@/lib/flowEditor/flowComputeInline'

const FRONTMATTER_FLOW_SETTINGS_KEY = 'frontmatterFlowSettings' as const
const FRONTMATTER_FLOW_WARNINGS_KEY = 'frontmatterFlowWarnings' as const

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function asBoolean(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (!s) return null
    if (s === 'true') return true
    if (s === 'false') return false
  }
  return null
}

function countIndent(rawLine: string): number {
  let i = 0
  while (i < rawLine.length && rawLine[i] === ' ') i += 1
  return i
}

function repairYamlInlineColonSpacing(raw: string): string {
  const src = String(raw || '')
  if (!src) return src
  const out: string[] = []
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] || ''
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line)
      continue
    }
    const m = /^(\s*[-]?\s*[A-Za-z0-9_.-]+):(["'].*)$/.exec(line)
    if (m) {
      out.push(`${m[1]}: ${m[2]}`)
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

function parseFlowObjectFromYamlBlock(rawBlock: string): Record<string, unknown> | null {
  const block = String(rawBlock || '')
  if (!block) return null
  try {
    const parsed = parseYaml(block) as unknown
    if (isRecord(parsed) && isRecord(parsed.flow)) return parsed.flow as Record<string, unknown>
  } catch {
    void 0
  }
  try {
    const repaired = repairYamlInlineColonSpacing(block)
    const parsed = parseYaml(repaired) as unknown
    if (isRecord(parsed) && isRecord(parsed.flow)) return parsed.flow as Record<string, unknown>
  } catch {
    void 0
  }
  return null
}

export function tryParseFlowBlockFromFrontmatterLines(args: {
  lines: string[]
  frontmatterStartLine: number
  frontmatterEndLineExclusive: number
}): Record<string, unknown> | null {
  const lines = Array.isArray(args.lines) ? args.lines : []
  if (lines.length === 0) return null
  const start = Math.max(0, Math.floor(args.frontmatterStartLine))
  const endExclusive = Math.min(lines.length, Math.max(start + 1, Math.floor(args.frontmatterEndLineExclusive)))
  if (endExclusive <= start) return null
  let flowLine = -1
  let flowIndent = 0
  for (let i = start; i < endExclusive; i += 1) {
    const rawLine = String(lines[i] || '')
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (/^flow\s*:\s*$/.test(trimmed)) {
      flowLine = i
      flowIndent = countIndent(rawLine)
      break
    }
  }
  if (flowLine < 0) return null
  let blockEnd = endExclusive
  for (let i = flowLine + 1; i < endExclusive; i += 1) {
    const rawLine = String(lines[i] || '')
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const indent = countIndent(rawLine)
    if (indent <= flowIndent && /^[A-Za-z0-9_.-]+\s*:/.test(trimmed)) {
      blockEnd = i
      break
    }
  }
  const flowBlock = lines.slice(flowLine, blockEnd).join('\n')
  return parseFlowObjectFromYamlBlock(flowBlock)
}

function getPathValue(
  source: Record<string, unknown>,
  path: string,
  pathCache: Map<string, unknown>,
): unknown {
  const raw = String(path || '').trim()
  if (!raw) return undefined
  if (pathCache.has(raw)) return pathCache.get(raw)
  const segs = raw.split('.').map(s => s.trim()).filter(Boolean)
  let cur: unknown = source
  for (let i = 0; i < segs.length; i += 1) {
    if (!isRecord(cur)) {
      pathCache.set(raw, undefined)
      return undefined
    }
    cur = (cur as Record<string, unknown>)[segs[i]]
  }
  pathCache.set(raw, cur)
  return cur
}

function resolveTemplateString(
  raw: string,
  vars: Record<string, unknown>,
  pathCache: Map<string, unknown>,
  textCache: Map<string, string>,
): string {
  const source = String(raw || '')
  if (!source) return ''
  const cached = textCache.get(source)
  if (typeof cached === 'string') return cached
  const resolved = source.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
    const found = getPathValue(vars, key, pathCache)
    if (found == null) return ''
    if (typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean') return String(found)
    return ''
  })
  textCache.set(source, resolved)
  return resolved
}

function resolveTemplateValue(
  value: unknown,
  vars: Record<string, unknown>,
  pathCache: Map<string, unknown>,
  textCache: Map<string, string>,
): unknown {
  if (typeof value === 'string') return resolveTemplateString(value, vars, pathCache, textCache)
  if (Array.isArray(value)) return value.map(v => resolveTemplateValue(v, vars, pathCache, textCache))
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) out[k] = resolveTemplateValue(v, vars, pathCache, textCache)
  return out
}

function normalizeFlowNodeType(rawType: string): 'input' | 'default' | 'output' | 'custom' {
  const type = String(rawType || '').trim().toLowerCase()
  if (type === 'input' || type === 'default' || type === 'output' || type === 'custom') return type
  return 'default'
}

function sanitizeFlowNodeContract(args: {
  id: string
  type: 'input' | 'default' | 'output' | 'custom'
  inputs: Array<Record<string, unknown>>
  outputs: Array<Record<string, unknown>>
  compute: string
  warnings: string[]
}): {
  inputs: Array<Record<string, unknown>>
  outputs: Array<Record<string, unknown>>
  compute: string
} {
  const { id, type, warnings } = args
  let inputs = args.inputs
  let outputs = args.outputs
  let compute = args.compute
  if (type === 'input' && inputs.length > 0) {
    warnings.push(`Flow node contract violation: input node ${id} cannot declare target handles`)
    inputs = []
  }
  if (type === 'output' && outputs.length > 0) {
    warnings.push(`Flow node contract violation: output node ${id} cannot declare source handles`)
    outputs = []
  }
  if ((type === 'input' || type === 'output') && compute) {
    warnings.push(`Flow node contract violation: ${type} node ${id} cannot declare compute`)
    compute = ''
  }
  if (compute && isUnsafeFlowComputeSource(compute)) {
    warnings.push(`Flow node compute rejected as unsafe: ${id}`)
    compute = ''
  }
  return { inputs, outputs, compute }
}

function normalizeFlowNodeDataValue(value: unknown): unknown {
  if (typeof value === 'undefined') return {}
  if (value === null) return null
  if (Array.isArray(value)) return value
  if (isRecord(value)) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return {}
}

function readFlowWarnings(raw: string[]): string[] {
  if (raw.length === 0) return raw
  const seen = new Set<string>()
  const deduped: string[] = []
  for (let i = 0; i < raw.length; i += 1) {
    const warning = String(raw[i] || '').trim()
    if (!warning || seen.has(warning)) continue
    seen.add(warning)
    deduped.push(warning)
  }
  deduped.sort((a, b) => a.localeCompare(b))
  return deduped
}


function normalizeFlowDataValue(value: unknown): { value: unknown; hasPending: boolean } {
  if (typeof value === 'string') {
    const s = value.trim()
    if (s.toUpperCase() === 'TBD') return { value: null, hasPending: true }
    return { value: value, hasPending: false }
  }
  if (Array.isArray(value)) {
    const out: unknown[] = []
    let hasPending = false
    for (let i = 0; i < value.length; i += 1) {
      const row = normalizeFlowDataValue(value[i])
      out.push(row.value)
      if (row.hasPending) hasPending = true
    }
    return { value: out, hasPending }
  }
  if (!isRecord(value)) return { value, hasPending: false }
  const out: Record<string, unknown> = {}
  let hasPending = false
  for (const [k, v] of Object.entries(value)) {
    const row = normalizeFlowDataValue(v)
    out[k] = row.value
    if (row.hasPending) hasPending = true
  }
  return { value: out, hasPending }
}

function coerceFlowNodePorts(raw: unknown): Array<Record<string, unknown>> {
  const arr = Array.isArray(raw) ? raw : []
  const out: Array<Record<string, unknown>> = []
  const seen = new Set<string>()
  for (let i = 0; i < arr.length; i += 1) {
    const key = asString(arr[i])
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ port: key })
  }
  return out
}

export function normalizeMetaWithFlowBlock(meta: Record<string, unknown>): Record<string, unknown> {
  const flow = isRecord(meta.flow) ? (meta.flow as Record<string, unknown>) : null
  if (!flow) return meta
  const vars = meta
  const pathCache = new Map<string, unknown>()
  const textCache = new Map<string, string>()
  const flowWarnings: string[] = []
  const rawNodes = Array.isArray(flow.nodes) ? flow.nodes : []
  const normalizedNodes: Array<Record<string, unknown>> = []
  for (let i = 0; i < rawNodes.length; i += 1) {
    const rawNode = rawNodes[i]
    if (!isRecord(rawNode)) continue
    const id = asString(rawNode.id)
    if (!id) continue
    const rawType = asString(rawNode.type)
    const type = normalizeFlowNodeType(rawType)
    if (rawType && rawType !== type) {
      flowWarnings.push(`Flow node type normalized to default: ${id}`)
    }
    const labelRaw = asString(rawNode.label)
    const position = isRecord(rawNode.position) ? (rawNode.position as Record<string, unknown>) : null
    const x = position ? asFiniteNumber(position.x) : asFiniteNumber((rawNode as Record<string, unknown>).pos_x)
    const y = position ? asFiniteNumber(position.y) : asFiniteNumber((rawNode as Record<string, unknown>).pos_y)
    const handles = isRecord(rawNode.handles) ? (rawNode.handles as Record<string, unknown>) : null
    const inputs = coerceFlowNodePorts(handles?.target)
    const outputs = coerceFlowNodePorts(handles?.source)
    const dataResolved = resolveTemplateValue(rawNode.data, vars, pathCache, textCache)
    const dataNormalized = normalizeFlowDataValue(dataResolved)
    const computeRaw = asString(rawNode.compute)
    const compute = computeRaw ? resolveTemplateString(computeRaw, vars, pathCache, textCache) : ''
    const sanitized = sanitizeFlowNodeContract({
      id,
      type,
      inputs,
      outputs,
      compute,
      warnings: flowWarnings,
    })
    const next: Record<string, unknown> = {
      id,
      type,
      label: labelRaw ? resolveTemplateString(labelRaw, vars, pathCache, textCache) : id,
      ...(x != null || y != null ? { pos: { ...(x != null ? { x } : {}), ...(y != null ? { y } : {}) } } : {}),
      inputs: sanitized.inputs,
      outputs: sanitized.outputs,
      data: normalizeFlowNodeDataValue(dataNormalized.value),
    }
    if (sanitized.compute) next.compute = sanitized.compute
    if (dataNormalized.hasPending) {
      const props = isRecord(rawNode.properties) ? ({ ...rawNode.properties } as Record<string, unknown>) : {}
      props['frontmatter:waiting'] = true
      next.properties = props
    } else if (isRecord(rawNode.properties)) {
      next.properties = rawNode.properties
    }
    normalizedNodes.push(next)
  }

  const rawEdges = Array.isArray(flow.edges) ? flow.edges : []
  const normalizedConnections: Array<Record<string, unknown>> = []
  for (let i = 0; i < rawEdges.length; i += 1) {
    const row = rawEdges[i]
    if (!isRecord(row)) continue
    const source = asString(row.source)
    const sourceHandle = asString(row.sourceHandle)
    const target = asString(row.target)
    const targetHandle = asString(row.targetHandle)
    if (!source || !target || !sourceHandle || !targetHandle) continue
    const labelRaw = asString(row.label)
    const label = labelRaw ? resolveTemplateString(labelRaw, vars, pathCache, textCache) : ''
    const conn: Record<string, unknown> = {
      id: asString(row.id) || `flow-e${String(i + 1).padStart(2, '0')}`,
      from_node: source,
      from_port: sourceHandle,
      to_node: target,
      to_port: targetHandle,
      ...(label ? { label } : {}),
      ...(asBoolean(row.animated) === true ? { animated: true } : {}),
      ...(asString(row.type) ? { type: asString(row.type) } : {}),
    }
    normalizedConnections.push(conn)
  }

  const rawDirection = asString(flow.direction).toUpperCase()
  const direction = rawDirection === 'LR' || rawDirection === 'TB' || rawDirection === 'RL' || rawDirection === 'BT' ? rawDirection : 'LR'
  const rawEdgeType = asString(flow.edgeType).toLowerCase()
  const edgeType = rawEdgeType === 'default' || rawEdgeType === 'straight' || rawEdgeType === 'step' || rawEdgeType === 'smoothstep' || rawEdgeType === 'bezier'
    ? rawEdgeType
    : 'bezier'
  const settings: Record<string, unknown> = {
    direction,
    edgeType,
    ...(asBoolean(flow.snapToGrid) != null ? { snapToGrid: asBoolean(flow.snapToGrid) } : {}),
    ...(asFiniteNumber(flow.gridSize) != null ? { gridSize: Math.max(1, Math.floor(asFiniteNumber(flow.gridSize) as number)) } : {}),
    ...(asBoolean(flow.computed) != null ? { computed: asBoolean(flow.computed) } : {}),
  }

  const next: Record<string, unknown> = {
    ...meta,
    ...(normalizedNodes.length > 0 ? { nodes: normalizedNodes } : {}),
    ...(normalizedConnections.length > 0 ? { connections: normalizedConnections } : {}),
    [FRONTMATTER_FLOW_SETTINGS_KEY]: settings,
    ...(flowWarnings.length > 0 ? { [FRONTMATTER_FLOW_WARNINGS_KEY]: readFlowWarnings(flowWarnings) } : {}),
  }
  return next
}

export { FRONTMATTER_FLOW_SETTINGS_KEY, FRONTMATTER_FLOW_WARNINGS_KEY }
