import {
  loadPersistedSourceFiles,
  loadPersistedSourceFilesWorkspace,
  persistSourceFiles,
  persistSourceFilesWorkspace,
} from '@/features/source-files/sourceFilesDb'
import {
  cacheMarkdownFolderFromFileInput,
  getCachedMarkdownFolderMetadata,
  getMostRecentCachedMarkdownFolderId,
  listCachedMarkdownPaths,
  readCachedMarkdownText,
  writeCachedMarkdownText,
} from '@/features/source-files/markdownFsCache'
import { testSourceFilesDbPersistsOnlyChangedRows } from '@/__tests__/sourceFilesIngestStaleGuard.test'

export async function testSourceFilesCacheOwnerRoundtripSmoke() {
  const sampleFile = {
    id: 'file_a',
    name: 'demo.md',
    text: '# Demo',
    enabled: true,
    status: 'parsed' as const,
    parsedParserId: 'markdown',
    parsedTextHash: 'sha256:text',
    source: { kind: 'local' as const, path: '/imports/demo.md' },
  }

  await persistSourceFiles([sampleFile])
  const loadedFiles = await loadPersistedSourceFiles()
  if (loadedFiles.length !== 1 || loadedFiles[0]?.id !== 'file_a') {
    throw new Error('expected sourceFilesDb roundtrip to preserve one file')
  }

  await persistSourceFilesWorkspace({
    folderName: 'notes',
    accessMode: 'opfs',
    folderCacheId: 'cache_a',
    selectedFolderPath: 'notes/demo',
  })
  const workspace = await loadPersistedSourceFilesWorkspace()
  if (String(workspace.folderCacheId || '') !== 'cache_a') {
    throw new Error('expected sourceFiles workspace roundtrip to preserve folderCacheId')
  }

  const { folderId } = await cacheMarkdownFolderFromFileInput({
    folderName: 'docs',
    entries: [{ path: 'a.md', text: '# A' }],
  })
  const paths = await listCachedMarkdownPaths(folderId)
  if (paths.length !== 1 || paths[0] !== 'a.md') {
    throw new Error('expected markdown cache to list cached path')
  }

  await writeCachedMarkdownText(folderId, 'b.md', '# B')
  const text = await readCachedMarkdownText(folderId, 'b.md')
  if (text !== '# B') {
    throw new Error('expected markdown cache write/read roundtrip')
  }

  const metadata = await getCachedMarkdownFolderMetadata(folderId)
  if (!metadata || metadata.name !== 'docs') {
    throw new Error('expected markdown cache folder metadata')
  }

  const recentFolderId = await getMostRecentCachedMarkdownFolderId()
  if (recentFolderId !== folderId) {
    throw new Error('expected most recent markdown folder id to match cached folder')
  }
}

export function testSourceFilesCacheOwnerPreservesChangedRowsGuard() {
  testSourceFilesDbPersistsOnlyChangedRows()
}
