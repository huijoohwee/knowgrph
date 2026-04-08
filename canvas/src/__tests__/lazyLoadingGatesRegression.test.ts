import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testHeavyFeatureSurfacesUseTargetedLazyLoadingGates() {
  const root = process.cwd()
  const mainText = readFileSync(resolve(root, 'src', 'main.tsx'), 'utf8')
  if (mainText.includes("import 'monaco-editor/dev/vs/style.css'")) {
    throw new Error('expected monaco styles to be lazy-loaded instead of eagerly imported in main.tsx')
  }
  if (mainText.includes("import 'maplibre-gl/dist/maplibre-gl.css'")) {
    throw new Error('expected maplibre styles to be lazy-loaded instead of eagerly imported in main.tsx')
  }

  const monacoTextEditorText = readFileSync(resolve(root, 'src', 'features', 'monaco', 'MonacoTextEditor.tsx'), 'utf8')
  if (!monacoTextEditorText.includes('ensureMonacoStyles')) {
    throw new Error('expected MonacoTextEditor to gate style loading via ensureMonacoStyles')
  }

  const markdownCodeBlockText = readFileSync(resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownCodeBlock.tsx'), 'utf8')
  if (!markdownCodeBlockText.includes('MermaidDiagramLazy') || !markdownCodeBlockText.includes('React.Suspense')) {
    throw new Error('expected MarkdownCodeBlock to lazy-load MermaidDiagram behind suspense')
  }

  const mdxComponentsText = readFileSync(resolve(root, 'src', 'features', 'markdown', 'ui', 'mdxComponents.tsx'), 'utf8')
  if (!mdxComponentsText.includes('MermaidDiagramLazy') || !mdxComponentsText.includes('React.Suspense')) {
    throw new Error('expected mdxComponents Mermaid renderer to lazy-load MermaidDiagram')
  }

  const threeGraphText = readFileSync(resolve(root, 'src', 'features', 'three', 'ThreeGraph.tsx'), 'utf8')
  if (!threeGraphText.includes("await import('three/examples/jsm/exporters/GLTFExporter.js')")) {
    throw new Error('expected ThreeGraph GLTF export path to lazy-load GLTFExporter')
  }

  const activeGraphDataText = readFileSync(resolve(root, 'src', 'hooks', 'useActiveGraphData.ts'), 'utf8')
  if (activeGraphDataText.includes("from '@/lib/mermaid/mermaidFrontmatterGeometry'")) {
    throw new Error('expected useActiveGraphData to avoid static mermaidFrontmatterGeometry import on startup path')
  }
  if (!activeGraphDataText.includes("import('@/lib/mermaid/mermaidFrontmatterGeometry')")) {
    throw new Error('expected useActiveGraphData to lazy-load mermaidFrontmatterGeometry for frontmatter geometry application')
  }
}
