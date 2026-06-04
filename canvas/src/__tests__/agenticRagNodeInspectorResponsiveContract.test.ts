import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testAgenticRagNodeInspectorDenseGridsUseResponsiveOwner() {
  const sourceText = readUtf8('src/features/panels/views/AgenticRagNodeInspectorSection.tsx')
  const denseGridLiteral = 'grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2'
  const ownerReferences = sourceText.match(/AGENTIC_RAG_NODE_INSPECTOR_DENSE_GRID_CLASS_NAME/g) || []

  if (!sourceText.includes(`AGENTIC_RAG_NODE_INSPECTOR_DENSE_GRID_CLASS_NAME = '${denseGridLiteral}'`)) {
    throw new Error('expected Agentic RAG node inspector dense grids to define one mobile-first owner')
  }
  if (ownerReferences.length < 6) {
    throw new Error('expected Agentic RAG node inspector dense metadata rows to consume the shared owner')
  }
  if (sourceText.includes('grid grid-cols-2 gap-1')) {
    throw new Error('expected Agentic RAG node inspector to avoid fixed two-column dense grid literals')
  }
}
