import { useParserUIState, DEFAULT_PARSER_SCRIPT_TEXT } from '@/features/parsers/uiState'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'

export const PARSER_WORKSPACE_FOLDER = '/parser'
export const PARSER_SCRIPT_WORKSPACE_PATH = '/parser/parser.py'

async function ensureParserWorkspaceFolder(): Promise<void> {
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  try {
    await fs.createFolder({ parentPath: WORKSPACE_ROOT_PATH, name: 'parser' })
  } catch {
    void 0
  }
}

export async function ensureParserScriptWorkspaceFile(): Promise<void> {
  await ensureParserWorkspaceFolder()

  const fs = await getWorkspaceFs()
  try {
    await fs.readFileText(PARSER_SCRIPT_WORKSPACE_PATH)
    return
  } catch {
    void 0
  }

  const existing = (() => {
    try {
      const text = useParserUIState.getState().scriptText
      return typeof text === 'string' ? text : ''
    } catch {
      return ''
    }
  })()
  const nextText = existing.trim() ? existing : DEFAULT_PARSER_SCRIPT_TEXT

  try {
    await fs.createFile({ parentPath: PARSER_WORKSPACE_FOLDER, name: 'parser.py', text: nextText })
  } catch {
    try {
      await fs.writeFileText(PARSER_SCRIPT_WORKSPACE_PATH, nextText)
    } catch {
      void 0
    }
  }
}

export function openParserScriptWorkspaceFile(): void {
  try {
    useGraphStore.getState().setWorkspaceViewMode('editor')
  } catch {
    void 0
  }
  void (async () => {
    try {
      await ensureParserScriptWorkspaceFile()
      useMarkdownExplorerStore.getState().setActivePath(normalizeWorkspacePath(PARSER_SCRIPT_WORKSPACE_PATH))
    } catch {
      void 0
    }
  })()
}

