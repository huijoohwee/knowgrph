import type {
  LocalChatPipelineSurfaceSnapshot,
  LocalCommerceReadinessSurfaceSnapshot,
  LocalEditorWorkspaceSurfaceSnapshot,
  LocalMainPanelSurfaceSnapshot,
  LocalSettingsChatReadinessSurfaceSnapshot,
} from './browserLocalSurfaceSnapshots'
import { inspectLocalCanvasTopology } from './localCanvasTopologyInspection'
import { inspectLocalChatPipelineState } from './localChatPipelineStateInspection'
import { inspectLocalEditorWorkspaceState } from './localEditorWorkspaceStateInspection'
import { inspectLocalMainPanelState } from './localMainPanelStateInspection'
import { inspectLocalSettingsChatReadiness } from './localSettingsChatReadinessInspection'
import { inspectLocalWorkspaceDocument } from './localWorkspaceDocumentInspection'

type LocalMainPanelChatCanvasPipelineInspectionArgs = {
  mainPanelSnapshot: (LocalMainPanelSurfaceSnapshot & { updatedAtMs?: number }) | null
  commerceReadinessSnapshot: (LocalCommerceReadinessSurfaceSnapshot & { updatedAtMs?: number }) | null
  settingsChatReadinessSnapshot: (LocalSettingsChatReadinessSurfaceSnapshot & { updatedAtMs?: number }) | null
  editorWorkspaceSnapshot: (LocalEditorWorkspaceSurfaceSnapshot & { updatedAtMs?: number }) | null
  chatPipelineSnapshot: (LocalChatPipelineSurfaceSnapshot & { updatedAtMs?: number }) | null
  markdownDocumentName?: unknown
  markdownDocumentText?: unknown
  markdownDocumentSourceUrl?: unknown
  graphData: unknown
  graphDataRevision?: unknown
  canvasRenderMode?: unknown
  canvas2dRenderer?: unknown
  documentSemanticMode?: unknown
  frontmatterModeEnabled?: unknown
  multiDimTableModeEnabled?: unknown
  documentStructureBaselineLock?: unknown
  collapsedGroupIds?: unknown
  selectedNodeId?: unknown
  selectedEdgeId?: unknown
}

const AGENT_READY_MAIN_PANEL_ENTRY_TABS = ['mcp', 'integrations', 'commerce']

const inspectLocalCommerceReadiness = (
  snapshot: (LocalCommerceReadinessSurfaceSnapshot & { updatedAtMs?: number }) | null,
) => {
  if (!snapshot) {
    return {
      available: false,
      sourceKind: 'browser-local-mainpanel-commerce-readiness',
      message: 'MainPanel Commerce readiness is not currently mounted in the local Knowgrph browser runtime.',
    }
  }
  return {
    available: true,
    sourceKind: 'browser-local-mainpanel-commerce-readiness',
    surface: snapshot.surface,
    semanticKey: snapshot.semanticKey,
    routeCount: snapshot.routeCount,
    routePaths: snapshot.routePaths,
    sectionCount: Array.isArray(snapshot.sections) ? snapshot.sections.length : 0,
    sections: snapshot.sections,
    signals: snapshot.signals,
    updatedAtMs: snapshot.updatedAtMs || null,
  }
}

const buildIssues = (args: {
  mainPanel: ReturnType<typeof inspectLocalMainPanelState>
  commerceReadiness: ReturnType<typeof inspectLocalCommerceReadiness>
  settingsChatReadiness: ReturnType<typeof inspectLocalSettingsChatReadiness>
  editorWorkspace: ReturnType<typeof inspectLocalEditorWorkspaceState>
  chatPipeline: ReturnType<typeof inspectLocalChatPipelineState>
  workspaceDocument: ReturnType<typeof inspectLocalWorkspaceDocument>
  canvasTopology: ReturnType<typeof inspectLocalCanvasTopology>
}): string[] => {
  const issues: string[] = []
  if (args.mainPanel.available !== true) {
    issues.push('MainPanel is not mounted in the local browser runtime.')
  } else if (!AGENT_READY_MAIN_PANEL_ENTRY_TABS.includes(String(args.mainPanel.activeTab || ''))) {
    issues.push('MainPanel is mounted, but the active tab is not MCP, Integrations, or Commerce.')
  } else if (
    String(args.mainPanel.activeTab || '') === 'commerce'
    && (
      args.commerceReadiness.available !== true
      || Number(args.commerceReadiness.routeCount || 0) <= 0
    )
  ) {
    issues.push('MainPanel Commerce is active, but shared commerce route readiness is not available.')
  }

  if (args.settingsChatReadiness.available !== true) {
    issues.push('Settings chat readiness is not mounted in the local browser runtime.')
  } else {
    if (args.settingsChatReadiness.modelDiscovery?.ready !== true) {
      issues.push('Chat provider, endpoint, or model selection is incomplete in MainPanel settings.')
    }
    if (args.settingsChatReadiness.routing?.integrationEnabled !== true) {
      issues.push('MainPanel Integrations does not currently enable AI chat routing into the FloatingPanel chat surface.')
    }
  }

  if (args.editorWorkspace.available !== true) {
    issues.push('Editor Workspace is not mounted in the local browser runtime.')
  } else if (args.editorWorkspace.workspaceViewMode !== 'editor' || args.editorWorkspace.isMarkdown !== true) {
    issues.push('Editor Workspace is mounted, but the active document is not in the Markdown editor workflow.')
  }

  if (args.chatPipeline.available !== true) {
    issues.push('FloatingPanel Chat is not mounted in the local browser runtime.')
  } else {
    if (args.chatPipeline.kgcValidation?.hasYamlFrontmatter !== true) {
      issues.push('FloatingPanel Chat has not yet produced validated YAML frontmatter output.')
    }
    if (!String(args.chatPipeline.workspacePaths?.streamFollowPath || '').trim()) {
      issues.push('FloatingPanel Chat does not currently expose a followable workspace path for the active stream/draft.')
    }
  }

  if (args.workspaceDocument.available !== true) {
    issues.push('No active local workspace markdown document is available for inspection.')
  } else {
    if (args.workspaceDocument.hasFrontmatter !== true) {
      issues.push('The active workspace document does not yet contain YAML frontmatter.')
    }
    if (args.workspaceDocument.hasFlowBlock !== true) {
      issues.push('The active workspace document does not yet expose a canonical flow block.')
    }
    if (Array.isArray(args.workspaceDocument.forbiddenGroupingAliases) && args.workspaceDocument.forbiddenGroupingAliases.length > 0) {
      issues.push(`The active workspace document still uses forbidden grouping aliases: ${args.workspaceDocument.forbiddenGroupingAliases.join(', ')}.`)
    }
  }

  if (args.canvasTopology.available !== true) {
    issues.push('No active canvas topology is available in the local browser runtime.')
  } else if (Number(args.canvasTopology.graphTopology?.nodeCount || 0) <= 0) {
    issues.push('The active canvas topology is available, but the render graph is empty.')
  }

  return issues
}

export const inspectLocalMainPanelChatCanvasPipeline = (
  args: LocalMainPanelChatCanvasPipelineInspectionArgs,
) => {
  const mainPanel = inspectLocalMainPanelState(args.mainPanelSnapshot)
  const commerceReadiness = inspectLocalCommerceReadiness(args.commerceReadinessSnapshot)
  const settingsChatReadiness = inspectLocalSettingsChatReadiness(args.settingsChatReadinessSnapshot)
  const editorWorkspace = inspectLocalEditorWorkspaceState(args.editorWorkspaceSnapshot)
  const chatPipeline = inspectLocalChatPipelineState(args.chatPipelineSnapshot)
  const workspaceDocument = inspectLocalWorkspaceDocument({
    markdownDocumentName: args.markdownDocumentName,
    markdownDocumentText: args.markdownDocumentText,
    markdownDocumentSourceUrl: args.markdownDocumentSourceUrl,
  })
  const canvasTopology = inspectLocalCanvasTopology({
    graphData: args.graphData as Parameters<typeof inspectLocalCanvasTopology>[0]['graphData'],
    graphDataRevision: args.graphDataRevision as Parameters<typeof inspectLocalCanvasTopology>[0]['graphDataRevision'],
    markdownDocumentName: args.markdownDocumentName,
    markdownDocumentText: args.markdownDocumentText,
    canvasRenderMode: args.canvasRenderMode,
    canvas2dRenderer: args.canvas2dRenderer,
    documentSemanticMode: args.documentSemanticMode,
    frontmatterModeEnabled: args.frontmatterModeEnabled,
    multiDimTableModeEnabled: args.multiDimTableModeEnabled,
    documentStructureBaselineLock: args.documentStructureBaselineLock,
    collapsedGroupIds: args.collapsedGroupIds,
    selectedNodeId: args.selectedNodeId,
    selectedEdgeId: args.selectedEdgeId,
  })

  const issues = buildIssues({
    mainPanel,
    commerceReadiness,
    settingsChatReadiness,
    editorWorkspace,
    chatPipeline,
    workspaceDocument,
    canvasTopology,
  })
  const activeMainPanelTab = mainPanel.available === true ? String(mainPanel.activeTab || '') : ''
  const commerceReady =
    commerceReadiness.available === true
    && Number(commerceReadiness.routeCount || 0) > 0
    && Number(commerceReadiness.sectionCount || 0) > 0
  const routeReady =
    mainPanel.available === true
    && (
      activeMainPanelTab === 'mcp'
      || activeMainPanelTab === 'integrations'
      || (activeMainPanelTab === 'commerce' && commerceReady)
    )
  const settingsReady =
    settingsChatReadiness.available === true
    && settingsChatReadiness.modelDiscovery?.ready === true
    && settingsChatReadiness.routing?.integrationEnabled === true
  const chatReady =
    chatPipeline.available === true
    && chatPipeline.kgcValidation?.hasYamlFrontmatter === true
    && Boolean(chatPipeline.workspacePaths?.streamFollowPath || chatPipeline.finalize?.persistedKnowgrphPath)
  const markdownFlowReady =
    workspaceDocument.available === true
    && workspaceDocument.hasFrontmatter === true
    && workspaceDocument.hasFlowBlock === true
    && Array.isArray(workspaceDocument.forbiddenGroupingAliases)
    && workspaceDocument.forbiddenGroupingAliases.length === 0
  const canvasReady =
    canvasTopology.available === true
    && Number(canvasTopology.graphTopology?.nodeCount || 0) > 0
  const editorWorkspaceReady =
    editorWorkspace.available === true
    && editorWorkspace.workspaceViewMode === 'editor'
    && editorWorkspace.isMarkdown === true
  const pipelineReady = routeReady && settingsReady && editorWorkspaceReady && chatReady && markdownFlowReady && canvasReady

  return {
    available: mainPanel.available === true
      || settingsChatReadiness.available === true
      || editorWorkspace.available === true
      || chatPipeline.available === true
      || workspaceDocument.available === true
      || canvasTopology.available === true,
    sourceKind: 'browser-local-mainpanel-chat-canvas-pipeline',
    stage: pipelineReady ? 'ready' : chatPipeline.streaming?.active ? 'streaming' : 'partial',
    pipelineReady,
    message: pipelineReady
      ? 'MainPanel MCP/Integrations/Commerce, FloatingPanel Chat, workspace markdown/frontmatter, and active canvas topology are aligned for the current local E2E pipeline.'
      : 'One or more local E2E pipeline checkpoints are missing or incomplete.',
    checkpoints: {
      mainPanelMounted: mainPanel.available === true,
      commerceReadinessMounted: commerceReadiness.available === true,
      settingsChatReadinessMounted: settingsChatReadiness.available === true,
      editorWorkspaceMounted: editorWorkspace.available === true,
      chatPipelineMounted: chatPipeline.available === true,
      workspaceDocumentAvailable: workspaceDocument.available === true,
      canvasTopologyAvailable: canvasTopology.available === true,
    },
    readiness: {
      routeReady,
      commerceReady,
      settingsReady,
      editorWorkspaceReady,
      chatReady,
      markdownFlowReady,
      canvasReady,
    },
    entrySurfaces: {
      mcp: {
        active: activeMainPanelTab === 'mcp',
        ready: mainPanel.available === true && activeMainPanelTab === 'mcp',
      },
      integrations: {
        active: activeMainPanelTab === 'integrations',
        ready: mainPanel.available === true && activeMainPanelTab === 'integrations',
      },
      commerce: {
        active: activeMainPanelTab === 'commerce',
        ready: commerceReady,
        semanticKey: commerceReadiness.available === true ? commerceReadiness.semanticKey : null,
        routeCount: commerceReadiness.available === true ? commerceReadiness.routeCount : null,
      },
    },
    route: {
      activeMainPanelTab: mainPanel.available === true ? mainPanel.activeTab : null,
      integrationOpenTab: settingsChatReadiness.available === true
        ? settingsChatReadiness.routing?.integrationOpenTab || null
        : null,
      chatContextScope: settingsChatReadiness.available === true
        ? settingsChatReadiness.routing?.contextScope || null
        : null,
    },
    counts: {
      flowNodeCount: workspaceDocument.available === true ? workspaceDocument.flowNodeCount : null,
      flowConnectionCount: workspaceDocument.available === true ? workspaceDocument.flowConnectionCount : null,
      flowSubgraphCount: workspaceDocument.available === true ? workspaceDocument.flowSubgraphCount : null,
      canvasNodeCount: canvasTopology.available === true ? canvasTopology.graphTopology?.nodeCount ?? null : null,
      canvasEdgeCount: canvasTopology.available === true ? canvasTopology.graphTopology?.edgeCount ?? null : null,
      canvasSubgraphCount: canvasTopology.available === true ? canvasTopology.subgraphCount : null,
      collapsedGroupCount: canvasTopology.available === true ? canvasTopology.collapsedGroupCount : null,
    },
    issues,
    mainPanel,
    commerceReadiness,
    settingsChatReadiness,
    editorWorkspace,
    chatPipeline,
    workspaceDocument,
    canvasTopology,
  }
}
