import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8')

export function testMarkdownSlidesSidebarUsesResponsiveOwner() {
  const ownerText = readSource('src/features/markdown/ui/markdownPresentationResponsiveClasses.ts')
  const sidebarText = readSource('src/features/markdown/ui/SlidesSidebar.tsx')
  const presentationText = readSource('src/features/markdown/ui/MarkdownPreviewPresentation.tsx')
  const cssText = readSource('src/styles/markdown-presentation-responsive.css')
  const indexCssText = readSource('src/index.css')

  if (
    !ownerText.includes("MARKDOWN_SLIDES_SIDEBAR_CLASS_NAME = 'kg-markdown-slides-sidebar'") ||
    !sidebarText.includes('MARKDOWN_SLIDES_SIDEBAR_CLASS_NAME') ||
    !presentationText.includes('MARKDOWN_SLIDES_SIDEBAR_CLASS_NAME') ||
    sidebarText.includes("width = 'w-64'") ||
    presentationText.includes('className="w-64 h-full flex flex-col overflow-hidden"')
  ) {
    throw new Error('expected Markdown slides sidebar width to use one shared presentation responsive class owner')
  }

  if (
    !indexCssText.includes("@import './styles/markdown-presentation-responsive.css';") ||
    !cssText.includes('.kg-markdown-slides-sidebar') ||
    !cssText.includes('--kg-markdown-slides-sidebar-width') ||
    !cssText.includes('--kg-markdown-slides-sidebar-min-width') ||
    !cssText.includes('calc(100vw - var(--kg-safe-left) - var(--kg-safe-right) - 1rem)')
  ) {
    throw new Error('expected Markdown slides sidebar sizing to stay viewport-safe in the presentation responsive stylesheet')
  }
}
