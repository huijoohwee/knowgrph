import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testMarkdownMermaidRenderingDefersUntilVisible() {
  const root = process.cwd()
  const gateText = readFileSync(resolve(root, 'src', 'features', 'markdown', 'ui', 'MermaidVisibilityGate.tsx'), 'utf8')
  if (!gateText.includes('IntersectionObserver')) {
    throw new Error('expected Mermaid visibility gate to rely on IntersectionObserver for deferred rendering')
  }
  if (!gateText.includes("rootMargin: MERMAID_VISIBILITY_ROOT_MARGIN")) {
    throw new Error('expected Mermaid visibility gate to preload slightly ahead of viewport entry')
  }
  if (!gateText.includes("data-kg-mermaid-visibility-gate")) {
    throw new Error('expected Mermaid visibility gate to expose a stable source-visible marker')
  }
  if (!gateText.includes("useMediaQuery(MERMAID_TOUCH_VIEWPORT_QUERY)") || !gateText.includes("data-kg-mermaid-touch-placeholder")) {
    throw new Error('expected Mermaid visibility gate to expose a touch-placeholder path for mobile explicit intent')
  }
  if (!gateText.includes("data-kg-mermaid-touch-placeholder-activate")) {
    throw new Error('expected Mermaid visibility gate to expose a stable mobile activation control')
  }

  const markdownCodeBlockText = readFileSync(resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownCodeBlock.tsx'), 'utf8')
  if (!markdownCodeBlockText.includes('MermaidVisibilityGate')) {
    throw new Error('expected MarkdownCodeBlock Mermaid rendering to flow through the shared visibility gate')
  }
  if (!markdownCodeBlockText.includes('<MermaidVisibilityGate>')) {
    throw new Error('expected MarkdownCodeBlock Mermaid render mode to defer diagram mounting until visible')
  }

  const mdxComponentsText = readFileSync(resolve(root, 'src', 'features', 'markdown', 'ui', 'mdxComponents.tsx'), 'utf8')
  if (!mdxComponentsText.includes('MermaidVisibilityGate')) {
    throw new Error('expected MDX Mermaid rendering to reuse the shared visibility gate')
  }
  if (!mdxComponentsText.includes('<MermaidVisibilityGate>')) {
    throw new Error('expected MDX Mermaid rendering to defer diagram mounting until visible')
  }
}
