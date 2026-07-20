import { shouldApplyImportedCanvasDocumentToGraph } from '@/features/markdown-workspace/workspaceImport'
import { applyWorkspaceImportToCanvas } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { normalizeWorkspacePath, workspaceBasename, workspaceDocumentKey } from '@/features/workspace-fs/path'
import { useGraphStore } from '@/hooks/useGraphStore'
import { normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'

export async function applyChatKgcDocumentTextToCanvas({
  name,
  text,
}: {
  name: string
  text: string
}): Promise<boolean> {
  return await useGraphStore.getState().setActiveMarkdownDocument({
    name,
    text: normalizeMermaidMmdToMarkdown(name, text),
    normalizeMermaidMmd: false,
    sourceUrl: null,
    jsonSourceText: null,
    applyViewPreset: true,
    applyToGraph: true,
    forceApplyToGraph: true,
  })
}

export async function applyChatKgcWorkspaceDocumentToCanvas(path: string): Promise<boolean> {
  const workspacePath = normalizeWorkspacePath(path)
  if (!workspacePath) return false
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const text = String((await fs.readFileText(workspacePath)) || '')
  if (!shouldApplyImportedCanvasDocumentToGraph({ path: workspacePath, text })) return false
  await applyWorkspaceImportToCanvas({
    fs,
    createdPaths: [workspacePath],
    opts: {
      applyToGraph: true,
      skipComposedGraphApply: true,
    },
  })
  const name = workspaceDocumentKey(workspacePath) || workspaceBasename(workspacePath) || workspacePath
  return await applyChatKgcDocumentTextToCanvas({ name, text })
}
