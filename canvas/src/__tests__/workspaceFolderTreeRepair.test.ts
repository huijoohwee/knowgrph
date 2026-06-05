import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { ensureWorkspaceFolderTreeIfMissing } from '@/features/workspace-fs/ensureFolderTreeIfMissing'

export async function testEnsureWorkspaceFolderTreeIfMissingCreatesNestedSeedFolders() {
  const fs = createMemoryWorkspaceFs()
  await fs.ensureSeed()

  await ensureWorkspaceFolderTreeIfMissing({
    fs,
    folderPath: '/fixtures/test-data',
  })

  const entries = await fs.listEntries()
  const folders = new Set(entries.filter(entry => entry.kind === 'folder').map(entry => String(entry.path || '')))
  if (!folders.has('/fixtures')) {
    throw new Error('expected nested workspace folder repair to create /fixtures')
  }
  if (!folders.has('/fixtures/test-data')) {
    throw new Error('expected nested workspace folder repair to create /fixtures/test-data')
  }
}
