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

