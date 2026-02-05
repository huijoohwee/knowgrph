import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'

export const SCHEMA_WORKSPACE_FOLDER = '/schema'
export const SCHEMA_CONFIG_WORKSPACE_PATH = '/schema/schema.json'

async function ensureSchemaWorkspaceFolder(): Promise<void> {
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  try {
    await fs.createFolder({ parentPath: WORKSPACE_ROOT_PATH, name: 'schema' })
  } catch {
    void 0
  }
}

export async function ensureSchemaConfigWorkspaceFile(): Promise<void> {
  await ensureSchemaWorkspaceFolder()

  const fs = await getWorkspaceFs()
  try {
    await fs.readFileText(SCHEMA_CONFIG_WORKSPACE_PATH)
    return
  } catch {
    void 0
  }

  const nextText = (() => {
    try {
      return JSON.stringify(useGraphStore.getState().schema, null, 2)
    } catch {
      return '{\n  "catalog": {\n    "nodeTypes": [],\n    "edgeLabels": []\n  }\n}\n'
    }
  })()

  try {
    await fs.createFile({ parentPath: SCHEMA_WORKSPACE_FOLDER, name: 'schema.json', text: nextText })
  } catch {
    try {
      await fs.writeFileText(SCHEMA_CONFIG_WORKSPACE_PATH, nextText)
    } catch {
      void 0
    }
  }
}

export function openSchemaConfigWorkspaceFile(): void {
  try {
    useGraphStore.getState().setWorkspaceViewMode('editor')
  } catch {
    void 0
  }
  void (async () => {
    try {
      await ensureSchemaConfigWorkspaceFile()
      useMarkdownExplorerStore.getState().setActivePath(normalizeWorkspacePath(SCHEMA_CONFIG_WORKSPACE_PATH))
    } catch {
      void 0
    }
  })()
}

