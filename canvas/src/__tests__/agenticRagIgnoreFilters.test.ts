import assert from 'node:assert/strict'
import {
  applyIgnoreCodebasePathsUpdate,
  computeInvalidIgnorePrefixes,
} from '@/features/panels/utils/agenticRagIgnoreFilters'
import type { AgenticRagIgnoreFiltersSummary } from '@/lib/graph/jsonld'
import type { GraphRagWorkflowJsonLd } from '@/features/panels/utils/graphragConfig'

export function testAgenticRagIgnoreFiltersInvalidPrefixes() {
  const summary: AgenticRagIgnoreFiltersSummary = {
    rawPatterns: ['dir:src', 'glob:**/*.ipynb', 'path:node_modules', 'foo:bar', 'BAR:baz', 'noPrefix', 'glob:*.ts'],
    resolvedPatterns: ['src', '**/*.ipynb', 'node_modules', 'foo:bar', 'BAR:baz', 'noPrefix', '*.ts'],
  }

  const invalid = computeInvalidIgnorePrefixes(summary).sort()

  assert.deepEqual(invalid, ['bar', 'foo'])
}

export function testAgenticRagIgnoreFiltersEmptySummaryReturnsEmptyPrefixes() {
  const summary: AgenticRagIgnoreFiltersSummary = {
    rawPatterns: [],
    resolvedPatterns: [],
  }

  const invalid = computeInvalidIgnorePrefixes(summary)

  assert.equal(invalid.length, 0)
}

export function testAgenticRagIgnoreFiltersNullSummaryReturnsEmptyPrefixes() {
  const invalid = computeInvalidIgnorePrefixes(null)

  assert.equal(invalid.length, 0)
}

export function testApplyIgnoreCodebasePathsUpdateUsesParsedPatterns() {
  const current: GraphRagWorkflowJsonLd = {
    '@context': {
      rag: 'http://example.org/rag#',
    },
    '@type': 'rag:GraphRAGWorkflow',
    '@id': 'example:graphrag-config-graph',
    graphId: 'graph',
    name: 'GraphRAG Workflow',
    retrievalMethod: 'graph-traversal',
    maxHops: 3,
    traversalRules: [],
    contextWindow: {
      '@type': 'rag:ContextWindow',
      contextSize: 8192,
      contextStrategy: 'ranked-by-relevance',
    },
    dataset: {
      inputDir: './data/raw',
      outputDir: './data/outputs',
      ignoreCodebasePaths: ['old'],
      ignoreCodebasePathsResolved: ['old'],
    },
  }

  const next = applyIgnoreCodebasePathsUpdate(current, '.git, glob:**/*.ipynb')

  assert.notEqual(next, current)
  assert.ok(next.dataset)
  assert.deepEqual(next.dataset?.ignoreCodebasePaths, ['.git', 'glob:**/*.ipynb'])
  assert.ok(Array.isArray(next.dataset?.ignoreCodebasePathsResolved))
  assert.equal(next.dataset?.ignoreCodebasePathsResolved?.length, 2)
}
