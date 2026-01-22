import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { isRecord } from '@/lib/graph/jsonld/utils'
import type { JSONValue } from '@/lib/graph/types'

type StageView = {
  id: string
  name: string
  code: string
  input: string
  output: JSONValue
  library?: { name?: string; url?: string; license?: string }
  metrics?: { latency_ms?: number; status?: string }
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')

const getStagesFromGraphMeta = (graphData: unknown): StageView[] => {
  if (!graphData || typeof graphData !== 'object' || Array.isArray(graphData)) return []
  const meta = (graphData as Record<string, unknown>).metadata
  if (!isRecord(meta)) return []
  const pipeline = meta.graphragTextPipeline
  if (!isRecord(pipeline)) return []
  const stagesRaw = pipeline.stages
  if (!Array.isArray(stagesRaw)) return []
  const out: StageView[] = []
  for (const entry of stagesRaw) {
    if (!isRecord(entry)) continue
    const id = typeof entry.id === 'string' ? entry.id : ''
    const name = typeof entry.name === 'string' ? entry.name : ''
    const code = typeof entry.code === 'string' ? entry.code : ''
    const input = typeof entry.input === 'string' ? entry.input : ''
    const output = (entry.output ?? null) as JSONValue
    const library = isRecord(entry.library) ? entry.library : undefined
    const metrics = isRecord(entry.metrics) ? entry.metrics : undefined
    if (!id || !name) continue
    out.push({ id, name, code, input, output, library, metrics })
  }
  return out
}

export default function GraphRagTextPipelineSection() {
  const graphData = useGraphStore(s => s.graphData)
  const [collapsed, setCollapsed] = React.useState(true)
  const [step, setStep] = React.useState(0)
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-sm')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')

  const stages = React.useMemo(() => getStagesFromGraphMeta(graphData), [graphData])

  React.useEffect(() => {
    if (step < 0) setStep(0)
    if (step >= stages.length) setStep(0)
  }, [step, stages.length])

  if (!stages.length) return null

  const current = stages[Math.min(Math.max(step, 0), stages.length - 1)]!

  const renderOutput = (output: JSONValue) => {
    const rec = isRecord(output) ? output : null
    if (!rec) {
      return (
        <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words">
          {JSON.stringify(output, null, 2)}
        </pre>
      )
    }
    if (isStringArray(rec.tokens) || isStringArray(rec.lemmas) || isStringArray(rec.subwords)) {
      const list = isStringArray(rec.tokens)
        ? rec.tokens
        : isStringArray(rec.lemmas)
          ? rec.lemmas
          : isStringArray(rec.subwords)
            ? rec.subwords
            : []
      return (
        <div className="flex flex-wrap gap-1">
          {list.slice(0, 64).map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-700 text-xs font-mono"
            >
              {t}
            </span>
          ))}
        </div>
      )
    }
    if (Array.isArray(rec.entities)) {
      const entities = rec.entities.filter(isRecord).slice(0, 32)
      return (
        <div className="space-y-1">
          {entities.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs">
                {String(e.text ?? '')}
              </span>
              <span className="text-[10px] font-mono text-gray-500">
                {String(e.label ?? '')}
              </span>
            </div>
          ))}
        </div>
      )
    }
    if (Array.isArray(rec.triples) && rec.triples.every(x => typeof x === 'string')) {
      const triples = rec.triples as string[]
      return (
        <div className="space-y-1">
          {triples.slice(0, 24).map((t, i) => (
            <div
              key={i}
              className="text-xs font-mono text-gray-700 bg-slate-50 border border-slate-200 rounded px-2 py-1"
            >
              {t}
            </div>
          ))}
        </div>
      )
    }
    if (isStringArray(rec.nodes)) {
      return (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">
            Nodes: {rec.nodes.length} · Edges: {String(rec.edges ?? '')} · Communities: {String(rec.communities ?? '')}
          </div>
          <div className="flex flex-wrap gap-1">
            {rec.nodes.slice(0, 48).map((n, i) => (
              <span key={`${n}-${i}`} className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-700 text-xs">
                {n}
              </span>
            ))}
          </div>
        </div>
      )
    }
    return (
      <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words">
        {JSON.stringify(output, null, 2)}
      </pre>
    )
  }

  const header = (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-gray-500">
        {UI_COPY.graphragTextPipelineBadge}
      </span>
      <Tooltip content={UI_COPY.graphragTextPipelineTooltip} maxWidthPx={320} contentClassName="bg-gray-800/90">
        <span className="text-xs font-semibold text-gray-800">
          {UI_COPY.graphragTextPipelineTitle}
        </span>
      </Tooltip>
    </div>
  )

  const lib = current.library || {}
  const hasLibLink = typeof lib.url === 'string' && lib.url.length > 0

  return (
    <CollapsibleSection title={header} collapsed={collapsed} onToggle={setCollapsed}>
      <div className={['mt-2 space-y-2', uiPanelKeyValueTextSizeClass, uiPanelTextFontClass].join(' ')}>
        <div className="flex flex-wrap gap-1">
          {stages.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(i)}
              className={[
                'px-2 py-1 rounded border text-xs transition-colors',
                step === i
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
              ].join(' ')}
            >
              {i + 1}. {s.name}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded border border-gray-200 bg-white p-3 space-y-2">
            <div className="text-xs text-gray-600">
              <span className="font-semibold text-gray-700">{current.name}</span>
              {current.metrics && typeof current.metrics.latency_ms === 'number' && (
                <span className="ml-2 text-[10px] font-mono text-gray-500">
                  {Math.round(current.metrics.latency_ms)}ms
                </span>
              )}
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-2">
              <pre className="text-xs font-mono text-slate-900 whitespace-pre-wrap break-words">
                {current.code}
              </pre>
            </div>
            <div className="text-xs text-gray-600">
              <div className="font-semibold text-gray-700">Input</div>
              <div className="mt-1 text-gray-700 whitespace-pre-wrap break-words">
                {current.input}
              </div>
            </div>
            <div className="text-xs text-gray-600">
              <div className="font-semibold text-gray-700">Library</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-700 text-xs">
                  {String(lib.name || '')}
                </span>
                {hasLibLink && (
                  <a href={String(lib.url)} className="text-blue-700 hover:text-blue-600" target="_blank" rel="noreferrer">
                    {UI_COPY.graphragTextPipelineLibraryLinkLabel}
                  </a>
                )}
                {lib.license && (
                  <span className="text-[10px] font-mono text-gray-500">
                    {String(lib.license)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-white p-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">Output</div>
            {renderOutput(current.output)}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}

