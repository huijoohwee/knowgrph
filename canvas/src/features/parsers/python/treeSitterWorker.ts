/* eslint-disable */
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'

const TREE_SITTER_JS = 'https://cdn.jsdelivr.net/npm/web-tree-sitter@0.20.7/tree-sitter.js'
const TREE_SITTER_WASM = 'https://cdn.jsdelivr.net/npm/web-tree-sitter@0.20.7/tree-sitter.wasm'
const PY_WASM = 'https://cdn.jsdelivr.net/npm/tree-sitter-python@0.20.3/tree-sitter-python.wasm'

type TreeSitterPosition = { row: number }

type TreeSitterNode = {
  type: string
  text: string
  namedChildCount: number
  childForFieldName(name: string): TreeSitterNode | null
  namedChild(index: number): TreeSitterNode
  parent: TreeSitterNode | null
  startPosition: TreeSitterPosition
}

type TreeSitterLanguage = unknown

type TreeSitterParser = {
  setLanguage(lang: TreeSitterLanguage): void
  parse(text: string): { rootNode: TreeSitterNode }
}

type TreeSitterParserConstructor = {
  new(): TreeSitterParser
  init(wasmUrl: string): Promise<void>
  Language: {
    load(wasmUrl: string): Promise<TreeSitterLanguage>
  }
}

type WorkerRequest = { id: string; name: string; text: string }
type WorkerResponse = { id: string; ok: boolean; graphData?: GraphData; warnings?: string[]; error?: string }

type WalkAccumulator = { nodes: Map<string, GraphNode>; edges: GraphEdge[] }

let inited = false
let Parser: TreeSitterParserConstructor | null = null
let Lang: TreeSitterLanguage | null = null

const workerGlobal = self as unknown as {
  importScripts: (...urls: string[]) => void
  TreeSitter?: TreeSitterParserConstructor
  postMessage: (msg: WorkerResponse) => void
}

const ensureInit = async () => {
  if (inited) return
  try {
    workerGlobal.importScripts(TREE_SITTER_JS)
    Parser = workerGlobal.TreeSitter || null
    if (!Parser) throw new Error('TreeSitter global not found')
    await Parser.init(TREE_SITTER_WASM)
    Lang = await Parser.Language.load(PY_WASM)
    inited = true
  } catch (e) {
    throw e
  }
}

const walk = (node: TreeSitterNode, file: string, out: WalkAccumulator) => {
  const type = node.type
  if (type === 'class_definition') {
    const nameNode = node.childForFieldName('name')
    const clsName = nameNode ? nameNode.text : 'Class'
    const id = `py:class:${clsName}`
    if (!out.nodes.has(id)) out.nodes.set(id, { id, label: clsName, type: 'class', properties: { file, line: node.startPosition.row + 1 } })
  } else if (type === 'function_definition') {
    const nameNode = node.childForFieldName('name')
    const fnName = nameNode ? nameNode.text : 'function'
    const withinClass = findAncestor(node, 'class_definition')
    const clsName = withinClass ? withinClass.childForFieldName('name')?.text : undefined
    const id = clsName ? `py:function:${clsName}.${fnName}` : `py:function:${fnName}`
    if (!out.nodes.has(id)) out.nodes.set(id, { id, label: fnName, type: 'function', properties: { file, line: node.startPosition.row + 1 } })
    if (clsName) {
      out.edges.push({ id: `py:member:${id}->py:class:${clsName}`, source: id, target: `py:class:${clsName}`, label: 'memberOf', properties: {} })
    }
  } else if (type === 'import_statement') {
    const moduleNames = [] as string[]
    for (let i = 0; i < node.namedChildCount; i++) {
      const ch = node.namedChild(i)
      if (ch.type === 'dotted_name' || ch.type === 'aliased_import') moduleNames.push(ch.text.replace(/\s+as\s+\w+$/i, ''))
    }
    for (const m of moduleNames) out.edges.push({ id: `py:imports:py:module:${file.replace(/\.py$/i,'')}->py:module:${m}`, source: `py:module:${file.replace(/\.py$/i,'')}`, target: `py:module:${m}`, label: 'imports', properties: { file } })
  } else if (type === 'import_from_statement') {
    const fromNode = node.childForFieldName('module')
    const namesNode = node.childForFieldName('names')
    const base = fromNode ? fromNode.text : ''
    const names = namesNode ? namesNode.text.replace(/[()]/g, '').split(',').map((s: string) => s.trim()).filter(Boolean) : []
    for (const n of names) {
      const q = `${base}.${n}`
      out.edges.push({ id: `py:imports:py:module:${file.replace(/\.py$/i,'')}->py:symbol:${q}`, source: `py:module:${file.replace(/\.py$/i,'')}`, target: `py:symbol:${q}`, label: 'imports', properties: { file } })
      const symId = `py:symbol:${q}`
      if (!out.nodes.has(symId)) out.nodes.set(symId, { id: symId, label: q, type: 'symbol', properties: { file } })
    }
  } else if (type === 'call') {
    const expr = node.childForFieldName('function')
    const parentFn = findAncestor(node, 'function_definition')
    const withinClass = findAncestor(node, 'class_definition')
    const callerNameNode = parentFn ? parentFn.childForFieldName('name') : null
    const clsName = withinClass ? withinClass.childForFieldName('name')?.text : undefined
    const callerId = callerNameNode ? (clsName ? `py:function:${clsName}.${callerNameNode.text}` : `py:function:${callerNameNode.text}`) : null
    if (expr && callerId) {
      const q = expr.text
      const tgtId = q.startsWith('py:') ? q : `py:symbol:${q}`
      out.edges.push({ id: `py:calls:${callerId}->${tgtId}|${node.startPosition.row + 1}`, source: callerId, target: tgtId, label: 'calls', properties: { file, line: node.startPosition.row + 1 } })
      if (tgtId.startsWith('py:symbol:') && !out.nodes.has(tgtId)) out.nodes.set(tgtId, { id: tgtId, label: q, type: 'symbol', properties: { file } })
    }
  }
  for (let i = 0; i < node.namedChildCount; i++) walk(node.namedChild(i), file, out)
}

const findAncestor = (node: TreeSitterNode, type: string): TreeSitterNode | null => {
  let cur = node.parent
  while (cur) { if (cur.type === type) return cur; cur = cur.parent }
  return null
}

;(self as unknown as { onmessage: (ev: MessageEvent) => void }).onmessage = async (ev: MessageEvent) => {
  const msg = ev.data as WorkerRequest
  const id = msg.id
  try {
    await ensureInit()
    if (!Parser || !Lang) throw new Error('TreeSitter not initialized')
    const parser = new Parser()
    parser.setLanguage(Lang)
    const tree = parser.parse(msg.text || '')
    const out: WalkAccumulator = { nodes: new Map<string, GraphNode>(), edges: [] }
    const modId = `py:module:${String(msg.name || '').replace(/\.py$/i,'')}`
    out.nodes.set(modId, { id: modId, label: String(msg.name || '').replace(/\.py$/i,''), type: 'module', properties: { file: msg.name } })
    walk(tree.rootNode, msg.name, out)
    const graphData: GraphData = { context: 'python-ast', type: 'Graph', nodes: Array.from(out.nodes.values()), edges: out.edges }
    workerGlobal.postMessage({ id, ok: true, graphData })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    workerGlobal.postMessage({ id, ok: false, error: message, warnings: ['tree-sitter parsing failed, falling back'] })
  }
}
