import fs from 'node:fs'
import path from 'node:path'

const readSource = (fileName: string): string => fs.readFileSync(
  path.resolve(process.cwd(), 'src', 'features', 'panels', 'views', fileName),
  'utf8',
)

export const testMainPanelSettingsSurfacesDocumentStorageSyncContract = () => {
  const settingsViewText = readSource('SettingsView.tsx')
  const rowsText = readSource('DocumentStorageSyncSettingsRows.tsx')
  if (!settingsViewText.includes("DOCUMENT_STORAGE_SYNC_SETTINGS_AREA = 'Document Storage & Sync'")
    || !settingsViewText.includes('<DocumentStorageSyncSettingsRows />')) {
    throw new Error('Expected MainPanel Settings to own and render Document Storage & Sync')
  }
  for (const token of [
    'GitHub/knowgrph/docs',
    'GitHub/huijoohwee/docs',
    'workspace-seeds: knowgrph/docs',
    'IndexedDB: active',
    'Queued outbox: retained',
    'Sync now',
  ]) {
    if (!rowsText.includes(token)) throw new Error(`Expected document storage settings to include ${JSON.stringify(token)}`)
  }
  if (!rowsText.includes("from 'grph-shared/react/keyTypeValueRow'")) {
    throw new Error('Expected document storage settings to reuse shared KTV rows')
  }
  if (rowsText.includes('apiKey') || rowsText.includes('GITHUB_TOKEN')) {
    throw new Error('Expected document storage settings to keep server-managed credentials out of browser UI')
  }
}
