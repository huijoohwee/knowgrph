import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8')

export function testMarkdownCodeAnnotationsUseResponsiveOwner() {
  const ownerText = readSource('src/features/markdown/ui/codeblock/markdownCodeAnnotationResponsiveClasses.ts')
  const rowsText = readSource('src/features/markdown/ui/codeblock/CodeAnnotationRows.tsx')
  const cssText = readSource('src/styles/markdown-codeblock-responsive.css')
  const indexCssText = readSource('src/index.css')

  if (
    !ownerText.includes("MARKDOWN_CODE_ANNOTATION_PANEL_CLASS_NAME = 'kg-markdown-code-annotation-panel'") ||
    !ownerText.includes("MARKDOWN_CODE_ANNOTATION_BESIDE_PANEL_CLASS_NAME = 'kg-markdown-code-annotation-panel kg-markdown-code-annotation-panel--beside'") ||
    !rowsText.includes('MARKDOWN_CODE_ANNOTATION_BESIDE_PANEL_CLASS_NAME') ||
    !rowsText.includes('MARKDOWN_CODE_ANNOTATION_PANEL_CLASS_NAME') ||
    rowsText.includes('w-full lg:w-72')
  ) {
    throw new Error('expected Markdown code annotation panel width to use shared responsive codeblock owners')
  }

  if (
    !indexCssText.includes("@import './styles/markdown-codeblock-responsive.css';") ||
    !cssText.includes('.kg-markdown-code-annotation-panel') ||
    !cssText.includes('.kg-markdown-code-annotation-panel--beside') ||
    !cssText.includes('--kg-markdown-code-annotation-panel-width') ||
    !cssText.includes('calc(100vw - var(--kg-safe-left) - var(--kg-safe-right) - 1rem)')
  ) {
    throw new Error('expected Markdown code annotation panel sizing to stay viewport-safe in the codeblock responsive stylesheet')
  }
}
