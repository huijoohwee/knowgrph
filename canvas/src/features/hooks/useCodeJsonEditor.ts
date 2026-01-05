import { findObjectBoundsById } from '@/lib/editor'
import { tryFormatJson } from '@/features/code-editor/format'
import { detectIdAroundSelection } from '@/features/code-editor/selection'
import type { GraphData, JSONValue } from '@/lib/graph/types'
import { UI_COPY } from '@/lib/config'

type UseCodeJsonEditorArgs = {
  codeText: string
  setCodeText: (v: string) => void
  setCodeError: (e: string) => void
  codeRef: React.RefObject<HTMLTextAreaElement>
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
      const el = codeRef.current
      const caret = el ? el.selectionStart : 0
      const id = detectIdAroundSelection(codeText, caret, caret + 1)
      const formatted = tryFormatJson(codeText)
      setCodeText(formatted)
      setCodeError('')
      if (el) {
        if (id) {
          const bounds = findObjectBoundsById(formatted, id)
          if (bounds && bounds.start >= 0) {
            el.focus()
            el.setSelectionRange(bounds.start, bounds.start)
          }
        } else {
          const pos = Math.min(caret, formatted.length)
          el.focus()
          el.setSelectionRange(pos, pos)
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      setCodeError(`${UI_COPY.invalidJsonPrefix}${message}`)
    }
  }

  return { formatEditor, applyJson }
}
