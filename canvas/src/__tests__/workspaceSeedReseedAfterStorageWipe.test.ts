import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'

export async function testWorkspaceEnsureSeedReseedsAfterStorageWipeWhenNotUserCleared() {
  const { restore } = initJsdomHarness()
  try {
    const fs1 = createMemoryWorkspaceFs()
    await fs1.ensureSeed()

    const seeded = await fs1.listEntries()
    const seededFiles = seeded.filter(e => e.kind === 'file')
    if (seededFiles.length === 0) throw new Error('expected seed files to exist after initial ensureSeed')

    const fs2 = createMemoryWorkspaceFs()
    await fs2.ensureSeed()
    const after = await fs2.listEntries()
    const afterFiles = after.filter(e => e.kind === 'file')
    if (afterFiles.length === 0) {
      throw new Error('expected ensureSeed to reseed after storage wipe when user did not clear all files')
    }
  } finally {
    restore()
  }
}

