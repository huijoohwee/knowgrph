import fs from 'node:fs'
import path from 'node:path'
import { collectGraphKeywordTermStats, readGraphNodeCentralizedKeywordTerms } from '@/lib/graph/keywordTerms'
import type { GraphData } from '@/lib/graph/types'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testGraphKeywordTermsCentralizeTagsKeywordsAndNodeTypes() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'source-1',
        label: 'Import Url Source',
        type: 'Strybldrimagesource',
        properties: {
          status: 'Source',
          tags: ['sd567', 'seedance'],
          keywords: 'Seedance, import-url-source',
        },
      },
      {
        id: 'frame-1',
        label: 'Import Url Source Frame',
        type: 'Storyboardframe',
        properties: {
          tags: 'sd567, shot',
          keywords: ['seedance', 'close-up'],
        },
      },
      {
        id: 'runtime-1',
        label: 'SenseNova API readiness',
        type: 'Storyboardelement',
        properties: {},
      },
    ],
    edges: [],
  }

  const sourceTerms = readGraphNodeCentralizedKeywordTerms(graphData.nodes[0] as never)
  if (!sourceTerms.includes('Strybldrimagesource') || !sourceTerms.includes('Source') || !sourceTerms.includes('sd567') || !sourceTerms.includes('seedance')) {
    throw new Error(`expected centralized keyword terms to include node type, tags, and keywords, got ${JSON.stringify(sourceTerms)}`)
  }

  const stats = collectGraphKeywordTermStats(graphData, 12)
  const sd567 = stats.find(entry => entry.term === 'sd567') || null
  if (!sd567 || sd567.count !== 2 || sd567.nodeIds.join(',') !== 'source-1,frame-1') {
    throw new Error(`expected shared tag frequency to aggregate node ids once, got ${JSON.stringify(sd567)}`)
  }

  const typeFallback = stats.find(entry => entry.term === 'Storyboardelement') || null
  if (!typeFallback || typeFallback.count !== 1 || typeFallback.nodeIds[0] !== 'runtime-1') {
    throw new Error(`expected typed node fallback keyword stats, got ${JSON.stringify(typeFallback)}`)
  }

  const laneKeyword = stats.find(entry => entry.term === 'Source') || null
  if (!laneKeyword || laneKeyword.count !== 1 || laneKeyword.nodeIds[0] !== 'source-1') {
    throw new Error(`expected lane/status keywords to centralize into Dashboard stats, got ${JSON.stringify(laneKeyword)}`)
  }
}

export function testGraphKeywordTermsKeepCompleteReusableStoryboardInventory() {
  const unrelatedNodes = Array.from({ length: 32 }, (_, index) => ({
    id: `unrelated-${index}`,
    label: `Unrelated ${index}`,
    type: `Reusabletype${String(index).padStart(2, '0')}`,
    properties: {
      tags: `reusable-tag-${index}`,
    },
  }))
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      ...unrelatedNodes,
      {
        id: 'source-1',
        label: 'Import Url Source',
        type: 'Strybldrimagesource',
        properties: {
          lane: 'Source',
        },
      },
      {
        id: 'frame-1',
        label: 'Import Url Source Frame',
        type: 'Storyboardframe',
        properties: {
          lane: 'Storyboard',
        },
      },
      {
        id: 'runtime-1',
        label: 'SenseNova API readiness',
        type: 'Storyboardelement',
        properties: {
          lane: 'Runtime',
        },
      },
    ],
    edges: [],
  }

  const completeStats = collectGraphKeywordTermStats(graphData)
  const completeTerms = new Set(completeStats.map(entry => entry.term))
  for (const expectedTerm of ['Strybldrimagesource', 'Storyboardframe', 'Storyboardelement', 'Source', 'Storyboard', 'Runtime']) {
    if (!completeTerms.has(expectedTerm)) {
      throw new Error(`expected complete Dashboard keyword inventory to include ${expectedTerm}, got ${JSON.stringify(completeStats.map(entry => entry.term))}`)
    }
  }
  if (completeStats.length <= 24) {
    throw new Error(`expected uncapped reusable keyword inventory beyond the legacy 24 item limit, got ${completeStats.length}`)
  }

  const cappedStats = collectGraphKeywordTermStats(graphData, 24)
  if (cappedStats.length !== 24) {
    throw new Error(`expected explicit keyword stat limits to remain available, got ${cappedStats.length}`)
  }
}

export function testGraphKeywordTermsStayCentralizedAcrossStoryboardAndDashboardOwners() {
  const storyboardModelText = readUtf8('src/components/StoryboardCanvas/storyboardModel.ts')
  const storyboardCanvasText = readUtf8('src/components/StoryboardCanvas.tsx')
  const graphStatsPanelText = readUtf8('src/features/graph-stats/GraphStatsPanel.tsx')
  const derivedDataText = readUtf8('src/features/graph-stats/hooks/useStatsDerivedData.ts')
  const keywordTermsText = readUtf8('src/lib/graph/keywordTerms.ts')

  if (!storyboardModelText.includes("from '@/lib/graph/keywordTerms'") || !storyboardModelText.includes('readGraphKeywordTermsFromProperties')) {
    throw new Error('expected storyboard keyword chips to read from the shared keyword term owner')
  }
  if (!storyboardModelText.includes('GRAPH_KEYWORD_LANE_PROPERTY_KEYS')) {
    throw new Error('expected storyboard lane owner keys to reuse the shared keyword lane registry')
  }
  if (!derivedDataText.includes('collectGraphKeywordTermStats') || !derivedDataText.includes('dashboardKeywordTerms')) {
    throw new Error('expected Dashboard derived data to expose centralized keyword term stats')
  }
  if (
    !derivedDataText.includes('const graph = data as GraphData | null')
    || !derivedDataText.includes('return collectGraphKeywordTermStats(graph)')
    || derivedDataText.includes('const graph = (effectiveGraph || data) as GraphData | null\n    return collectGraphKeywordTermStats(graph)')
  ) {
    throw new Error('expected Dashboard keyword inventory to remain full-graph scoped for reusable storyboard keywords')
  }
  if (!graphStatsPanelText.includes('GraphKeywordTermsSection') || !graphStatsPanelText.includes('terms={dashboardKeywordTerms}')) {
    throw new Error('expected MainPanel Dashboard to render the centralized keyword term section')
  }
  if (
    !storyboardCanvasText.includes('ariaLabel={`Storyboard type for ${card.id}`}')
    || !storyboardCanvasText.includes("patch: { type }")
    || !storyboardCanvasText.includes("updateNode(cardId, { type })")
  ) {
    throw new Error('expected storyboard type chips to stay editable through the canonical node type owner')
  }
  if (
    !storyboardCanvasText.includes('ariaLabel={`Storyboard lane for ${card.id}`}')
    || !storyboardCanvasText.includes("canonicalKey: 'lane'")
    || !storyboardCanvasText.includes('GRAPH_KEYWORD_LANE_PROPERTY_KEYS')
  ) {
    throw new Error('expected storyboard lane chips to stay editable through the shared centralized lane keyword owner')
  }
  if (!keywordTermsText.includes('GRAPH_KEYWORD_LANE_PROPERTY_KEYS') || !keywordTermsText.includes("['status', 'stage', 'column', 'lane'")) {
    throw new Error('expected shared keyword owner to include storyboard lane/status fields')
  }
}
