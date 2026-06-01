import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testMainPanelKtvRowsUseSharedEditableValueCell = () => {
  const root = process.cwd()
  const keyTypeValueRow = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'ui', 'KeyTypeValueRow.tsx'))
  const sharedKtvRows = readUtf8(path.resolve(root, '..', 'grph-shared', 'src', 'ui', 'keyTypeValueRows.ts'))
  const settingsEntryRow = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'views', 'SettingsEntryRow.tsx'))
  const settingsEntryInput = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'views', 'settingsEntryRow.input.tsx'))
  const settingsView = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'views', 'SettingsView.tsx'))
  const settingsUi = readUtf8(path.resolve(root, 'src', 'features', 'settings', 'ui.tsx'))

  if (!keyTypeValueRow.includes("from 'grph-shared/ui/keyTypeValueRows'")) {
    throw new Error('Expected KeyTypeValueRow to import the shared KTV row class contract')
  }
  for (const exportedClassName of [
    'KTV_ROW_TEXT_CELL_CLASS_NAME',
    'KTV_ROW_LABEL_CELL_CLASS_NAME',
    'KTV_ROW_VALUE_CELL_CLASS_NAME',
    'KTV_KEY_TYPE_VALUE_GRID_CLASS_NAME',
  ]) {
    if (!sharedKtvRows.includes(`export const ${exportedClassName}`)) {
      throw new Error(`Expected shared KTV rows module to export ${exportedClassName}`)
    }
  }
  const valueCellUses = keyTypeValueRow.match(/KTV_ROW_VALUE_CELL_CLASS_NAME/g)?.length ?? 0
  if (valueCellUses < 5) {
    throw new Error('Expected all KeyTypeValueRow layouts to reuse the shared value-cell class')
  }
  if (!keyTypeValueRow.includes('items-center overflow-hidden justify-start sm:justify-end')) {
    throw new Error('Expected RightAlignedValueCell to keep the same responsive value alignment')
  }

  if (!settingsEntryRow.includes('RightAlignedValueCell') || !settingsEntryRow.includes('valueNode={<RightAlignedValueCell>')) {
    throw new Error('Expected SettingsEntryRow values to use the shared KTV value cell')
  }
  if (!settingsView.includes('RightAlignedValueCell') || !settingsView.includes('<RightAlignedValueCell>')) {
    throw new Error('Expected the SettingsView Value header to share row value alignment')
  }

  for (const eventName of ['onPointerDown', 'onMouseDown', 'onClick', 'onKeyDown']) {
    if (!settingsEntryInput.includes(`${eventName}={stopSettingsValueEvent}`)) {
      throw new Error(`Expected Settings value editors to stop ${eventName} from toggling the row`)
    }
  }
  if (!settingsEntryInput.includes('justify-start sm:justify-end')) {
    throw new Error('Expected Settings value editors to share responsive value alignment')
  }

  if (!settingsUi.includes('normalizePanelValueInputClassName') || !settingsUi.includes('uiPanelKeyValueInputLeftClass')) {
    throw new Error('Expected settings inputs to derive visual variants from uiPanelKeyValueInputClass')
  }
  if (settingsUi.includes('className={`w-full h-6 px-2 text-sm border') || settingsUi.includes('className={`w-full min-w-0 max-w-full h-6 px-2 text-sm border')) {
    throw new Error('Expected settings input branches to avoid local KTV input class redefinitions')
  }

  const hubModes: Array<[string, string]> = [
    ['IntegrationsHubView.tsx', 'integrations'],
    ['McpHubView.tsx', 'mcp'],
    ['MapsHubView.tsx', 'maps'],
    ['CommerceHubView.tsx', 'payments'],
  ]
  for (const [fileName, mode] of hubModes) {
    const text = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'views', fileName))
    if (!text.includes('SettingsView') || !text.includes(`mode="${mode}"`)) {
      throw new Error(`Expected ${fileName} to inherit KTV rows through SettingsView mode=${mode}`)
    }
  }
}
