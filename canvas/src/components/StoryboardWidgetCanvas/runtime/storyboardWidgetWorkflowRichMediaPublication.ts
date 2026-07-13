import { buildTextWidgetOutputPatch, clearRichMediaOutputProperties, isRichMediaOutputTargetNode } from '@/features/chat/richMediaRun'
import { toAnnotationPreviewSrcDoc, toMarkdownSummary, type AnnotationRunResult } from '@/features/visual-annotation-engine'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { resolveStoryboardWidgetWorkflowDownstreamRunTargetIds } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowDownstreamRunTargets'
import {
  applyStoryboardWidgetWorkflowRichMediaPanelDraftPatch,
  ensureStoryboardWidgetWorkflowRichMediaPanelNodeId,
} from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPanel'
import type { StoryboardWidgetWorkflowNodeResolutionContext } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetRenderGraph'
import { areStoryboardWidgetWorkflowRecordValuesEqual } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowWriteback'

const HTML_VIDEO_PREVIEW_STABILITY_KEYS = [
  'output',
  'outputSrcDoc',
  'outputMimeType',
  'outputModel',
  'renderErrorCode',
  'renderErrorReason',
  'richMediaActiveTab',
] as const

const readWorkflowString = (value: unknown): string => {
  const scalar = value && typeof value === 'object' && !Array.isArray(value) && 'value' in value
    ? (value as { value?: unknown }).value
    : value
  return typeof scalar === 'string' ? scalar.trim() : ''
}

export function stabilizeHtmlVideoPreviewPatchForExistingProps(
  currentProps: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const outputSrcDoc = typeof patch.outputSrcDoc === 'string' ? patch.outputSrcDoc : ''
  if (!outputSrcDoc || currentProps.outputSrcDoc !== outputSrcDoc) return patch
  for (const key of HTML_VIDEO_PREVIEW_STABILITY_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue
    if (!Object.is(currentProps[key], patch[key])) return patch
  }
  return {
    ...patch,
    lastRunAt: currentProps.lastRunAt,
  }
}

export type StoryboardWidgetTextRunOutputPublisher = (args: {
  anchorNode: GraphNode
  outputText: string
  title: string
  model?: unknown
  sourceUrl?: string
  outputPath?: string | null
  loading?: boolean
}) => void

export type StoryboardWidgetMediaRunOutputPublisher = (args: {
  anchorNode: GraphNode
  patch: Record<string, unknown>
}) => void

export type StoryboardWidgetAnnotationRunOutputPublisher = (args: {
  anchorNode: GraphNode
  result: AnnotationRunResult
}) => void

export function resolveMediaPatchActiveTab(args: {
  existingActiveTab: unknown
  patch: Record<string, unknown>
}): string {
  const explicitActiveTab = readWorkflowString(args.patch.richMediaActiveTab)
  if (explicitActiveTab) return explicitActiveTab
  const existingActiveTab = readWorkflowString(args.existingActiveTab)
  const hasImage = Boolean(readWorkflowString(args.patch.imageUrl))
  const hasVideo = Boolean(readWorkflowString(args.patch.videoUrl))
  const hasAudio = Boolean(readWorkflowString(args.patch.audioUrl))
  if (existingActiveTab === 'image' && hasImage) return 'image'
  if (existingActiveTab === 'video' && hasVideo) return 'video'
  if (existingActiveTab === 'audio' && hasAudio) return 'audio'
  if (hasImage) return 'image'
  if (hasVideo) return 'video'
  if (hasAudio) return 'audio'
  return 'auto'
}

export function createStoryboardWidgetWorkflowRichMediaPublishers(args: {
  context: StoryboardWidgetWorkflowNodeResolutionContext
  graphForRun: GraphData
  allowCreateRichMediaPanel: boolean
  suppressLayoutMutation: boolean
  withRunLayoutMutationGuard: <T>(run: () => T) => T
  scheduleWorkflowOutputEdgeRefresh: () => void
  readLiveDraftGraphData: () => GraphData | null
  appendDraftNode: (args: {
    id?: string | null
    type: string
    label?: string | null
    x: number
    y: number
    properties?: Record<string, unknown>
  }) => string
  commitDraftGraphDataUpdate: (currentDraft: GraphData, nextDraft: GraphData) => void
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  resolveNodeByIdAcrossGraphs: (candidateId: string) => GraphNode | null
}): {
  publishTextRunOutputToRichMediaPanel: StoryboardWidgetTextRunOutputPublisher
  publishMediaRunOutputToRichMediaPanel: StoryboardWidgetMediaRunOutputPublisher
  publishAnnotationRunOutputToRichMediaPanel: StoryboardWidgetAnnotationRunOutputPublisher
} {
  const publishTextRunOutputToRichMediaPanel: StoryboardWidgetTextRunOutputPublisher = panelArgs => {
    args.withRunLayoutMutationGuard(() => {
      const panelNodeId = ensureStoryboardWidgetWorkflowRichMediaPanelNodeId({
        context: args.context,
        graphForRun: args.graphForRun,
        allowCreateRichMediaPanel: args.allowCreateRichMediaPanel,
        anchorNode: panelArgs.anchorNode,
        readLiveDraftGraphData: args.readLiveDraftGraphData,
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
      const updatedPanelInDraft = applyStoryboardWidgetWorkflowRichMediaPanelDraftPatch({
        panelNodeId,
        patch,
        readLiveDraftGraphData: args.readLiveDraftGraphData,
        commitDraftGraphDataUpdate: args.commitDraftGraphDataUpdate,
        scheduleWorkflowOutputEdgeRefresh: args.scheduleWorkflowOutputEdgeRefresh,
      })
      const liveDraft = args.readLiveDraftGraphData()
      const updatedPanel = updatedPanelInDraft || (Array.isArray(liveDraft?.nodes)
        ? liveDraft!.nodes.find(existing => String(existing?.id || '').trim() === panelNodeId) || null
        : args.resolveNodeByIdAcrossGraphs(panelNodeId))
      const existingPanelProps = (updatedPanel?.properties || {}) as Record<string, unknown>
      if (!args.suppressLayoutMutation) args.updateNode(panelNodeId, { properties: { ...existingPanelProps, ...patch } as never })
    })
  }

  const publishMediaRunOutputToRichMediaPanel: StoryboardWidgetMediaRunOutputPublisher = panelArgs => {
    args.withRunLayoutMutationGuard(() => {
      const downstreamPanelTargetIds = resolveStoryboardWidgetWorkflowDownstreamRunTargetIds({
        node: panelArgs.anchorNode,
        graphData: args.graphForRun,
      }).filter(targetId => isRichMediaOutputTargetNode(args.resolveNodeByIdAcrossGraphs(targetId)))
      const panelNodeIds = downstreamPanelTargetIds.length > 0
        ? downstreamPanelTargetIds
        : [ensureStoryboardWidgetWorkflowRichMediaPanelNodeId({
          context: args.context,
          graphForRun: args.graphForRun,
          allowCreateRichMediaPanel: args.allowCreateRichMediaPanel,
          anchorNode: panelArgs.anchorNode,
          readLiveDraftGraphData: args.readLiveDraftGraphData,
          appendDraftNode: args.appendDraftNode,
        })].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      for (const panelNodeId of panelNodeIds) {
        const liveDraftBeforePatch = args.readLiveDraftGraphData()
        const existingPanelBeforePatch = Array.isArray(liveDraftBeforePatch?.nodes)
          ? liveDraftBeforePatch!.nodes.find(existing => String(existing?.id || '').trim() === panelNodeId) || args.resolveNodeByIdAcrossGraphs(panelNodeId)
          : args.resolveNodeByIdAcrossGraphs(panelNodeId)
        const existingPanelBeforePatchProps = (existingPanelBeforePatch?.properties || {}) as Record<string, unknown>
        const rawPatch = {
          ...panelArgs.patch,
          richMediaActiveTab: resolveMediaPatchActiveTab({
            existingActiveTab: existingPanelBeforePatchProps.richMediaActiveTab,
            patch: panelArgs.patch,
          }),
        }
        const patch = stabilizeHtmlVideoPreviewPatchForExistingProps(existingPanelBeforePatchProps, rawPatch)
        const updatedPanelInDraft = applyStoryboardWidgetWorkflowRichMediaPanelDraftPatch({
          panelNodeId,
          patch,
          readLiveDraftGraphData: args.readLiveDraftGraphData,
          commitDraftGraphDataUpdate: args.commitDraftGraphDataUpdate,
          scheduleWorkflowOutputEdgeRefresh: args.scheduleWorkflowOutputEdgeRefresh,
        })
        const liveDraft = args.readLiveDraftGraphData()
        const updatedPanel = updatedPanelInDraft || (Array.isArray(liveDraft?.nodes)
          ? liveDraft!.nodes.find(existing => String(existing?.id || '').trim() === panelNodeId) || null
          : args.resolveNodeByIdAcrossGraphs(panelNodeId))
        const existingPanelProps = (updatedPanel?.properties || {}) as Record<string, unknown>
        const nextPanelProps = { ...existingPanelProps, ...patch }
        if (!args.suppressLayoutMutation && !areStoryboardWidgetWorkflowRecordValuesEqual(existingPanelProps, nextPanelProps)) {
          args.updateNode(panelNodeId, { properties: nextPanelProps as never })
        }
      }
    })
  }

  const publishAnnotationRunOutputToRichMediaPanel: StoryboardWidgetAnnotationRunOutputPublisher = panelArgs => {
    const result = panelArgs.result
    const jsonText = JSON.stringify(result, null, 2)
    const summaryText = result.ok === true ? toMarkdownSummary(result) : [
      '## Annotation Error',
      '',
      `- code: ${result.errorCode}`,
      ...(result.modelId ? [`- modelId: ${result.modelId}`] : []),
      ...(result.field ? [`- field: ${result.field}`] : []),
      ...(result.reason ? [`- reason: ${result.reason}`] : []),
      '',
      '```json',
      jsonText,
      '```',
    ].join('\n')
    const outputText = result.ok === true ? `${summaryText}\n\n## Annotation JSON\n\n\`\`\`json\n${jsonText}\n\`\`\`` : summaryText
    args.withRunLayoutMutationGuard(() => {
      const downstreamPanelTargetIds = resolveStoryboardWidgetWorkflowDownstreamRunTargetIds({
        node: panelArgs.anchorNode,
        graphData: args.graphForRun,
      }).filter(targetId => readWorkflowString(args.resolveNodeByIdAcrossGraphs(targetId)?.type) === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID)
      const panelNodeIds = downstreamPanelTargetIds.length > 0
        ? downstreamPanelTargetIds
        : [ensureStoryboardWidgetWorkflowRichMediaPanelNodeId({
          context: args.context,
          graphForRun: args.graphForRun,
          allowCreateRichMediaPanel: args.allowCreateRichMediaPanel,
          anchorNode: panelArgs.anchorNode,
          readLiveDraftGraphData: args.readLiveDraftGraphData,
          appendDraftNode: args.appendDraftNode,
        })].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      for (const panelNodeId of panelNodeIds) {
        const patch: Record<string, unknown> = {
          ...clearRichMediaOutputProperties({}),
          ...buildTextWidgetOutputPatch({
            output: outputText,
            title: panelArgs.anchorNode.label || 'Annotation Engine',
            model: result.modelId || 'annotation',
            outputPath: result.ok === true ? result.outputPath : null,
          }),
          ...(result.ok === true ? { outputSrcDoc: toAnnotationPreviewSrcDoc(result) } : {}),
          annotationId: result.ok === true ? result.annotationId : undefined,
          annotationSchemaVersion: result.ok === true ? result.schemaVersion : undefined,
          renderErrorCode: result.ok === false ? result.errorCode : undefined,
          renderErrorReason: result.ok === false ? result.reason : undefined,
          richMediaActiveTab: result.ok === true ? 'auto' : 'text',
          lastRunAt: new Date().toISOString(),
        }
        const updatedPanelInDraft = applyStoryboardWidgetWorkflowRichMediaPanelDraftPatch({
          panelNodeId,
          patch,
          readLiveDraftGraphData: args.readLiveDraftGraphData,
          commitDraftGraphDataUpdate: args.commitDraftGraphDataUpdate,
          scheduleWorkflowOutputEdgeRefresh: args.scheduleWorkflowOutputEdgeRefresh,
        })
        const liveDraft = args.readLiveDraftGraphData()
        const updatedPanel = updatedPanelInDraft || (Array.isArray(liveDraft?.nodes)
          ? liveDraft!.nodes.find(existing => String(existing?.id || '').trim() === panelNodeId) || null
          : args.resolveNodeByIdAcrossGraphs(panelNodeId))
        const existingPanelProps = (updatedPanel?.properties || {}) as Record<string, unknown>
        const nextPanelProps = { ...existingPanelProps, ...patch }
        if (!args.suppressLayoutMutation && !areStoryboardWidgetWorkflowRecordValuesEqual(existingPanelProps, nextPanelProps)) {
          args.updateNode(panelNodeId, { properties: nextPanelProps as never })
        }
      }
    })
  }

  return {
    publishTextRunOutputToRichMediaPanel,
    publishMediaRunOutputToRichMediaPanel,
    publishAnnotationRunOutputToRichMediaPanel,
  }
}
