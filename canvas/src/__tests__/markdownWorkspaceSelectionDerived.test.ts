import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'
import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import { deriveMarkdownWorkspaceSelectionState } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionDerived'

const buildFileEntry = (path: string, text = ''): WorkspaceEntry => ({
  path,
  parentPath: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) || '/' : '/',
  kind: 'file',
  name: path.split('/').pop() || '',
  text,
  updatedAtMs: 1,
})

const buildFolderEntry = (path: string): WorkspaceEntry => ({
  path,
  parentPath: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) || '/' : '/',
  kind: 'folder',
  name: path.split('/').pop() || '',
  updatedAtMs: 1,
})

export function testMarkdownWorkspaceSelectionDerivedCentralizesActiveDocumentModel() {
  const entries = [
    buildFolderEntry('/docs'),
    buildFileEntry('/docs/readme.md', '# Readme'),
    buildFileEntry('/docs/url.md', '# Url'),
  ]
  const sourcesByPath: WorkspaceSourceIndex = {
    '/docs/url.md': { kind: 'url', url: ' https://example.com/page ' },
  }

  const fileState = deriveMarkdownWorkspaceSelectionState({
    activePath: '/docs/url.md' as never,
    selectionPath: '/docs/readme.md' as never,
    entries,
    sourcesByPath,
  })
  if (fileState.activeEntry?.path !== '/docs/url.md' || fileState.activeEntryKind !== 'file') {
    throw new Error(`expected active file entry derivation, got ${JSON.stringify(fileState.activeEntry)}`)
  }
  if (fileState.activeEntryText !== '# Url') {
    throw new Error(`expected active file text derivation, got ${String(fileState.activeEntryText)}`)
  }
  if (fileState.activeDocumentKey !== 'docs/url.md') {
    throw new Error(`expected active document key for file selection, got ${String(fileState.activeDocumentKey)}`)
  }
  if (fileState.activeDocumentSourceUrl !== 'https://example.com/page') {
    throw new Error(`expected trimmed active document source URL, got ${String(fileState.activeDocumentSourceUrl)}`)
  }
  if (fileState.createParentPath !== '/docs') {
    throw new Error(`expected file selection parent path derivation, got ${String(fileState.createParentPath)}`)
  }

  const folderState = deriveMarkdownWorkspaceSelectionState({
    activePath: '/docs' as never,
    selectionPath: '/docs' as never,
    entries,
    sourcesByPath,
  })
  if (folderState.activeEntryKind !== 'folder' || folderState.activeDocumentKey !== '') {
    throw new Error(`expected folder active path to suppress active document key, got ${JSON.stringify(folderState)}`)
  }
  if (folderState.createParentPath !== '/docs') {
    throw new Error(`expected folder selection parent path to stay folder path, got ${String(folderState.createParentPath)}`)
  }
}
