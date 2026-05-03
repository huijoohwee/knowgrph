import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphFieldsListUtilsReuseSemanticOwnerSummaryCache() {
  const graphFieldsText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'graph-fields', 'graphFields.ts'),
    'utf8',
  )
  const text = readFileSync(
    resolve(
      process.cwd(),
      'src',
      'features',
      'panels',
      'views',
      'graph-fields',
      'graphFieldsListUtils.ts',
    ),
    'utf8',
  )

  if (
    !graphFieldsText.includes('const graphFieldOwnerSummaryCache = new Map<string, GraphFieldOwnerSummary>()')
    || !graphFieldsText.includes("export function getCachedGraphFieldOwnerSummary(")
    || !graphFieldsText.includes("buildScopedGraphSemanticKey('graph-fields-owner-summary'")
    || !text.includes("getCachedGraphFieldOwnerSummary,")
    || !text.includes('const ownerSummary = getCachedGraphFieldOwnerSummary(graphData)')
    || !text.includes("if (!ownerKey) ownerKey = ownerSummary?.nodeOwnerByFieldKey.get(key) || ''")
    || !text.includes("if (!ownerKey) ownerKey = ownerSummary?.edgeOwnerByFieldKey.get(key) || ''")
    || !text.includes("const trimmed = getCachedGraphFieldOwnerSummary(graphData)?.firstNodeType || ''")
    || !text.includes("const trimmed = getCachedGraphFieldOwnerSummary(graphData)?.firstEdgeLabel || ''")
    || text.includes('const graphFieldOwnerSummaryCache = new Map<string, GraphFieldOwnerSummary>()')
    || text.includes("buildScopedGraphSemanticKey('graph-fields-list-utils-owner-summary'")
    || text.includes('function getCachedGraphFieldOwnerSummary(')
    || text.includes('graphData.nodes.find(')
    || text.includes('graphData.edges.find(')
  ) {
    throw new Error('expected graphFields.ts to own the semantic owner-summary cache and graphFieldsListUtils to reuse that SSOT instead of keeping a duplicate graph summary cache')
  }
}
