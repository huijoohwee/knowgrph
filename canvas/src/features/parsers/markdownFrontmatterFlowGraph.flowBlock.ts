import { load as parseYaml } from 'js-yaml'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import { isUnsafeFlowComputeSource } from '@/lib/flowEditor/flowComputeInline'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import { buildCanonicalWidgetRegistryDraft } from '@/features/flow-editor-manager/registryTemplates'

const FRONTMATTER_FLOW_SETTINGS_KEY = 'frontmatterFlowSettings' as const
const FRONTMATTER_FLOW_WARNINGS_KEY = 'frontmatterFlowWarnings' as const

export const FRONTMATTER_FLOW_WIDGET_FIELDS_KEY = 'frontmatter:widgetFields' as const
export const FRONTMATTER_FLOW_HANDLES_VALUE_KEY = 'frontmatter:handles' as const

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function isChatKnowgrphFlowContractRelaxed(meta: Record<string, unknown>): boolean {
  if (meta['frontmatter:chatKnowgrphRelaxed'] === true) return true
  const topType = asString(meta.type).toLowerCase()
  if (topType === 'chatknowgrph') return true
  const doc = meta.doc
  if (!isRecord(doc)) return false
  const docType = asString(doc.type).toLowerCase()
  return docType === 'chatknowgrph'
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
    const m = /^(\s*[-]?\s*[A-Za-z0-9_.-]+):([^\s].*)$/.exec(line)
    if (m) {
      out.push(`${m[1]}: ${m[2]}`)
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

export function repairFlowInlineEnvelopeBlockScalars(raw: string): string {
  const src = String(raw || '')
  if (!src) return src
  const lines = src.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    const m = /^(\s*)([A-Za-z0-9_.-]+)\s*:\s*\{\s*key:\s*([^,]+?),\s*type:\s*([^,]+?),\s*value:\s*\|\s*$/.exec(line)
    if (!m) {
      out.push(line)
      continue
    }
    const indent = m[1] || ''
    const indentLen = indent.length
    const fieldKey = String(m[2] || '').trim()
    const keyPart = String(m[3] || '').trim()
    const typePart = String(m[4] || '').trim()
    if (!fieldKey || !keyPart || !typePart) {
      out.push(line)
      continue
    }
    out.push(`${indent}${fieldKey}:`)
    out.push(`${indent}  key: ${keyPart}`)
    out.push(`${indent}  type: ${typePart}`)
    out.push(`${indent}  value: |`)
    let consumedClosingBrace = false
    for (let j = i + 1; j < lines.length; j += 1) {
      const bodyLine = String(lines[j] || '')
      const trimmedBody = bodyLine.trim()
      if (/^\s*\}\s*$/.test(bodyLine) && countIndent(bodyLine) <= indentLen) {
        consumedClosingBrace = true
        i = j
        break
      }

      const bodyIndent = countIndent(bodyLine)
      if (trimmedBody && bodyIndent <= indentLen) {
        consumedClosingBrace = true
        i = j - 1
        break
      }

      if (bodyIndent > indentLen && /\}\s*$/.test(bodyLine) && !/^\s*\}\s*$/.test(bodyLine)) {
        let k = j + 1
        while (k < lines.length) {
          const nextRaw = String(lines[k] || '')
          const nextTrimmed = nextRaw.trim()
          if (!nextTrimmed) {
            k += 1
            continue
          }
          if (countIndent(nextRaw) <= indentLen) {
            const stripped = bodyLine.replace(/\}\s*$/, '')
            out.push(stripped ? `  ${stripped}` : stripped)
            consumedClosingBrace = true
            i = j
            break
          }
          break
        }
        if (consumedClosingBrace) break
      }

      out.push(bodyLine ? `  ${bodyLine}` : bodyLine)
    }
    if (!consumedClosingBrace) {
      // Keep original line if malformed envelope to avoid destructive rewrite.
      out.pop()
      out.pop()
      out.pop()
      out.pop()
      out.push(line)
    }
  }
  return out.join('\n')
}

function parseFlowObjectFromYamlBlock(rawBlock: string): Record<string, unknown> | null {
  const block = String(rawBlock || '')
  if (!block) return null
  const repairedBlock = repairFlowInlineEnvelopeBlockScalars(repairYamlInlineColonSpacing(block))
  try {
    const parsed = parseYaml(repairedBlock) as unknown
    if (isRecord(parsed) && isRecord(parsed.flow)) return parsed.flow as Record<string, unknown>
  } catch {
    void 0
  }
  try {
    const synthetic = `---\n${repairedBlock}\n---`
    const fm = parseMarkdownFrontmatter(splitMarkdownLines(synthetic))
    if (isRecord(fm.meta) && isRecord((fm.meta as Record<string, unknown>).flow)) {
      return (fm.meta as Record<string, unknown>).flow as Record<string, unknown>
    }
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
    if (countIndent(rawLine) === 0 && /^flow\s*:\s*$/.test(trimmed)) {
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

export function tryParseFlowBlockFromMarkdownBodyLines(args: {
  lines: string[]
  startLine?: number
  endLineExclusive?: number
}): Record<string, unknown> | null {
  const lines = Array.isArray(args.lines) ? args.lines : []
  if (lines.length === 0) return null
  const start = Math.max(0, Math.floor(args.startLine ?? 0))
  const endExclusive = Math.min(lines.length, Math.max(start + 1, Math.floor(args.endLineExclusive ?? lines.length)))
  if (endExclusive <= start) return null

  let flowLine = -1
  let flowIndent = 0
  let inFence = false
  for (let i = start; i < endExclusive; i += 1) {
    const rawLine = String(lines[i] || '')
    const trimmed = rawLine.trim()
    if (trimmed.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
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
    if (!trimmed) continue
    const indent = countIndent(rawLine)
    if (trimmed.startsWith('```') && indent <= flowIndent) {
      blockEnd = i
      break
    }
    if (indent <= flowIndent && trimmed === '---') {
      blockEnd = i
      break
    }
    if (indent <= flowIndent && trimmed.startsWith('#')) {
      blockEnd = i
      break
    }
    if (indent <= flowIndent && /^[A-Za-z0-9_.-]+\s*:/.test(trimmed)) {
      blockEnd = i
      break
    }
  }

  const flowBlock = lines.slice(flowLine, blockEnd).join('\n')
  return parseFlowObjectFromYamlBlock(flowBlock)
}

function extractWidgetFieldSpecsFromFlowNode(args: {
  rawNode: Record<string, unknown>
  normalizedRawNode: Record<string, unknown>
}): Array<{ fieldKey: string; fieldType: string; schemaPath: string }> {
  const nodeType = asString(args.normalizedRawNode.type)
  const mapFromCanonicalFields = (fields: Array<{ fieldKey: string; fieldType: string; schemaPath?: string }>) => {
    const out: Array<{ fieldKey: string; fieldType: string; schemaPath: string }> = []
    const seen = new Set<string>()
    for (let i = 0; i < fields.length; i += 1) {
      const field = fields[i]
      if (!field) continue
      const fieldKey = asString(field.fieldKey)
      const fieldType = asString(field.fieldType)
      const schemaPath = asString(field.schemaPath) || `properties.${fieldKey}`
      if (!fieldKey || !fieldType || !schemaPath) continue
      const dedupeKey = `${fieldKey}|${schemaPath}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      out.push({ fieldKey, fieldType, schemaPath })
    }
    return out
  }
  const canonicalDraft = buildCanonicalWidgetRegistryDraft({ nodeTypeId: nodeType })
  if (canonicalDraft) {
    return mapFromCanonicalFields(canonicalDraft.fields)
  }

  const out: Array<{ fieldKey: string; fieldType: string; schemaPath: string }> = []
  for (const [k, v] of Object.entries(args.rawNode)) {
    const fieldName = asString(k)
    if (!fieldName) continue
    if (!isRecord(v)) continue
    const rec = v as Record<string, unknown>
    const fieldKey = asString(rec.key)
    const fieldType = asString(rec.type)
    if (!fieldKey || !fieldType) continue

    const schemaPath = (() => {
      if (fieldName === 'compute') return 'flow:compute'
      if (fieldName === 'handles') return FRONTMATTER_FLOW_HANDLES_VALUE_KEY
      return fieldName
    })()

    if (fieldName === 'id' || fieldName === 'type' || fieldName === 'label' || fieldName === 'pos' || fieldName === 'position') continue
    out.push({ fieldKey, fieldType, schemaPath })
  }
  return out
}

function collectDeclaredFlowNodePropertyValues(args: {
  rawNode: Record<string, unknown>
  normalizedRawNode: Record<string, unknown>
  vars: Record<string, unknown>
  pathCache: Map<string, unknown>
  declarationCache: Map<string, unknown>
  resolvedStringCache: Map<string, string>
}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args.rawNode)) {
    const fieldName = asString(k)
    if (!fieldName) continue
    if (
      fieldName === 'id' ||
      fieldName === 'type' ||
      fieldName === 'label' ||
      fieldName === 'pos' ||
      fieldName === 'position' ||
      fieldName === 'handles' ||
      fieldName === 'data' ||
      fieldName === 'compute'
    ) {
      continue
    }
    const rawValue = isRecord(v) && Object.prototype.hasOwnProperty.call(v, 'value')
      ? (v as Record<string, unknown>).value
      : (args.normalizedRawNode as Record<string, unknown>)[fieldName]
    const resolved = resolveTemplateValue(rawValue, args.vars, args.pathCache, args.declarationCache, args.resolvedStringCache)
    if (typeof resolved === 'undefined') continue
    out[fieldName] = resolved
  }
  return out
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

const FLOW_TEMPLATE_KEY_RE = /^[A-Za-z0-9_.-]{1,128}$/

type FlowTemplateExpr = {
  key: string
  declared: string | null
  fallback: string | null
}

function parseFlowTemplateExpr(rawExpr: string): FlowTemplateExpr | null {
  const expr = String(rawExpr || '').trim()
  if (!expr) return null
  let key = expr
  let declared: string | null = null
  let fallback: string | null = null
  const pipeIdx = expr.indexOf('|')
  const colonIdx = expr.indexOf(':')
  if (colonIdx >= 0 && (pipeIdx < 0 || colonIdx < pipeIdx)) {
    key = expr.slice(0, colonIdx).trim()
    if (pipeIdx > colonIdx) {
      declared = expr.slice(colonIdx + 1, pipeIdx).trim()
      fallback = expr.slice(pipeIdx + 1).trim()
    } else {
      declared = expr.slice(colonIdx + 1).trim()
    }
  } else if (pipeIdx >= 0) {
    key = expr.slice(0, pipeIdx).trim()
    fallback = expr.slice(pipeIdx + 1).trim()
  }
  if (!FLOW_TEMPLATE_KEY_RE.test(key)) return null
  return {
    key,
    declared,
    fallback: fallback && fallback.length > 0 ? fallback : null,
  }
}

function resolveFlowTemplateExprValue(args: {
  expr: FlowTemplateExpr
  vars: Record<string, unknown>
  pathCache: Map<string, unknown>
  declarationCache: Map<string, unknown>
}): unknown {
  const { expr, vars, pathCache, declarationCache } = args
  const fromFrontmatter = getPathValue(vars, expr.key, pathCache)
  if (typeof fromFrontmatter !== 'undefined') return fromFrontmatter
  if (declarationCache.has(expr.key)) return declarationCache.get(expr.key)
  if (expr.declared != null) {
    declarationCache.set(expr.key, expr.declared)
    return expr.declared
  }
  if (expr.fallback) {
    if (FLOW_TEMPLATE_KEY_RE.test(expr.fallback)) {
      const fallbackFromFrontmatter = getPathValue(vars, expr.fallback, pathCache)
      if (typeof fallbackFromFrontmatter !== 'undefined') return fallbackFromFrontmatter
      if (declarationCache.has(expr.fallback)) return declarationCache.get(expr.fallback)
      return expr.fallback
    }
    return expr.fallback
  }
  return undefined
}

function resolveTemplateString(
  raw: string,
  vars: Record<string, unknown>,
  pathCache: Map<string, unknown>,
  declarationCache: Map<string, unknown>,
  resolvedCache: Map<string, string>,
): string {
  const source = String(raw || '')
  if (!source) return ''
  const cached = resolvedCache.get(source)
  if (typeof cached === 'string') return cached
  const resolved = source.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (token: string, exprRaw: string) => {
    const parsed = parseFlowTemplateExpr(exprRaw)
    if (!parsed) return token
    const found = resolveFlowTemplateExprValue({ expr: parsed, vars, pathCache, declarationCache })
    if (typeof found === 'undefined') return `{{${String(exprRaw || '').trim()}}}`
    if (found === null) return ''
    if (typeof found === 'string' || typeof found === 'number' || typeof found === 'boolean') return String(found)
    try {
      return JSON.stringify(found)
    } catch {
      return ''
    }
  })
  resolvedCache.set(source, resolved)
  return resolved
}

function resolveTemplateValue(
  value: unknown,
  vars: Record<string, unknown>,
  pathCache: Map<string, unknown>,
  declarationCache: Map<string, unknown>,
  resolvedStringCache: Map<string, string>,
): unknown {
  if (typeof value === 'string') {
    const exactMatch = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(value)
    if (exactMatch) {
      const parsed = parseFlowTemplateExpr(exactMatch[1] || '')
      if (parsed) {
        const found = resolveFlowTemplateExprValue({ expr: parsed, vars, pathCache, declarationCache })
        if (typeof found !== 'undefined') return found === null ? '' : found
      }
    }
    return resolveTemplateString(value, vars, pathCache, declarationCache, resolvedStringCache)
  }
  if (Array.isArray(value)) return value.map(v => resolveTemplateValue(v, vars, pathCache, declarationCache, resolvedStringCache))
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) out[k] = resolveTemplateValue(v, vars, pathCache, declarationCache, resolvedStringCache)
  return out
}

function normalizeFlowNodeType(rawType: string): string {
  const type = String(rawType || '').trim()
  return type || 'default'
}

function sanitizeFlowNodeContract(args: {
  id: string
  type: string
  inputs: Array<Record<string, unknown>>
  outputs: Array<Record<string, unknown>>
  compute: string
  warnings: string[]
  allowMixedHandles: boolean
}): {
  inputs: Array<Record<string, unknown>>
  outputs: Array<Record<string, unknown>>
  compute: string
} {
  const { id, type, warnings } = args
  let inputs = args.inputs
  let outputs = args.outputs
  let compute = args.compute
  if (!args.allowMixedHandles && type === 'input' && inputs.length > 0) {
    warnings.push(`Flow node contract violation: input node ${id} cannot declare target handles`)
    inputs = []
  }
  if (!args.allowMixedHandles && type === 'output' && outputs.length > 0) {
    warnings.push(`Flow node contract violation: output node ${id} cannot declare source handles`)
    outputs = []
  }
  if (compute && isUnsafeFlowComputeSource(compute)) {
    warnings.push(`Flow node compute rejected as unsafe: ${id}`)
    compute = ''
  }
  return { inputs, outputs, compute }
}

function normalizeFlowNodeDataValue(value: unknown): unknown {
  if (typeof value === 'undefined') return undefined
  if (value === null) return null
  if (Array.isArray(value)) return value
  if (isRecord(value)) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return undefined
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

function sanitizeChatKnowgrphNodeData(value: unknown): unknown {
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  const reserved = [
    'handles',
    'inputs',
    'outputs',
    'connections',
    'compute',
    'source',
    'target',
    'sourceHandle',
    'targetHandle',
  ]
  for (let i = 0; i < reserved.length; i += 1) {
    delete out[reserved[i]!]
  }
  return out
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

function unwrapFlowNodeFieldValue(raw: unknown): unknown {
  if (!isRecord(raw)) return raw
  if (!Object.prototype.hasOwnProperty.call(raw, 'value')) return raw
  const keys = Object.keys(raw)
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i]!
    if (k !== 'key' && k !== 'type' && k !== 'value') return raw
  }
  return (raw as Record<string, unknown>).value
}

function normalizeFlowNodeEnvelope(rawNode: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rawNode)) {
    out[k] = unwrapFlowNodeFieldValue(v)
  }
  return out
}

function parseFlowEdgeEndpoint(rawNode: unknown, rawHandle: unknown): { nodeId: string; portKey: string } | null {
  const nodeIdRaw = asString(rawNode)
  const handleRaw = asString(rawHandle)
  if (nodeIdRaw && handleRaw) return { nodeId: nodeIdRaw, portKey: handleRaw }
  const dot = nodeIdRaw.lastIndexOf('.')
  if (dot < 0) return null
  const nodeId = nodeIdRaw.slice(0, dot).trim()
  const portKey = nodeIdRaw.slice(dot + 1).trim()
  if (!nodeId || !portKey) return null
  return { nodeId, portKey }
}

function pruneFlowNodeHandlesByDeclaredConnections(args: {
  nodes: Array<Record<string, unknown>>
  connections: Array<Record<string, unknown>>
  warnings: string[]
}): void {
  const usedInByNode = new Map<string, Set<string>>()
  const usedOutByNode = new Map<string, Set<string>>()
  const ensure = (m: Map<string, Set<string>>, id: string): Set<string> => {
    const prev = m.get(id)
    if (prev) return prev
    const next = new Set<string>()
    m.set(id, next)
    return next
  }
  for (let i = 0; i < args.connections.length; i += 1) {
    const row = args.connections[i]
    const fromNode = asString(row.from_node)
    const fromPort = asString(row.from_port)
    const toNode = asString(row.to_node)
    const toPort = asString(row.to_port)
    if (fromNode && fromPort) ensure(usedOutByNode, fromNode).add(fromPort)
    if (toNode && toPort) ensure(usedInByNode, toNode).add(toPort)
  }
  for (let i = 0; i < args.nodes.length; i += 1) {
    const node = args.nodes[i]
    const nodeId = asString(node.id)
    if (!nodeId) continue
    const oldInputs = Array.isArray(node.inputs) ? (node.inputs as Array<Record<string, unknown>>) : []
    const oldOutputs = Array.isArray(node.outputs) ? (node.outputs as Array<Record<string, unknown>>) : []
    const keepIn = usedInByNode.get(nodeId) || new Set<string>()
    const keepOut = usedOutByNode.get(nodeId) || new Set<string>()
    const nextInputs = oldInputs.filter(p => keepIn.has(asString((p || {}).port)))
    const nextOutputs = oldOutputs.filter(p => keepOut.has(asString((p || {}).port)))
    if (nextInputs.length !== oldInputs.length || nextOutputs.length !== oldOutputs.length) {
      args.warnings.push(`Flow chatKnowgrph contract: pruned unreferenced handles for node ${nodeId}`)
      node.inputs = nextInputs
      node.outputs = nextOutputs
    }
  }
}

function buildFlowTemplateVars(
  vars: Record<string, unknown>,
  nodes: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...vars }
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!isRecord(node)) continue
    const id = asString(node.id)
    if (!id) continue
    merged[id] = {
      id,
      type: asString(node.type),
      label: asString(node.label) || id,
      data: node.data,
      properties: isRecord(node.properties) ? node.properties : undefined,
    }
  }
  return merged
}

export function normalizeMetaWithFlowBlock(meta: Record<string, unknown>): Record<string, unknown> {
  const flow = isRecord(meta.flow) ? (meta.flow as Record<string, unknown>) : null
  if (!flow) return meta
  const readFlowValue = (v: unknown): unknown => unwrapFlowNodeFieldValue(v)
  const allowMixedHandles = isChatKnowgrphFlowContractRelaxed(meta)
  const vars = meta
  const pathCache = new Map<string, unknown>()
  const declarationCache = new Map<string, unknown>()
  const resolvedStringCache = new Map<string, string>()
  const flowWarnings: string[] = []
  const rawNodes = Array.isArray(readFlowValue(flow.nodes)) ? (readFlowValue(flow.nodes) as unknown[]) : []
  const normalizedNodes: Array<Record<string, unknown>> = []
  for (let i = 0; i < rawNodes.length; i += 1) {
    const rawNode = rawNodes[i]
    if (!isRecord(rawNode)) continue
    const normalizedRawNode = normalizeFlowNodeEnvelope(rawNode as Record<string, unknown>)
    const id = asString(normalizedRawNode.id)
    if (!id) continue
    const rawType = asString(normalizedRawNode.type)
    const type = normalizeFlowNodeType(rawType)
    if (!rawType) {
      flowWarnings.push(`Flow node type defaulted to default: ${id}`)
    }
    const labelRaw = asString(normalizedRawNode.label)
    const position = isRecord(normalizedRawNode.position) ? (normalizedRawNode.position as Record<string, unknown>) : null
    const x = position ? asFiniteNumber(position.x) : asFiniteNumber((normalizedRawNode as Record<string, unknown>).pos_x)
    const y = position ? asFiniteNumber(position.y) : asFiniteNumber((normalizedRawNode as Record<string, unknown>).pos_y)
    const handles = isRecord(normalizedRawNode.handles) ? (normalizedRawNode.handles as Record<string, unknown>) : null
    const inputs = coerceFlowNodePorts(handles?.target)
    const outputs = coerceFlowNodePorts(handles?.source)
    const dataResolved = resolveTemplateValue(normalizedRawNode.data, vars, pathCache, declarationCache, resolvedStringCache)
    const dataNormalized = normalizeFlowDataValue(dataResolved)
    const computeRaw = asString(normalizedRawNode.compute)
    let compute = computeRaw ? resolveTemplateString(computeRaw, vars, pathCache, declarationCache, resolvedStringCache) : ''
    if (allowMixedHandles && compute) {
      flowWarnings.push(`Flow chatKnowgrph contract: compute removed for node ${id}`)
      compute = ''
    }
    const sanitized = sanitizeFlowNodeContract({
      id,
      type,
      inputs,
      outputs,
      compute,
      warnings: flowWarnings,
      allowMixedHandles,
    })
    const baseProps = isRecord(normalizedRawNode.properties) ? ({ ...normalizedRawNode.properties } as Record<string, unknown>) : {}
    const widgetFields = extractWidgetFieldSpecsFromFlowNode({
      rawNode: rawNode as Record<string, unknown>,
      normalizedRawNode,
    })
    if (widgetFields.length > 0) baseProps[FRONTMATTER_FLOW_WIDGET_FIELDS_KEY] = widgetFields
    if (handles && Object.keys(handles).length > 0) baseProps[FRONTMATTER_FLOW_HANDLES_VALUE_KEY] = handles
    const declaredProps = collectDeclaredFlowNodePropertyValues({
      rawNode: rawNode as Record<string, unknown>,
      normalizedRawNode,
      vars,
      pathCache,
      declarationCache,
      resolvedStringCache,
    })
    for (const [propKey, propValue] of Object.entries(declaredProps)) {
      if (typeof baseProps[propKey] !== 'undefined') continue
      baseProps[propKey] = propValue
    }

    const normalizedData = normalizeFlowNodeDataValue(
      allowMixedHandles ? sanitizeChatKnowgrphNodeData(dataNormalized.value) : dataNormalized.value,
    )
    const next: Record<string, unknown> = {
      id,
      type,
      label: labelRaw ? resolveTemplateString(labelRaw, vars, pathCache, declarationCache, resolvedStringCache) : id,
      ...(x != null || y != null ? { pos: { ...(x != null ? { x } : {}), ...(y != null ? { y } : {}) } } : {}),
      inputs: sanitized.inputs,
      outputs: sanitized.outputs,
      ...(typeof normalizedData !== 'undefined' ? { data: normalizedData } : {}),
    }
    if (sanitized.compute) next.compute = sanitized.compute
    if (dataNormalized.hasPending) {
      baseProps['frontmatter:waiting'] = true
      next.properties = baseProps
    } else if (Object.keys(baseProps).length > 0) {
      next.properties = baseProps
    }
    normalizedNodes.push(next)
  }
  const flowVars = buildFlowTemplateVars(vars, normalizedNodes)

  const rawEdges = Array.isArray(readFlowValue(flow.edges)) ? (readFlowValue(flow.edges) as unknown[]) : []
  const normalizedConnections: Array<Record<string, unknown>> = []
  for (let i = 0; i < rawEdges.length; i += 1) {
    const row = rawEdges[i]
    if (!isRecord(row)) continue
    const sourceEp = parseFlowEdgeEndpoint(row.source, row.sourceHandle)
    const targetEp = parseFlowEdgeEndpoint(row.target, row.targetHandle)
    if (!sourceEp || !targetEp) continue
    const labelRaw = asString(row.label)
    const label = labelRaw ? resolveTemplateString(labelRaw, flowVars, pathCache, declarationCache, resolvedStringCache) : ''
    const conn: Record<string, unknown> = {
      id: asString(row.id) || `flow-e${String(i + 1).padStart(2, '0')}`,
      from_node: sourceEp.nodeId,
      from_port: sourceEp.portKey,
      to_node: targetEp.nodeId,
      to_port: targetEp.portKey,
      ...(label ? { label } : {}),
      ...(asBoolean(row.animated) === true ? { animated: true } : {}),
      ...(asString(row.type) ? { type: asString(row.type) } : {}),
    }
    normalizedConnections.push(conn)
  }
  if (allowMixedHandles) {
    pruneFlowNodeHandlesByDeclaredConnections({
      nodes: normalizedNodes,
      connections: normalizedConnections,
      warnings: flowWarnings,
    })
  }

  for (let i = 0; i < normalizedNodes.length; i += 1) {
    const node = normalizedNodes[i]
    if (!isRecord(node)) continue
    const labelRaw = asString(node.label)
    const computeRaw = asString(node.compute)
    node.label = labelRaw ? resolveTemplateString(labelRaw, flowVars, pathCache, declarationCache, resolvedStringCache) : asString(node.id)
    node.data = normalizeFlowNodeDataValue(
      resolveTemplateValue(node.data, flowVars, pathCache, declarationCache, resolvedStringCache),
    )
    if (computeRaw) node.compute = resolveTemplateString(computeRaw, flowVars, pathCache, declarationCache, resolvedStringCache)
  }

  const rawDirection = asString(readFlowValue(flow.direction)).toUpperCase()
  const direction = rawDirection === 'LR' || rawDirection === 'TB' || rawDirection === 'RL' || rawDirection === 'BT' ? rawDirection : 'LR'
  const rawEdgeType = asString(readFlowValue(flow.edgeType)).toLowerCase()
  const edgeType = rawEdgeType === 'default' || rawEdgeType === 'straight' || rawEdgeType === 'step' || rawEdgeType === 'smoothstep' || rawEdgeType === 'bezier'
    ? rawEdgeType
    : 'bezier'
  const settings: Record<string, unknown> = {
    direction,
    edgeType,
    balancedViewportPreset: 'widgetFrontmatter',
    balancedHeroRowCount: 3,
    balancedHeroRowGapScale: 0.76,
    balancedHeroRowStaggerScale: 0.12,
    balancedPanelOffsetScale: 0.96,
    ...(asBoolean(readFlowValue(flow.snapToGrid)) != null ? { snapToGrid: asBoolean(readFlowValue(flow.snapToGrid)) } : {}),
    ...(asFiniteNumber(readFlowValue(flow.gridSize)) != null ? { gridSize: Math.max(1, Math.floor(asFiniteNumber(readFlowValue(flow.gridSize)) as number)) } : {}),
    ...(asBoolean(readFlowValue(flow.computed)) != null ? { computed: asBoolean(readFlowValue(flow.computed)) } : {}),
  }

  const next: Record<string, unknown> = {
    ...meta,
    nodes: normalizedNodes,
    connections: normalizedConnections,
    [FRONTMATTER_FLOW_SETTINGS_KEY]: settings,
    ...(flowWarnings.length > 0 ? { [FRONTMATTER_FLOW_WARNINGS_KEY]: readFlowWarnings(flowWarnings) } : {}),
  }
  return next
}

export { FRONTMATTER_FLOW_SETTINGS_KEY, FRONTMATTER_FLOW_WARNINGS_KEY }
