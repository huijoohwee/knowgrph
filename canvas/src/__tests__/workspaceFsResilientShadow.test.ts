import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { createResilientWorkspaceFs } from '@/features/workspace-fs/workspaceFs'

export async function testWorkspaceFsResilientShadowKeepsCreatedFileReadableAfterSilentReadMiss() {
  let storedPath = ''
  let storedText = ''
  const inner: WorkspaceFs = {
    ensureSeed: async () => false,
    listEntries: async () => [{ path: '/' as WorkspacePath, parentPath: null, kind: 'folder' as const, name: '', updatedAtMs: 1 }],
    readFileText: async () => null,
    writeFileText: async () => void 0,
    createFile: async (args: { parentPath: WorkspacePath; name: string; text: string }) => {
      storedPath = `${args.parentPath === '/' ? '' : args.parentPath}/${args.name}`
      storedText = args.text
      return storedPath as WorkspacePath
    },
    createFolder: async (args: { parentPath: WorkspacePath; name: string }) => `${args.parentPath === '/' ? '' : args.parentPath}/${args.name}` as WorkspacePath,
    deleteEntry: async () => void 0,
  }

  const fs = createResilientWorkspaceFs(inner)
  const createdPath = await fs.createFile({
    parentPath: '/',
    name: 'widget-bundle.frontmatter.yaml',
    text: '{"kind":"kg:flow:widgetBundle"}',
  })

  const readText = await fs.readFileText(createdPath)
  if (readText !== storedText) throw new Error(`expected shadow fallback text, got ${String(readText)}`)

  const entries = await fs.listEntries()
  if (!entries.some(entry => entry.kind === 'file' && entry.path === storedPath)) {
    throw new Error('expected listEntries to include created file from shadow fallback')
  }
}
