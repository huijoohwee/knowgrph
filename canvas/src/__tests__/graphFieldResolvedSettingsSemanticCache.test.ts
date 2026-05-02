import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphFieldResolvedSettingsReuseSemanticCacheAcrossConsumers() {
  const graphFieldsPath = resolve(process.cwd(), 'src', 'features', 'graph-fields', 'graphFields.ts')
  const graphFieldsListUtilsPath = resolve(
    process.cwd(),
    'src',
    'features',
    'panels',
    'views',
    'graph-fields',
    'graphFieldsListUtils.ts',
  )
  const bottomPanelColumnsPath = resolve(
    process.cwd(),
    'src',
    'components',
    'BottomPanel',
    'hooks',
    'useBottomPanelCuratorColumns.ts',
  )
  const bottomPanelFieldAggregatesPath = resolve(
    process.cwd(),
    'src',
    'components',
    'BottomPanel',
    'hooks',
    'useBottomPanelCuratorFieldAggregates.ts',
  )

  const graphFieldsText = readFileSync(graphFieldsPath, 'utf8')
  const graphFieldsListUtilsText = readFileSync(graphFieldsListUtilsPath, 'utf8')
  const bottomPanelColumnsText = readFileSync(bottomPanelColumnsPath, 'utf8')
  const bottomPanelFieldAggregatesText = readFileSync(bottomPanelFieldAggregatesPath, 'utf8')

  if (
    !graphFieldsText.includes('const resolvedFieldSettingsCache = new Map<string, Map<GraphFieldId, GraphFieldSettingsResolved>>()')
    || !graphFieldsText.includes('export function getCachedResolvedFieldSettingsById(args: {')
    || !graphFieldsText.includes("'graph-fields-resolved-settings'")
  ) {
    throw new Error('expected graph-fields helper layer to centralize semantic caching for resolved field settings')
  }

  if (!graphFieldsListUtilsText.includes('return getCachedResolvedFieldSettingsById({ fields, settingsById })')) {
    throw new Error('expected graph-fields list utilities to reuse the shared resolved-settings cache helper')
  }

  if (
    !bottomPanelColumnsText.includes('const resolvedSettingsById = React.useMemo(')
    || !bottomPanelColumnsText.includes('getCachedResolvedFieldSettingsById({ fields: derivedGraphFields, settingsById: graphFieldSettingsById })')
    || bottomPanelColumnsText.includes('const settings = normalizeSettingsForField(field, graphFieldSettingsById[field.id])')
  ) {
    throw new Error('expected bottom-panel columns to reuse shared resolved field settings instead of normalizing per loop')
  }

  if (
    !bottomPanelFieldAggregatesText.includes('getCachedResolvedFieldSettingsById({ fields: derivedGraphFields, settingsById: graphFieldSettingsById, graphSemanticKey: sampleGraphSemanticKey })')
    || !bottomPanelFieldAggregatesText.includes('const settings = resolvedSettingsById.get(field.id)')
  ) {
    throw new Error('expected bottom-panel field aggregates to reuse shared resolved field settings')
  }
}
