import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'

const MarkdownWorkspaceLazy = React.lazy(() =>
  import('./BottomPanel/markdownWorkspace/MarkdownWorkspace').then(mod => ({ default: mod.MarkdownWorkspace })),
)
const GraphTableWorkspaceLazy = React.lazy(() => import('@/features/graph-table/ui/GraphTableWorkspace'))

export function EmbeddedEditorShell(props: { active: boolean }) {
  const pane = useGraphStore(s => s.editorWorkspacePane)
  const [graphTableWarmed, setGraphTableWarmed] = React.useState(pane === 'graphTable')
  React.useEffect(() => {
    if (pane === 'graphTable') setGraphTableWarmed(true)
  }, [pane])

  React.useEffect(() => {
    if (graphTableWarmed) return
    if (typeof window === 'undefined') return
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const schedule = w.requestIdleCallback
      ? () => w.requestIdleCallback?.(() => void import('@/features/graph-table/ui/GraphTableWorkspace'), { timeout: 2000 }) as number
      : () => window.setTimeout(() => void import('@/features/graph-table/ui/GraphTableWorkspace'), 400)
    const cancel = w.cancelIdleCallback
      ? (id: number) => w.cancelIdleCallback?.(id)
      : (id: number) => window.clearTimeout(id)
    const id = schedule()
    return () => cancel(id)
  }, [graphTableWarmed])

  const showGraphTable = pane === 'graphTable'
  const showMarkdown = !showGraphTable

  return (
    <div className={`relative w-full h-full ${props.active ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!props.active}>
      <div className={`absolute inset-0 ${showMarkdown ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <React.Suspense fallback={null}>
          <MarkdownWorkspaceLazy active={props.active && showMarkdown} />
        </React.Suspense>
      </div>

      {graphTableWarmed ? (
        <div className={`absolute inset-0 ${showGraphTable ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <React.Suspense fallback={<div className="p-3 text-sm opacity-70">Loading table…</div>}>
            <GraphTableWorkspaceLazy active={props.active && showGraphTable} />
          </React.Suspense>
        </div>
      ) : null}
    </div>
  )
}
