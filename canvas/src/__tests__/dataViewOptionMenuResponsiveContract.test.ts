import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testDataViewOptionMenusUseSharedResponsiveOwner() {
  const classText = readUtf8('src/lib/ui/responsiveElementClasses.ts')
  const cssText = readUtf8('src/styles/responsive-toolbar.css')
  const singleSelectText = readUtf8('src/features/markdown/ui/MarkdownDataViewSingleSelect.tsx')
  const multiTagSelectText = readUtf8('src/features/markdown/ui/MarkdownDataViewMultiTagSelect.tsx')

  if (!classText.includes("UI_RESPONSIVE_DATA_VIEW_OPTION_MENU_LIST_CLASSNAME = 'kg-data-view-option-menu-list m-0 list-none overflow-auto p-0'")) throw new Error('expected data-view option menu list reset and scroll owner to be exported from the shared responsive class registry')
  if (!cssText.includes('.kg-data-view-option-menu-list') || !cssText.includes('--kg-data-view-option-menu-list-max-height')) throw new Error('expected data-view option menu viewport cap to live in shared responsive CSS')
  if (!singleSelectText.includes('UI_RESPONSIVE_DATA_VIEW_OPTION_MENU_LIST_CLASSNAME') || !multiTagSelectText.includes('UI_RESPONSIVE_DATA_VIEW_OPTION_MENU_LIST_CLASSNAME')) throw new Error('expected single-select and multi-tag option menus to consume the shared responsive owner')
  if (singleSelectText.includes('m-0 p-0 list-none max-h-44 overflow-auto') || multiTagSelectText.includes('m-0 p-0 list-none max-h-44 overflow-auto')) throw new Error('expected data-view option menu consumers to stay free of repeated local max-height scroll literals')
}
