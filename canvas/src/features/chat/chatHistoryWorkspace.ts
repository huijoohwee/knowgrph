export type {
  ChatHistoryWorkspaceAppendArgs,
  ChatHistoryWorkspaceDraftArgs,
} from './chatHistoryWorkspace.types'

export {
  isKgcStructuredMarkdown,
} from './chatHistoryWorkspace.kgc.parse'

export {
  buildKgcWorkspaceDocument,
  normalizeKgcAssistantBodyForStorage,
} from './chatHistoryWorkspace.kgc.build'

export {
  createNewChatHistoryWorkspaceFilePath,
  ensureChatHistoryWorkspaceFilePath,
} from './chatHistoryWorkspace.paths'

export {
  appendChatHistoryWorkspaceFile,
  upsertChatHistoryWorkspaceDraft,
} from './chatHistoryWorkspace.persistence'
