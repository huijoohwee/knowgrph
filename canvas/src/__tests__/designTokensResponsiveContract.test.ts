import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testDesignTokenListsUseSharedResponsiveOwner() {
  const classText = readUtf8('src/lib/ui/responsiveElementClasses.ts')
  const cssText = readUtf8('src/styles/responsive-toolbar.css')
  const panelText = readUtf8('src/features/design/DesignTokensPanel.tsx')

  if (!classText.includes('UI_RESPONSIVE_DESIGN_PANEL_TOKEN_LIST_CLASSNAME')) {
    throw new Error('expected Design token list owner to be exported from the shared responsive class registry')
  }
  if (!cssText.includes('.kg-design-panel-token-list') || !cssText.includes('--kg-design-panel-token-list-max-height')) {
    throw new Error('expected Design token list viewport cap to live in shared responsive CSS')
  }
  if (!panelText.includes('UI_RESPONSIVE_DESIGN_PANEL_TOKEN_LIST_CLASSNAME')) {
    throw new Error('expected DesignTokensPanel token lists to consume the shared responsive owner')
  }
  if (panelText.includes('max-h-36') || panelText.includes('m-0 max-h-36 list-none overflow-y-auto p-0')) {
    throw new Error('expected DesignTokensPanel to stay free of local fixed token-list height literals')
  }
}

export function testDesignSystemLayoutsUseSharedResponsiveOwners() {
  const ownerText = readUtf8('src/features/design-system/designSystemResponsiveClasses.ts')
  const cssText = readUtf8('src/styles/design-system-responsive.css')
  const indexCssText = readUtf8('src/index.css')
  const shellText = readUtf8('src/features/design-system/DesignSystemPanel.tsx')
  const tokensText = readUtf8('src/features/design-system/pages/TokensExplorer.tsx')

  for (const name of [
    'DESIGN_SYSTEM_SHELL_GRID_CLASS_NAME',
    'DESIGN_SYSTEM_TOKENS_GRID_CLASS_NAME',
    'DESIGN_SYSTEM_TOKEN_DETAIL_GRID_CLASS_NAME',
  ]) {
    if (!ownerText.includes(name)) throw new Error(`expected design-system responsive owner to export ${name}`)
  }
  for (const snippet of [
    '.kg-design-system-shell-grid',
    '.kg-design-system-tokens-grid',
    '.kg-design-system-token-detail-grid',
    '--kg-design-system-nav-width',
    '--kg-design-system-tokens-filter-width',
    '--kg-design-system-token-detail-label-width',
  ]) {
    if (!cssText.includes(snippet)) throw new Error(`expected design-system responsive CSS owner to include ${snippet}`)
  }
  if (!cssText.includes('grid-template-columns: minmax(0, 1fr)')) {
    throw new Error('expected design-system responsive grids to stay mobile-first')
  }
  if (!indexCssText.includes("@import './styles/design-system-responsive.css';")) {
    throw new Error('expected app CSS to import the design-system responsive stylesheet')
  }
  if (!shellText.includes('DESIGN_SYSTEM_SHELL_GRID_CLASS_NAME') || !tokensText.includes('DESIGN_SYSTEM_TOKENS_GRID_CLASS_NAME') || !tokensText.includes('DESIGN_SYSTEM_TOKEN_DETAIL_GRID_CLASS_NAME')) {
    throw new Error('expected design-system surfaces to consume shared responsive layout owners')
  }
  for (const literal of [
    'grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 p-3',
    'grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4',
    'mt-3 grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-sm',
  ]) {
    if (shellText.includes(literal) || tokensText.includes(literal)) {
      throw new Error(`expected design-system layout to avoid inline fixed grid literal: ${literal}`)
    }
  }
}
