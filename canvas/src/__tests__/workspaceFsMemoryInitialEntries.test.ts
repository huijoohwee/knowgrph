import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import {
  GEOSPATIAL_WORKSPACE_SEED_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  WORKSPACE_README_SEED_PATH,
} from '@/features/workspace-fs/workspaceFs'

export const testWorkspaceFsMemoryInitialEntries = async () => {
  const fs = createMemoryWorkspaceFs({
    initialEntries: [
      {
        path: '/a.md',
        parentPath: '/',
        kind: 'file',
        name: 'a.md',
        text: '# A',
        updatedAtMs: 1,
      },
    ],
  })

  await fs.ensureSeed()
  const entries = await fs.listEntries()
  if (!entries.some(e => e.kind === 'file' && e.path === '/a.md')) throw new Error('Expected initial file to be present')

  const text = await fs.readFileText('/a.md')
  if (text !== '# A') throw new Error(`Expected initial file text '# A', got ${String(text)}`)
}

export const testWorkspaceFsMemoryForbidsInitializationFileDelete = async () => {
  const fs = createMemoryWorkspaceFs()

  await fs.ensureSeed()
  await fs.deleteEntry('/README.md')
  await fs.deleteEntry('/knowgrph-video-demo.md')
  await fs.deleteEntry('/knowgrph-maps-grabmap-multim-demo.md')

  const entries = await fs.listEntries()
  if (!entries.some(e => e.kind === 'file' && e.path === '/README.md')) throw new Error('Expected README initialization file to remain after delete')
  if (!entries.some(e => e.kind === 'file' && e.path === '/knowgrph-video-demo.md')) throw new Error('Expected video demo initialization file to remain after delete')
  if (!entries.some(e => e.kind === 'file' && e.path === '/knowgrph-maps-grabmap-multim-demo.md')) throw new Error('Expected geospatial initialization file to remain after delete')
}

export const testWorkspaceFsMemoryRefreshesStaleInitializationFileText = async () => {
  const fs = createMemoryWorkspaceFs({
    initialEntries: [
      { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
      {
        path: WORKSPACE_README_SEED_PATH,
        parentPath: '/',
        kind: 'file',
        name: 'README.md',
        text: 'stale README initialization content',
        updatedAtMs: 1,
      },
      {
        path: TEST_VALIDATION_WORKSPACE_SEED_PATH,
        parentPath: '/',
        kind: 'file',
        name: 'knowgrph-video-demo.md',
        text: 'stale video demo initialization content',
        updatedAtMs: 1,
      },
      {
        path: GEOSPATIAL_WORKSPACE_SEED_PATH,
        parentPath: '/',
        kind: 'file',
        name: 'knowgrph-maps-grabmap-multim-demo.md',
        text: 'stale geospatial initialization content',
        updatedAtMs: 1,
      },
    ],
  })

  await fs.ensureSeed()

  const readmeText = await fs.readFileText(WORKSPACE_README_SEED_PATH)
  const videoDemoText = await fs.readFileText(TEST_VALIDATION_WORKSPACE_SEED_PATH)
  const geospatialText = await fs.readFileText(GEOSPATIAL_WORKSPACE_SEED_PATH)
  if (!String(readmeText || '').includes('kgCanvas2dRenderer: "d3"')) throw new Error('Expected stale README initialization content to refresh from current seed source')
  if (!String(videoDemoText || '').includes('kgCanvas2dRenderer: "flowEditor"')) throw new Error('Expected stale video demo initialization content to refresh from current seed source')
  if (!String(geospatialText || '').includes('kgCanvasSurfaceMode: "geospatial"')) throw new Error('Expected stale geospatial initialization content to refresh from current seed source')
}
