import { openBottomPanel } from '@/features/bottom-panel/open'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'

export type CreateNewMarkdownSourceFileArgs = {
  parentPath?: string | null
}

export function createNewMarkdownSourceFileAndOpenViewer(
  args?: CreateNewMarkdownSourceFileArgs,
): { id: string; name: string } | null {
  try {
    const store = useGraphStore.getState()
    store.setBottomPanelCurationView('markdown')
    openBottomPanel('curation')

    void (async () => {
      try {
        const fs = await getWorkspaceFs()
        const createdPath = await fs.createFile({
          parentPath: WORKSPACE_ROOT_PATH,
          name: 'note.md',
          text: '',
        })
        useMarkdownExplorerStore.getState().setActivePath(createdPath)
      } catch {
        void 0
      }
    })()

    return { id: 'workspace', name: String(args?.parentPath ?? '') }
  } catch {
    return null
  }
}
