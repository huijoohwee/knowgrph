import React from 'react'
import { createRoot } from 'react-dom/client'
import MainPanel from '@/features/panels/MainPanel'
import { inspectLocalMainPanelChatCanvasPipeline } from '@/features/agent-ready/localMainPanelChatCanvasPipelineInspection'
import {
  readLocalMainPanelSurfaceSnapshot,
  readLocalSettingsChatReadinessSurfaceSnapshot,
  resetBrowserLocalSurfaceSnapshotsForTests,
  type LocalChatPipelineSurfaceSnapshot,
  type LocalEditorWorkspaceSurfaceSnapshot,
  type LocalMainPanelSurfaceSnapshot,
  type LocalSettingsChatReadinessSurfaceSnapshot,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'
import { DEFAULT_INTEGRATION_CONFIGS, stringifyIntegrationConfigs } from '@/features/integrations/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import {
  installDeterministicRaf,
  mountReactRoot,
  unmountReactRoot,
  waitForFrames,
  waitForTasks,
} from '@/tests/lib/reactRootHarness'
import { AGENTIC_COMMERCE_MAIN_PANEL_READINESS } from 'grph-shared/payments/agenticCommerceSsot'

const READY_MARKDOWN = `---
flow:
  nodes:
    - id: start
      label: Start
    - id: end
      label: End
  connections:
    - source: start
      target: end
---

# Agent Ready
`

const READY_GRAPH = {
  nodes: [
    { id: 'start', type: 'Step', label: 'Start' },
    { id: 'end', type: 'Step', label: 'End' },
  ],
  edges: [
    { id: 'edge-1', source: 'start', target: 'end', label: 'next' },
  ],
}

const buildMainPanelSnapshot = (activeTab: string): LocalMainPanelSurfaceSnapshot => ({
  activeTab,
  activeTabLabel: activeTab === 'mcp' ? 'MCP' : activeTab === 'integrations' ? 'Integrations' : activeTab === 'commerce' ? 'Commerce' : activeTab,
  searchable: true,
  searchOpen: true,
  searchVisible: true,
  searchQuery: 'agent ready',
  searchPlaceholder: 'Search',
  footerLabel: activeTab,
  traversalChip: null,
  sharedActions: {
    hasApply: true,
    hasReset: true,
    hasGlobalReset: false,
    hasCollapseAll: true,
    hasExpandAll: true,
    allCollapsed: false,
  },
})

const READY_SETTINGS_CHAT: LocalSettingsChatReadinessSurfaceSnapshot = {
  normalizedChatProvider: 'openai',
  chatEndpointUrl: '/api/chat',
  chatModel: 'gpt-4.1',
  chatAuthMode: 'server',
  chatContextScope: 'workspace',
  integrationEnabled: true,
  integrationOpenTab: 'chat',
  pixverseVideoEnabled: false,
  pixverseVideoStrategy: 'disabled',
  pixverseVideoTransport: 'none',
  isRefreshingChatModels: false,
  chatModelsStatus: 'ready',
  discoveredChatModelCount: 3,
  suggestedChatModelCount: 1,
}

const READY_CHAT_PIPELINE: LocalChatPipelineSurfaceSnapshot = {
  messageCount: 2,
  isLoading: false,
  errorText: null,
  connectivity: 'ok',
  connectivityDetail: 'ready',
  chatProviderSummary: 'OpenAI / gpt-4.1',
  chatProviderHint: null,
  chatContextScope: 'workspace',
  chatStorageTarget: 'chatKnowgrph',
  chatKnowgrphWorkspacePath: '/chat/knowgrph/agent-ready.md',
  chatHistoryWorkspacePath: '/chat/history/agent-ready.md',
  workspaceViewMode: 'editor',
  editorWorkspacePane: 'markdown',
  markdownDocumentName: 'workspace:/docs/agent-ready.md',
  selectedNodeId: 'start',
  streamingAssistant: null,
  streamingWorkspacePath: null,
  streamFollowPath: '/chat/knowgrph/agent-ready.md',
  streamDraft: null,
  kgcValidation: {
    stage: 'validated',
    attempt: 1,
    maxAttempts: 3,
    failedRuleId: null,
    failedMessage: null,
    correctionPromptPreview: null,
    hasStructuredKgc: true,
    hasYamlFrontmatter: true,
    validatedKgcLength: READY_MARKDOWN.length,
  },
  finalize: {
    stage: 'applied',
    traceId: 'trace-agent-ready',
    modelId: 'gpt-4.1',
    finalStatus: 'ok',
    persistedKnowgrphPath: '/chat/knowgrph/agent-ready.md',
    applied: true,
    message: 'Applied',
  },
}

const READY_EDITOR_WORKSPACE: LocalEditorWorkspaceSurfaceSnapshot = {
  activeDocumentKey: 'workspace:/docs/agent-ready.md',
  workspaceViewMode: 'editor',
  workspaceCanvasPaneOpen: true,
  workspaceEditorOverlayOpen: true,
  layoutMode: 'editor',
  viewerKind: 'markdown',
  viewerMode: 'read',
  isMarkdown: true,
  isJsonMarkdownEditing: false,
  paneVisibility: { markdown: true, json: true, viewer: true, html: false, binary: false },
  splitPaneVisibility: { markdown: true, json: true, viewer: true, html: false, bin: false },
  liveMarkdownText: READY_MARKDOWN,
  persistedMarkdownText: READY_MARKDOWN,
  hasUncommittedDraft: false,
  liveDraftSource: 'persisted',
}

const inspectReadyPipeline = (activeTab: string) => inspectLocalMainPanelChatCanvasPipeline({
  mainPanelSnapshot: buildMainPanelSnapshot(activeTab),
  commerceReadinessSnapshot: AGENTIC_COMMERCE_MAIN_PANEL_READINESS,
  settingsChatReadinessSnapshot: READY_SETTINGS_CHAT,
  editorWorkspaceSnapshot: READY_EDITOR_WORKSPACE,
  chatPipelineSnapshot: READY_CHAT_PIPELINE,
  markdownDocumentName: 'workspace:/docs/agent-ready.md',
  markdownDocumentText: READY_MARKDOWN,
  markdownDocumentSourceUrl: '/knowgrph/share/agent-ready',
  graphData: READY_GRAPH,
  graphDataRevision: 1,
  canvasRenderMode: '2d',
  canvas2dRenderer: 'd3',
  documentSemanticMode: 'document',
  frontmatterModeEnabled: true,
  multiDimTableModeEnabled: false,
  documentStructureBaselineLock: false,
  collapsedGroupIds: [],
  selectedNodeId: 'start',
  selectedEdgeId: 'edge-1',
})

export function testLocalMainPanelChatCanvasPipelineAcceptsMcpIntegrationsCommerceEntryTabs() {
  for (const activeTab of ['mcp', 'integrations', 'commerce']) {
    const inspection = inspectReadyPipeline(activeTab) as {
      pipelineReady?: unknown
      readiness?: { routeReady?: unknown; commerceReady?: unknown; editorWorkspaceReady?: unknown; chatReady?: unknown; markdownFlowReady?: unknown; canvasReady?: unknown }
      entrySurfaces?: { commerce?: { active?: unknown; ready?: unknown; semanticKey?: unknown; routeCount?: unknown } }
      route?: { activeMainPanelTab?: unknown }
      issues?: unknown
    }
    if (inspection.pipelineReady !== true) {
      throw new Error(`expected ${activeTab} entry tab to be pipeline-ready, got ${JSON.stringify(inspection)}`)
    }
    if (inspection.readiness?.routeReady !== true || inspection.readiness?.commerceReady !== true || inspection.readiness?.editorWorkspaceReady !== true || inspection.readiness?.chatReady !== true || inspection.readiness?.markdownFlowReady !== true || inspection.readiness?.canvasReady !== true) {
      throw new Error(`expected ${activeTab} entry tab to keep every readiness checkpoint true, got ${JSON.stringify(inspection.readiness)}`)
    }
    if (inspection.route?.activeMainPanelTab !== activeTab) {
      throw new Error(`expected ${activeTab} entry tab to remain explicit without remapping, got ${JSON.stringify(inspection.route)}`)
    }
    if (inspection.entrySurfaces?.commerce?.semanticKey !== AGENTIC_COMMERCE_MAIN_PANEL_READINESS.semanticKey) {
      throw new Error(`expected ${activeTab} entry tab to expose shared Commerce semantic key, got ${JSON.stringify(inspection.entrySurfaces)}`)
    }
    if (activeTab === 'commerce' && (inspection.entrySurfaces.commerce.active !== true || inspection.entrySurfaces.commerce.ready !== true || inspection.entrySurfaces.commerce.routeCount !== AGENTIC_COMMERCE_MAIN_PANEL_READINESS.routeCount)) {
      throw new Error(`expected active Commerce entry surface to be ready from shared routes, got ${JSON.stringify(inspection.entrySurfaces.commerce)}`)
    }
    if (Array.isArray(inspection.issues) && inspection.issues.length > 0) {
      throw new Error(`expected ${activeTab} entry tab to report no issues, got ${JSON.stringify(inspection.issues)}`)
    }
  }
}

export async function testLocalMainPanelChatCanvasPipelineUsesRenderedIntegrationsEntrySnapshots() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    resetBrowserLocalSurfaceSnapshotsForTests()
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = installDeterministicRaf(dom.window)

    const api = useGraphStore.getState()
    api.resetAll()
    api.setChatProvider('openai')
    api.setChatEndpointUrl('/api/chat')
    api.setChatModel('gpt-4.1')
    api.setChatContextScope('workspace')
    api.setChatStorageTarget('chatKnowgrph')
    api.setIntegrationConfigsJson(stringifyIntegrationConfigs({
      ...DEFAULT_INTEGRATION_CONFIGS,
      aiChat: {
        ...DEFAULT_INTEGRATION_CONFIGS.aiChat,
        enabled: true,
      },
      pixverseVideo: {
        ...DEFAULT_INTEGRATION_CONFIGS.pixverseVideo,
        enabled: true,
        strategy: 'transition-video',
      },
    }))

    const container = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(container)
    root = createRoot(container)
    await mountReactRoot(root, React.createElement(MainPanel, {
      requestedTab: 'integrations',
      requestedSearchQuery: 'chat',
    }), {
      window: dom.window as unknown as Window,
      frames: 8,
    })
    await waitForTasks(4)
    await waitForFrames(dom.window as unknown as Window, 2)

    const mainPanelSnapshot = readLocalMainPanelSurfaceSnapshot()
    const settingsChatReadinessSnapshot = readLocalSettingsChatReadinessSurfaceSnapshot()
    if (mainPanelSnapshot?.activeTab !== 'integrations') {
      throw new Error(`expected rendered MainPanel snapshot to stay on Integrations, got ${JSON.stringify(mainPanelSnapshot)}`)
    }
    if (mainPanelSnapshot.sharedActions?.hasApply !== true || mainPanelSnapshot.sharedActions.hasReset !== true) {
      throw new Error(`expected rendered Integrations entry to register shared Settings actions, got ${JSON.stringify(mainPanelSnapshot.sharedActions)}`)
    }
    if (
      settingsChatReadinessSnapshot?.integrationEnabled !== true ||
      settingsChatReadinessSnapshot.integrationOpenTab !== 'chat' ||
      settingsChatReadinessSnapshot.pixverseVideoEnabled !== true ||
      settingsChatReadinessSnapshot.pixverseVideoStrategy !== 'transition-video' ||
      settingsChatReadinessSnapshot.pixverseVideoTransport !== 'mcp-stdio'
    ) {
      throw new Error(`expected rendered Integrations settings snapshot to expose normalized chat and PixVerse routing, got ${JSON.stringify(settingsChatReadinessSnapshot)}`)
    }

    const inspection = inspectLocalMainPanelChatCanvasPipeline({
      mainPanelSnapshot,
      commerceReadinessSnapshot: AGENTIC_COMMERCE_MAIN_PANEL_READINESS,
      settingsChatReadinessSnapshot,
      editorWorkspaceSnapshot: READY_EDITOR_WORKSPACE,
      chatPipelineSnapshot: READY_CHAT_PIPELINE,
      markdownDocumentName: 'workspace:/docs/agent-ready.md',
      markdownDocumentText: READY_MARKDOWN,
      markdownDocumentSourceUrl: '/knowgrph/share/agent-ready',
      graphData: READY_GRAPH,
      graphDataRevision: 1,
      canvasRenderMode: '2d',
      canvas2dRenderer: 'd3',
      documentSemanticMode: 'document',
      frontmatterModeEnabled: true,
      multiDimTableModeEnabled: false,
      documentStructureBaselineLock: false,
      collapsedGroupIds: [],
      selectedNodeId: 'start',
      selectedEdgeId: 'edge-1',
    }) as {
      pipelineReady?: unknown
      readiness?: { routeReady?: unknown; settingsReady?: unknown; chatReady?: unknown; markdownFlowReady?: unknown; canvasReady?: unknown }
      entrySurfaces?: { integrations?: { active?: unknown; ready?: unknown } }
      route?: { activeMainPanelTab?: unknown; integrationOpenTab?: unknown; chatContextScope?: unknown }
      counts?: { flowNodeCount?: unknown; canvasNodeCount?: unknown }
      issues?: unknown
    }

    if (
      inspection.pipelineReady !== true ||
      inspection.entrySurfaces?.integrations?.active !== true ||
      inspection.entrySurfaces.integrations.ready !== true ||
      inspection.readiness?.routeReady !== true ||
      inspection.readiness.settingsReady !== true ||
      inspection.readiness.chatReady !== true ||
      inspection.readiness.markdownFlowReady !== true ||
      inspection.readiness.canvasReady !== true ||
      inspection.route?.activeMainPanelTab !== 'integrations' ||
      inspection.route.integrationOpenTab !== 'chat' ||
      inspection.route.chatContextScope !== 'workspace' ||
      inspection.counts?.flowNodeCount !== 2 ||
      inspection.counts.canvasNodeCount !== 2 ||
      (Array.isArray(inspection.issues) && inspection.issues.length > 0)
    ) {
      throw new Error(`expected rendered Integrations entry to prove the local chat/frontmatter/canvas E2E pipeline, got ${JSON.stringify(inspection)}`)
    }

    const text = container.textContent || ''
    if (!text.includes('integrationConfigsJson') || !text.includes('Open FloatingPanel Chat UI')) {
      throw new Error(`expected rendered Integrations UI to expose integration routing rows and Chat entry action, got ${JSON.stringify(text)}`)
    }
  } finally {
    if (root) {
      await unmountReactRoot(root, { window: dom.window as unknown as Window })
    }
    resetBrowserLocalSurfaceSnapshotsForTests()
    useGraphStore.getState().resetAll()
    restoreDom()
    restoreWindow()
  }
}

export function testLocalMainPanelChatCanvasPipelineRejectsLegacyPaymentsEntryTab() {
  const inspection = inspectReadyPipeline('payments') as {
    pipelineReady?: unknown
    readiness?: { routeReady?: unknown; commerceReady?: unknown }
    route?: { activeMainPanelTab?: unknown }
    issues?: string[]
  }
  if (inspection.route?.activeMainPanelTab !== 'payments') {
    throw new Error(`expected legacy active tab to remain visible to inspection instead of being remapped, got ${JSON.stringify(inspection.route)}`)
  }
  if (inspection.pipelineReady === true || inspection.readiness?.routeReady === true) {
    throw new Error(`expected legacy payments tab to be rejected as an agent-ready entry point, got ${JSON.stringify(inspection)}`)
  }
  if (inspection.readiness?.commerceReady !== true) {
    throw new Error(`expected Commerce readiness to stay independently available while rejecting legacy tab, got ${JSON.stringify(inspection.readiness)}`)
  }
  if (!inspection.issues?.includes('MainPanel is mounted, but the active tab is not MCP, Integrations, or Commerce.')) {
    throw new Error(`expected a precise legacy tab issue without compatibility remapping, got ${JSON.stringify(inspection.issues)}`)
  }
}
