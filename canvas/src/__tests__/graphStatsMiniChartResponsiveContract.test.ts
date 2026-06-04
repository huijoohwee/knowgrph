import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testGraphStatsMiniChartsUseSharedResponsiveOwner() {
  const classText = readUtf8('src/lib/ui/responsiveElementClasses.ts')
  const cssText = readUtf8('src/styles/responsive-toolbar.css')
  const metricsText = readUtf8('src/features/graph-stats/statsMiniChart.ts')
  const sectionTexts = [
    readUtf8('src/features/graph-stats/sections/KeywordEntitiesSection.tsx'),
    readUtf8('src/features/graph-stats/sections/EdgesStatsSection.tsx'),
    readUtf8('src/features/graph-stats/sections/CommunitiesStatsSection.tsx'),
    readUtf8('src/features/graph-stats/sections/GraphLayerWordFrequenciesSection.tsx'),
  ]

  if (!classText.includes('UI_RESPONSIVE_STATS_MINI_CHART_SCROLL_CLASSNAME')) throw new Error('expected graph-stats mini chart scroll owner to be exported from the shared responsive class registry')
  if (!cssText.includes('.kg-stats-mini-chart-scroll') || !cssText.includes('--kg-stats-mini-chart-height')) throw new Error('expected graph-stats mini chart height and horizontal scroll to live in shared responsive CSS')
  if (!metricsText.includes('STATS_MINI_CHART_MIN_HEIGHT_PX = 64')) throw new Error('expected graph-stats mini chart min-height metric to use a shared source owner')
  if (sectionTexts.some(text => !text.includes('UI_RESPONSIVE_STATS_MINI_CHART_SCROLL_CLASSNAME') || !text.includes('STATS_MINI_CHART_MIN_HEIGHT_PX'))) throw new Error('expected graph-stats sections to consume shared mini chart responsive and metric owners')
  if (sectionTexts.some(text => text.includes('overflow-x-auto h-16') || text.includes('minHeight={64}'))) throw new Error('expected graph-stats sections to stay free of local mini chart scroll and height literals')
}
