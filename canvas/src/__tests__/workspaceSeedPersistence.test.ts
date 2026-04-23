import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import {
  LEGACY_WORKSPACE_README_PATH,
  LEGACY_WORKSPACE_TRIP_DEMO_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
} from '@/features/workspace-fs/workspaceFs'

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

export async function testWorkspaceEnsureSeedMigratesLegacyDefaultsToValidationDemo() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs({
      initialEntries: [
        { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
        { path: LEGACY_WORKSPACE_README_PATH, parentPath: '/', kind: 'file', name: 'README.md', text: '# Workspace', updatedAtMs: 1 },
        { path: LEGACY_WORKSPACE_TRIP_DEMO_PATH, parentPath: '/', kind: 'file', name: 'trip-demo-mmd.md', text: '# Trip demo', updatedAtMs: 1 },
      ],
    })
    await fs.ensureSeed()

    const entries = await fs.listEntries()
    const filePaths = new Set(entries.filter(e => e.kind === 'file').map(e => String(e.path || '')))
    if (filePaths.has(LEGACY_WORKSPACE_README_PATH)) {
      throw new Error('expected legacy README workspace seed to be removed during validation demo migration')
    }
    if (filePaths.has(LEGACY_WORKSPACE_TRIP_DEMO_PATH)) {
      throw new Error('expected legacy trip demo workspace seed to be removed during validation demo migration')
    }
    if (!filePaths.has(TEST_VALIDATION_WORKSPACE_SEED_PATH)) {
      throw new Error('expected validation demo workspace seed to replace legacy default workspace files')
    }
  } finally {
    restore()
  }
}
