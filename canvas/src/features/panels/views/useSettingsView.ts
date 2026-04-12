import React from 'react'
import { settingsRegistry, loadFlowDetails } from '@/features/settings/registry'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { FlowDetails } from '@/features/settings/types'
import { loadSettingsCollapsedByArea, persistSettingsCollapsedByArea } from '@/features/panels/utils/settingsCollapsedStorage'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { getLocalStorage } from '@/lib/persistence'
import { FALLBACK_DETAILS } from './SettingsFallbackDetails'
import { renderSettingInput } from '@/features/settings/ui'
import { UI_ANCHORS } from '@/lib/config'
import { resolveChatEndpointForHealth } from '@/lib/chatEndpoint'

export function useSettingsView({
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
    if (key === 'infiniteCanvasInteractionMode') return false
    if (key === 'canvasWorkspaceSyncMode') return false
    if (key === 'wheelZoomCtrlMetaBoostMultiplier') return false
    if (key.startsWith('flowWheelZoom')) return false
    if (key === 'canvas3dMode') return false
    if (key === 'canvasRenderMode') return true
    if (key === 'multiDimTableModeEnabled') return true
    if (key === 'import.json.workspaceTarget') return true
    if (key === 'three.graph.edgeRenderer') return true
    if (key === 'three.preset.presentation3d') return true
    if (key === 'integrationConfigsJson') return false
    if (key.startsWith('graph.behavior.')) return true
    const a = String(area || '')
    if (
      a === 'Canvas Rendering'
      || a === 'Canvas Interaction'
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
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')

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
    const healthUrl = resolveChatEndpointForHealth(url)
    if (!healthUrl) {
      setChatHealthStatus('Endpoint URL is not configured.')
      return
    }
    setIsCheckingHealth(true)
    setChatHealthStatus('Checking...')
    try {
      const res = await fetch(healthUrl, {
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
      const source = flow[s.key] || (s.docKey ? flow[s.docKey] : undefined)
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
      const anchorId = s.key === 'uiIconScale' ? UI_ANCHORS.settingsUiIconScale : undefined
      return { meta: s, details, writable: !!s.write, index, anchorId }
    })
      .filter(entry => entry.writable)
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

  return {
    flow,
    expanded,
    setExpanded,
    values,
    setValues,
    dirtyRef,
    schema,
    setSchema,
    uiPanelKeyValueInputClass,
    uiPanelMonospaceTextClass,
    uiPanelKeyValueTextSizeClass,
    chatHealthStatus,
    isCheckingHealth,
    checkChatHealth,
    onGlobalReset,
    renderInput,
    entries,
    normalizedQuery,
    filtered,
    collapsedByArea,
    setCollapsedByArea,
    saveCollapsed,
    groupByArea,
    allCollapsed,
    collapseAll,
    expandAll,
    toggleArea,
  }
}
