import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronDown, ChevronUp, Eye, EyeOff, Layers, Search, Target } from 'lucide-react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { getIconSizeClass } from '@/lib/ui'
import { cn } from '@/lib/utils'

import type { DesignLayerNode } from '@/features/design/designLayersState'

function coerceLayerNodes(graphData: unknown): DesignLayerNode[] {
  const gd = graphData as { nodes?: Array<{ id?: unknown; label?: unknown; type?: unknown }> } | null
  const src = Array.isArray(gd?.nodes) ? gd!.nodes! : []
  const out: DesignLayerNode[] = []
  for (let i = 0; i < src.length; i += 1) {
    const rawId = src[i]?.id
    const id = typeof rawId === 'string' ? rawId.trim() : String(rawId || '').trim()
    if (!id) continue
    const rawLabel = src[i]?.label
    const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : id
    const rawType = src[i]?.type
    const type = typeof rawType === 'string' && rawType.trim() ? rawType.trim() : undefined
    out.push({ id, label, ...(type ? { type } : {}) })
  }
  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

export default function DesignLayersPanel({ active }: { active: boolean }) {
  const panelTypography = usePanelTypography()

  const {
    uiIconScale,
    uiIconStrokeWidth,
    graphData,
    selectedNodeId,
    setSelectionSource,
    selectNode,
    requestZoom,
    designLayerState,
    normalizeDesignLayerStateFromNodes,
    toggleDesignLayerHidden: toggleLayerHidden,
    moveDesignLayer: moveLayer,
  } = useGraphStore(
    useShallow(s => ({
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      graphData: s.graphData,
      selectedNodeId: s.selectedNodeId,
      setSelectionSource: s.setSelectionSource,
      selectNode: s.selectNode,
      requestZoom: s.requestZoom,
      designLayerState: s.designLayerState,
      normalizeDesignLayerStateFromNodes: s.normalizeDesignLayerStateFromNodes,
      toggleDesignLayerHidden: s.toggleDesignLayerHidden,
      moveDesignLayer: s.moveDesignLayer,
    })),
  )

  const iconSizeClass = getIconSizeClass(uiIconScale)
  const [query, setQuery] = React.useState('')
  const normalizedQuery = String(query || '').trim().toLowerCase()

  const nodes = React.useMemo(() => coerceLayerNodes(graphData), [graphData])

  React.useEffect(() => {
    if (!active) return
    normalizeDesignLayerStateFromNodes(nodes)
  }, [active, nodes, normalizeDesignLayerStateFromNodes])

  const visibleCount = React.useMemo(() => {
    const hidden = designLayerState?.hiddenById || {}
    let count = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const id = nodes[i].id
      if (hidden[id] === true) continue
      count += 1
    }
    return count
  }, [designLayerState?.hiddenById, nodes])

  const ordered = React.useMemo(() => {
    const order = Array.isArray(designLayerState?.order) ? designLayerState.order : []
    if (order.length === 0) return nodes
    const byId = new Map(nodes.map(n => [n.id, n] as const))
    const out: DesignLayerNode[] = []
    for (let i = 0; i < order.length; i += 1) {
      const n = byId.get(order[i])
      if (n) out.push(n)
    }
    return out
  }, [designLayerState?.order, nodes])

  const filtered = React.useMemo(() => {
    if (!normalizedQuery) return ordered
    return ordered.filter(n => `${n.label} ${n.id} ${n.type || ''}`.toLowerCase().includes(normalizedQuery))
  }, [normalizedQuery, ordered])

  const toggleHidden = React.useCallback((id: string) => toggleLayerHidden(id), [toggleLayerHidden])

  const move = React.useCallback((id: string, dir: 'up' | 'down') => moveLayer(id, dir), [moveLayer])

  const handleSelect = React.useCallback(
    (id: string) => {
      if (!active) return
      setSelectionSource('canvas')
      selectNode(id)
      requestZoom('selection')
    },
    [active, requestZoom, selectNode, setSelectionSource],
  )

  return (
    <div
      className={cn(
        'min-w-56',
        UI_THEME_TOKENS.panel.bg,
      )}
      aria-label="Design Layers"
      data-main-panel-no-drag="true"
    >
      <div className={cn('px-3 py-2 border-b flex items-center gap-2', UI_THEME_TOKENS.panel.border)} aria-label="Layers header">
        <Layers className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
        <span className={cn('min-w-0 truncate text-xs font-semibold', UI_THEME_TOKENS.text.primary)}>{UI_LABELS.layerMode}</span>
        <span className={cn('text-[10px] font-mono', UI_THEME_TOKENS.text.tertiary)}>{visibleCount}/{nodes.length}</span>
        <button
          type="button"
          className={cn('App-toolbar__btn ml-auto', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
          onClick={() => requestZoom('fit')}
          title={UI_LABELS.fitToView}
          aria-label={UI_LABELS.fitToView}
          disabled={!active}
        >
          <Target className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
        </button>
      </div>

      <label className="px-3 py-2 block" aria-label="Layers search">
        <span className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>{UI_LABELS.search}</span>
        <span className={cn('mt-1 flex items-center gap-2 rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border)}>
          <Search className={cn(iconSizeClass, UI_THEME_TOKENS.text.tertiary)} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={UI_COPY.searchNodesPlaceholder}
            className={cn('w-full bg-transparent outline-none text-xs', UI_THEME_TOKENS.input.text)}
          />
        </span>
      </label>

      <div aria-label="Layers list">
        {filtered.length === 0 ? (
          <span className={cn('block px-3 py-2 text-[10px]', UI_THEME_TOKENS.text.tertiary)}>No layers match.</span>
        ) : (
          <ul className="m-0 p-0 list-none" aria-label="Layers">
            {filtered.map(n => {
              const hidden = designLayerState?.hiddenById?.[n.id] === true
              const selected = selectedNodeId === n.id
              return (
                <li key={n.id} className={cn('border-b last:border-b-0', UI_THEME_TOKENS.panel.border)}>
                  <div className={cn('px-2 py-2 flex items-center gap-2', selected ? 'bg-blue-50 dark:bg-blue-900/20' : '')}>
                    <button
                      type="button"
                      className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg, 'p-1.5')}
                      onClick={() => toggleHidden(n.id)}
                      aria-label={hidden ? UI_LABELS.showAll : UI_LABELS.hideAll}
                      title={hidden ? UI_LABELS.showAll : UI_LABELS.hideAll}
                      disabled={!active}
                    >
                      {hidden ? (
                        <EyeOff className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                      ) : (
                        <Eye className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                      )}
                    </button>

                    <button
                      type="button"
                      className={cn(
                        'min-w-0 flex-1 text-left rounded px-2 py-1',
                        UI_THEME_TOKENS.button.hoverBg,
                        selected ? cn(UI_THEME_TOKENS.button.activeText) : cn(UI_THEME_TOKENS.text.primary),
                      )}
                      onClick={() => handleSelect(n.id)}
                      aria-label={n.label}
                      disabled={!active}
                    >
                      <span className={cn('block min-w-0 truncate text-xs font-semibold', hidden ? 'opacity-50' : '')}>{n.label}</span>
                      <span className={cn('block min-w-0 truncate text-[10px] font-mono', UI_THEME_TOKENS.text.tertiary, hidden ? 'opacity-50' : '')}>
                        {n.type ? `${n.type} · ${n.id}` : n.id}
                      </span>
                    </button>

                    <span className="flex items-center gap-1" aria-label="Reorder">
                      <button
                        type="button"
                        className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg, 'p-1.5')}
                        onClick={() => move(n.id, 'up')}
                        aria-label={UI_LABELS.undo}
                        title="Move up"
                        disabled={!active}
                      >
                        <ChevronUp className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                      </button>
                      <button
                        type="button"
                        className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg, 'p-1.5')}
                        onClick={() => move(n.id, 'down')}
                        aria-label={UI_LABELS.redo}
                        title="Move down"
                        disabled={!active}
                      >
                        <ChevronDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
                      </button>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
