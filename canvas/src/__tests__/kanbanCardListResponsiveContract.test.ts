import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testKanbanCardListsUseSharedResponsiveOwner() {
  const classText = readUtf8('src/lib/ui/responsiveElementClasses.ts')
  const cssText = readUtf8('src/styles/responsive-toolbar.css')
  const graphTableKanbanText = readUtf8('src/features/graph-table/ui/GraphTableKanbanView.tsx')
  const markdownKanbanGroupText = readUtf8('src/features/markdown/ui/kanban/KanbanGroup.tsx')

  if (!classText.includes("UI_RESPONSIVE_DATA_VIEW_KANBAN_CARD_LIST_CLASSNAME = 'kg-data-view-kanban-card-list flex flex-col gap-2 list-none m-0 overflow-y-auto p-2'")) {
    throw new Error('expected Kanban card list reset, scroll, spacing, and padding to live in the shared responsive class owner')
  }
  if (!cssText.includes('.kg-data-view-kanban-card-list') || !cssText.includes('--kg-data-view-kanban-card-list-max-height')) {
    throw new Error('expected Kanban card list viewport bounds to stay in shared responsive CSS')
  }
  if (!graphTableKanbanText.includes('UI_RESPONSIVE_DATA_VIEW_KANBAN_CARD_LIST_CLASSNAME') || !markdownKanbanGroupText.includes('UI_RESPONSIVE_DATA_VIEW_KANBAN_CARD_LIST_CLASSNAME')) {
    throw new Error('expected Graph Table and Markdown Kanban card lists to consume the shared responsive owner')
  }
  if (graphTableKanbanText.includes('overflow-y-auto list-none m-0 p-2 flex flex-col gap-2') || markdownKanbanGroupText.includes('p-2 space-y-2 list-none m-0 overflow-y-auto')) {
    throw new Error('expected Kanban card list consumers to stay free of repeated local list and scroll classes')
  }
}
