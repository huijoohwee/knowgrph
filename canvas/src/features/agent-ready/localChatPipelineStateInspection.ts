import type { LocalChatPipelineSurfaceSnapshot } from './browserLocalSurfaceSnapshots'

const normalizeString = (value: unknown): string => String(value || '').trim()
const buildPreview = (text: string, maxLength = 400): string =>
  text.length <= maxLength ? text : `${text.slice(0, maxLength)}\n...(truncated)`

export const inspectLocalChatPipelineState = (
  snapshot: (LocalChatPipelineSurfaceSnapshot & { updatedAtMs?: number }) | null,
) => {
  if (!snapshot) {
    return {
      available: false,
      sourceKind: 'browser-local-chat-pipeline',
      message: 'FloatingPanel Chat is not currently mounted in the local Knowgrph browser runtime.',
    }
  }
  const streamingText = normalizeString(snapshot.streamingAssistant?.text)
  const streamDraftText = normalizeString(snapshot.streamDraft?.text)
  const streamingReasoningPreview = normalizeString(snapshot.streamingInsights?.reasoningPreview || snapshot.streamingAssistant?.reasoningPreview)
  const streamingUsageSummary = normalizeString(snapshot.streamingInsights?.usageSummary || snapshot.streamingAssistant?.usageSummary)
  return {
    available: true,
    sourceKind: 'browser-local-chat-pipeline',
    messageCount: snapshot.messageCount,
    isLoading: snapshot.isLoading,
    errorText: snapshot.errorText,
    connectivity: snapshot.connectivity,
    connectivityDetail: snapshot.connectivityDetail,
    chatProviderSummary: snapshot.chatProviderSummary,
    chatProviderHint: snapshot.chatProviderHint,
    chatContextScope: snapshot.chatContextScope,
    chatStorageTarget: snapshot.chatStorageTarget,
    workspaceViewMode: snapshot.workspaceViewMode,
    editorWorkspacePane: snapshot.editorWorkspacePane,
    markdownDocumentName: snapshot.markdownDocumentName,
    selectedNodeId: snapshot.selectedNodeId,
    workspacePaths: {
      chatKnowgrphWorkspacePath: snapshot.chatKnowgrphWorkspacePath,
      chatHistoryWorkspacePath: snapshot.chatHistoryWorkspacePath,
      streamingWorkspacePath: snapshot.streamingWorkspacePath,
      streamFollowPath: snapshot.streamFollowPath,
    },
    cloudUrls: {
      chatKnowgrphCloudUrl: snapshot.chatKnowgrphCloudUrl || null,
      chatHistoryCloudUrl: snapshot.chatHistoryCloudUrl || null,
    },
    streaming: {
      active: snapshot.isLoading || Boolean(snapshot.streamingAssistant) || Boolean(snapshot.streamingWorkspacePath),
      assistantId: snapshot.streamingAssistant?.id || null,
      textLength: streamingText.length,
      preview: buildPreview(streamingText),
      reasoningPreview: streamingReasoningPreview || null,
      reasoningStepCount: snapshot.streamingInsights?.reasoningStepCount || snapshot.streamingAssistant?.reasoningStepCount || 0,
      usageSummary: streamingUsageSummary || null,
      finishReason: snapshot.streamingInsights?.finishReason || snapshot.streamingAssistant?.finishReason || null,
      modelId: snapshot.streamingInsights?.modelId || snapshot.streamingAssistant?.modelId || null,
      draftPath: snapshot.streamDraft?.path || null,
      draftTextLength: streamDraftText.length,
      draftPreview: buildPreview(streamDraftText),
    },
    kgcValidation: {
      stage: snapshot.kgcValidation?.stage || 'idle',
      attempt: snapshot.kgcValidation?.attempt || 0,
      maxAttempts: snapshot.kgcValidation?.maxAttempts || 0,
      failedRuleId: snapshot.kgcValidation?.failedRuleId || null,
      failedMessage: snapshot.kgcValidation?.failedMessage || null,
      correctionPromptPreview: snapshot.kgcValidation?.correctionPromptPreview || null,
      hasStructuredKgc: snapshot.kgcValidation?.hasStructuredKgc === true,
      hasYamlFrontmatter: snapshot.kgcValidation?.hasYamlFrontmatter === true,
      validatedKgcLength: snapshot.kgcValidation?.validatedKgcLength || 0,
    },
    finalize: {
      stage: snapshot.finalize?.stage || 'idle',
      traceId: snapshot.finalize?.traceId || null,
      modelId: snapshot.finalize?.modelId || null,
      finalStatus: snapshot.finalize?.finalStatus || null,
      persistedKnowgrphPath: snapshot.finalize?.persistedKnowgrphPath || null,
      applied: snapshot.finalize?.applied ?? null,
      message: snapshot.finalize?.message || null,
    },
    updatedAtMs: snapshot.updatedAtMs || null,
  }
}
