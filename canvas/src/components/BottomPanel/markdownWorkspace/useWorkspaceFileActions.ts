import type { WorkspaceFileActions, UseWorkspaceFileActionsArgs } from './useWorkspaceFileActions/types'
import { shouldForceDocumentSemanticModeForImport, useWorkspaceFileActionsCore, useWorkspaceStatusHelpers } from './useWorkspaceFileActions/core'
import { useWorkspaceImportActions } from './useWorkspaceFileActions/importActions'
import { useWorkspaceWebsiteImportAction } from './useWorkspaceFileActions/websiteImportAction'
import { useWorkspaceMutationActions } from './useWorkspaceFileActions/mutationActions'

export { shouldForceDocumentSemanticModeForImport, useWorkspaceStatusHelpers }

export function useWorkspaceFileActions(args: UseWorkspaceFileActionsArgs): WorkspaceFileActions {
  const core = useWorkspaceFileActionsCore(args)

  const importActions = useWorkspaceImportActions({
    core,
    ctx: {
      getFs: args.getFs,
      refresh: args.refresh,
      openedPath: args.openedPath,
      activeDocumentKey: args.activeDocumentKey,
      setActiveText: args.setActiveText,
      setEntries: args.setEntries,
      lastLoadedRef: args.lastLoadedRef,
      setActiveMarkdownDocument: args.setActiveMarkdownDocument,
    },
  })

  const websiteImport = useWorkspaceWebsiteImportAction({
    core,
    ctx: { getFs: args.getFs, refresh: args.refresh },
  })

  const mutationActions = useWorkspaceMutationActions({
    core: { status: core.status },
    ctx: {
      getFs: args.getFs,
      refresh: args.refresh,
      openedPath: args.openedPath,
      selectionPath: args.selectionPath,
      selectionEntryKind: args.selectionEntryKind,
      activeDocumentKey: args.activeDocumentKey,
      setActiveText: args.setActiveText,
      setEntries: args.setEntries,
      lastLoadedRef: args.lastLoadedRef,
      setActiveMarkdownDocument: args.setActiveMarkdownDocument,
    },
  })

  return {
    createNewFile: core.createNewFile,
    createNewFolder: core.createNewFolder,
    handleImportLocalFiles: importActions.handleImportLocalFiles,
    handleImportLocalFolder: importActions.handleImportLocalFolder,
    handleImportUrl: importActions.handleImportUrl,
    handleImportWebsite: websiteImport.handleImportWebsite,
    refreshFileFromSource: mutationActions.refreshFileFromSource,
    onDeleteEntry: mutationActions.onDeleteEntry,
    onClearFile: mutationActions.onClearFile,
    canClearActiveSelection: mutationActions.canClearActiveSelection,
    canDeleteActive: mutationActions.canDeleteActive,
    onClearActiveSelection: mutationActions.onClearActiveSelection,
    onDeleteActive: mutationActions.onDeleteActive,
  }
}
