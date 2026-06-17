import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testGraphStatsTokenListPanelsUseSharedResponsiveOwner() {
  const classText = readUtf8('src/lib/ui/responsiveElementClasses.ts')
  const cssText = readUtf8('src/styles/responsive-toolbar.css')
  const communitiesText = readUtf8('src/features/graph-stats/sections/CommunitiesStatsSection.tsx')
  const wordFrequenciesText = readUtf8('src/features/graph-stats/sections/GraphLayerWordFrequenciesSection.tsx')

  if (!classText.includes('UI_RESPONSIVE_STATS_TOKEN_LIST_PANEL_CLASSNAME')) {
    throw new Error('expected graph-stats token list panel class owner to be exported from the shared responsive class registry')
  }
  if (!cssText.includes('.kg-stats-token-list-panel') || !cssText.includes('--kg-stats-token-list-panel-max-height')) {
    throw new Error('expected graph-stats token list panel viewport bounds to live in shared responsive CSS')
  }
  if (!communitiesText.includes('UI_RESPONSIVE_STATS_TOKEN_LIST_PANEL_CLASSNAME') || !wordFrequenciesText.includes('UI_RESPONSIVE_STATS_TOKEN_LIST_PANEL_CLASSNAME')) {
    throw new Error('expected graph-stats token list panels to consume the shared responsive owner')
  }
  if (communitiesText.includes('max-h-40 overflow-y-auto') || wordFrequenciesText.includes('max-h-40 overflow-y-auto')) {
    throw new Error('expected graph-stats token list panels to stay free of local max-height scroll literals')
  }
}

export function testGraphStatsMetricGridsUseSharedResponsiveOwner() {
  const ownerText = readUtf8('src/features/graph-stats/graphStatsResponsiveClasses.ts')
  const panelText = readUtf8('src/features/graph-stats/GraphStatsPanel.tsx')
  const edgesText = readUtf8('src/features/graph-stats/sections/EdgesStatsSection.tsx')
  const centralityText = readUtf8('src/features/graph-stats/sections/GraphRagCentralityStatsSection.tsx')
  const metricGridLiteral = 'grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2'
  const detailGridLiteral = 'grid min-w-0 grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)]'
  const keywordControlGridLiteral = 'grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2'

  if (!ownerText.includes(`GRAPH_STATS_METRIC_GRID_CLASS_NAME = '${metricGridLiteral}'`)) {
    throw new Error('expected graph-stats metric grids to use the shared mobile-first responsive owner')
  }
  if (!ownerText.includes(`GRAPH_STATS_DETAIL_GRID_CLASS_NAME = '${detailGridLiteral}'`)) {
    throw new Error('expected graph-stats detail grids to use the shared mobile-first responsive owner')
  }
  if (!ownerText.includes(`GRAPH_STATS_KEYWORD_CONTROL_GRID_CLASS_NAME = '${keywordControlGridLiteral}'`) || !panelText.includes('GRAPH_STATS_KEYWORD_CONTROL_GRID_CLASS_NAME')) {
    throw new Error('expected graph-stats keyword controls to consume the shared mobile-first responsive grid owner')
  }
  if (!edgesText.includes('GRAPH_STATS_METRIC_GRID_CLASS_NAME') || !centralityText.includes('GRAPH_STATS_DETAIL_GRID_CLASS_NAME')) {
    throw new Error('expected graph-stats sections to consume the shared responsive metric grid owners')
  }
  if (edgesText.includes('grid grid-cols-2 gap-2') || centralityText.includes('grid grid-cols-2 gap-x-4 gap-y-1') || panelText.includes('grid grid-cols-1 sm:grid-cols-2 gap-3')) {
    throw new Error('expected graph-stats sections to stay free of fixed two-column metric grid literals')
  }
}

export function testGraphRagCentralityStatsUsesSharedCentralityToggleGroup() {
  const centralityText = readUtf8('src/features/graph-stats/sections/GraphRagCentralityStatsSection.tsx')
  if (
    !centralityText.includes("from '@/features/graphrag/ui/GraphRagCentralityToggleGroup'") ||
    !centralityText.includes('GraphRagCentralityToggleGroup') ||
    centralityText.includes('type="checkbox"')
  ) {
    throw new Error('expected GraphRAG centrality stats toggles to consume the shared centrality toggle group')
  }
}
