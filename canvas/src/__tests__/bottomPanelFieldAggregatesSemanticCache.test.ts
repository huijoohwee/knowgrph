import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testBottomPanelFieldAggregatesReuseSemanticNumericSampleCache() {
  const fieldStatsPath = resolve(
    process.cwd(),
    'src',
    'components',
    'BottomPanel',
    'BottomPanelCuratorFieldStats.tsx',
  )
  const fieldAggregatesPath = resolve(
    process.cwd(),
    'src',
    'components',
    'BottomPanel',
    'hooks',
    'useBottomPanelCuratorFieldAggregates.ts',
  )

  const fieldStatsText = readFileSync(fieldStatsPath, 'utf8')
  const fieldAggregatesText = readFileSync(fieldAggregatesPath, 'utf8')

  if (
    !fieldStatsText.includes('const numericSampleStatsByFieldIdCache = new Map<string, Map<string, NumericSampleStats>>()')
    || !fieldStatsText.includes('export function getCachedNumericSampleStatsByFieldId(args: {')
    || !fieldStatsText.includes("'bottom-panel-numeric-sample-stats'")
    || !fieldStatsText.includes('buildNumericSampleStatsFieldSignature(args.fields)')
  ) {
    throw new Error('expected bottom-panel field stats helper to centralize semantic caching for numeric sample scans')
  }

  if (
    !fieldAggregatesText.includes('getCachedNumericSampleStatsByFieldId({')
    || !fieldAggregatesText.includes('graphSemanticKey: sampleGraphSemanticKey')
    || fieldAggregatesText.includes('computeNumericSampleStatsForField(field, sampleNodes, sampleEdges, numericSampleLimit)')
  ) {
    throw new Error('expected bottom-panel field aggregates to reuse cached semantic numeric sample stats instead of rescanning per field')
  }
}
