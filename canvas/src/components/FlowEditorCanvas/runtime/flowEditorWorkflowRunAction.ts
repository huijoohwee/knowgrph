import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { isKgcWorkspaceCompanionPath, toCanonicalKgcWorkspacePath } from '@/features/chat/chatHistoryWorkspace.paths'
import { emitKgcRunOutput } from '@/features/chat/kgcRunOutput'
import { ensureEditorCanvasLandingForDuration } from '@/lib/toolbar/workspaceLandingGuard'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { UI_COPY, FLOW_SWARM_PREDICTION_NODE_TYPE_ID, FLOW_TEXT_GENERATION_NODE_LABEL, FLOW_TEXT_GENERATION_NODE_TYPE_ID, FLOW_VIDEO_TRANSCRIBER_NODE_LABEL, FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID, isFlowVideoScriptFormId } from '@/lib/config'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import { resolveWidgetRegistryEntry, FLOW_WIDGET_FORM_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { buildTextWidgetOutputPatch, buildRichMediaWidgetOutputPatch, clearRichMediaOutputProperties, resolveRichMediaWidgetKind, runRichMediaWidgetGeneration, writeTextWidgetRunOutputArtifact } from '@/features/chat/richMediaRun'
import { fetchYouTubeTranscriptMarkdown } from '@/features/transcription/youtubeTranscriptMarkdown'
import { getChatDefaultEndpointUrlForProvider, normalizeChatProviderId } from '@/lib/chatEndpoint'
import { generateRunMarkdownWithProvider } from '@/features/chat/byteplusRunGeneration'
import { inferTextGenerationProviderFamily, resolveEffectiveTextGenerationWidgetProperties } from '@/features/flow-editor-manager/registryTemplates'
import { runSwarmPredictionWidgetProperties } from '@/features/swarm-prediction/swarmPredictionWidget'
import {
  FLOW_SHOWRUNNER_NODE_TYPE_ID,
  runShowrunnerWidgetProperties,
} from '@/features/ai-showrunner/showrunnerFlowNode'
import {
  getCachedFlowEditorWorkflowNodeResolutionContext,
  resolveFlowEditorWorkflowNodeByIdAcrossGraphs,
  resolveFlowEditorWorkflowRunTarget,
} from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'
import {
  applyFlowEditorWorkflowRichMediaPanelDraftPatch,
  ensureFlowEditorWorkflowRichMediaPanelNodeId,
} from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowRichMediaPanel'
import {
  buildFlowEditorInlineComputeOutputPatch,
  resolveFlowEditorWorkflowConnectedValuesInput,
} from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowRunInputs'
import {
  isFlowEditorWorkflowRunnableNode,
  resolveFlowEditorWorkflowDownstreamRunTargetIds,
} from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowDownstreamRunTargets'
import {
  setFlowEditorWorkflowRunLoadingStateForKnownNodeIds,
  updateFlowEditorWorkflowOutputForKnownNodeIds,
} from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowWriteback'
import { readFlowComputeSource } from '@/lib/flowEditor/flowComputeInline'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'

export type FlowEditorWorkflowNodeRunner = (nodeId: string, runOptions?: {
  allowCreateRichMediaPanel?: boolean
  visitedNodeIds?: Set<string>
}) => Promise<void>

export type FlowEditorWorkflowNodeRunnerArgs = {
  baseGraphKind: string
  baseGraphData: GraphData | null
  readDraftGraphData: () => GraphData | null
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  renderGraphDataOverride: GraphData | null
  markdownDocumentName: string | null
  markdownDocumentSourceUrl: string | null
  widgetRegistry: WidgetRegistryEntry[]
  appendDraftNode: (args: {
    id?: string | null
    type: string
    label?: string | null
    x: number
    y: number
    properties?: Record<string, unknown>
  }) => string
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
  scheduleOverlayEdgeUpdate: () => void
}

export function resolveFlowEditorBaseGraphKind(graphData: GraphData | null | undefined): string {
  if (graphData && isFrontmatterFlowGraph(graphData)) return 'frontmatter-flow'
  const meta = (graphData?.metadata || {}) as Record<string, unknown>
  const byKind = String(meta.kind || '').trim()
  if (byKind) return byKind
  return String(graphData?.context || '').trim()
}

export function createFlowEditorWorkflowNodeRunner(args: FlowEditorWorkflowNodeRunnerArgs): FlowEditorWorkflowNodeRunner {
  const scheduleWorkflowOutputEdgeRefresh = () => {
    const run = () => args.scheduleOverlayEdgeUpdate()
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => run())
      return
    }
    run()
  }

  const runWorkflowNode: FlowEditorWorkflowNodeRunner = async (nodeId, runOptions) => {
    try {
      const id = String(nodeId || '').trim()
      const allowCreateRichMediaPanel = runOptions?.allowCreateRichMediaPanel !== false
      if (!id) return
      const visitedNodeIds = runOptions?.visitedNodeIds || new Set<string>()
      if (visitedNodeIds.has(id)) return
      visitedNodeIds.add(id)
      const activeWorkspacePath = typeof args.markdownDocumentName === 'string' ? args.markdownDocumentName.trim() : ''
      if (activeWorkspacePath && isKgcWorkspaceCompanionPath(activeWorkspacePath)) {
        const canonicalPath = toCanonicalKgcWorkspacePath(activeWorkspacePath)
        const fs = await getWorkspaceFs()
        await fs.ensureSeed()
        const canonicalText = String(await fs.readFileText(canonicalPath) || '')
        if (canonicalText.trim()) {
          useMarkdownExplorerStore.getState().setActivePath(canonicalPath)
          ensureEditorCanvasLandingForDuration(1500)
          const state = useGraphStore.getState()
          if (state.markdownDocumentName !== canonicalPath || state.markdownDocumentText !== canonicalText) {
            void state.setActiveMarkdownDocument({
              name: canonicalPath,
              text: canonicalText,
              normalizeMermaidMmd: false,
              autoEnableFrontmatter: false,
              sourceUrl: typeof args.markdownDocumentSourceUrl === 'string' ? args.markdownDocumentSourceUrl : null,
            })
          }
          const ok = await state.applyMarkdownDocumentToGraph(canonicalPath, canonicalText, { force: true })
          const outputResult = ok
            ? await emitKgcRunOutput({
                canonicalPath,
                canonicalText,
                generationConfig: {
                  provider: state.chatProvider,
                  endpointUrl: state.chatEndpointUrl,
                  apiKey: state.chatAuthMode === 'byok' ? state.chatApiKey : '',
                  chatModel: state.chatModel,
                },
                getStore: () => ({
                  captureCanvasPngSnapshot: () => useGraphStore.getState().captureCanvasPngSnapshot(),
                  captureCanvasSvgSnapshot: () => useGraphStore.getState().captureCanvasSvgSnapshot(),
                }),
              })
            : { path: null, kind: 'markdown' as const, degraded: false }
          const outputName = outputResult.path ? canonicalPath.split('/').pop() : ''
          const generatedName = outputResult.path ? outputResult.path.split('/').pop() : ''
          args.upsertUiToast({
            id: `flow-editor-run-${id}`,
            kind: 'neutral',
            message: ok
              ? generatedName
                ? outputResult.degraded
                  ? `Ran ${outputName || 'KGC document'} and generated ${generatedName} as a markdown fallback for video output.`
                  : `Ran ${outputName || 'KGC document'} and generated ${generatedName}.`
                : `Ran ${outputName || 'KGC document'}.`
              : `Opened ${canonicalPath.split('/').pop() || 'KGC document'}.`,
            ttlMs: 2200,
          })
          return
        }
      }

      const draft = args.readDraftGraphData()
      if (!draft) {
        args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
        return
      }
      const store = useGraphStore.getState()
      const workflowNodeResolutionContext = getCachedFlowEditorWorkflowNodeResolutionContext({
        draftGraph: draft,
        draftGraphRevision: readGraphDataRevision(draft),
        renderGraph: args.renderGraphDataOverride,
        renderGraphRevision: readGraphDataRevision(args.renderGraphDataOverride),
        baseGraph: args.baseGraphData,
        baseGraphRevision: readGraphDataRevision(args.baseGraphData),
        storeGraph: store.graphData as GraphData | null,
        storeGraphRevision: readGraphDataRevision(store.graphData as GraphData | null),
        preferCurrentGraphDataRefs: true,
      })
      const resolvedRunTarget = resolveFlowEditorWorkflowRunTarget({
        context: workflowNodeResolutionContext,
        requestedNodeId: id,
      })
      const node = resolvedRunTarget?.node || null
      if (!node) {
        args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorNodeNotFoundToast(id), ttlMs: 2400 })
        return
      }
      const graphForRun = resolvedRunTarget?.graphForRun || draft
      const resolvedNodeId = String(resolvedRunTarget?.resolvedNodeId || node.id || id)
      const writableNodeId = String(resolvedRunTarget?.writableNodeId || resolvedNodeId).trim() || resolvedNodeId

      const resolveNodeByIdAcrossGraphs = (candidateId: string): GraphNode | null =>
        resolveFlowEditorWorkflowNodeByIdAcrossGraphs({
          context: workflowNodeResolutionContext,
          candidateNodeId: candidateId,
          graphForRun,
        })

      const workflowWritebackNodeIds = [writableNodeId, resolvedNodeId, id, node.id]
      const updateRunOutputForKnownNodeIds = (buildPatch: (nodeProps: Record<string, unknown>) => Record<string, unknown>) => {
        updateFlowEditorWorkflowOutputForKnownNodeIds({
          nodeIds: workflowWritebackNodeIds,
          fallbackNode: node,
          fallbackWritableNodeId: writableNodeId,
          readLiveDraftGraphData: args.readDraftGraphData,
          resolveNodeByIdAcrossGraphs,
          commitDraftGraphDataUpdate: args.commitDraftGraphDataUpdate,
          updateNode: args.updateNode,
          scheduleWorkflowOutputEdgeRefresh,
          buildPatch,
        })
      }

      const setRunLoadingStateForKnownNodeIds = (loadingArgs: { loading: boolean; kind?: 'text' | 'image' | 'video' | 'audio' }) => {
        setFlowEditorWorkflowRunLoadingStateForKnownNodeIds({
          nodeIds: workflowWritebackNodeIds,
          fallbackNode: node,
          fallbackWritableNodeId: writableNodeId,
          loading: loadingArgs.loading,
          kind: loadingArgs.kind,
          readLiveDraftGraphData: args.readDraftGraphData,
          resolveNodeByIdAcrossGraphs,
          commitDraftGraphDataUpdate: args.commitDraftGraphDataUpdate,
          updateNode: args.updateNode,
          scheduleWorkflowOutputEdgeRefresh,
        })
      }

      const rawNodeProperties = (node.properties || {}) as Record<string, unknown>
      if (readFlowComputeSource(node)) {
        const inlineRegistryEntry = resolveWidgetRegistryEntry({ node, registry: args.widgetRegistry, graphMetaKind: args.baseGraphKind })
        const connectedValuesInput = resolveFlowEditorWorkflowConnectedValuesInput({
          context: workflowNodeResolutionContext,
          graphForRun,
          writableNodeId,
          registry: args.widgetRegistry,
          preserveMaterializedOutputs: false,
        })
        const connectedValuesBySchemaPath = connectedValuesInput?.connectedValuesByNodeId.get(connectedValuesInput.targetNodeId) || null
        const nextInlinePatch = buildFlowEditorInlineComputeOutputPatch({
          node,
          registryEntry: inlineRegistryEntry,
          connectedValuesBySchemaPath,
          currentProperties: rawNodeProperties,
        })
        if (!nextInlinePatch) {
          args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorRunFailedToast, ttlMs: 2600 })
          return
        }
        updateRunOutputForKnownNodeIds(nodeProps => buildFlowEditorInlineComputeOutputPatch({
          node: { ...node, properties: nodeProps as never },
          registryEntry: inlineRegistryEntry,
          connectedValuesBySchemaPath,
          currentProperties: nodeProps,
        }) || nodeProps)
        args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: 'Ran inline compute.', ttlMs: 2200 })
        return
      }

      const publishTextRunOutputToRichMediaPanel = (panelArgs: { anchorNode: GraphNode; outputText: string; title: string; model?: unknown; sourceUrl?: string; outputPath?: string | null; loading?: boolean }) => {
        const panelNodeId = ensureFlowEditorWorkflowRichMediaPanelNodeId({
          context: workflowNodeResolutionContext,
          graphForRun,
          allowCreateRichMediaPanel,
          anchorNode: panelArgs.anchorNode,
          readLiveDraftGraphData: args.readDraftGraphData,
          appendDraftNode: args.appendDraftNode,
        })
        if (!panelNodeId) return
        const patch: Record<string, unknown> = {
          ...clearRichMediaOutputProperties({}),
          ...buildTextWidgetOutputPatch({ output: String(panelArgs.outputText || ''), title: panelArgs.title, model: panelArgs.model, outputPath: panelArgs.outputPath }),
          richMediaActiveTab: 'text',
          outputLoading: panelArgs.loading === true ? true : undefined,
          outputLoadingKind: panelArgs.loading === true ? 'text' : undefined,
          lastRunAt: panelArgs.loading === true ? new Date().toISOString() : undefined,
          outputSourceUrl: typeof panelArgs.sourceUrl === 'string' && panelArgs.sourceUrl.trim() ? panelArgs.sourceUrl.trim() : undefined,
        }
        const updatedPanelInDraft = applyFlowEditorWorkflowRichMediaPanelDraftPatch({
          panelNodeId,
          patch,
          readLiveDraftGraphData: args.readDraftGraphData,
          commitDraftGraphDataUpdate: args.commitDraftGraphDataUpdate,
          scheduleWorkflowOutputEdgeRefresh,
        })
        const liveDraft = args.readDraftGraphData()
        const updatedPanel = updatedPanelInDraft || (Array.isArray(liveDraft?.nodes)
          ? liveDraft!.nodes.find(existing => String(existing?.id || '').trim() === panelNodeId) || null
          : resolveNodeByIdAcrossGraphs(panelNodeId))
        const existingPanelProps = (updatedPanel?.properties || {}) as Record<string, unknown>
        args.updateNode(panelNodeId, { properties: { ...existingPanelProps, ...patch } as never })
      }

      if (String(node.type || '').trim() === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID) {
        const sourceUrlRaw = typeof rawNodeProperties.sourceUrl === 'string' ? rawNodeProperties.sourceUrl.trim() : ''
        const langRaw = typeof rawNodeProperties.languageHint === 'string' ? rawNodeProperties.languageHint.trim() : ''
        if (!sourceUrlRaw) {
          args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: 'Import a video URL before running the Video Transcriber Widget.', ttlMs: 2400 })
          return
        }
        setRunLoadingStateForKnownNodeIds({ loading: true, kind: 'text' })
        try {
          const converted = await fetchYouTubeTranscriptMarkdown({ url: sourceUrlRaw, ...(langRaw ? { lang: langRaw } : {}) })
          if (!converted) {
            args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorRunFailedToast, ttlMs: 2600 })
            return
          }
          if ('error' in converted) {
            args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: converted.error.trim() ? converted.error.trim() : UI_COPY.flowEditorRunFailedToast, ttlMs: 2600 })
            return
          }
          const nodeTitle = node.label || FLOW_VIDEO_TRANSCRIBER_NODE_LABEL
          const resolvedSourceUrl = String(converted.sourceUrl || sourceUrlRaw).trim() || sourceUrlRaw
          const outputText = String(converted.markdown || '')
          const outputPath = await writeTextWidgetRunOutputArtifact({
            workspacePath: activeWorkspacePath || null,
            node,
            output: outputText,
            variant: 'transcript',
          })
          updateRunOutputForKnownNodeIds(nodeProps => ({
            ...clearRichMediaOutputProperties(nodeProps),
            sourceUrl: resolvedSourceUrl,
            ...(langRaw ? { languageHint: langRaw } : { languageHint: '' }),
            ...buildTextWidgetOutputPatch({ output: outputText, title: nodeTitle, model: 'youtube', outputPath }),
            outputSourceUrl: resolvedSourceUrl,
          }))
          publishTextRunOutputToRichMediaPanel({ anchorNode: node, outputText, title: nodeTitle, model: 'youtube', sourceUrl: resolvedSourceUrl, outputPath, loading: false })
          args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: 'Transcribed video transcript.', ttlMs: 2400 })
        } finally {
          setRunLoadingStateForKnownNodeIds({ loading: false })
        }
        return
      }

      if (String(node.type || '').trim() === FLOW_SWARM_PREDICTION_NODE_TYPE_ID) {
        const connectedValuesInput = resolveFlowEditorWorkflowConnectedValuesInput({
          context: workflowNodeResolutionContext,
          graphForRun,
          writableNodeId,
          registry: args.widgetRegistry,
        })
        const connectedValuesBySchemaPath = connectedValuesInput?.connectedValuesByNodeId.get(connectedValuesInput.targetNodeId)
        const readConnectedProperty = (schemaPath: string, propertyKey: string): unknown => {
          const connected = connectedValuesBySchemaPath?.[schemaPath]?.value
          return typeof connected === 'undefined' || connected === null ? rawNodeProperties[propertyKey] : connected
        }
        setRunLoadingStateForKnownNodeIds({ loading: true, kind: 'text' })
        try {
          const outputProperties = runSwarmPredictionWidgetProperties({
            ...rawNodeProperties,
            scenarioTitle: readConnectedProperty('properties.scenarioTitle', 'scenarioTitle'),
            seedSignalsJson: readConnectedProperty('properties.seedSignalsJson', 'seedSignalsJson'),
            agentPopulationJson: readConnectedProperty('properties.agentPopulationJson', 'agentPopulationJson'),
            interventionsJson: readConnectedProperty('properties.interventionsJson', 'interventionsJson'),
          })
          updateRunOutputForKnownNodeIds(nodeProps => ({
            ...clearRichMediaOutputProperties(nodeProps),
            output: outputProperties.output,
            outputSrcDoc: outputProperties.outputSrcDoc,
            imageUrl: outputProperties.imageUrl,
            predictionScore: outputProperties.predictionScore,
            confidenceScore: outputProperties.confidenceScore,
            eventLogJson: outputProperties.eventLogJson,
            metricsJson: outputProperties.metricsJson,
            swarmPredictionRunId: outputProperties.swarmPredictionRunId,
            outputMimeType: 'text/markdown; charset=utf-8',
            outputModel: 'knowgrph-swarm-prediction',
            lastRunAt: new Date().toISOString(),
          }))
          args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: 'Ran swarm prediction.', ttlMs: 2400 })
        } finally {
          setRunLoadingStateForKnownNodeIds({ loading: false })
        }
        return
      }

      if (String(node.type || '').trim() === FLOW_SHOWRUNNER_NODE_TYPE_ID) {
        const connectedValuesInput = resolveFlowEditorWorkflowConnectedValuesInput({
          context: workflowNodeResolutionContext,
          graphForRun,
          writableNodeId,
          registry: args.widgetRegistry,
        })
        const connectedValuesBySchemaPath = connectedValuesInput?.connectedValuesByNodeId.get(connectedValuesInput.targetNodeId)
        const readConnectedProperty = (schemaPath: string, propertyKey: string): unknown => {
          const connected = connectedValuesBySchemaPath?.[schemaPath]?.value
          return typeof connected === 'undefined' || connected === null ? rawNodeProperties[propertyKey] : connected
        }
        setRunLoadingStateForKnownNodeIds({ loading: true, kind: 'text' })
        try {
          const outputProperties = await runShowrunnerWidgetProperties({
            ...rawNodeProperties,
            brief_path: readConnectedProperty('properties.brief_path', 'brief_path'),
            brief_markdown: readConnectedProperty('properties.brief_markdown', 'brief_markdown'),
            run_id: readConnectedProperty('properties.run_id', 'run_id'),
            dry_run: readConnectedProperty('properties.dry_run', 'dry_run'),
          })
          updateRunOutputForKnownNodeIds(nodeProps => ({
            ...clearRichMediaOutputProperties(nodeProps),
            run_id: outputProperties.run_id,
            run_status: outputProperties.run_status,
            latest_artifact_path: outputProperties.latest_artifact_path,
            token_spend_summary: outputProperties.token_spend_summary,
            output: outputProperties.token_spend_summary,
            outputMimeType: 'application/json; charset=utf-8',
            outputModel: 'knowgrph-ai-showrunner',
            lastRunAt: new Date().toISOString(),
          }))
          args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: 'Ran AI Showrunner.', ttlMs: 2400 })
        } finally {
          setRunLoadingStateForKnownNodeIds({ loading: false })
        }
        return
      }

      const richMediaKind = resolveRichMediaWidgetKind(node)
      if (richMediaKind) {
        setRunLoadingStateForKnownNodeIds({ loading: true, kind: richMediaKind })
        try {
          const connectedValuesInput = resolveFlowEditorWorkflowConnectedValuesInput({
            context: workflowNodeResolutionContext,
            graphForRun,
            writableNodeId,
            registry: args.widgetRegistry,
          })
          const normalizedProvider = normalizeChatProviderId(store.chatProvider)
          const runProvider = normalizedProvider || store.chatProvider
          const runAuthMode = store.chatAuthMode === 'byok' ? 'byok' : 'serverManaged'
          const runApiKey = runAuthMode === 'byok' ? store.chatApiKey : ''
          const runEndpointUrl = String(store.chatEndpointUrl || '').trim() || getChatDefaultEndpointUrlForProvider(runProvider)
          const richMediaResult = await runRichMediaWidgetGeneration({
            node,
            connectedValuesBySchemaPath: connectedValuesInput?.connectedValuesByNodeId.get(connectedValuesInput.targetNodeId),
            markdownDocumentText: typeof store.markdownDocumentText === 'string' ? store.markdownDocumentText : '',
            workspacePath: activeWorkspacePath || null,
            generationConfig: { provider: runProvider, endpointUrl: runEndpointUrl, apiKey: runApiKey, chatModel: store.chatModel },
          })
          if (!richMediaResult) {
            args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorRunFailedToast, ttlMs: 2600 })
            return
          }
          updateRunOutputForKnownNodeIds(nodeProps => ({
            ...clearRichMediaOutputProperties(nodeProps),
            ...buildRichMediaWidgetOutputPatch({ kind: richMediaResult.kind, asset: richMediaResult.asset, outputPath: richMediaResult.outputPath, outputManifestPath: richMediaResult.outputManifestPath }),
          }))
          const generatedName = richMediaResult.outputPath ? richMediaResult.outputPath.split('/').pop() : richMediaResult.kind === 'video' ? 'video output' : 'image output'
          args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: `Generated ${generatedName}.`, ttlMs: 2400 })
        } finally {
          setRunLoadingStateForKnownNodeIds({ loading: false })
        }
        return
      }

      if (String(node.type || '').trim() === FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
        const resolvedTextRegistryEntry = resolveWidgetRegistryEntry({ node, registry: args.widgetRegistry, graphMetaKind: args.baseGraphKind })
        const providerFamily = inferTextGenerationProviderFamily({
          provider: rawNodeProperties.chatProvider,
          widgetTypeId: resolvedTextRegistryEntry?.widgetTypeId,
          formId: resolvedTextRegistryEntry?.formId || rawNodeProperties[FLOW_WIDGET_FORM_ID_KEY],
        })
        const properties = resolveEffectiveTextGenerationWidgetProperties({
          providerFamily,
          localProperties: rawNodeProperties,
          globalProperties: {
            chatProvider: store.chatProvider,
            chatAuthMode: store.chatAuthMode,
            chatEndpointUrl: store.chatEndpointUrl,
            chatModel: store.chatModel,
            chatTemperature: store.chatTemperature,
            chatMaxCompletionTokens: store.chatMaxCompletionTokens,
            chatServiceTier: store.chatServiceTier,
            chatStream: store.chatStream,
            chatMessagesJson: store.chatMessagesJson,
            chatReasoningEffort: store.chatReasoningEffort,
            chatThinkingType: store.chatThinkingType,
            chatThinkingJson: store.chatThinkingJson,
            chatFrequencyPenalty: store.chatFrequencyPenalty,
            chatPresencePenalty: store.chatPresencePenalty,
            chatTopP: store.chatTopP,
            chatLogprobs: store.chatLogprobs,
            chatTopLogprobs: store.chatTopLogprobs,
            chatParallelToolCalls: store.chatParallelToolCalls,
            chatStopJson: store.chatStopJson,
            chatStreamOptionsJson: store.chatStreamOptionsJson,
            chatResponseFormatJson: store.chatResponseFormatJson,
            chatLogitBiasJson: store.chatLogitBiasJson,
            chatToolsJson: store.chatToolsJson,
            chatToolChoiceJson: store.chatToolChoiceJson,
          },
        })
        const prompt = typeof properties.prompt === 'string' ? properties.prompt.trim() : ''
        if (!prompt) {
          args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: 'Add a prompt before running the Text Widget.', ttlMs: 2400 })
          return
        }
        setRunLoadingStateForKnownNodeIds({ loading: true, kind: 'text' })
        const mirrorTextOutputToRichMediaPanel = isFlowVideoScriptFormId(resolvedTextRegistryEntry?.formId) || providerFamily === 'byteplus'
        if (mirrorTextOutputToRichMediaPanel) {
          updateRunOutputForKnownNodeIds(nodeProps => ({ ...clearRichMediaOutputProperties(nodeProps), outputLoading: true, outputLoadingKind: 'text', lastRunAt: new Date().toISOString() }))
        }
        let lastPublishedText = ''
        const publishTextRunOutput = (outputText: string, loading: boolean, outputPath?: string | null) => {
          const nextOutput = String(outputText || '')
          if (mirrorTextOutputToRichMediaPanel) {
            updateRunOutputForKnownNodeIds(nodeProps => ({
              ...clearRichMediaOutputProperties(nodeProps),
              ...(loading === true ? {} : buildTextWidgetOutputPatch({ output: nextOutput, title: node.label || FLOW_TEXT_GENERATION_NODE_LABEL, model: properties.chatModel || store.chatModel, outputPath })),
              outputLoading: loading === true ? true : undefined,
              outputLoadingKind: loading === true ? 'text' : undefined,
              lastRunAt: loading === true ? new Date().toISOString() : undefined,
            }))
            publishTextRunOutputToRichMediaPanel({ anchorNode: node, outputText: nextOutput, title: node.label || FLOW_TEXT_GENERATION_NODE_LABEL, model: properties.chatModel || useGraphStore.getState().chatModel, outputPath, loading })
            return
          }
          updateRunOutputForKnownNodeIds(nodeProps => ({
            ...clearRichMediaOutputProperties(nodeProps),
            ...buildTextWidgetOutputPatch({ output: nextOutput, title: node.label || FLOW_TEXT_GENERATION_NODE_LABEL, model: properties.chatModel || store.chatModel, outputPath }),
            outputLoading: loading === true ? true : undefined,
            outputLoadingKind: loading === true ? 'text' : undefined,
          }))
        }
        try {
          const result = await generateRunMarkdownWithProvider({
            config: {
              provider: properties.chatProvider || store.chatProvider,
              endpointUrl: properties.chatEndpointUrl || store.chatEndpointUrl,
              apiKey: (properties.chatAuthMode || store.chatAuthMode) === 'byok' ? store.chatApiKey : '',
              chatModel: properties.chatModel || store.chatModel,
            },
            prompt,
            options: {
              chatTemperature: properties.chatTemperature ?? store.chatTemperature,
              chatMaxCompletionTokens: properties.chatMaxCompletionTokens ?? store.chatMaxCompletionTokens,
              chatServiceTier: properties.chatServiceTier ?? store.chatServiceTier,
              chatStream: properties.chatStream ?? store.chatStream,
              chatMessagesJson: properties.chatMessagesJson ?? store.chatMessagesJson,
              chatReasoningEffort: properties.chatReasoningEffort ?? store.chatReasoningEffort,
              chatThinkingType: properties.chatThinkingType ?? store.chatThinkingType,
              chatThinkingJson: properties.chatThinkingJson ?? store.chatThinkingJson,
              chatFrequencyPenalty: properties.chatFrequencyPenalty ?? store.chatFrequencyPenalty,
              chatPresencePenalty: properties.chatPresencePenalty ?? store.chatPresencePenalty,
              chatTopP: properties.chatTopP ?? store.chatTopP,
              chatLogprobs: properties.chatLogprobs ?? store.chatLogprobs,
              chatTopLogprobs: properties.chatTopLogprobs ?? store.chatTopLogprobs,
              chatParallelToolCalls: properties.chatParallelToolCalls ?? store.chatParallelToolCalls,
              chatStopJson: properties.chatStopJson ?? store.chatStopJson,
              chatStreamOptionsJson: properties.chatStreamOptionsJson ?? store.chatStreamOptionsJson,
              chatResponseFormatJson: properties.chatResponseFormatJson ?? store.chatResponseFormatJson,
              chatLogitBiasJson: properties.chatLogitBiasJson ?? store.chatLogitBiasJson,
              chatToolsJson: properties.chatToolsJson ?? store.chatToolsJson,
              chatToolChoiceJson: properties.chatToolChoiceJson ?? store.chatToolChoiceJson,
              onText: (nextText) => {
                if (nextText === lastPublishedText) return
                lastPublishedText = nextText
                publishTextRunOutput(nextText, true)
              },
            },
          })
          if (!result) {
            args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorRunFailedToast, ttlMs: 2600 })
            return
          }
          const outputPath = await writeTextWidgetRunOutputArtifact({
            workspacePath: activeWorkspacePath || null,
            node,
            output: result,
            variant: 'text-output',
          })
          publishTextRunOutput(result, false, outputPath)
          args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: 'Generated text output.', ttlMs: 2400 })
        } finally {
          setRunLoadingStateForKnownNodeIds({ loading: false })
        }
        return
      }

      const downstreamRunTargetIds = resolveFlowEditorWorkflowDownstreamRunTargetIds({
        node,
        graphData: graphForRun,
      }).filter(targetId => !visitedNodeIds.has(targetId))
      const downstreamRunnableTargetIds = downstreamRunTargetIds.filter(targetId => isFlowEditorWorkflowRunnableNode({
        node: resolveNodeByIdAcrossGraphs(targetId),
        resolveRichMediaKind: resolveRichMediaWidgetKind,
      }))
      if (downstreamRunnableTargetIds.length > 0) {
        for (const targetId of downstreamRunnableTargetIds) {
          await runWorkflowNode(targetId, { allowCreateRichMediaPanel, visitedNodeIds })
        }
        args.upsertUiToast({
          id: `flow-editor-run-downstream-${id}`,
          kind: 'neutral',
          message: `Ran ${downstreamRunnableTargetIds.length} downstream node${downstreamRunnableTargetIds.length === 1 ? '' : 's'}.`,
          ttlMs: 2200,
        })
        return
      }

      console.warn(`[flowEditor] runWorkflowNode: no handler for node type "${String(node.type || '').trim()}" (id: "${id}"). Skipping.`)
    } catch (error) {
      const detail = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '').trim() : ''
      args.upsertUiToast({ id: `flow-editor-run-failed-${String(nodeId || '')}`, kind: 'error', message: detail || UI_COPY.flowEditorRunFailedToast, ttlMs: 4200 })
    }
  }

  return runWorkflowNode
}
