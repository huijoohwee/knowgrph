import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'

export async function testWorkspaceEnsureSeedDoesNotReseedAfterUserDeletesAllFiles() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const seeded = await fs.listEntries()
    const seededFiles = seeded.filter(e => e.kind === 'file')
    if (seededFiles.length === 0) throw new Error('expected seed files to exist after ensureSeed')

    for (const f of seededFiles) {
      await fs.deleteEntry(f.path)
    }

    const afterDelete = await fs.listEntries()
    if (afterDelete.some(e => e.kind === 'file')) throw new Error('expected all files deleted')

    await fs.ensureSeed()
    const afterEnsureSeedAgain = await fs.listEntries()
    if (afterEnsureSeedAgain.some(e => e.kind === 'file')) {
      throw new Error('expected ensureSeed not to reseed after user deleted all files')
    }
  } finally {
    restore()
  }
}

