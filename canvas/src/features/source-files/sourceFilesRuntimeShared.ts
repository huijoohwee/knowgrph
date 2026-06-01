export {
  hydrateWorkspaceEntriesInlineText,
  readReusableWorkspaceEntriesSnapshot,
  readWorkspaceActiveEntrySnapshot,
  readWorkspaceSourceRootEntriesSnapshot,
} from '@/features/source-files/sourceFilesRuntimeActive'

export {
  buildActiveWorkspaceRuntimeSourceFilesSnapshot,
  buildMaterializedWorkspaceActivePathKey,
  buildMaterializedWorkspaceForceIncludePaths,
  materializeActiveWorkspaceEntryIntoSourceFiles,
  resolveMaterializedWorkspaceActivePath,
} from '@/features/source-files/sourceFilesRuntimeMaterialization'

export {
  buildInitialWorkspaceStartupSnapshot,
  resolveInitialWorkspaceStartupState,
} from '@/features/source-files/sourceFilesRuntimeStartup'
