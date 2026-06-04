import React from 'react'
import { emitMainPanelOpen, MAIN_PANEL_OPEN_READY_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { QUERY_PARAM_DEV_FLOW_EDITOR_GEOMETRY, QUERY_PARAM_OPEN_MAIN_PANEL, QUERY_PARAM_SHARE, QUERY_PARAM_SHARE_TEXT, QUERY_PARAM_SHARE_TITLE, QUERY_PARAM_SHARE_URL, QUERY_PARAM_WORKSPACE_COMMAND } from '@/lib/routing/queryParams'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyGraphDataCanonicalBootstrap } from '@/features/parsers/applyGraphDataCanonicalBootstrap'

const buildDevFlowEditorGeometryGraph = () => ({
  type: 'Graph' as const,
  nodes: [
    { id: 'dev-widget-1', label: 'Dev Widget 1', type: 'Anchor', x: 0, y: 0, properties: {} },
    { id: 'dev-widget-2', label: 'Dev Widget 2', type: 'Anchor', x: 0, y: 0, properties: {} },
    {
      id: 'dev-media-1',
      label: 'Dev Media 1',
      type: 'RichMediaPanel',
      x: 0,
      y: 0,
      properties: {
        imageUrl: 'https://example.com/dev-flow-editor-geometry.png',
        'visual:width': 240,
        'visual:height': 180,
      },
    },
  ],
  edges: [],
  metadata: { kind: 'test', source: 'devFlowEditorGeometry' },
})

type WorkspaceCommandQueryPayload = {
  id?: unknown
  action?: unknown
  args?: unknown
}

const isLocalWorkspaceCommandQueryAllowed = (): boolean => {
  const anyImportMeta = import.meta as unknown as { env?: { DEV?: boolean } }
  if (anyImportMeta.env?.DEV) return true
  if (typeof window === 'undefined') return false
  const host = String(window.location?.hostname || '').trim().toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
}

const decodeBase64UrlText = (raw: string): string => {
  const normalized = String(raw || '').trim().replace(/-/g, '+').replace(/_/g, '/')
  if (!normalized) return ''
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

const parseWorkspaceCommandQueryPayload = (raw: string): WorkspaceCommandQueryPayload | null => {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  const text = trimmed.startsWith('{') ? trimmed : decodeBase64UrlText(trimmed)
  const parsed = JSON.parse(text)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as WorkspaceCommandQueryPayload
    : null
}

type MainPanelOpenReadyWindow = Window & {
  __KG_MAIN_PANEL_OPEN_READY__?: boolean
}

export function CanvasQueryBootstrapRuntime(props: {
  search: string
}) {
  const { search } = props
  const openedMainPanelFromQueryRef = React.useRef(false)
  const appliedDevFlowEditorGeometryRef = React.useRef(false)
  const handledWorkspaceCommandRef = React.useRef('')
  const setCanvasRenderMode = useGraphStore(s => s.setCanvasRenderMode)
  const setCanvas2dRenderer = useGraphStore(s => s.setCanvas2dRenderer)
  const setFrontmatterModeEnabled = useGraphStore(s => s.setFrontmatterModeEnabled)
  const setDocumentSemanticMode = useGraphStore(s => s.setDocumentSemanticMode)
  const setRenderMediaAsNodes = useGraphStore(s => s.setRenderMediaAsNodes)
  const setOpenWidgetNodeIds = useGraphStore(s => s.setOpenWidgetNodeIds)

  React.useEffect(() => {
    const raw = String(search || '')
    if (!raw) return
    const params = new URLSearchParams(raw)
    const commandRaw = String(params.get(QUERY_PARAM_WORKSPACE_COMMAND) || '').trim()
    if (!commandRaw || handledWorkspaceCommandRef.current === commandRaw) return
    handledWorkspaceCommandRef.current = commandRaw
    if (!isLocalWorkspaceCommandQueryAllowed()) return
    const commandIdFallback = `workspace-query-${Date.now()}`
    try {
      params.delete(QUERY_PARAM_WORKSPACE_COMMAND)
      const next = params.toString()
      const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
      window.history.replaceState(null, '', nextUrl)
    } catch {
      void 0
    }
    void (async () => {
      const {
        createWorkspaceRuntimeCommand,
        publishWorkspaceRuntimeCommandResult,
        summarizeWorkspaceRuntimeCommandResult,
      } = await import('@/features/agent-ready/workspaceRuntimeCommand')
      const payload = parseWorkspaceCommandQueryPayload(commandRaw)
      const id = String(payload?.id || '').trim() || commandIdFallback
      const action = String(payload?.action || '').trim()
      const command = createWorkspaceRuntimeCommand()
      try {
        const result = action === 'readState'
          ? command.readState()
          : action === 'applyMarkdownDocument'
            ? await command.applyMarkdownDocument((payload?.args || {}) as never)
            : action === 'applyChatAssistantResponse'
              ? await command.applyChatAssistantResponse((payload?.args || {}) as never)
              : (() => { throw new Error(`Unsupported workspace command query action: ${action || 'unknown'}`) })()
        publishWorkspaceRuntimeCommandResult({ id, ok: true, result: summarizeWorkspaceRuntimeCommandResult(result) })
      } catch (error) {
        publishWorkspaceRuntimeCommandResult({
          id,
          ok: false,
          error: error instanceof Error ? error.message : String(error || 'Workspace command query failed'),
        })
      }
    })().catch(error => {
      void import('@/features/agent-ready/workspaceRuntimeCommand').then(mod => {
        mod.publishWorkspaceRuntimeCommandResult({
          id: commandIdFallback,
          ok: false,
          error: error instanceof Error ? error.message : String(error || 'Workspace command query failed'),
        })
      })
    })
  }, [search])

  React.useEffect(() => {
    if (appliedDevFlowEditorGeometryRef.current) return
    const anyImportMeta = import.meta as unknown as { env?: { DEV?: boolean } }
    if (!anyImportMeta.env?.DEV) return
    const raw = String(search || '')
    if (!raw) return
    const params = new URLSearchParams(raw)
    if (!String(params.get(QUERY_PARAM_DEV_FLOW_EDITOR_GEOMETRY) || '').trim()) return
    appliedDevFlowEditorGeometryRef.current = true
    try {
      applyGraphDataCanonicalBootstrap({ graphData: buildDevFlowEditorGeometryGraph() })
      setOpenWidgetNodeIds(['dev-widget-1', 'dev-widget-2'])
    } catch {
      void 0
    }
    try {
      params.delete(QUERY_PARAM_DEV_FLOW_EDITOR_GEOMETRY)
      const next = params.toString()
      const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
      window.history.replaceState(null, '', nextUrl)
    } catch {
      void 0
    }
  }, [
    search,
    setOpenWidgetNodeIds,
  ])

  React.useEffect(() => {
    if (openedMainPanelFromQueryRef.current) return
    const raw = String(search || '')
    if (!raw) return
    const params = new URLSearchParams(raw)
    const tab = String(params.get(QUERY_PARAM_OPEN_MAIN_PANEL) || '').trim()
    if (!tab) return
    if (typeof window === 'undefined') return

    const dispatchOpenMainPanel = () => {
      if (openedMainPanelFromQueryRef.current) return
      openedMainPanelFromQueryRef.current = true
      try {
        emitMainPanelOpen({ tab })
      } catch {
        void 0
      }
      try {
        params.delete(QUERY_PARAM_OPEN_MAIN_PANEL)
        const next = params.toString()
        const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
        window.history.replaceState(null, '', nextUrl)
      } catch {
        void 0
      }
    }

    if ((window as MainPanelOpenReadyWindow).__KG_MAIN_PANEL_OPEN_READY__ === true) {
      dispatchOpenMainPanel()
      return
    }

    const handleReady = () => {
      window.removeEventListener(MAIN_PANEL_OPEN_READY_EVENT, handleReady)
      dispatchOpenMainPanel()
    }

    window.addEventListener(MAIN_PANEL_OPEN_READY_EVENT, handleReady, { once: true })
    return () => {
      window.removeEventListener(MAIN_PANEL_OPEN_READY_EVENT, handleReady)
    }
  }, [search])

  const handledShareRef = React.useRef(false)
  const upsertUiToast = useGraphStore(s => s.upsertUiToast)

  React.useEffect(() => {
    if (handledShareRef.current) return
    const raw = String(search || '')
    if (!raw) return
    const params = new URLSearchParams(raw)
    if (!params.has(QUERY_PARAM_SHARE)) return
    if (typeof window === 'undefined') return

    handledShareRef.current = true
    const sharedTitle = String(params.get(QUERY_PARAM_SHARE_TITLE) || '').trim()
    const sharedText = String(params.get(QUERY_PARAM_SHARE_TEXT) || '').trim()
    const sharedUrl = String(params.get(QUERY_PARAM_SHARE_URL) || '').trim()
    const parts = [sharedTitle, sharedText, sharedUrl].filter(Boolean)
    if (parts.length > 0) {
      upsertUiToast({
        id: 'pwa:share-received',
        kind: 'neutral',
        message: `Shared: ${parts.join(' — ')}`,
        ttlMs: 8000,
        dismissible: true,
      })
    }
    try {
      params.delete(QUERY_PARAM_SHARE)
      params.delete(QUERY_PARAM_SHARE_TITLE)
      params.delete(QUERY_PARAM_SHARE_TEXT)
      params.delete(QUERY_PARAM_SHARE_URL)
      const next = params.toString()
      const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
      window.history.replaceState(null, '', nextUrl)
    } catch {
      void 0
    }
  }, [search, upsertUiToast])

  return null
}
