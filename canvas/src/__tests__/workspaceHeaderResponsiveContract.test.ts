import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testWorkspaceHeaderRowsUseSharedResponsiveOwner() {
  const classText = readUtf8('src/lib/ui/responsiveElementClasses.ts')
  const cssText = readUtf8('src/styles/responsive-toolbar.css')
  const workspaceHeaderText = readUtf8('src/components/ui/WorkspaceHeader.tsx')
  const markdownExplorerText = readUtf8('src/features/markdown-workspace/MarkdownWorkspaceExplorer.tsx')
  const markdownToolbarText = readUtf8('src/features/markdown-workspace/MarkdownWorkspaceToolbar.tsx')
  const graphTableHeaderText = readUtf8('src/features/graph-table/ui/GraphTableWorkspaceHeader.tsx')

  if (!classText.includes('UI_RESPONSIVE_WORKSPACE_HEADER_ROW_CLASSNAME')) {
    throw new Error('expected workspace header row class owner to be exported from the shared responsive class registry')
  }
  if (!workspaceHeaderText.includes('UI_RESPONSIVE_WORKSPACE_HEADER_ROW_CLASSNAME') || !markdownExplorerText.includes('UI_RESPONSIVE_WORKSPACE_HEADER_ROW_CLASSNAME')) {
    throw new Error('expected workspace header rows and explorer headers to consume the shared responsive owner')
  }
  if (!cssText.includes('--kg-workspace-header-row-min-height') || !cssText.includes('.kg-graph-table-header { --kg-workspace-header-row-min-height')) {
    throw new Error('expected workspace header row heights to live in shared responsive CSS')
  }
  if (
    [markdownExplorerText, markdownToolbarText].some(text => text.includes('min-h-[calc(var(--kg-control-height,28px)+0.5rem+2px)]')) ||
    graphTableHeaderText.includes('min-h-[var(--kg-control-height,28px)]') ||
    markdownToolbarText.includes('kg-markdown-workspace-toolbar-row kg-toolbar') ||
    graphTableHeaderText.includes('kg-graph-table-header kg-toolbar')
  ) {
    throw new Error('expected workspace header consumers to stay free of local toolbar height literals')
  }
}
