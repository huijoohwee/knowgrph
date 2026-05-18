import { pickFirstCreatedFilePathForImportFocus } from '@/features/markdown-workspace/useWorkspaceFileActions/importRuntimeActions'

export async function testWorkspaceImportFocusPrefersFileOverFolder() {
  const fs = {
    listEntries: async () => [
      { kind: 'folder', path: '/imports' },
      { kind: 'file', path: '/imports/graph.jsonld' },
    ],
  } as any

  const created = ['/imports', '/imports/graph.jsonld']
  const picked = await pickFirstCreatedFilePathForImportFocus(fs, created)
  if (picked !== '/imports/graph.jsonld') throw new Error(`expected /imports/graph.jsonld, got ${String(picked)}`)
}

export async function testWorkspaceImportFocusFallsBackToFileLikePathOnListEntriesError() {
  const fs = {
    listEntries: async () => {
      throw new Error('unavailable')
    },
  } as any

  const created = ['/imports', '/imports/notes.md', '/imports/graph.jsonld']
  const picked = await pickFirstCreatedFilePathForImportFocus(fs, created)
  if (picked !== '/imports/notes.md') throw new Error(`expected /imports/notes.md, got ${String(picked)}`)
}
