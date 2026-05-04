import React, { useMemo, useState } from 'react'
import type { GraphData } from '@/lib/graph/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

function ParserTable({ data }: { data: GraphData | null }) {
  const [tab, setTab] = useState<'nodes' | 'edges'>('nodes')
  const nodeRows = useMemo(() => {
    const nodes = data?.nodes || []
    return nodes.map(n => ({ id: n.id, label: n.label, type: n.type }))
  }, [data?.nodes])
  const edgeRows = useMemo(() => {
    const edges = data?.edges || []
    return edges.map(e => ({ id: e.id, source: String(e.source), target: String(e.target), label: e.label }))
  }, [data?.edges])
  const tabButtonClassName = (isActive: boolean) =>
    `App-toolbar__btn text-xs ${isActive ? UI_THEME_TOKENS.button.neutralSubtle : ''}`.trim()
  const stripeRowClassName = (index: number) =>
    index % 2 === 0 ? UI_THEME_TOKENS.panel.headerBg : ''
  return (
    <div className="mt-2">
      <div className="flex gap-2 mb-2">
        <button className={tabButtonClassName(tab === 'nodes')} onClick={() => setTab('nodes')}>Nodes</button>
        <button className={tabButtonClassName(tab === 'edges')} onClick={() => setTab('edges')}>Edges</button>
      </div>
      {tab === 'nodes' ? (
        <table className="w-full text-xs">
          <thead><tr><th className="text-left px-2 py-1">id</th><th className="text-left px-2 py-1">label</th><th className="text-left px-2 py-1">type</th></tr></thead>
          <tbody>
            {nodeRows.map((r, index) => (
              <tr key={r.id} className={stripeRowClassName(index)}>
                <td className="px-2 py-1">{r.id}</td>
                <td className="px-2 py-1">{r.label}</td>
                <td className="px-2 py-1">{r.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-xs">
          <thead><tr><th className="text-left px-2 py-1">id</th><th className="text-left px-2 py-1">source</th><th className="text-left px-2 py-1">target</th><th className="text-left px-2 py-1">label</th></tr></thead>
          <tbody>
            {edgeRows.map((r, index) => (
              <tr key={r.id} className={stripeRowClassName(index)}>
                <td className="px-2 py-1">{r.id}</td>
                <td className="px-2 py-1">{r.source}</td>
                <td className="px-2 py-1">{r.target}</td>
                <td className="px-2 py-1">{r.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default React.memo(ParserTable)
