import React from 'react'
import { settingsRegistry, loadFlowDetails } from '@/features/settings/registry'
import { renderSettingInput } from '@/features/settings/ui'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { FlowDetails } from '@/features/settings/types'
import { loadSettingsCollapsedByArea, persistSettingsCollapsedByArea } from '@/features/panels/utils/settingsCollapsedStorage'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import { UI_ANCHORS } from '@/lib/config'
import { getLocalStorage } from '@/lib/persistence'

const FALLBACK_DETAILS: Record<string, { area?: string; responsibility?: string; notes?: string }> = {
  uiPanelOpacity: { area: 'Global Translucency', responsibility: 'Main Panel opacity' },
  uiToolbarOpacity: { area: 'Global Translucency', responsibility: 'Toolbar opacity' },
  historyDebounceMs: { area: 'Editor Behavior & Timing', responsibility: 'Debounce history' },
  codeHighlightDurationMs: { area: 'Editor Behavior & Timing', responsibility: 'Code highlight duration' },
  codeSelectThrottleMs: { area: 'Editor Behavior & Timing', responsibility: 'Code→Canvas selection throttle' },
  codeHighlightUntilClick: { area: 'Editor Behavior & Timing', responsibility: 'Highlight until click' },
  uiIconScale: {
    area: 'UI Density: Icons',
    responsibility: 'Global icon scale (toolbar, panels, bottom panel)',
    notes: 'Options: compact (smaller icons, denser UI) or default (larger icons, more spacious). Applied via getIconSizeClass across HeaderActions, Toolbar, SearchPanel, History panels, Launch Spotlight status, Help/Workflow headers, Graph Fields icon legend, and bottom panel toolbars.',
  },
  uiIconFormat: {
    area: 'UI Density: Icons',
    responsibility: 'Global icon format (default vs minimal styling)',
  },
  uiIconStrokeWidth: {
    area: 'UI Density: Icons',
    responsibility: 'Global Lucide icon stroke width',
  },
  uiIconColorClass: {
    area: 'UI Density: Icons',
    responsibility: 'Base Tailwind class for icon color',
  },
  uiIconHoverBgClass: {
    area: 'UI Density: Icons',
    responsibility: 'Base Tailwind class for icon hover background',
  },
  uiIconButtonPaddingClass: {
    area: 'UI Density: Icons',
    responsibility: 'Base Tailwind class for icon button padding',
  },
  uiIconPillClass: {
    area: 'UI Density: Icons',
    responsibility: 'Base Tailwind class for icon legend pills (scope, origin, visibility, field types)',
  },
  uiIconPillLegendTextSizeClass: {
    area: 'UI Density: Icons',
    responsibility: 'Tailwind class for legend pill text size',
  },
  uiIconPillBadgeTextSizeClass: {
    area: 'UI Density: Icons',
    responsibility: 'Tailwind class for badge and inline pill text size',
  },
  uiIconBadgeChipClass: {
    area: 'UI Density: Icons',
    responsibility: 'Base Tailwind class for small schema/property badge chips',
  },
  uiIconBadgeChipTextSizeClass: {
    area: 'UI Density: Icons',
    responsibility: 'Tailwind class for badge chip text size',
  },
  uiPanelKeyValueTextSizeClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for panel key/value text size',
  },
  uiPanelMicroLabelTextSizeClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for panel micro-label helper text size',
  },
  uiPanelTextFontClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for panel key/value text font',
  },
  uiPanelKeyValueInputClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for panel key/value numeric input shell',
  },
  uiPanelRowDensityDefaultClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for default panel row padding (density="default")',
  },
  uiPanelMonospaceTextClass: {
    area: 'UI Density: Panels',
    responsibility: 'Tailwind class for panel monospace text in Graph JSON, Parser, Schema, and Markdown editors',
  },
  uiHeaderRowHeightClass: {
    area: 'UI Density: Headers',
    responsibility: 'Tailwind class for primary header row min-height',
  },
  uiHeaderRowPaddingClass: {
    area: 'UI Density: Headers',
    responsibility: 'Tailwind class for primary header row padding',
  },
  uiSectionHeaderRowHeightClass: {
    area: 'UI Density: Headers',
    responsibility: 'Tailwind class for section header row min-height',
  },
  uiSectionHeaderRowPaddingClass: {
    area: 'UI Density: Headers',
    responsibility: 'Tailwind class for section header row padding',
  },
  uiIconAnimationEnabled: {
    area: 'UI Density: Icons',
    responsibility: 'Enable toolbar launch/3D icon animation',
  },
  bottomPanelHeightRatio: { area: 'Bottom Panel Layout', responsibility: 'Bottom panel height ratio' },
  floatingPanelWidthRatio: { area: 'Floating Panel Layout', responsibility: 'Floating panel width ratio (viewport)' },
  floatingPanelHeightRatio: { area: 'Floating Panel Layout', responsibility: 'Floating panel height ratio (viewport)' },
  floatingPanelZIndex: { area: 'Floating Panel Layout', responsibility: 'Floating panel z-index' },
  sidebarWidthRatio: { area: 'Side Panel Layout', responsibility: 'Side panel width ratio (viewport)' },
  enableTabSync: { area: 'Tab Sync', responsibility: 'Enable cross‑tab sync' },
  enableVirtualTables: { area: 'Graph Data Table Virtualization', responsibility: 'Virtualized tables' },
  'graphDataTable.overscanMultiplier': {
    area: 'Graph Data Table Virtualization',
    responsibility: 'Overscan multiplier for virtual tables',
    notes:
      'To make the table more stable with fewer re-renders while scrolling, increase this toward 1.0–2.0. To reduce DOM size for very large tables, lower this toward 0.1–0.3 and optionally reduce graphDataTable.virtualOverscanRows for a more aggressive window.',
  },
  'graphDataTable.virtualOverscanRows': {
    area: 'Graph Data Table Virtualization',
    responsibility: 'Virtual overscan rows (window padding)',
    notes:
      'Acts as a hard floor for overscan rows. Lower values reduce DOM size but may cause more frequent row window updates while scrolling, especially when graphDataTable.overscanMultiplier is also low.',
  },
  'graphDataTable.minRows': {
    area: 'Graph Data Table Virtualization',
    responsibility: 'Min rows before virtualizing tables',
  },
  'graphDataTable.debugLogRanges': {
    area: 'Graph Data Table Virtualization',
    responsibility: 'Log virtual window ranges in dev',
  },
  schemaDeriveCacheCapacity: { area: 'Graph Performance (Schema Derive Cache)', responsibility: 'LRU capacity for schema derive lists' },
  'graphDataTable.frozenDragStepNoneLabelPx': {
    area: 'Graph Data Table',
    responsibility: 'Drag distance (px) from none to label boundary',
  },
  'graphDataTable.frozenDragStepLabelIdPx': {
    area: 'Graph Data Table',
    responsibility: 'Drag distance (px) from label to id boundary',
  },
  'graphDataTable.numericSampleLimit': {
    area: 'Graph Data Table',
    responsibility: 'Maximum samples per field when inferring numeric behavior',
  },
  'graphDataTable.numericSampleMinCount': {
    area: 'Graph Data Table',
    responsibility: 'Minimum numeric samples required for aggregate eligibility',
  },
  'graphDataTable.numericSampleMinRatio': {
    area: 'Graph Data Table',
    responsibility: 'Minimum numeric ratio required for aggregate eligibility',
  },
  'spotlight.margin': { area: 'Launch Spotlight Layout', responsibility: 'Viewport margin for spotlight card clamp' },
  'spotlight.nearTopThreshold': {
    area: 'Launch Spotlight Layout',
    responsibility: 'Top threshold before anchored card flips below target',
  },
  chatEndpointUrl: { area: 'Chat', responsibility: 'Chat endpoint URL (OpenAI-compatible)' },
  chatModel: { area: 'Chat', responsibility: 'Chat model name (OpenAI-compatible)' },
  chatTemperature: { area: 'Chat', responsibility: 'Chat completion temperature' },
  chatSystemPrompt: { area: 'Chat', responsibility: 'Optional system prompt for Chat' },
  CLICK_URL: { area: 'Config Constants', responsibility: 'Toolbar badge click URL' },
  PUBLIC_FALLBACK_JSON: { area: 'Dataset Loading', responsibility: 'Fallback dataset path' },
  KG_INPUT_PATH: { area: 'Pipeline Env', responsibility: 'Pipeline input path' },
  KG_OUTPUT_DIR: { area: 'Pipeline Env', responsibility: 'Pipeline output directory' },
  'max-lines': { area: 'ESLint Guard', responsibility: 'Max lines per file' },
  canvasRenderMode: { area: 'Canvas Rendering', responsibility: 'Render mode (2d or 3d)' },
  orchestratorTraversalDelayMs: {
    area: 'Orchestrator Traversal',
    responsibility: 'Delay between traversal steps in Orchestrator (ms)',
  },
  orchestratorView: {
    area: 'Orchestrator UI',
    responsibility: 'Default Orchestrator bottom panel view (UI or Text)',
  },
  'graph.behavior.selectMode': {
    area: 'Canvas Interaction',
    responsibility: 'Node selection mode (single, multi, lasso)',
    notes:
      'Selector → pick single, multi, or lasso selection behavior → shape how canvas clicks, Graph Data Table row selection, and Embed/Overlay / Dataset Inspector visualizations respond to the active selection neighborhood.',
  },
  'graph.behavior.createMode': {
    area: 'Canvas Interaction',
    responsibility: 'Edge creation mode (shift-drag, click, panel-only)',
    notes:
      'Edge creator → choose shift-drag, click-source-target, or panel-only edge creation → align edge gestures with selection-aware overlays so you can inspect distributions, hierarchies, polygons, and paths without losing predictable zoom and node-drag behavior.',
  },
  'three.selection.selectedNodeGlowIntensity': { area: '3D Selection', responsibility: 'Selected node emissive glow intensity' },
  'three.selection.dimmedNodeOpacity': { area: '3D Selection', responsibility: 'Dimmed unselected node opacity' },
  'three.selection.dimmedEdgeOpacity': { area: '3D Selection', responsibility: 'Dimmed non‑selected edge opacity' },
  'three.selection.selectedEdgeWidth': { area: '3D Selection', responsibility: 'Selected edge stroke width in 3D' },
  'three.graph.linkDirectionalArrowLength': { area: '3D Edges & Arrows', responsibility: 'Default 3D edge arrow length' },
  'three.graph.linkOpacity': { area: '3D Edges & Arrows', responsibility: 'Default 3D edge opacity' },
  'three.graph.linkCurvature': { area: '3D Edges & Arrows', responsibility: 'Default 3D edge curvature' },
  'three.graph.linkCurveRotation': { area: '3D Edges & Arrows', responsibility: 'Default 3D curve rotation' },
  'three.graph.linkDirectionalParticles': { area: '3D Particles', responsibility: 'Default edge particle count' },
  'three.graph.linkDirectionalParticleSpeed': { area: '3D Particles', responsibility: 'Default edge particle speed' },
  'three.graph.nodeSizingFormula': { area: '3D Formulas', responsibility: 'Node sizing formula (schema or importance)' },
  'three.graph.edgeWidthFormula': { area: '3D Formulas', responsibility: 'Edge width formula (schema or weight)' },
  'three.graph.layerOpacityByLayer.1': { area: '3D Layers', responsibility: 'Layer 1 base opacity' },
  'three.graph.layerOpacityByLayer.2': { area: '3D Layers', responsibility: 'Layer 2 base opacity' },
  'three.graph.layerOpacityByLayer.3': { area: '3D Layers', responsibility: 'Layer 3 base opacity' },
  'three.graph.nodeMotionIntensity': { area: '3D Motion', responsibility: 'Idle node motion intensity' },
  'three.graph.minimapOpacity': { area: '3D Minimap', responsibility: '3D minimap background opacity' },
  'three.graph.starfieldEnabled': { area: '3D Background', responsibility: 'Enable 3D starfield particle background' },
  'three.graph.starfieldCount': { area: '3D Background', responsibility: 'Starfield particle count (0 disables)' },
  'three.graph.starfieldRadius': { area: '3D Background', responsibility: 'Starfield radius around camera' },
  'three.graph.starfieldOpacity': { area: '3D Background', responsibility: 'Starfield particle brightness/opacity' },
  'three.graph.starfieldColor': { area: '3D Background', responsibility: 'Starfield particle tint color' },
  'three.layout.sphereRadius': { area: '3D Layout & Physics', responsibility: 'Base sphere radius for node layout' },
  'three.layout.seed': { area: '3D Layout & Physics', responsibility: 'Random seed for 3D layout' },
  'three.layout.minSpacing': { area: '3D Layout & Physics', responsibility: 'Minimum spacing between nodes' },
  'three.preset.presentation3d': { area: '3D Presets', responsibility: 'Apply low-motion presentation 3D preset' },
  'three.camera.backgroundColor': { area: 'Canvas Rendering', responsibility: '3D canvas background color' },
  'three.graph.polygons.elevationOffset': {
    area: '3D Group Surfaces',
    responsibility: 'Vertical offset for 3D group polygons relative to nodes',
  },
  'three.graph.polygons.opacityMultiplier': {
    area: '3D Group Surfaces',
    responsibility: 'Global multiplier for 3D group polygon fill opacity',
  },
}

export default function SettingsView({
  searchQuery,
  onRegisterActions,
}: {
  searchQuery: string
  onRegisterActions?: (a: {
    apply: () => void
    reset: () => void
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }) => void
}) {
  const shouldHideSetting = React.useCallback((key: string, area?: string) => {
    if (key === 'canvasRenderMode') return true
    if (key === 'three.preset.presentation3d') return true
    if (key.startsWith('three.')) return true
    if (key.startsWith('graph.behavior.')) return true
    const a = String(area || '')
    if (
      a === 'Canvas Rendering'
      || a === 'Canvas Interaction'
      || a === '3D Selection'
      || a === '3D Edges & Arrows'
      || a === '3D Particles'
      || a === '3D Formulas'
      || a === '3D Layers'
      || a === '3D Motion'
      || a === '3D Minimap'
      || a === '3D Group Surfaces'
      || a === '3D Background'
      || a === '3D Layout & Physics'
      || a === '3D Presets'
    ) {
      return true
    }
    return false
  }, [])

  const [flow, setFlow] = React.useState<Record<string, FlowDetails>>({})
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [values, setValues] = React.useState<Record<string, string | number | boolean>>(() => {
    const v: Record<string, string | number | boolean> = {}
    settingsRegistry.forEach(s => {
      const r = s.read()
      if (r !== null) v[s.key] = r
    })
    return v
  })
  const dirtyRef = React.useRef<Set<string>>(new Set())
  const schema = useGraphStore(s => s.schema)
  const setSchema = useGraphStore(s => s.setSchema)
  const uiPanelKeyValueInputClass = useGraphStore(
    s => s.uiPanelKeyValueInputClass || 'w-full h-6 px-2 text-xs border border-gray-300 rounded text-right',
  )
  const uiPanelMonospaceTextClass = useGraphStore(s => s.uiPanelMonospaceTextClass || 'font-mono text-xs')

  React.useEffect(() => {
    let alive = true
    loadFlowDetails().then(d => { if (alive) setFlow(d || {}) })
    return () => { alive = false }
  }, [])

  const applyAll = React.useCallback(() => {
    const dirty = Array.from(dirtyRef.current)
    dirty.forEach((key) => {
      const meta = settingsRegistry.find(s => s.key === key)
      if (!meta || !meta.write) return
      const desired = values[key]
      const current = meta.read()
      if (desired !== current) meta.write(desired)
    })
    const next: Record<string, string | number | boolean> = { ...values }
    settingsRegistry.forEach(s => {
      if (dirtyRef.current.has(s.key)) {
        const current = s.read()
        if (current !== null) next[s.key] = current
      }
    })
    setValues(next)
    dirtyRef.current.clear()
  }, [values])

  const resetToDefaults = React.useCallback(() => {
    settingsRegistry.forEach(s => {
      if (!s.write || !s.default) return
      const def = s.default()
      if (def !== null) s.write(def)
    })
    const next: Record<string, string | number | boolean> = {}
    settingsRegistry.forEach(s => {
      const r = s.read()
      if (r !== null) next[s.key] = r
    })
    setValues(next)
    dirtyRef.current.clear()
  }, [])

  const [chatHealthStatus, setChatHealthStatus] = React.useState<string | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = React.useState(false)

  const checkChatHealth = React.useCallback(async () => {
    const url = values.chatEndpointUrl
    if (!url || typeof url !== 'string') {
      setChatHealthStatus('Endpoint URL is not configured.')
      return
    }
    setIsCheckingHealth(true)
    setChatHealthStatus('Checking...')
    try {
      const res = await fetch(url.replace(/\/chat\/completions$/, '/health'), {
        method: 'GET',
      })
      if (res.ok) {
        const data = await res.json()
        setChatHealthStatus(`OK: ${JSON.stringify(data)}`)
      } else {
        setChatHealthStatus(`Error: ${res.status} ${res.statusText}`)
      }
    } catch (err: unknown) {
      setChatHealthStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsCheckingHealth(false)
    }
  }, [values.chatEndpointUrl])

  const onGlobalReset = React.useCallback(() => {
    try {
      const ok = typeof window !== 'undefined' ? window.confirm('Confirm reset: reset all settings and data') : true
      if (!ok) return
      resetToDefaults()
      useGraphStore.getState().resetAll()
    } catch { void 0 }
  }, [resetToDefaults])

  const renderInput = (key: string, type: string, writable: boolean, options?: string[]) =>
    renderSettingInput(key, type, writable, values, setValues, dirtyRef, options)

  const entries = React.useMemo(() => {
    return settingsRegistry.map((s) => {
      const source = flow[s.docKey || s.key]
      const details = {
        area: source?.area || FALLBACK_DETAILS[s.key]?.area || '—',
        modules: source?.modules || [],
        classes: source?.classes || [],
        functions: source?.functions || [],
        responsibility: source?.responsibility || FALLBACK_DETAILS[s.key]?.responsibility || '—',
        imports: source?.imports || [],
        notes: source?.notes || FALLBACK_DETAILS[s.key]?.notes || '',
      }
      const index = normalizeText(
        [
          details.area,
          s.key,
          s.type,
          details.responsibility,
          ...(details.modules || []),
          ...(details.classes || []),
          ...(details.functions || []),
          ...(details.imports || []),
          details.notes || '',
        ].join(' '),
      )
      return { meta: s, details, writable: !!s.write, index }
    })
      .filter(entry => !shouldHideSetting(entry.meta.key, entry.details.area))
  }, [flow, shouldHideSetting])

  const normalizedQuery = React.useMemo(() => normalizeText(searchQuery).trim(), [searchQuery])
  const filtered = React.useMemo(
    () => (normalizedQuery ? entries.filter(e => e.index.includes(normalizedQuery)) : entries),
    [entries, normalizedQuery],
  )

  const [collapsedByArea, setCollapsedByArea] = React.useState<Record<string, boolean>>(() => {
    const storage = getLocalStorage()
    return loadSettingsCollapsedByArea(storage)
  })
  const saveCollapsed = React.useCallback((next: Record<string, boolean>) => {
    const storage = getLocalStorage()
    persistSettingsCollapsedByArea(storage, next)
  }, [])
  const groupByArea = React.useMemo(() => {
    const map = new Map<string, typeof filtered>()
    filtered.forEach(entry => {
      const area = entry.details.area || '—'
      const list = map.get(area) || []
      map.set(area, [...list, entry])
    })
    return Array.from(map.entries())
  }, [filtered])
  const allCollapsed = React.useMemo(
    () => {
      if (groupByArea.length === 0) return true
      return groupByArea.every(([area]) => {
        const value = collapsedByArea[area]
        if (value === undefined) return true
        return value
      })
    },
    [groupByArea, collapsedByArea],
  )
  const collapseAll = React.useCallback(() => {
    const next: Record<string, boolean> = {}
    groupByArea.forEach(([area]) => { next[area] = true })
    setCollapsedByArea(next)
    saveCollapsed(next)
  }, [groupByArea, saveCollapsed])
  const expandAll = React.useCallback(() => {
    const next: Record<string, boolean> = {}
    groupByArea.forEach(([area]) => { next[area] = false })
    setCollapsedByArea(next)
    saveCollapsed(next)
  }, [groupByArea, saveCollapsed])
  const toggleArea = React.useCallback((area: string, next: boolean) => {
    setCollapsedByArea(prev => {
      const merged = { ...prev, [area]: next }
      saveCollapsed(merged)
      return merged
    })
  }, [saveCollapsed])

  const setUiPanelKeyValueTextSizeClass = useGraphStore(s => s.setUiPanelKeyValueTextSizeClass)
  const setUiPanelTextFontClass = useGraphStore(s => s.setUiPanelTextFontClass)
  const setUiPanelKeyValueInputClass = useGraphStore(s => s.setUiPanelKeyValueInputClass)
  const setUiPanelRowDensityDefaultClass = useGraphStore(
    s => s.setUiPanelRowDensityDefaultClass,
  )
  const setUiPanelMonospaceTextClass = useGraphStore(s => s.setUiPanelMonospaceTextClass)
  const setUiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.setUiPanelMicroLabelTextSizeClass,
  )

  React.useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        apply: applyAll,
        reset: resetToDefaults,
        globalReset: onGlobalReset,
        collapseAll,
        expandAll,
        allCollapsed,
      })
    }
  }, [onRegisterActions, applyAll, resetToDefaults, onGlobalReset, collapseAll, expandAll, allCollapsed])

  return (
    <div className="h-full min-h-0 flex flex-col space-y-0">
      <div className="flex-1 min-h-0 overflow-auto space-y-0">
        <div className="px-0 py-2 border-b border-gray-200">
          <div className="text-xs font-semibold text-gray-700 mb-1">
            Graph
          </div>
          <KeyTypeValueRow
            layout="keyValue"
            density="compact"
            keyNode={<span className={uiPanelMonospaceTextClass}>schema.layers.mode</span>}
            valueNode={(
              <div className="flex w-full justify-end">
                <select
                  className={uiPanelKeyValueInputClass}
                  value={(schema?.layers?.mode ?? 'property') as 'property' | 'document-structure' | 'semantic'}
                  disabled={!schema}
                  onChange={e => {
                    if (!schema) return
                    const raw = e.target.value
                    const nextMode: 'property' | 'document-structure' | 'semantic' =
                      raw === 'document-structure' || raw === 'semantic' ? raw : 'property'
                    const baseLayers = schema.layers || {}
                    setSchema({
                      ...schema,
                      layers: {
                        ...baseLayers,
                        mode: nextMode,
                      },
                    })
                  }}
                >
                  <option value="property">property</option>
                  <option value="document-structure">document-structure</option>
                  <option value="semantic">semantic</option>
                </select>
              </div>
            )}
          />
        </div>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <KeyTypeValueRow
            keyNode={<span className="font-semibold text-gray-600">Key</span>}
            typeNode={<span className="font-semibold text-gray-600">Type</span>}
            valueNode={<span className="font-semibold text-gray-600">Value</span>}
            density="compact"
            className="h-9 py-0"
          />
        </div>
        {groupByArea.map(([area, entries]) => {
          const collapsed = collapsedByArea[area] ?? true
          const responsibilities = entries.map(e => e.details.responsibility).filter(Boolean)
          const firstResponsibility = responsibilities[0]
          let tooltipContent = firstResponsibility
            ? `Settings area for ${firstResponsibility.toLowerCase()} keys. Expand to see modules, functions, and notes.`
            : 'Settings area grouping related keys. Expand to see modules, functions, and notes.'
          if (area === 'UI Density: Icons') {
            tooltipContent = `${tooltipContent} Use uiIconScale to switch between compact and default icon sizes across toolbars and panels.`
          }
          return (
            <CollapsibleSection
              key={area}
              title={(
                <Tooltip
                  content={tooltipContent}
                  maxWidthPx={250}
                  contentClassName="bg-gray-800/90"
                >
                  <span className="inline-flex items-center gap-1">
                    <span>{area}</span>
                    <span className="text-xs uppercase tracking-wide text-gray-400 ml-1">
                      {entries.length}
                      {' '}
                      items
                    </span>
                  </span>
                </Tooltip>
              )}
              collapsed={collapsed}
              onToggle={next => toggleArea(area, next)}
            >
              <div>
                {area === 'UI Density: Panels' && (
                  <div className="mb-1 flex flex-wrap items-center gap-1 text-xs text-gray-600">
                    <span className="font-semibold text-gray-700">Presets</span>
                    <button
                      type="button"
                      className="App-toolbar__btn text-xs border border-gray-300 bg-white text-gray-700"
                      onClick={() => {
                        setUiPanelKeyValueTextSizeClass('text-sm')
                        setUiPanelTextFontClass('font-sans')
                        setUiPanelKeyValueInputClass('w-full h-6 px-2 text-sm border border-gray-300 rounded text-right')
                        setUiPanelRowDensityDefaultClass('py-1')
                        setUiPanelMonospaceTextClass('font-mono text-xs')
                        setUiPanelMicroLabelTextSizeClass('text-xs')
                      }}
                    >
                      Comfortable
                    </button>
                    <button
                      type="button"
                      className="App-toolbar__btn text-xs border border-blue-400 bg-blue-50 text-blue-700"
                      onClick={() => {
                        setUiPanelKeyValueTextSizeClass('text-xs')
                        setUiPanelTextFontClass('font-sans')
                        setUiPanelKeyValueInputClass('w-full h-6 px-2 text-xs border border-gray-300 rounded text-right')
                        setUiPanelRowDensityDefaultClass('py-0.5')
                        setUiPanelMonospaceTextClass('font-mono text-xs')
                        setUiPanelMicroLabelTextSizeClass('text-[9px]')
                      }}
                    >
                      Compact
                    </button>
                  </div>
                )}
                {entries.map(({ meta: s, details, writable }) => {
                  const isExpanded = expanded === s.key
                  const hasOptions = Array.isArray(s.options) && s.options.length > 0
                  const hint = details.notes || details.responsibility || ''
                  const anchorId = s.key === 'uiIconScale' ? UI_ANCHORS.settingsUiIconScale : undefined
                  return (
                    <div key={s.key}>
                      <KeyTypeValueRow
                        id={anchorId}
                        dataKgAnchor={anchorId}
                        keyNode={hasOptions && hint ? (
                          <Tooltip
                            content={hint}
                            maxWidthPx={250}
                            contentClassName="bg-gray-800/90"
                          >
                            <span className="inline-flex items-center gap-1">
                              <span className="truncate">{s.key}</span>
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="truncate">{s.key}</span>
                        )}
                        typeNode={s.type}
                        valueNode={(
                          <div className="flex-1">
                            {renderInput(s.key, s.type, writable, s.options)}
                            {s.key === 'chatSystemPrompt' && (
                              <div className="mt-2">
                                <button
                                  onClick={checkChatHealth}
                                  disabled={isCheckingHealth}
                                  className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded"
                                >
                                  {isCheckingHealth ? 'Checking...' : 'Check Health'}
                                </button>
                                {chatHealthStatus && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    {chatHealthStatus}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        onClick={() => setExpanded(isExpanded ? null : s.key)}
                      />
                      {isExpanded && (
                        <div className="mt-0 mb-0 text-xs text-gray-700 border-l pl-2">
                          <div className="grid grid-cols-7 gap-1">
                            <div className="font-medium">Area</div>
                            <div className="font-medium">Modules</div>
                            <div className="font-medium">Classes/Objects</div>
                            <div className="font-medium">Functions/Methods</div>
                            <div className="font-medium">Responsibility</div>
                            <div className="font-medium">Dependencies / Imports</div>
                            <div className="font-medium">Notes</div>
                            <div>{details.area}</div>
                            <div>{(details.modules || []).join(', ') || '—'}</div>
                            <div>{(details.classes || []).join(', ') || '—'}</div>
                            <div>{(details.functions || []).join(', ') || '—'}</div>
                            <div>{details.responsibility}</div>
                            <div>{(details.imports || []).join(', ') || '—'}</div>
                            <div>{details.notes || '—'}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CollapsibleSection>
          )
        })}
        <CollapsibleSection
          title="Resets and data"
          collapsed={false}
          onToggle={() => void 0}
          className="mt-2 pt-2 border-t border-red-200"
        >
          <div className="space-y-1 text-xs text-gray-700">
            <div>
              Reset all settings to defaults and clear canvas data. This action cannot be undone.
            </div>
            <button
              type="button"
              className="App-toolbar__btn text-xs border border-red-300 bg-red-50 text-red-700"
              onClick={onGlobalReset}
            >
              Global Reset
            </button>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  )
}
