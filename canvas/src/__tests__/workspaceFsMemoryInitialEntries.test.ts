import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'

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

  const entries = await fs.listEntries()
  if (!entries.some(e => e.kind === 'file' && e.path === '/README.md')) throw new Error('Expected README initialization file to remain after delete')
  if (!entries.some(e => e.kind === 'file' && e.path === '/knowgrph-video-demo.md')) throw new Error('Expected video demo initialization file to remain after delete')
}

