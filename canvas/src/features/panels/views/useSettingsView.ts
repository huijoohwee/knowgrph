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
import { buildChatProxyHeaders, resolveChatEndpointForHealth } from '@/lib/chatEndpoint'
import { BYTEPLUS_CHAT_API_DOC_AREA, BYTEPLUS_CHAT_API_REQUEST_DOC_ENTRIES } from './byteplusChatApiDocs'

const SETTINGS_AREA_ORDER: readonly string[] = [
  'Chat',
  'UI Density: Panels',
  'UI Density: Icons',
  'Workspace',
  'Markdown',
  'Flow Editor',
  'Canvas',
  'Rendering',
  'Performance',
  'Graph Data Table',
  'Import / Export',
  'Integrations',
  BYTEPLUS_CHAT_API_DOC_AREA,
]

const SETTINGS_AREA_CANONICAL: Readonly<Record<string, string>> = {
  'ui density panels': 'UI Density: Panels',
  'ui density panel': 'UI Density: Panels',
  'ui density icons': 'UI Density: Icons',
  'graph data table': 'Graph Data Table',
  'import export': 'Import / Export',
  integrations: 'Integrations',
}

function normalizeSettingsAreaLabel(areaRaw: string): string {
  const area = String(areaRaw || '').trim()
  if (!area) return '—'
  const key = area.toLowerCase().replace(/[/:]+/g, ' ').replace(/\s+/g, ' ').trim()
  return SETTINGS_AREA_CANONICAL[key] || area
}

function settingsAreaSortWeight(area: string): number {
  const idx = SETTINGS_AREA_ORDER.indexOf(area)
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER
}

function isIntegrationsOwnedSetting(key: string, areaRaw: string): boolean {
  const area = normalizeSettingsAreaLabel(areaRaw)
  if (area === 'Chat' || area === 'Integrations' || area === BYTEPLUS_CHAT_API_DOC_AREA) return true
  return key.startsWith('chat') || key === 'integrationConfigsJson'
}

type SettingsEntry = {
  meta: {
    key: string
    type: string
    source: string
    read: () => string | number | boolean | null
    write?: (value: string | number | boolean) => void
    docKey?: string
    default?: () => string | number | boolean | null
    options?: string[]
  }
  details: FlowDetails
  writable: boolean
  index: string
  anchorId?: string
  typeLabel?: string
}

const getSettingsSearchHints = (key: string): string[] => {
  if (key === 'chatContextScope') {
    return ['chat ai assistant context scope selection workspace hybrid']
  }
  if (key === 'chatProvider' || key === 'chatAuthMode' || key === 'chatEndpointUrl' || key === 'chatApiKey' || key === 'chatModel') {
    return ['chat ai byteplus modelark openai official provider endpoint api key byok server-managed auth mode model multi-modal multimodal run image video generation']
  }
  if (key === 'chatHistoryStorageMode' || key === 'chatHistoryWorkspacePath' || key === 'chatHistoryCloudUrl') {
    return ['chat history workspace file path markdown cloud url github']
  }
  if (key === 'chatStorageTarget' || key === 'chatLocalStorageRootPath' || key === 'chatKnowgrphStorageMode' || key === 'chatKnowgrphWorkspacePath' || key === 'chatKnowgrphCloudUrl') {
    return ['chat storage chatKnowgrph chatHistory local cloud markdown file path url']
  }
  if (key === 'integrationConfigsJson') {
    return ['integrations ai chat aiChat simulationCommands openTab commandPrefix provider']
  }
  return []
}

export function useSettingsView({
  searchQuery,
  onRegisterActions,
  mode = 'all',
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
  mode?: 'all' | 'integrations'
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
    BYTEPLUS_CHAT_API_REQUEST_DOC_ENTRIES.forEach(entry => {
      v[entry.meta.key] = entry.value
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
      const authMode = String(values.chatAuthMode || '').trim() === 'byok' ? 'byok' : 'serverManaged'
      const res = await fetch(healthUrl, {
        method: 'GET',
        headers: buildChatProxyHeaders({
          provider: values.chatProvider,
          apiKey: authMode === 'byok' ? values.chatApiKey : null,
          endpointUrl: values.chatEndpointUrl,
          clientRequestId: `kg-chat-health-${Date.now().toString(36)}`,
        }),
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
  }, [values.chatAuthMode, values.chatApiKey, values.chatEndpointUrl, values.chatProvider])

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
    const concreteEntries: SettingsEntry[] = settingsRegistry.map((s) => {
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
      const searchHints = getSettingsSearchHints(s.key)
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
          ...searchHints,
        ].join(' '),
      )
      const anchorId =
        s.key === 'uiIconScale'
          ? UI_ANCHORS.settingsUiIconScale
          : (s.key === 'chatApiKey' ? UI_ANCHORS.settingsChatApiKey : undefined)
      return { meta: s, details, writable: !!s.write, index, anchorId }
    })
    const virtualEntries: SettingsEntry[] = BYTEPLUS_CHAT_API_REQUEST_DOC_ENTRIES.map(entry => ({
      meta: entry.meta,
      details: entry.details,
      writable: false,
      index: normalizeText(
        [
          entry.details.area,
          entry.meta.key,
          entry.typeLabel,
          entry.value,
          entry.details.responsibility,
          ...(entry.searchHints || []),
        ].join(' '),
      ),
      typeLabel: entry.typeLabel,
    }))
    return [...concreteEntries, ...virtualEntries]
      .filter(entry => entry.writable)
      .concat(virtualEntries)
      .filter(entry => !shouldHideSetting(entry.meta.key, entry.details.area))
      .filter(entry => {
        const isIntegrationsOwned = isIntegrationsOwnedSetting(entry.meta.key, entry.details.area)
        return mode === 'integrations' ? isIntegrationsOwned : !isIntegrationsOwned
      })
  }, [flow, mode, shouldHideSetting])

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
      const area = normalizeSettingsAreaLabel(entry.details.area)
      const normalizedEntry = area === entry.details.area
        ? entry
        : {
            ...entry,
            details: {
              ...entry.details,
              area,
            },
          }
      const list = map.get(area) || []
      list.push(normalizedEntry)
      map.set(area, list)
    })
    const grouped = Array.from(map.entries()).map(([area, entriesByArea]) => {
      const sortedEntries = [...entriesByArea].sort((a, b) =>
        String(a.meta.key || '').localeCompare(String(b.meta.key || ''), undefined, { sensitivity: 'base' }),
      )
      return [area, sortedEntries] as const
    })
    grouped.sort((a, b) => {
      const aw = settingsAreaSortWeight(a[0])
      const bw = settingsAreaSortWeight(b[0])
      if (aw !== bw) return aw - bw
      return a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })
    })
    return grouped
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
