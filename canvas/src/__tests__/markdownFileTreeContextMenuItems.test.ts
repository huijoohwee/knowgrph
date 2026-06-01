import { buildMarkdownFileTreeContextMenuItems } from '@/features/markdown-workspace/markdownFileTreeContextMenuItems'
import { WORKSPACE_README_SEED_PATH } from '@/features/workspace-fs/workspaceFs'

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
    onCreateNewFile: () => calls.push('new-file'),
    onRevealInFinder: path => calls.push(`reveal:${path}`),
    onClearFile: path => calls.push(`clear:${path}`),
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
  if (labels !== 'Share URL,Reveal in Finder,Copy Path,Copy Relative Path,New file,Clear,Rename,Delete') {
    throw new Error(`expected shared file-tree context-menu labels, got ${labels}`)
  }
  if (items[7]?.tone !== 'danger') {
    throw new Error(`expected delete menu item to be danger tone, got ${String(items[7]?.tone || '')}`)
  }

  items[0]?.onSelect()
  items[1]?.onSelect()
  await items[2]?.onSelect()
  await items[3]?.onSelect()
  items[4]?.onSelect()
  items[5]?.onSelect()
  items[6]?.onSelect()
  items[7]?.onSelect()

  const callLog = calls.join(',')
  if (!callLog.includes('new-file,close')) {
    throw new Error(`expected New file item to create and close, got ${callLog}`)
  }
  if (!callLog.includes('clear:/docs/note.md,close')) {
    throw new Error(`expected Clear item to clear file and close, got ${callLog}`)
  }
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
      path: WORKSPACE_README_SEED_PATH,
      parentPath: '/',
      kind: 'file',
      name: 'workspace-readme.md',
      updatedAtMs: 0,
    },
    copyToClipboard: async () => true,
    onCreateNewFile: () => void 0,
    onClearFile: () => void 0,
    closeContextMenu: () => void 0,
  })

  const labels = items.map(item => item.label).join(',')
  if (labels !== 'Share URL,Reveal in Finder,Copy Path,Copy Relative Path,New file,Clear') {
    throw new Error(`expected initialization-file menu to hide rename and delete, got ${labels}`)
  }
}

export async function testMarkdownFileTreeShareUrlAwaitsAsyncPublishedUrlBeforeCopy() {
  const calls: string[] = []
  const copied: string[] = []
  const items = buildMarkdownFileTreeContextMenuItems({
    entry: {
      path: '/docs/public.md',
      parentPath: '/docs',
      kind: 'file',
      name: 'public.md',
      updatedAtMs: 0,
    },
    buildShareUrl: async () => 'https://airvio.co/knowgrph/share/kg-public-token',
    copyToClipboard: async text => {
      copied.push(text)
      return true
    },
    closeContextMenu: () => calls.push('close'),
  })

  await items[0]?.onSelect()
  await new Promise(resolve => setTimeout(resolve, 0))
  if (calls.join(',') !== 'close') {
    throw new Error(`expected Share URL to close the context menu immediately, got ${calls.join(',')}`)
  }
  if (copied.join(',') !== 'https://airvio.co/knowgrph/share/kg-public-token') {
    throw new Error(`expected async published Share URL to be copied, got ${copied.join(',')}`)
  }
}

export async function testMarkdownFileTreeShareUrlPromptsWhenClipboardUnavailable() {
  const prompted: string[] = []
  const items = buildMarkdownFileTreeContextMenuItems({
    entry: {
      path: '/docs/public.md',
      parentPath: '/docs',
      kind: 'file',
      name: 'public.md',
      updatedAtMs: 0,
    },
    buildShareUrl: () => 'https://airvio.co/knowgrph/share/kg-public-token',
    copyToClipboard: async () => false,
    promptShareUrl: url => prompted.push(url),
    closeContextMenu: () => void 0,
  })

  await items[0]?.onSelect()
  await new Promise(resolve => setTimeout(resolve, 0))
  if (prompted.join(',') !== 'https://airvio.co/knowgrph/share/kg-public-token') {
    throw new Error(`expected Share URL fallback prompt when clipboard write is unavailable, got ${prompted.join(',')}`)
  }
}
