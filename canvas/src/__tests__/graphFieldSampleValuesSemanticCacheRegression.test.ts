import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphFieldSampleValuesReuseSemanticCacheAcrossConsumers() {
  const graphFieldsText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'graph-fields', 'graphFields.ts'),
    'utf8',
  )
  const fieldSamplesText = readFileSync(
    resolve(
      process.cwd(),
      'src',
      'features',
      'panels',
      'views',
      'graph-fields',
      'fieldSamples.ts',
    ),
    'utf8',
  )

  if (
    !graphFieldsText.includes('const fieldSampleValuesCache = new Map<string, ReadonlyArray<unknown>>()')
    || !graphFieldsText.includes("buildScopedGraphSemanticKey('graph-fields-sampled-values-graph'")
    || !graphFieldsText.includes("export function getCachedFieldSampleValues(")
    || !graphFieldsText.includes("const values = getCachedFieldSampleValues(graphData, field)")
    || graphFieldsText.includes('const scanNodes = (graphData.nodes || []).slice(0, ENTITY_SCAN_LIMIT)')
    || graphFieldsText.includes('const scanEdges = (graphData.edges || []).slice(0, ENTITY_SCAN_LIMIT)')
  ) {
    throw new Error('expected graphFields.ts to own a semantic sampled-values cache for field inference instead of rescanning graph entities locally')
  }

  if (
    !fieldSamplesText.includes("import { getCachedFieldSampleValues, type GraphField } from '@/features/graph-fields/graphFields'")
    || !fieldSamplesText.includes('const values = getCachedFieldSampleValues(graphData, field)')
    || fieldSamplesText.includes('const scanNodes = (graphData.nodes || []).slice(0, ENTITY_SCAN_LIMIT)')
    || fieldSamplesText.includes('const scanEdges = (graphData.edges || []).slice(0, ENTITY_SCAN_LIMIT)')
  ) {
    throw new Error('expected fieldSamples.ts to reuse the shared sampled-values cache instead of owning a second bounded graph scan path')
  }
}
