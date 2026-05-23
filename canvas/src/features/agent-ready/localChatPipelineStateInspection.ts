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
    streaming: {
      active: snapshot.isLoading || Boolean(snapshot.streamingAssistant) || Boolean(snapshot.streamingWorkspacePath),
      assistantId: snapshot.streamingAssistant?.id || null,
      textLength: streamingText.length,
      preview: buildPreview(streamingText),
      draftPath: snapshot.streamDraft?.path || null,
      draftTextLength: streamDraftText.length,
      draftPreview: buildPreview(streamDraftText),
    },
    updatedAtMs: snapshot.updatedAtMs || null,
  }
}
