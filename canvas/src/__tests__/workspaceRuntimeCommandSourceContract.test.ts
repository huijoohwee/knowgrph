import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testWorkspaceRuntimeCommandInstallsStableWindowCommand() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'features', 'agent-ready', 'workspaceRuntimeCommand.ts'), 'utf8')
  for (const snippet of [
    'export type WorkspaceRuntimeCommandState = {',
    'export type WorkspaceRuntimeCommandApplyDocumentArgs = {',
    'readState: () => WorkspaceRuntimeCommandState',
    'applyMarkdownDocument: (args: WorkspaceRuntimeCommandApplyDocumentArgs)',
    'markdownDocumentText: string | null',
    'const state = useGraphStore.getState()',
    "markdownDocumentText: typeof state.markdownDocumentText === 'string' ? state.markdownDocumentText : null,",
    'state.setWorkspaceViewMode(args.workspaceViewMode)',
    'state.setWorkspaceCanvasPaneOpen(args.workspaceCanvasPaneOpen)',
    'state.setCanvasRenderMode(nextCanvasRenderMode)',
    'state.setCanvas2dRenderer(nextCanvas2dRenderer)',
    'state.setDocumentSemanticMode(nextDocumentSemanticMode)',
    'state.setFrontmatterModeEnabled(args.frontmatterModeEnabled)',
    'await state.setActiveMarkdownDocument({',
    'window.knowgrphWorkspaceCommand = command',
    'delete window.knowgrphWorkspaceCommand',
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected workspace runtime command contract snippet: ${snippet}`)
    }
  }
}

export function testAppInstallsWorkspaceRuntimeCommand() {
  const text = readFileSync(resolve(process.cwd(), 'src', 'App.tsx'), 'utf8')
  for (const snippet of [
    "import('@/features/agent-ready/workspaceRuntimeCommand')",
    'let cleanupWorkspaceRuntime = () => void 0',
    'cleanupWorkspaceRuntime = workspaceRuntimeModule.installWorkspaceRuntimeCommand()',
    'cleanupWorkspaceRuntime()',
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected App to install workspace runtime command snippet: ${snippet}`)
    }
  }
}
