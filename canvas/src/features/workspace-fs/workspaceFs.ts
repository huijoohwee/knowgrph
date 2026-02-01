import type { WorkspaceFs, WorkspacePath } from './types'
import { WORKSPACE_ROOT_PATH } from './path'

const canUseIndexedDb = () => {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof indexedDB !== 'undefined' &&
      typeof (globalThis as unknown as { IDBKeyRange?: unknown }).IDBKeyRange !== 'undefined'
    )
  } catch {
    return false
  }
}

let fsSingleton: WorkspaceFs | null = null

export async function getWorkspaceFs(): Promise<WorkspaceFs> {
  if (fsSingleton) return fsSingleton
  if (canUseIndexedDb()) {
    const { createDexieWorkspaceFs } = await import('./workspaceFsDexie.ts')
    fsSingleton = createDexieWorkspaceFs()
    return fsSingleton
  }
  const { createMemoryWorkspaceFs } = await import('./workspaceFsMemory.ts')
  fsSingleton = createMemoryWorkspaceFs()
  return fsSingleton
}

export async function ensureSeedWorkspaceFs(): Promise<void> {
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
}

export const WORKSPACE_SEED_FILES: Array<{ path: WorkspacePath; text: string }> = [
  {
    path: '/README.md',
    text: [
      '# Workspace',
      '',
      '- Select a file in SOURCE FILES to load it into the editor.',
      '- Headings show up in TOC.',
      '- Use [[README]] as a wikilink example.',
      '',
      '## Notes',
      '',
      'This workspace is stored locally in your browser.',
    ].join('\n'),
  },
]

export function defaultParentPath(): WorkspacePath {
  return WORKSPACE_ROOT_PATH
}
