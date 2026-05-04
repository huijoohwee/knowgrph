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
  const graphFieldsListPanelPath = resolve(
    process.cwd(),
    'src',
    'features',
    'panels',
    'views',
    'graph-fields',
    'GraphFieldsListPanel.tsx',
  )
  const fieldSettingsPanelPath = resolve(
    process.cwd(),
    'src',
    'features',
    'panels',
    'views',
    'graph-fields',
    'FieldSettingsPanel.tsx',
  )

  const graphFieldsText = readFileSync(graphFieldsPath, 'utf8')
  const graphFieldsListUtilsText = readFileSync(graphFieldsListUtilsPath, 'utf8')
  const graphFieldsListPanelText = readFileSync(graphFieldsListPanelPath, 'utf8')
  const fieldSettingsPanelText = readFileSync(fieldSettingsPanelPath, 'utf8')

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
    !graphFieldsListPanelText.includes('const current = resolvedSettingsById.get(fieldId)')
    || graphFieldsListPanelText.includes('const current = normalizeSettingsForField(field, settingsById[fieldId])')
  ) {
    throw new Error('expected graph-fields list panel to reuse shared resolved field settings when patching field settings')
  }

  if (
    !fieldSettingsPanelText.includes('getCachedResolvedFieldSettingsById({')
    || !fieldSettingsPanelText.includes('return selectedFieldResolvedSettingsById?.get(selectedField.id) || null')
    || fieldSettingsPanelText.includes('return normalizeSettingsForField(selectedField, settingsById[selectedField.id])')
  ) {
    throw new Error('expected field settings panel to reuse shared resolved field settings for the selected field')
  }
}
