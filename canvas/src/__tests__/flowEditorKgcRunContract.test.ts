import fs from 'node:fs'
import path from 'node:path'

export function testFlowEditorRunTargetsCanonicalKgcWorkspaceDocument() {
  const filePath = path.resolve(process.cwd(), 'src/components/FlowEditorCanvas.tsx')
  const source = fs.readFileSync(filePath, 'utf8')

  const requiredSnippets = [
    "isKgcWorkspaceCompanionPath(activeWorkspacePath)",
    'const canonicalPath = toCanonicalKgcWorkspacePath(activeWorkspacePath)',
    'useMarkdownExplorerStore.getState().setActivePath(canonicalPath)',
    'ensureEditorCanvasLandingForDuration(1500)',
    'applyMarkdownDocumentToGraph(canonicalPath, canonicalText, { force: true })',
    'await emitKgcRunOutput({',
  ]

  for (const snippet of requiredSnippets) {
    if (!source.includes(snippet)) {
      throw new Error(`Expected FlowEditor Run handler to include canonical KGC runnable behavior: ${snippet}`)
    }
  }
}
