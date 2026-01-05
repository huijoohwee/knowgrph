import React from 'react'
import type EditorJS from '@editorjs/editorjs'
import type { OutputData, OutputBlockData, ToolConstructable } from '@editorjs/editorjs'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import type { GraphSchema, PropertySpec } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'

type RootBlockData = {
  typeText: string
  contextText: string
  metadataText: string
}

type EntityKind = 'node' | 'edge'

type EntityBlockData = {
  kind: EntityKind
  jsonText: string
}

type SectionHeaderData = {
  text: string
}

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const raw = String(text || '').trim()
  if (!raw) return { ok: true as const, value: undefined }
  try {
    return { ok: true as const, value: JSON.parse(raw) as unknown }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ''
    return { ok: false as const, error: `${UI_COPY.invalidJsonPrefix}${message}` }
  }
}

function isParseError(
  res: { ok: true; value: unknown } | { ok: false; error: string },
): res is { ok: false; error: string } {
  return res.ok === false
}

function isNodeParseError(
  res: { ok: true; node: GraphNode } | { ok: false; error: string },
): res is { ok: false; error: string } {
  return res.ok === false
}

function isEdgeParseError(
  res: { ok: true; edge: GraphEdge } | { ok: false; error: string },
): res is { ok: false; error: string } {
  return res.ok === false
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x)
}

function collectPropertySpecKeys(spec: Record<string, PropertySpec> | undefined): string[] {
  if (!spec) return []
  return Object.keys(spec).filter(Boolean)
}

function buildPropertyKeySuggestions(schema: GraphSchema | null | undefined, kind: EntityKind, ownerKey: string): string[] {
  const propertySchemas = schema?.propertySchemas
  if (!propertySchemas) return []
  const byOwner = kind === 'node' ? propertySchemas.node : propertySchemas.edge
  if (!byOwner) return []
  const spec = byOwner[ownerKey]
  const keys = collectPropertySpecKeys(spec)
  return keys.slice(0, 24)
}

function tryParseGraphNode(raw: unknown): { ok: true; node: GraphNode } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false as const, error: 'Node must be an object' }
  const id = raw.id
  const label = raw.label
  const type = raw.type
  const properties = raw.properties
  if (typeof id !== 'string' || !id.trim()) return { ok: false as const, error: 'Node.id must be a non-empty string' }
  if (typeof label !== 'string') return { ok: false as const, error: 'Node.label must be a string' }
  if (typeof type !== 'string' || !type.trim()) return { ok: false as const, error: 'Node.type must be a non-empty string' }
  if (!isRecord(properties)) return { ok: false as const, error: 'Node.properties must be an object' }
  return { ok: true as const, node: raw as unknown as GraphNode }
}

function tryParseGraphEdge(raw: unknown): { ok: true; edge: GraphEdge } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false as const, error: 'Edge must be an object' }
  const id = raw.id
  const label = raw.label
  const source = raw.source
  const target = raw.target
  const properties = raw.properties
  if (typeof id !== 'string' || !id.trim()) return { ok: false as const, error: 'Edge.id must be a non-empty string' }
  if (typeof label !== 'string') return { ok: false as const, error: 'Edge.label must be a string' }
  if (typeof source !== 'string' || !source.trim()) return { ok: false as const, error: 'Edge.source must be a non-empty string' }
  if (typeof target !== 'string' || !target.trim()) return { ok: false as const, error: 'Edge.target must be a non-empty string' }
  if (!isRecord(properties)) return { ok: false as const, error: 'Edge.properties must be an object' }
  return { ok: true as const, edge: raw as unknown as GraphEdge }
}

function toEditorOutputData(graphData: GraphData): OutputData {
  const blocks: OutputBlockData[] = []
  blocks.push({
    type: 'sectionHeader',
    data: { text: 'Graph' } satisfies SectionHeaderData,
  })
  blocks.push({
    type: 'graphRoot',
    data: {
      typeText: String(graphData.type || 'Graph'),
      contextText: graphData.context === undefined ? '' : stringifyJson(graphData.context),
      metadataText: graphData.metadata ? stringifyJson(graphData.metadata) : '',
    } satisfies RootBlockData,
  })
  blocks.push({
    type: 'sectionHeader',
    data: { text: `Nodes (${graphData.nodes.length})` } satisfies SectionHeaderData,
  })
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    blocks.push({
      type: 'graphEntity',
      data: {
        kind: 'node',
        jsonText: stringifyJson(graphData.nodes[i]),
      } satisfies EntityBlockData,
    })
  }
  blocks.push({
    type: 'sectionHeader',
    data: { text: `Edges (${graphData.edges.length})` } satisfies SectionHeaderData,
  })
  for (let i = 0; i < graphData.edges.length; i += 1) {
    blocks.push({
      type: 'graphEntity',
      data: {
        kind: 'edge',
        jsonText: stringifyJson(graphData.edges[i]),
      } satisfies EntityBlockData,
    })
  }
  return { blocks }
}

function parseEditorOutputData(output: OutputData): { ok: true; graphData: GraphData } | { ok: false; error: string } {
  const blocks = Array.isArray(output?.blocks) ? output.blocks : []
  const root = blocks.find(b => b.type === 'graphRoot')?.data as RootBlockData | undefined
  const typeText = String(root?.typeText || '').trim() || 'Graph'

  const contextRes = parseJson(String(root?.contextText || ''))
  if (isParseError(contextRes)) return { ok: false as const, error: `Context: ${contextRes.error}` }
  const metadataRes = parseJson(String(root?.metadataText || ''))
  if (isParseError(metadataRes)) return { ok: false as const, error: `Metadata: ${metadataRes.error}` }

  const context =
    typeof contextRes.value === 'undefined' ? undefined : (contextRes.value as JSONValue)
  const metadata =
    typeof metadataRes.value === 'undefined'
      ? undefined
      : isRecord(metadataRes.value)
        ? (metadataRes.value as Record<string, JSONValue>)
        : null
  if (metadata === null) return { ok: false as const, error: 'Metadata must be a JSON object' }

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i]
    if (b.type !== 'graphEntity') continue
    const data = (b.data || {}) as EntityBlockData
    const kind = data.kind
    const jsonText = String(data.jsonText || '')
    const parsed = parseJson(jsonText)
    if (isParseError(parsed)) {
      return { ok: false as const, error: `${kind === 'edge' ? 'Edge' : 'Node'} #${nodes.length + edges.length + 1}: ${parsed.error}` }
    }
    if (kind === 'node') {
      const res = tryParseGraphNode(parsed.value)
      if (isNodeParseError(res)) return { ok: false as const, error: `Node: ${res.error}` }
      nodes.push(res.node)
      continue
    }
    if (kind === 'edge') {
      const res = tryParseGraphEdge(parsed.value)
      if (isEdgeParseError(res)) return { ok: false as const, error: `Edge: ${res.error}` }
      edges.push(res.edge)
    }
  }

  return {
    ok: true as const,
    graphData: {
      type: typeText,
      context,
      metadata,
      nodes,
      edges,
    },
  }
}

class SectionHeaderTool {
  static get toolbox() {
    return { title: 'Section', icon: '' }
  }

  private data: SectionHeaderData

  constructor({ data }: { data: SectionHeaderData }) {
    this.data = data || { text: '' }
  }

  render() {
    const wrapper = document.createElement('div')
    wrapper.className = 'py-1'
    const text = document.createElement('div')
    text.className = 'text-xs font-semibold text-gray-700'
    text.textContent = String(this.data.text || '')
    wrapper.appendChild(text)
    return wrapper
  }

  save() {
    return { text: String(this.data.text || '') } satisfies SectionHeaderData
  }
}

class GraphRootTool {
  static get toolbox() {
    return { title: 'Graph', icon: '' }
  }

  private data: RootBlockData
  private config: { onChange?: () => void }
  private typeInput: HTMLInputElement | null = null
  private contextTextarea: HTMLTextAreaElement | null = null
  private metadataTextarea: HTMLTextAreaElement | null = null

  constructor({ data, config }: { data: RootBlockData; config: { onChange?: () => void } }) {
    this.data = data || { typeText: 'Graph', contextText: '', metadataText: '' }
    this.config = config || {}
  }

  render() {
    const wrapper = document.createElement('div')
    wrapper.className = 'border border-gray-200 rounded p-2 bg-white'

    const typeRow = document.createElement('div')
    typeRow.className = 'flex items-center gap-2'
    const typeLabel = document.createElement('div')
    typeLabel.className = 'text-xs text-gray-600 shrink-0'
    typeLabel.textContent = 'type'
    const typeInput = document.createElement('input')
    typeInput.className = 'flex-1 h-7 px-2 text-xs border border-gray-300 rounded'
    typeInput.value = String(this.data.typeText || '')
    typeInput.addEventListener('input', () => {
      this.data.typeText = typeInput.value
      this.config.onChange?.()
    })
    typeRow.appendChild(typeLabel)
    typeRow.appendChild(typeInput)

    const contextLabel = document.createElement('div')
    contextLabel.className = 'mt-2 text-xs text-gray-600'
    contextLabel.textContent = 'context (JSON / JSON-LD)'
    const contextTextarea = document.createElement('textarea')
    contextTextarea.className = 'mt-1 w-full min-h-24 px-2 py-2 text-xs border border-gray-300 rounded font-mono'
    contextTextarea.value = String(this.data.contextText || '')
    contextTextarea.addEventListener('input', () => {
      this.data.contextText = contextTextarea.value
      this.config.onChange?.()
    })

    const metadataLabel = document.createElement('div')
    metadataLabel.className = 'mt-2 text-xs text-gray-600'
    metadataLabel.textContent = 'metadata (JSON)'
    const metadataTextarea = document.createElement('textarea')
    metadataTextarea.className = 'mt-1 w-full min-h-24 px-2 py-2 text-xs border border-gray-300 rounded font-mono'
    metadataTextarea.value = String(this.data.metadataText || '')
    metadataTextarea.addEventListener('input', () => {
      this.data.metadataText = metadataTextarea.value
      this.config.onChange?.()
    })

    wrapper.appendChild(typeRow)
    wrapper.appendChild(contextLabel)
    wrapper.appendChild(contextTextarea)
    wrapper.appendChild(metadataLabel)
    wrapper.appendChild(metadataTextarea)

    this.typeInput = typeInput
    this.contextTextarea = contextTextarea
    this.metadataTextarea = metadataTextarea
    return wrapper
  }

  save() {
    return {
      typeText: String(this.typeInput?.value ?? this.data.typeText ?? ''),
      contextText: String(this.contextTextarea?.value ?? this.data.contextText ?? ''),
      metadataText: String(this.metadataTextarea?.value ?? this.data.metadataText ?? ''),
    } satisfies RootBlockData
  }
}

class GraphEntityTool {
  static get toolbox() {
    return { title: 'Entity', icon: '' }
  }

  private data: EntityBlockData
  private config: { onChange?: () => void; schema?: GraphSchema }
  private textarea: HTMLTextAreaElement | null = null
  private suggestionsRow: HTMLDivElement | null = null

  constructor({ data, config }: { data: EntityBlockData; config: { onChange?: () => void; schema?: GraphSchema } }) {
    this.data = data || { kind: 'node', jsonText: '' }
    this.config = config || {}
  }

  private rebuildSuggestions() {
    const row = this.suggestionsRow
    if (!row) return
    row.innerHTML = ''
    const jsonText = String(this.textarea?.value ?? this.data.jsonText ?? '')
    const parsed = parseJson(jsonText)
    if (!parsed.ok) return
    if (!isRecord(parsed.value)) return
    const schema = this.config.schema
    if (!schema) return
    const kind = this.data.kind
    const ownerKey = kind === 'node' ? String(parsed.value.type || '') : String(parsed.value.label || '')
    if (!ownerKey.trim()) return
    const suggestions = buildPropertyKeySuggestions(schema, kind, ownerKey)
    if (suggestions.length === 0) return

    const label = document.createElement('div')
    label.className = 'text-[10px] text-gray-500 shrink-0'
    label.textContent = 'suggest'
    row.appendChild(label)

    for (let i = 0; i < suggestions.length; i += 1) {
      const key = suggestions[i]
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'px-1.5 py-0.5 text-[10px] border border-gray-200 rounded bg-gray-50 text-gray-700 hover:bg-gray-100'
      btn.textContent = key
      btn.addEventListener('click', () => {
        const el = this.textarea
        if (!el) return
        const insert = `"${key}": `
        const start = el.selectionStart ?? el.value.length
        const end = el.selectionEnd ?? el.value.length
        el.value = el.value.slice(0, start) + insert + el.value.slice(end)
        const nextPos = start + insert.length
        try { el.focus() } catch { void 0 }
        try { el.setSelectionRange(nextPos, nextPos) } catch { void 0 }
        this.data.jsonText = el.value
        this.config.onChange?.()
      })
      row.appendChild(btn)
    }
  }

  render() {
    const wrapper = document.createElement('div')
    wrapper.className = 'border border-gray-200 rounded p-2 bg-white'

    const header = document.createElement('div')
    header.className = 'flex items-center justify-between gap-2'
    const title = document.createElement('div')
    title.className = 'text-xs text-gray-600'
    title.textContent = this.data.kind === 'edge' ? 'Edge' : 'Node'
    header.appendChild(title)

    const suggestionsRow = document.createElement('div')
    suggestionsRow.className = 'mt-1 flex flex-wrap items-center gap-1'

    const textarea = document.createElement('textarea')
    textarea.className = 'mt-2 w-full min-h-28 px-2 py-2 text-xs border border-gray-300 rounded font-mono'
    textarea.value = String(this.data.jsonText || '')
    textarea.addEventListener('input', () => {
      this.data.jsonText = textarea.value
      this.rebuildSuggestions()
      this.config.onChange?.()
    })

    wrapper.appendChild(header)
    wrapper.appendChild(suggestionsRow)
    wrapper.appendChild(textarea)

    this.textarea = textarea
    this.suggestionsRow = suggestionsRow
    this.rebuildSuggestions()
    return wrapper
  }

  save() {
    return {
      kind: this.data.kind,
      jsonText: String(this.textarea?.value ?? this.data.jsonText ?? ''),
    } satisfies EntityBlockData
  }
}

export default function BottomPanelGraphDataBlockEditor() {
  const graphData = useGraphStore(s => s.graphData)
  const setGraphData = useGraphStore(s => s.setGraphData)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectionSource = useGraphStore(s => s.selectionSource)
  const uiPanelMicroLabelTextSizeClass = useGraphStore(s => s.uiPanelMicroLabelTextSizeClass || 'text-xs')
  const holderRef = React.useRef<HTMLDivElement | null>(null)
  const editorRef = React.useRef<EditorJS | null>(null)
  const saveTimerRef = React.useRef<number | null>(null)
  const isApplyingRef = React.useRef(false)
  const lastRenderedHashRef = React.useRef<string>('')
  const [error, setError] = React.useState<string>('')
  const highlightedElRef = React.useRef<HTMLElement | null>(null)

  const scheduleSave = React.useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    saveTimerRef.current = window.setTimeout(async () => {
      const editor = editorRef.current as unknown as { save?: () => Promise<OutputData> } | null
      if (!editor?.save) return
      try {
        const output = await editor.save()
        const parsed = parseEditorOutputData(output)
        if (parsed.ok === false) {
          setError(parsed.error)
          return
        }
        isApplyingRef.current = true
        setError('')
        setGraphData(parsed.graphData)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : ''
        setError(message ? `Save failed: ${message}` : 'Save failed')
      }
    }, 250)
  }, [setGraphData])

  const scheduleSaveRef = React.useRef(scheduleSave)
  React.useEffect(() => {
    scheduleSaveRef.current = scheduleSave
  }, [scheduleSave])

  React.useEffect(() => {
    let isUnmounted = false
    const mount = async () => {
      const holder = holderRef.current
      if (!holder) return
      const { default: Editor } = await import('@editorjs/editorjs')
      if (isUnmounted) return
      const base: GraphData = useGraphStore.getState().graphData || { type: 'Graph', nodes: [], edges: [] }
      const schema = useGraphStore.getState().schema
      const data = toEditorOutputData(base)
      lastRenderedHashRef.current = stringifyJson(base)
      const editor = new Editor({
        holder,
        data,
        tools: {
          sectionHeader: SectionHeaderTool as unknown as ToolConstructable,
          graphRoot: {
            class: GraphRootTool as unknown as ToolConstructable,
            config: { onChange: () => scheduleSaveRef.current() },
          },
          graphEntity: {
            class: GraphEntityTool as unknown as ToolConstructable,
            config: { onChange: () => scheduleSaveRef.current(), schema: schema ?? undefined },
          },
        },
        minHeight: 0,
      }) as unknown as EditorJS
      editorRef.current = editor
    }
    void mount()
    return () => {
      isUnmounted = true
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      const editor = editorRef.current as unknown as { destroy?: () => void } | null
      editorRef.current = null
      try {
        editor?.destroy?.()
      } catch {
        void 0
      }
    }
  }, [])

  React.useEffect(() => {
    const editor = editorRef.current as unknown as { render?: (data: OutputData) => Promise<void> } | null
    if (!editor?.render) return
    const base: GraphData = graphData || { type: 'Graph', nodes: [], edges: [] }
    const nextHash = stringifyJson(base)
    if (isApplyingRef.current) {
      isApplyingRef.current = false
      lastRenderedHashRef.current = nextHash
      return
    }
    if (nextHash === lastRenderedHashRef.current) return
    lastRenderedHashRef.current = nextHash
    void editor.render(toEditorOutputData(base))
  }, [graphData])

  React.useEffect(() => {
    if (selectionSource !== 'canvas') return
    const id = selectedNodeId || selectedEdgeId
    if (!id) return
    const holder = holderRef.current
    if (!holder) return

    const clearHighlight = () => {
      const el = highlightedElRef.current
      if (!el) return
      el.classList.remove('kg-block-highlight')
      highlightedElRef.current = null
    }

    const raf = requestAnimationFrame(() => {
      const textareas = Array.from(holder.querySelectorAll('textarea')) as HTMLTextAreaElement[]
      let targetTextarea: HTMLTextAreaElement | null = null

      for (let i = 0; i < textareas.length; i += 1) {
        const ta = textareas[i]
        const parsed = parseJson(ta.value)
        if (!parsed.ok) continue
        if (!isRecord(parsed.value)) continue
        const parsedId = String((parsed.value as { id?: unknown }).id || '')
        if (parsedId === id) {
          targetTextarea = ta
          break
        }
      }

      const targetCard =
        (targetTextarea?.closest('div.border') as HTMLElement | null) ||
        (targetTextarea?.closest('div') as HTMLElement | null)

      if (!targetCard) {
        clearHighlight()
        return
      }

      if (highlightedElRef.current && highlightedElRef.current !== targetCard) {
        highlightedElRef.current.classList.remove('kg-block-highlight')
      }

      targetCard.classList.add('kg-block-highlight')
      highlightedElRef.current = targetCard

      try {
        targetCard.scrollIntoView({ block: 'start', behavior: 'auto' })
      } catch {
        void 0
      }
    })

    return () => cancelAnimationFrame(raf)
  }, [selectedEdgeId, selectedNodeId, selectionSource])

  return (
    <div className="h-full min-h-0 flex flex-col">
      {error && (
        <div className={`mb-2 ${uiPanelMicroLabelTextSizeClass} text-red-600 shrink-0`}>
          {error}
        </div>
      )}
      <div ref={holderRef} className="kg-editorjs w-full flex-1 min-h-0 overflow-auto pl-[72px] pr-3" />
    </div>
  )
}
