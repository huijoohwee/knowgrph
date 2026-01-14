import { findObjectBoundsById } from '@/lib/editor'
import { tryFormatJson } from '@/features/code-editor/format'
import { detectIdAroundSelection } from '@/features/code-editor/selection'
import type { GraphData, JSONValue } from '@/lib/graph/types'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

type UseCodeJsonEditorArgs = {
  codeText: string
  setCodeText: (v: string) => void
  setCodeError: (e: string) => void
  codeRef: React.RefObject<MonacoTextEditorHandle | null>
  setGraphData: (v: GraphData) => void
}

const isRecord = (x: unknown): x is Record<string, JSONValue> => !!x && typeof x === 'object'

export function useCodeJsonEditor({
  codeText,
  setCodeText,
  setCodeError,
  codeRef,
  setGraphData,
}: UseCodeJsonEditorArgs) {
  const formatEditor = () => {
    try {
      const handle = codeRef.current
      const offsets = handle?.getSelectionOffsets()
      const caret = offsets ? offsets.startOffset : 0
      const id = detectIdAroundSelection(codeText, caret, caret + 1)
      const formatted = tryFormatJson(codeText)
      setCodeText(formatted)
      setCodeError('')
      if (handle) {
        if (id) {
          const bounds = findObjectBoundsById(formatted, id)
          if (bounds && bounds.start >= 0) {
            handle.focus()
            handle.setSelectionOffsets(bounds.start, bounds.start)
          }
        } else {
          const pos = Math.min(caret, formatted.length)
          handle.focus()
          handle.setSelectionOffsets(pos, pos)
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      setCodeError(`${UI_COPY.invalidJsonPrefix}${message}`)
    }
  }

  const applyJson = () => {
    try {
      const raw = JSON.parse(codeText) as unknown
      if (!raw || typeof raw !== 'object' || raw === null) {
        setCodeError('JSON must include nodes[] and edges[]')
        return
      }
      const candidate = raw as {
        context?: unknown
        metadata?: unknown
        type?: unknown
        nodes?: unknown
        edges?: unknown
      }
      if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
        setCodeError('JSON must include nodes[] and edges[]')
        return
      }
      const context: JSONValue | undefined =
        typeof candidate.context === 'undefined' ? undefined : (candidate.context as JSONValue)
      const metadata =
        isRecord(candidate.metadata) ? (candidate.metadata as Record<string, JSONValue>) : undefined
      const graph: GraphData = {
        context,
        metadata,
        type: typeof candidate.type === 'string' ? candidate.type : 'Graph',
        nodes: candidate.nodes as GraphData['nodes'],
        edges: candidate.edges as GraphData['edges'],
      }
      setGraphData(graph)
      setCodeText(JSON.stringify(graph, null, 2))
      setCodeError('')
      try {
        const store = useGraphStore.getState()
        const name = store.markdownDocumentName
        const jsonSource = store.jsonSourceDocumentText
        const shouldUpdateJsonSource =
          typeof jsonSource === 'string' && jsonSource.trim()
            ? true
            : typeof name === 'string' && (name.endsWith('.json') || name.endsWith('.jsonld'))
        if (shouldUpdateJsonSource && typeof store.setJsonSourceDocument === 'function') {
          const baseName =
            typeof name === 'string' && name.trim()
              ? name
              : 'graph.json'
          store.setJsonSourceDocument(baseName, codeText)
        }
      } catch {
        void 0
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      setCodeError(`${UI_COPY.invalidJsonPrefix}${message}`)
    }
  }

  return { formatEditor, applyJson }
}
