import type { MutableRefObject } from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { workspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import type { WorkspacePath } from '@/features/workspace-fs/types'
import type { MarkdownWorkspaceRuntimeGetFs, MarkdownWorkspaceRuntimeSetActiveDocument } from './markdownWorkspaceRuntime.types'
import { normalizeWebpageFrontmatterView } from '@/lib/markdown/frontmatter'
import { ORCHESTRATOR_WORKFLOW_WORKSPACE_PATH } from '@/features/panels/utils/orchestratorWorkspaceFiles'
import { PARSER_SCRIPT_WORKSPACE_PATH } from '@/features/panels/utils/parserWorkspaceFiles'
import { SCHEMA_CONFIG_WORKSPACE_PATH } from '@/features/panels/utils/schemaWorkspaceFiles'
import { useParserUIState } from '@/features/parsers/uiState'
import { parseSchemaText } from '@/features/schema/io'
import { WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS } from '@/lib/config'


export const pushWorkspaceTextToActiveMarkdownDocument = (args: {
  activeDocumentKey: string
  activeDocumentSourceUrl: string | null
  setActiveMarkdownDocument: MarkdownWorkspaceRuntimeSetActiveDocument
  text: string
}): void => {
  if (!args.activeDocumentKey) return
  void args.setActiveMarkdownDocument({
    name: args.activeDocumentKey,
    text: normalizeWebpageFrontmatterView(args.text, 'markdown'),
    normalizeMermaidMmd: false,
    autoEnableFrontmatter: false,
    sourceUrl: args.activeDocumentSourceUrl,
  })
}

export const updateExistingWorkspaceSourceFile = (args: {
  path: WorkspacePath
  text: string
  resetParsedState: boolean
}): void => {
  try {
    const store = useGraphStore.getState()
    const wsPath = workspaceSourcePathKey(args.path)
    const current = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
    const existing = current.find(file => String(file?.source?.path || '') === wsPath) || null
    if (!existing) return
    if (args.resetParsedState) {
      store.updateSourceFile(existing.id, {
        text: args.text,
        status: 'idle',
        error: undefined,
        parsedParserId: undefined,
        parsedTextHash: undefined,
        parsedGraphData: undefined,
      })
      return
    }
    const inlineText = args.text.length <= WORKSPACE_ENTRY_INLINE_TEXT_MAX_CHARS ? args.text : undefined
    store.updateSourceFile(existing.id, {
      text: inlineText ?? '',
      status: 'idle',
      error: undefined,
    })
  } catch {
    void 0
  }
}

export const applyWorkspaceSpecialFileEffects = (args: {
  path: WorkspacePath
  text: string
  setGraphRagWorkflowJsonText: (text: string) => void
}): void => {
  if (args.path === ORCHESTRATOR_WORKFLOW_WORKSPACE_PATH) {
    try {
      args.setGraphRagWorkflowJsonText(args.text)
    } catch {
      void 0
    }
  }
  if (args.path === PARSER_SCRIPT_WORKSPACE_PATH) {
    try {
      useParserUIState.getState().setScriptText(args.text)
    } catch {
      void 0
    }
  }
  if (args.path === SCHEMA_CONFIG_WORKSPACE_PATH) {
    try {
      const next = parseSchemaText(args.text)
      const store = useGraphStore.getState()
      store.setSchema(next)
      store.setSchemaOpStatus(true, 'Applied schema from workspace file')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err ?? '')
      try {
        useGraphStore.getState().setSchemaOpStatus(false, `Schema parse failed: ${msg}`)
      } catch {
        void 0
      }
    }
  }
}

export const writeWorkspaceFileAndSync = async (args: {
  path: WorkspacePath
  text: string
  getFs: MarkdownWorkspaceRuntimeGetFs
  lastLoadedRef: MutableRefObject<{ path: WorkspacePath; text: string } | null>
  patchWorkspaceEntryInlineText: (path: WorkspacePath, text: string) => void
  activeDocumentKey: string
  activeDocumentSourceUrl: string | null
  setActiveMarkdownDocument: MarkdownWorkspaceRuntimeSetActiveDocument
  setGraphRagWorkflowJsonText: (text: string) => void
  resetParsedState: boolean
}): Promise<void> => {
  const fs = await args.getFs()
  await fs.writeFileText(args.path, args.text)
  args.lastLoadedRef.current = { path: args.path, text: args.text }
  args.patchWorkspaceEntryInlineText(args.path, args.text)
  pushWorkspaceTextToActiveMarkdownDocument({
    activeDocumentKey: args.activeDocumentKey,
    activeDocumentSourceUrl: args.activeDocumentSourceUrl,
    setActiveMarkdownDocument: args.setActiveMarkdownDocument,
    text: args.text,
  })
  updateExistingWorkspaceSourceFile({
    path: args.path,
    text: args.text,
    resetParsedState: args.resetParsedState,
  })
  applyWorkspaceSpecialFileEffects({
    path: args.path,
    text: args.text,
    setGraphRagWorkflowJsonText: args.setGraphRagWorkflowJsonText,
  })
}

export const resolveAuthoritativeWorkspaceText = async (args: {
  path: WorkspacePath
  getFs: MarkdownWorkspaceRuntimeGetFs
  lastLoadedRef: MutableRefObject<{ path: WorkspacePath; text: string } | null>
  activeTextRef: MutableRefObject<string>
  userEditedActiveTextRef: MutableRefObject<boolean>
}): Promise<string> => {
  const lastLoaded = args.lastLoadedRef.current
  const isDirty = !!(
    args.userEditedActiveTextRef.current &&
    lastLoaded &&
    lastLoaded.path === args.path &&
    lastLoaded.text !== args.activeTextRef.current
  )
  if (isDirty) return String(args.activeTextRef.current || '')
  if (lastLoaded && lastLoaded.path === args.path && typeof lastLoaded.text === 'string' && lastLoaded.text.trim()) {
    return lastLoaded.text
  }
  const fs = await args.getFs()
  const hydrated = typeof fs.readFileText === 'function'
    ? await fs.readFileText(args.path).catch(() => '')
    : ''
  if (String(hydrated || '').trim()) return String(hydrated || '')
  return String(args.activeTextRef.current || '')
}
