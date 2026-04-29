import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { isKgcWorkspaceCompanionPath, toCanonicalKgcWorkspacePath } from '@/features/chat/chatHistoryWorkspace.paths'
import { emitKgcRunOutput } from '@/features/chat/kgcRunOutput'
import { ensureEditorCanvasLandingForDuration } from '@/lib/toolbar/workspaceLandingGuard'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { UI_COPY, FLOW_RICH_MEDIA_PANEL_NODE_LABEL, FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, FLOW_TEXT_GENERATION_NODE_LABEL, FLOW_TEXT_GENERATION_NODE_TYPE_ID, FLOW_VIDEO_TRANSCRIBER_NODE_LABEL, FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID, isFlowVideoScriptFormId } from '@/lib/config'
import { parseCanonicalNodeIds, splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'
import { buildSelectionSubgraph, exportWidgetBundleAsJson } from '@/lib/graph/file'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'
import { computeFlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { FLOW_RUN_ALL_PHASES, buildFlowRunAllNodeSequence } from '@/lib/flowEditor/runAllSequenceSsot'
import { WORKFLOW_RUN_ALL_EVENT } from '@/features/canvas/utils'
import { resolveWidgetRegistryEntry, FLOW_WIDGET_FORM_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { buildTextWidgetOutputPatch, buildRichMediaWidgetOutputPatch, clearRichMediaOutputProperties, resolveRichMediaWidgetKind, runRichMediaWidgetGeneration } from '@/features/chat/richMediaRun'
import { fetchYouTubeTranscriptMarkdown } from '@/features/transcription/youtubeTranscriptMarkdown'
import { CHAT_PROVIDER_BYTEPLUS, getChatDefaultEndpointUrlForProvider, normalizeChatProviderId } from '@/lib/chatEndpoint'
import { generateRunMarkdownWithProvider } from '@/features/chat/byteplusRunGeneration'
import { inferTextGenerationProviderFamily, resolveEffectiveTextGenerationWidgetProperties } from '@/features/flow-editor-manager/registryTemplates'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'

export function useFlowEditorWorkflowActions(args: {
  flowEditorViewActive: boolean
  baseGraphKind: string
  baseGraphData: GraphData | null
  draftGraphData: GraphData | null
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  renderGraphDataOverride: GraphData | null
  markdownDocumentName: string | null
  markdownDocumentSourceUrl: string | null
  appendDraftNode: (args: { id?: string | null; type: string; label?: string | null; x: number; y: number; properties?: Record<string, unknown> }) => string
  setDraftGraphData: React.Dispatch<React.SetStateAction<GraphData | null>>
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
}) {
  const runWorkflowNode = React.useCallback(async (nodeId: string) => {
    try {
      const id = String(nodeId || '').trim()
      if (!id) return
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

      const draft = (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null
      if (!draft) {
        args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
        return
      }
      const resolved = [draft, args.renderGraphDataOverride as GraphData | null, args.baseGraphData].filter(Boolean).map(graph => {
        const node = (graph!.nodes || []).find(n => String(n.id || '') === id) || null
        return node ? { graph: graph as GraphData, node } : null
      }).find(Boolean) as { graph: GraphData; node: GraphNode } | null
      const node = resolved?.node || null
      if (!node) {
        args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorNodeNotFoundToast(id), ttlMs: 2400 })
        return
      }
      const graphForRun = resolved?.graph || draft
      const resolvedNodeId = String(node.id || id)
      const pickWritableNodeId = () => {
        const draftNodes = Array.isArray(draft.nodes) ? draft.nodes : []
        const requested = splitComposedNodeId(id)
        const resolvedId = splitComposedNodeId(resolvedNodeId)
        const targetInners = new Set([requested.inner, resolvedId.inner].filter(Boolean))
        const exactRequested = draftNodes.find(n => String(n.id || '').trim() === requested.full)
        if (exactRequested) return String(exactRequested.id || '')
        const exactResolved = draftNodes.find(n => String(n.id || '').trim() === resolvedId.full)
        if (exactResolved) return String(exactResolved.id || '')
        const innerMatches = draftNodes.filter(n => targetInners.has(splitComposedNodeId(n.id).inner))
        if (innerMatches.length === 1) return String(innerMatches[0]?.id || '')
        return resolvedNodeId
      }
      const writableNodeId = pickWritableNodeId() || resolvedNodeId
      const store = useGraphStore.getState()

      const resolveNodeByIdAcrossGraphs = (candidateId: string): GraphNode | null => {
        const cid = String(candidateId || '').trim()
        if (!cid) return null
        const candidates = [
          args.draftGraphDataRef.current || args.draftGraphData,
          args.renderGraphDataOverride,
          store.graphData as GraphData | null,
          graphForRun,
        ].filter(Boolean) as GraphData[]
        for (let i = 0; i < candidates.length; i += 1) {
          const hit = (candidates[i]!.nodes || []).find(n => String(n.id || '').trim() === cid) || null
          if (hit) return hit
        }
        return null
      }

      const updateRunOutputForKnownNodeIds = (buildPatch: (nodeProps: Record<string, unknown>) => Record<string, unknown>) => {
        const candidateIds = new Set<string>()
        for (const next of parseCanonicalNodeIds(writableNodeId)) candidateIds.add(next)
        for (const next of parseCanonicalNodeIds(resolvedNodeId)) candidateIds.add(next)
        for (const next of parseCanonicalNodeIds(id)) candidateIds.add(next)
        for (const next of parseCanonicalNodeIds(node.id)) candidateIds.add(next)

        args.setDraftGraphData(prev => {
          if (!prev || !Array.isArray(prev.nodes) || prev.nodes.length === 0) return prev
          let changed = false
          const nextNodes = prev.nodes.map(existing => {
            const existingId = String(existing?.id || '').trim()
            if (!existingId || !candidateIds.has(existingId)) return existing
            const nextProps = buildPatch((existing.properties || {}) as Record<string, unknown>)
            changed = true
            return { ...existing, properties: nextProps as never }
          })
          if (!changed) return prev
          const nextDraft = { ...prev, nodes: nextNodes }
          args.draftGraphDataRef.current = nextDraft
          return nextDraft
        })

        let updated = false
        for (const candidateId of Array.from(candidateIds.values())) {
          const hit = resolveNodeByIdAcrossGraphs(candidateId)
          if (!hit) continue
          args.updateNode(candidateId, { properties: buildPatch((hit.properties || {}) as Record<string, unknown>) as never })
          updated = true
        }
        if (!updated) args.updateNode(writableNodeId, { properties: buildPatch((node.properties || {}) as Record<string, unknown>) as never })
      }

      const setRunLoadingStateForKnownNodeIds = (loadingArgs: { loading: boolean; kind?: 'text' | 'image' | 'video' }) => {
        updateRunOutputForKnownNodeIds(nodeProps => ({
          ...nodeProps,
          outputLoading: loadingArgs.loading === true ? true : undefined,
          outputLoadingKind: loadingArgs.loading === true ? (loadingArgs.kind || undefined) : undefined,
        }))
      }

      const dataflowRegistry = buildDataflowWidgetRegistry({
        documentWidgetRegistry: Array.isArray(store.documentWidgetRegistry) ? (store.documentWidgetRegistry as WidgetRegistryEntry[]) : [],
        effectiveWidgetRegistry: Array.isArray(store.effectiveWidgetRegistry) ? (store.effectiveWidgetRegistry as WidgetRegistryEntry[]) : [],
        widgetRegistry: Array.isArray(store.widgetRegistry) ? (store.widgetRegistry as WidgetRegistryEntry[]) : [],
      })

      const resolveRichMediaPanelTargetNodeId = (): string | null => {
        const graphs: GraphData[] = [
          (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null,
          args.renderGraphDataOverride,
          graphForRun,
          store.graphData as GraphData | null,
        ].filter(Boolean) as GraphData[]
        const allNodes: GraphNode[] = []
        for (let i = 0; i < graphs.length; i += 1) {
          const nodes = Array.isArray(graphs[i]!.nodes) ? (graphs[i]!.nodes as GraphNode[]) : []
          for (let j = 0; j < nodes.length; j += 1) allNodes.push(nodes[j]!)
        }
        const panels = allNodes.filter(n => String(n.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID)
        if (panels.length === 0) return null
        const activePanel = panels.find(n => {
          const p = (n.properties || {}) as Record<string, unknown>
          return (typeof p.outputSrcDoc === 'string' && p.outputSrcDoc.trim()) || (typeof p.output === 'string' && p.output.trim())
        })
        return String((activePanel || panels[0])!.id || '').trim() || null
      }

      const ensureRichMediaPanelNodeId = (anchorNode: GraphNode): string | null => {
        const existing = resolveRichMediaPanelTargetNodeId()
        if (existing) return existing
        if (!args.draftGraphData) return null
        const createdId = args.appendDraftNode({
          id: null,
          type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
          label: FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
          x: (Number.isFinite(anchorNode.x) ? anchorNode.x : 0) + 520,
          y: Number.isFinite(anchorNode.y) ? anchorNode.y : 0,
          properties: { media_interactive: true },
        })
        return createdId
      }

      const updatePanelInDraft = (panelId: string, patch: Record<string, unknown>) => {
        args.setDraftGraphData(prev => {
          if (!prev || !Array.isArray(prev.nodes) || prev.nodes.length === 0) return prev
          let changed = false
          const nextNodes = prev.nodes.map(existing => {
            const existingId = String(existing?.id || '').trim()
            if (existingId !== panelId) return existing
            changed = true
            return { ...existing, properties: { ...((existing.properties || {}) as Record<string, unknown>), ...patch } as never }
          })
          if (!changed) return prev
          const nextDraft = { ...prev, nodes: nextNodes }
          args.draftGraphDataRef.current = nextDraft
          return nextDraft
        })
      }

      const publishTextRunOutputToRichMediaPanel = (panelArgs: { anchorNode: GraphNode; outputText: string; title: string; model?: unknown; sourceUrl?: string; loading?: boolean }) => {
        const panelNodeId = ensureRichMediaPanelNodeId(panelArgs.anchorNode)
        if (!panelNodeId) return
        const patch: Record<string, unknown> = {
          ...clearRichMediaOutputProperties({}),
          ...buildTextWidgetOutputPatch({ output: String(panelArgs.outputText || ''), title: panelArgs.title, model: panelArgs.model }),
          richMediaActiveTab: 'text',
          outputLoading: panelArgs.loading === true ? true : undefined,
          outputLoadingKind: panelArgs.loading === true ? 'text' : undefined,
          outputSourceUrl: typeof panelArgs.sourceUrl === 'string' && panelArgs.sourceUrl.trim() ? panelArgs.sourceUrl.trim() : undefined,
        }
        updatePanelInDraft(panelNodeId, patch)
        args.updateNode(panelNodeId, { properties: patch as never })
      }

      if (String(node.type || '').trim() === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID) {
        const rawProperties = (node.properties || {}) as Record<string, unknown>
        const sourceUrlRaw = typeof rawProperties.sourceUrl === 'string' ? rawProperties.sourceUrl.trim() : ''
        const langRaw = typeof rawProperties.languageHint === 'string' ? rawProperties.languageHint.trim() : ''
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
          updateRunOutputForKnownNodeIds(nodeProps => ({
            ...clearRichMediaOutputProperties(nodeProps),
            sourceUrl: resolvedSourceUrl,
            ...(langRaw ? { languageHint: langRaw } : { languageHint: '' }),
            ...buildTextWidgetOutputPatch({ output: outputText, title: nodeTitle, model: 'youtube' }),
            outputSourceUrl: resolvedSourceUrl,
          }))
          publishTextRunOutputToRichMediaPanel({ anchorNode: node, outputText, title: nodeTitle, model: 'youtube', sourceUrl: resolvedSourceUrl, loading: false })
          args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: 'Transcribed video transcript.', ttlMs: 2400 })
        } finally {
          setRunLoadingStateForKnownNodeIds({ loading: false })
        }
        return
      }

      const richMediaKind = resolveRichMediaWidgetKind(node)
      if (richMediaKind) {
        setRunLoadingStateForKnownNodeIds({ loading: true, kind: richMediaKind })
        try {
          const connectedValuesByNodeId = computeFlowConnectedValuesBySchemaPath({
            graphData: (args.renderGraphDataOverride as GraphData | null) || graphForRun,
            registry: dataflowRegistry,
            targetNodeIds: new Set([writableNodeId]),
          })
          const normalizedProvider = normalizeChatProviderId(store.chatProvider)
          const runProvider = CHAT_PROVIDER_BYTEPLUS
          const runAuthMode = store.chatAuthMode === 'byok' ? 'byok' : 'serverManaged'
          const runApiKey = runAuthMode === 'byok' ? store.chatApiKey : ''
          const runEndpointUrl = normalizedProvider === CHAT_PROVIDER_BYTEPLUS ? store.chatEndpointUrl : getChatDefaultEndpointUrlForProvider(CHAT_PROVIDER_BYTEPLUS)
          const richMediaResult = await runRichMediaWidgetGeneration({
            node,
            connectedValuesBySchemaPath: connectedValuesByNodeId.get(writableNodeId),
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
            ...buildRichMediaWidgetOutputPatch({ kind: richMediaResult.kind, asset: richMediaResult.asset, outputPath: richMediaResult.outputPath }),
          }))
          const generatedName = richMediaResult.outputPath ? richMediaResult.outputPath.split('/').pop() : richMediaResult.kind === 'video' ? 'video output' : 'image output'
          args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: `Generated ${generatedName}.`, ttlMs: 2400 })
        } finally {
          setRunLoadingStateForKnownNodeIds({ loading: false })
        }
        return
      }

      if (String(node.type || '').trim() === FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
        const resolvedTextRegistryEntry = resolveWidgetRegistryEntry({ node, registry: dataflowRegistry, graphMetaKind: args.baseGraphKind })
        const rawProperties = (node.properties || {}) as Record<string, unknown>
        const providerFamily = inferTextGenerationProviderFamily({
          provider: rawProperties.chatProvider,
          widgetTypeId: resolvedTextRegistryEntry?.widgetTypeId,
          formId: resolvedTextRegistryEntry?.formId || rawProperties[FLOW_WIDGET_FORM_ID_KEY],
        })
        const properties = resolveEffectiveTextGenerationWidgetProperties({
          providerFamily,
          localProperties: rawProperties,
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
          updateRunOutputForKnownNodeIds(nodeProps => ({ ...clearRichMediaOutputProperties(nodeProps), outputLoading: true, outputLoadingKind: 'text' }))
        }
        let lastPublishedText = ''
        const publishTextRunOutput = (outputText: string, loading: boolean) => {
          const nextOutput = String(outputText || '')
          if (mirrorTextOutputToRichMediaPanel) {
            updateRunOutputForKnownNodeIds(nodeProps => ({ ...clearRichMediaOutputProperties(nodeProps), outputLoading: loading === true ? true : undefined, outputLoadingKind: loading === true ? 'text' : undefined }))
            publishTextRunOutputToRichMediaPanel({ anchorNode: node, outputText: nextOutput, title: node.label || FLOW_TEXT_GENERATION_NODE_LABEL, model: properties.chatModel || useGraphStore.getState().chatModel, loading })
            return
          }
          updateRunOutputForKnownNodeIds(nodeProps => ({
            ...clearRichMediaOutputProperties(nodeProps),
            ...buildTextWidgetOutputPatch({ output: nextOutput, title: node.label || FLOW_TEXT_GENERATION_NODE_LABEL, model: properties.chatModel || store.chatModel }),
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
          publishTextRunOutput(result, false)
          args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: 'Generated text output.', ttlMs: 2400 })
        } finally {
          setRunLoadingStateForKnownNodeIds({ loading: false })
        }
        return
      }

      const subgraph = buildSelectionSubgraph(graphForRun, writableNodeId, null) || { ...graphForRun, nodes: [node], edges: [] }
      const registry = Array.isArray(store.widgetRegistry) ? store.widgetRegistry : []
      const nodeTypeIds = new Set((subgraph.nodes || []).map(n => String(n.type || '').trim()).filter(Boolean))
      const registryEntries = registry.filter(e => e && e.isEnabled && nodeTypeIds.has(String(e.nodeTypeId || '').trim()))
      const fallbackResolved = resolveWidgetRegistryEntry({ node, registry, graphMetaKind: args.baseGraphKind })
      const entries = registryEntries.length > 0 ? registryEntries : fallbackResolved ? [fallbackResolved] : []
      await exportWidgetBundleAsJson({ graphData: subgraph, registryEntries: entries, suggestedName: `flow-node-${writableNodeId}.widget.bundle.json` })
      args.upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorRunExportedToast, ttlMs: 2200 })
    } catch (error) {
      const detail = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '').trim() : ''
      args.upsertUiToast({ id: `flow-editor-run-failed-${String(nodeId || '')}`, kind: 'error', message: detail || UI_COPY.flowEditorRunFailedToast, ttlMs: 4200 })
    }
  }, [args])

  const runWorkflowAllInFlightRef = React.useRef(false)
  const runWorkflowAllNodes = React.useCallback(async () => {
    if (!args.flowEditorViewActive) {
      args.upsertUiToast({ id: 'flow-editor-run-all-not-active', kind: 'neutral', message: 'Open Flow Editor to run all.', ttlMs: 2200 })
      return
    }
    if (runWorkflowAllInFlightRef.current) return
    runWorkflowAllInFlightRef.current = true
    try {
      const draft = (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null
      const nodes = Array.isArray(draft?.nodes) ? (draft!.nodes as GraphNode[]) : []
      if (!draft || nodes.length === 0) {
        args.upsertUiToast({ id: 'flow-editor-run-all-missing', kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
        return
      }
      const ordered = buildFlowRunAllNodeSequence({ graphData: draft, eligibleNodeIds: buildFlowWidgetEligibleNodeIdSet(nodes) })
      const ids = ordered.orderedNodeIds
      if (ids.length === 0) {
        args.upsertUiToast({ id: 'flow-editor-run-all-empty', kind: 'neutral', message: 'No runnable workflow nodes found.', ttlMs: 2400 })
        return
      }
      const phaseSummary = FLOW_RUN_ALL_PHASES.map(phase => `${phase.label}: ${ordered.phaseCounts[phase.id] || 0}`).join(' · ')
      args.upsertUiToast({ id: 'flow-editor-run-all', kind: 'neutral', message: `Running ${ids.length} nodes in sequence. ${phaseSummary}`, ttlMs: 2600 })
      for (let i = 0; i < ids.length; i += 1) {
        await runWorkflowNode(ids[i]!)
        if (typeof requestAnimationFrame === 'function') await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      }
      args.upsertUiToast({ id: 'flow-editor-run-all-done', kind: 'neutral', message: `Ran ${ids.length} nodes.`, ttlMs: 2200 })
    } finally {
      runWorkflowAllInFlightRef.current = false
    }
  }, [args, runWorkflowNode])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => {
      void runWorkflowAllNodes()
    }
    window.addEventListener(WORKFLOW_RUN_ALL_EVENT, handler as EventListener)
    return () => window.removeEventListener(WORKFLOW_RUN_ALL_EVENT, handler as EventListener)
  }, [runWorkflowAllNodes])

  const exportWorkflowBundle = React.useCallback(async () => {
    try {
      const draft = (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null
      if (!draft) {
        args.upsertUiToast({ id: 'flow-editor-export-bundle', kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
        return
      }
      const store = useGraphStore.getState()
      const registry = Array.isArray(store.widgetRegistry) ? store.widgetRegistry : []
      await exportWidgetBundleAsJson({ graphData: draft, registryEntries: registry, suggestedName: 'flow-workflow.widget.bundle.json' })
      args.upsertUiToast({ id: 'flow-editor-export-bundle', kind: 'neutral', message: UI_COPY.flowEditorRunExportedToast, ttlMs: 2200 })
    } catch {
      args.upsertUiToast({ id: 'flow-editor-export-bundle-failed', kind: 'neutral', message: UI_COPY.flowEditorRunFailedToast, ttlMs: 2600 })
    }
  }, [args])

  return { exportWorkflowBundle, runWorkflowNode }
}
