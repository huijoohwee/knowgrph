import { buildMarkdownFileTreeContextMenuItems } from '@/components/BottomPanel/markdownWorkspace/markdownFileTreeContextMenuItems'

export async function testMarkdownFileTreeContextMenuItemsReuseSharedDefinitions() {
  const calls: string[] = []
  const copied: string[] = []
  const items = buildMarkdownFileTreeContextMenuItems({
    entry: {
      path: '/docs/note.md',
      parentPath: '/docs',
      kind: 'file',
      name: 'note.md',
      updatedAtMs: 0,
    },
    copyToClipboard: async text => {
      copied.push(text)
      return true
    },
    onRevealInFinder: path => calls.push(`reveal:${path}`),
    onRenameEntry: (path, nextName) => calls.push(`rename:${path}:${nextName}`),
    onDeleteEntry: path => calls.push(`delete:${path}`),
    closeContextMenu: () => calls.push('close'),
    promptRename: currentName => {
      calls.push(`prompt:${currentName}`)
      return 'renamed.md'
    },
    confirmDelete: entryPath => {
      calls.push(`confirm:${entryPath}`)
      return true
    },
  })

  const labels = items.map(item => item.label).join(',')
  if (labels !== 'Reveal in Finder,Copy Path,Copy Relative Path,Rename,Delete') {
    throw new Error(`expected shared file-tree context-menu labels, got ${labels}`)
  }
  if (items[4]?.tone !== 'danger') {
    throw new Error(`expected delete menu item to be danger tone, got ${String(items[4]?.tone || '')}`)
  }

  items[0]?.onSelect()
  await items[1]?.onSelect()
  await items[2]?.onSelect()
  items[3]?.onSelect()
  items[4]?.onSelect()

  const callLog = calls.join(',')
  if (!callLog.includes('reveal:/docs/note.md,close')) {
    throw new Error(`expected reveal item to reveal and close, got ${callLog}`)
  }
  if (!callLog.includes('prompt:note.md,rename:/docs/note.md:renamed.md,close')) {
    throw new Error(`expected rename item to prompt, rename, and close, got ${callLog}`)
  }
  if (!callLog.includes('confirm:/docs/note.md,delete:/docs/note.md,close')) {
    throw new Error(`expected delete item to confirm, delete, and close, got ${callLog}`)
  }
  if (copied.join(',') !== '/docs/note.md,docs/note.md') {
    throw new Error(`expected copy actions to reuse absolute and relative path logic, got ${copied.join(',')}`)
  }
}

export async function testMarkdownFileTreeContextMenuItemsHideMutationsForInitializationFiles() {
  const items = buildMarkdownFileTreeContextMenuItems({
    entry: {
      path: '/README.md',
      parentPath: '/',
      kind: 'file',
      name: 'README.md',
      updatedAtMs: 0,
    },
    copyToClipboard: async () => true,
    closeContextMenu: () => void 0,
  })

  const labels = items.map(item => item.label).join(',')
  if (labels !== 'Reveal in Finder,Copy Path,Copy Relative Path') {
    throw new Error(`expected initialization-file menu to hide rename and delete, got ${labels}`)
  }
}
