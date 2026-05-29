import { inspectLocalMainPanelChatCanvasPipeline } from '@/features/agent-ready/localMainPanelChatCanvasPipelineInspection'
import type {
  LocalChatPipelineSurfaceSnapshot,
  LocalEditorWorkspaceSurfaceSnapshot,
  LocalMainPanelSurfaceSnapshot,
  LocalSettingsChatReadinessSurfaceSnapshot,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'
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
