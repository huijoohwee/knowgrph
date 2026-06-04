import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testMarkdownInlineMenusUseSharedResponsiveListOwners() {
  const classText = readUtf8('src/lib/ui/responsiveElementClasses.ts')
  const cssText = readUtf8('src/styles/responsive-toolbar.css')
  const toolbarStylesText = readUtf8('src/features/toolbar/ui/toolbarStyles.ts')
  const inlineMenusText = readUtf8('src/lib/markdown-core/ui/markdownBlockContainerCore.inlineMenusOverlay.tsx')

  if (!classText.includes("UI_RESPONSIVE_MARKDOWN_INLINE_MENU_LIST_CLASSNAME = 'kg-markdown-inline-menu-list list-none m-0 p-0'")) throw new Error('expected Markdown inline menu responsive owner to include menu reset classes')
  if (!cssText.includes('.kg-markdown-inline-menu-list') || !cssText.includes('--kg-markdown-inline-menu-list-max-height')) throw new Error('expected Markdown inline menu viewport cap to stay in shared responsive CSS')
  if (!toolbarStylesText.includes('uiToolbarRowScrollListClassName')) throw new Error('expected toolbar row-scroll list helper to remain the shared reset owner')
  if (!inlineMenusText.includes('UI_RESPONSIVE_MARKDOWN_INLINE_MENU_LIST_CLASSNAME') || !inlineMenusText.includes('uiToolbarRowScrollListClassName')) throw new Error('expected Markdown inline menus to consume shared responsive menu and row-scroll list owners')
  if (inlineMenusText.includes('uiToolbarRowScrollClassName} list-none m-0 p-0') || inlineMenusText.includes('list-none m-0 p-0 mt-2') || inlineMenusText.includes('mt-2 gap-2 list-none m-0 p-0')) throw new Error('expected Markdown inline menus to stay free of local list reset duplication')
}
