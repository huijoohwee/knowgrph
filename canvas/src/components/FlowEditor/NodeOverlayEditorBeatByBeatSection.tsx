import React from 'react'

import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'
import { pad2, parseBeatIndexFromNodeId, readBeatRefFromParams } from '@/components/FlowEditor/beatByBeat'
import { FLOW_WIDGET_BEAT_WIRING_COLUMN_STYLES, FLOW_WIDGET_BEAT_WIRING_ROW_LAYOUT } from '@/components/FlowEditor/nodeOverlayEditorTableLayout'

function readEdgePortKey(edge: GraphEdge, key: string): string {
  const props = (edge.properties || {}) as Record<string, unknown>
  const v = props[key]
  return typeof v === 'string' ? v.trim() : ''
}

function deriveBeatWiringEdges(args: {
  beatRef: string
  clipNodeId: string
  overlayNodeId: string
  edges: ReadonlyArray<GraphEdge>
}): GraphEdge[] {
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return []
  const clipId = String(args.clipNodeId || '').trim()
  const overlayId = String(args.overlayNodeId || '').trim()
  const edges = Array.isArray(args.edges) ? args.edges : []
  if (!clipId || !overlayId || edges.length === 0) return []

  const out: GraphEdge[] = []
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    if (!e) continue
    const source = String((e as { source?: unknown }).source || '').trim()
    const target = String((e as { target?: unknown }).target || '').trim()
    if (!source || !target) continue
    const fromPort = readEdgePortKey(e, FLOW_EDGE_SOURCE_PORT_KEY)
    if (!fromPort) continue
    const isBeatTimelineEdge = source === 'NODE_TIMELINE' && fromPort === `${beatRef}_out`
    const touchesClipOrOverlay = source === clipId || target === clipId || source === overlayId || target === overlayId
    if (!isBeatTimelineEdge && !touchesClipOrOverlay) continue
    out.push(e)
  }
  out.sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))
  return out
}

const BEAT_WIRING_CACHE = new WeakMap<object, Map<string, GraphEdge[]>>()

function getCachedBeatWiringEdges(args: {
  beatRef: string
  clipNodeId: string
  overlayNodeId: string
  edges: ReadonlyArray<GraphEdge>
}): GraphEdge[] {
  const key = `${String(args.beatRef || '').trim()}|${String(args.clipNodeId || '').trim()}|${String(args.overlayNodeId || '').trim()}`
  if (!key) return []
  const edgesKey = args.edges as unknown as object
  const cache = BEAT_WIRING_CACHE.get(edgesKey) || new Map<string, GraphEdge[]>()
  if (!BEAT_WIRING_CACHE.has(edgesKey)) BEAT_WIRING_CACHE.set(edgesKey, cache)
  const hit = cache.get(key)
  if (hit) return hit
  const computed = deriveBeatWiringEdges(args)
  cache.set(key, computed)
  return computed
}

export const NodeOverlayEditorBeatByBeatSection = React.memo(function NodeOverlayEditorBeatByBeatSection(props: {
  node: GraphNode
  graphMetaKind: string | null | undefined
  edges: ReadonlyArray<GraphEdge>
  microLabelClass: string
  monospaceTextClass: string
  compact?: boolean
}) {
  const { node, graphMetaKind, edges, microLabelClass, monospaceTextClass, compact = false } = props
  const isFrontmatterFlow = String(graphMetaKind || '').trim() === 'frontmatter-flow'

  const nodeId = String(node.id || '').trim()
  const beatIndex = parseBeatIndexFromNodeId(nodeId)
  const beatRefFromParams = readBeatRefFromParams(node)
  const beatRef = beatRefFromParams || (beatIndex != null ? `beat_${pad2(beatIndex)}` : '')

  const clipNodeId = nodeId.startsWith('NODE_CLIP_') ? nodeId : beatIndex != null ? `NODE_CLIP_${pad2(beatIndex)}` : ''
  const overlayNodeId = nodeId.startsWith('NODE_OVERLAY_') ? nodeId : beatIndex != null ? `NODE_OVERLAY_${pad2(beatIndex)}` : ''

  const beatNo = beatIndex != null ? pad2(beatIndex) : beatRef.replace(/^beat_/, '')
  const clipKey = `clip_${beatNo}`
  const overlayKey = `overlay_${beatNo}`
  const sfxKey = `sfx_${beatNo}`

  const wiringEdges = React.useMemo(
    () => getCachedBeatWiringEdges({ beatRef, clipNodeId, overlayNodeId, edges }),
    [beatRef, clipNodeId, overlayNodeId, edges],
  )

  const overlayTextLine = React.useMemo(() => {
    if (beatRef === 'beat_01') return `{{variables.hook[variables.hook.active]}}`
    if (beatRef === 'beat_04') return `{{variables.cta[variables.cta.active]}}`
    return `{{overlays.${overlayKey}.text}}`
  }, [beatRef, overlayKey])

  const overlayNote = React.useMemo(() => {
    if (beatRef === 'beat_01') return `text resolves from NODE_VARIABLES.hook_out`
    if (beatRef === 'beat_02') return `text from NODE_STRINGS.subject_out and NODE_STRINGS.stats_out`
    if (beatRef === 'beat_03') return `stat card · text from NODE_STRINGS.stats_out · background fill from NODE_PALETTE.palette_out`
    if (beatRef === 'beat_04') return `text resolves from NODE_VARIABLES.cta_out`
    return ''
  }, [beatRef])

  const audioNote = React.useMemo(() => {
    if (beatRef === 'beat_01' || beatRef === 'beat_02') return `wired from NODE_AUDIO_VO and NODE_AUDIO_SFX`
    if (beatRef === 'beat_03') return `wired from NODE_AUDIO_VO and NODE_AUDIO_SCORE music swell`
    if (beatRef === 'beat_04') return `wired from NODE_AUDIO_VO`
    return ''
  }, [beatRef])

  if (!isFrontmatterFlow || !beatRef || !clipNodeId || !overlayNodeId) return null

  if (compact) {
    return (
      <section className="min-w-0 mt-4" aria-label="Beat-by-beat script">
        <header className="min-w-0">
          <h3 className={cn('font-semibold', UI_THEME_TOKENS.text.primary)}>
            <span>{beatRef}</span>
            <span>{' · '}</span>
            <code className={cn(monospaceTextClass, UI_THEME_TOKENS.text.secondary)}>{`{{timeline.beats.${beatRef}.label}}`}</code>
            <span>{' · '}</span>
            <code className={cn(monospaceTextClass, UI_THEME_TOKENS.text.secondary)}>{clipNodeId}</code>
            <span>{' → '}</span>
            <code className={cn(monospaceTextClass, UI_THEME_TOKENS.text.secondary)}>{overlayNodeId}</code>
          </h3>
        </header>
      </section>
    )
  }

  return (
    <section className="min-w-0 mt-4" aria-label="Beat-by-beat script">
      <header className="min-w-0">
        <h3 className={cn('font-semibold', UI_THEME_TOKENS.text.primary)}>
          <span>{beatRef}</span>
          <span>{' · '}</span>
          <code className={cn(monospaceTextClass, UI_THEME_TOKENS.text.secondary)}>{`{{timeline.beats.${beatRef}.label}}`}</code>
          <span>{' · '}</span>
          <code className={cn(monospaceTextClass, UI_THEME_TOKENS.text.secondary)}>{clipNodeId}</code>
          <span>{' → '}</span>
          <code className={cn(monospaceTextClass, UI_THEME_TOKENS.text.secondary)}>{overlayNodeId}</code>
        </h3>
        <section className={cn('mt-2', UI_THEME_TOKENS.text.secondary)}>
          <strong>Timing</strong>
          <span>{' — '}</span>
          <code className={monospaceTextClass}>{`{{timeline.beats.${beatRef}.start_ms}}`}</code>
          <span>{' ms to '}</span>
          <code className={monospaceTextClass}>{`{{timeline.beats.${beatRef}.end_ms}}`}</code>
          <span>{' ms · duration '}</span>
          <code className={monospaceTextClass}>{`{{timeline.beats.${beatRef}.duration_ms}}`}</code>
          <span>{' ms'}</span>
        </section>
      </header>

      <section className="min-w-0 mt-3" aria-label="Visual">
        <section className={cn(UI_THEME_TOKENS.text.secondary)}>
          <strong>Visual</strong>
        </section>
        <ul className={cn('mt-1 list-disc pl-5', UI_THEME_TOKENS.text.secondary)}>
          <li>
            <span>{'Clip description — '}</span>
            <code className={monospaceTextClass}>{`{{clips.${clipKey}.description}}`}</code>
          </li>
          <li>
            <span>{'Source — '}</span>
            <code className={monospaceTextClass}>{`{{clips.${clipKey}.source}}`}</code>
          </li>
          <li>
            <span>{'Transition in / out — '}</span>
            <code className={monospaceTextClass}>{`{{clips.${clipKey}.transition_in}}`}</code>
            <span>{' / '}</span>
            <code className={monospaceTextClass}>{`{{clips.${clipKey}.transition_out}}`}</code>
          </li>
          {beatRef === 'beat_04' ? (
            <li>
              <span>{'Branding — '}</span>
              <code className={monospaceTextClass}>{'{{constants.brand.handle}}'}</code>
              <span>{' · watermark '}</span>
              <code className={monospaceTextClass}>{'{{constants.brand.watermark}}'}</code>
              <span>{' from '}</span>
              <code className={monospaceTextClass}>{'NODE_CONSTANTS.brand_out'}</code>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="min-w-0 mt-3" aria-label="Overlay">
        <section className={cn(UI_THEME_TOKENS.text.secondary)}>
          <strong>Overlay</strong>
          <span>{' — '}</span>
          <code className={monospaceTextClass}>{overlayNodeId}</code>
          {overlayNote ? <span>{` · ${overlayNote}`}</span> : null}
        </section>
        <ul className={cn('mt-1 list-disc pl-5', UI_THEME_TOKENS.text.secondary)}>
          <li>
            <span>{'Text — '}</span>
            <code className={monospaceTextClass}>{overlayTextLine}</code>
          </li>
          <li>
            <span>{'Style — '}</span>
            <code className={monospaceTextClass}>{`{{overlays.${overlayKey}.style}}`}</code>
            <span>{' · font size '}</span>
            <code className={monospaceTextClass}>{`{{overlays.${overlayKey}.font_size}}`}</code>
            {beatRef === 'beat_01' ? (
              <>
                <span>{' · weight '}</span>
                <code className={monospaceTextClass}>{'{{overlays.overlay_01.font_weight}}'}</code>
              </>
            ) : null}
          </li>
          <li>
            <span>{'Animation — '}</span>
            <code className={monospaceTextClass}>{`{{overlays.${overlayKey}.animation}}`}</code>
            <span>{' · position — '}</span>
            <code className={monospaceTextClass}>{`{{overlays.${overlayKey}.position}}`}</code>
          </li>
          {beatRef === 'beat_03' ? (
            <li>
              <span>{'Background — '}</span>
              <code className={monospaceTextClass}>{'{{palette.primary}}'}</code>
              <span>{' from '}</span>
              <code className={monospaceTextClass}>{'NODE_PALETTE'}</code>
            </li>
          ) : null}
        </ul>
      </section>

      {audioNote ? (
        <section className="min-w-0 mt-3" aria-label="Audio">
          <section className={cn(UI_THEME_TOKENS.text.secondary)}>
            <strong>Audio</strong>
            {audioNote ? <span>{` — ${audioNote}`}</span> : null}
          </section>
          <ul className={cn('mt-1 list-disc pl-5', UI_THEME_TOKENS.text.secondary)}>
            <li>
              <span>{'Voice over — '}</span>
              <code className={monospaceTextClass}>{`{{audio.vo.lines.${beatRef}}}`}</code>
            </li>
            {beatRef === 'beat_01' || beatRef === 'beat_02' ? (
              <li>
                <span>{'SFX — '}</span>
                <code className={monospaceTextClass}>{`{{audio.sfx.${sfxKey}.label}}`}</code>
                <span>{' at '}</span>
                <code className={monospaceTextClass}>{`{{audio.sfx.${sfxKey}.volume_pct}}`}</code>
                <span>{'% vol · offset '}</span>
                <code className={monospaceTextClass}>{`{{audio.sfx.${sfxKey}.offset_ms}}`}</code>
                <span>{' ms'}</span>
              </li>
            ) : null}
            {beatRef === 'beat_03' ? (
              <li>
                <span>{'Score swell — '}</span>
                <code className={monospaceTextClass}>{'{{audio.score.track}}'}</code>
                <span>{' · mood '}</span>
                <code className={monospaceTextClass}>{'{{audio.score.mood}}'}</code>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section className="min-w-0 mt-3" aria-label="Port handles wiring this beat">
        <section className={cn(microLabelClass, UI_THEME_TOKENS.text.secondary)}>Port handles wiring this beat</section>
        <section className="-mx-3 mt-2">
          <table className="w-full border-collapse table-fixed" data-kg-flow-widget-wiring-row-layout={FLOW_WIDGET_BEAT_WIRING_ROW_LAYOUT}>
            <colgroup>
              {FLOW_WIDGET_BEAT_WIRING_COLUMN_STYLES.map((style, idx) => <col key={idx} style={style} />)}
            </colgroup>
            <thead className={UI_THEME_TOKENS.table.headerBg}>
              <tr>
                <td className={cn('px-3 py-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>Edge</td>
                <td className={cn('px-3 py-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>From port</td>
                <td className={cn('px-3 py-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>To port</td>
                <td className={cn('px-3 py-2', microLabelClass, UI_THEME_TOKENS.text.secondary)}>Type</td>
              </tr>
            </thead>
            <tbody>
              {wiringEdges.map(e => {
                const source = String(e.source || '').trim()
                const target = String(e.target || '').trim()
                const fromPort = readEdgePortKey(e, FLOW_EDGE_SOURCE_PORT_KEY)
                const toPort = readEdgePortKey(e, FLOW_EDGE_TARGET_PORT_KEY)
                const type = String(e.type || '').trim()
                return (
                  <tr key={String(e.id || '')} className={cn('border-t', UI_THEME_TOKENS.table.cellBorder, UI_THEME_TOKENS.table.rowHover)}>
                    <td className={cn('px-3 py-2 align-top', monospaceTextClass, UI_THEME_TOKENS.text.primary)}>{String(e.id || '')}</td>
                    <td className={cn('px-3 py-2 align-top', monospaceTextClass, UI_THEME_TOKENS.text.secondary)}>
                      <code>{`${source}.${fromPort}`}</code>
                    </td>
                    <td className={cn('px-3 py-2 align-top', monospaceTextClass, UI_THEME_TOKENS.text.secondary)}>
                      <code>{`${target}.${toPort}`}</code>
                    </td>
                    <td className={cn('px-3 py-2 align-top', monospaceTextClass, UI_THEME_TOKENS.text.secondary)}><code>{type}</code></td>
                  </tr>
                )
              })}
              {wiringEdges.length === 0 && (
                <tr className={cn('border-t', UI_THEME_TOKENS.table.cellBorder)}>
                  <td className={cn('px-3 py-2', microLabelClass, UI_THEME_TOKENS.text.secondary)} colSpan={4}>
                    No beat wiring edges found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>
    </section>
  )
})
