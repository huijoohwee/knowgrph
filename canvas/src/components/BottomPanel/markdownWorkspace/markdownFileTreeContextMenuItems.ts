import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'

export type MarkdownFileTreeContextMenuItem = {
  key: 'reveal' | 'copyPath' | 'copyRelativePath' | 'rename' | 'delete'
  label: string
  tone?: 'default' | 'danger'
  onSelect: () => void
}

type BuildMarkdownFileTreeContextMenuItemsArgs = {
  entry: WorkspaceEntry
  copyToClipboard: (text: string) => Promise<boolean>
  onRevealInFinder?: (path: WorkspacePath) => void
  onRenameEntry?: (path: WorkspacePath, nextName: string) => void
  onDeleteEntry?: (path: WorkspacePath) => void
  closeContextMenu: () => void
  promptRename?: (currentName: string) => string | null
  confirmDelete?: (entryPath: string) => boolean
}

export function buildMarkdownFileTreeContextMenuItems(
  args: BuildMarkdownFileTreeContextMenuItemsArgs,
): MarkdownFileTreeContextMenuItem[] {
  const promptRename = args.promptRename || (currentName => window.prompt('Rename', currentName))
  const confirmDelete = args.confirmDelete || (entryPath => window.confirm(`Delete ${entryPath}?`))
  const entryPath = args.entry.path

  return [
    {
      key: 'reveal',
      label: 'Reveal in Finder',
      onSelect: () => {
        args.onRevealInFinder?.(entryPath)
        args.closeContextMenu()
      },
    },
    {
      key: 'copyPath',
      label: 'Copy Path',
      onSelect: () => {
        void args.copyToClipboard(entryPath)
        args.closeContextMenu()
      },
    },
    {
      key: 'copyRelativePath',
      label: 'Copy Relative Path',
      onSelect: () => {
        const relative = String(entryPath || '').replace(/^\/+/, '')
        void args.copyToClipboard(relative)
        args.closeContextMenu()
      },
    },
    {
      key: 'rename',
      label: 'Rename',
      onSelect: () => {
        const current = String(args.entry.name || '').trim()
        const next = promptRename(current)
        if (!next || String(next).trim() === current) {
          args.closeContextMenu()
          return
        }
        args.onRenameEntry?.(entryPath, String(next).trim())
        args.closeContextMenu()
      },
    },
    {
      key: 'delete',
      label: 'Delete',
      tone: 'danger',
      onSelect: () => {
        if (!confirmDelete(entryPath)) {
          args.closeContextMenu()
          return
        }
        args.onDeleteEntry?.(entryPath)
        args.closeContextMenu()
      },
    },
  ]
}
