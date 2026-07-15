import { serializeMarkdownPipeTable } from '@/features/markdown/ui/markdownDataViewSerialize'
import { settingsRegistry } from '../features/settings/registry'
import type { SettingMeta } from '../features/settings/types'
import { LS_KEYS, LS_KEY_OWNERS, type LsKeyId, type LsStorageKey, type LsKeyOwner } from '../lib/config'

type SettingsMarkdownRecord = {
  key: string
  type: SettingMeta['type']
  source: SettingMeta['source']
  docKey: string | undefined
  storageKey: LsStorageKey | null
  owner: LsKeyOwner | null
}

export function getSettingsMarkdownRecords(): SettingsMarkdownRecord[] {
  return settingsRegistry.map(meta => {
    const docKey = meta.docKey
    const storageKey =
      docKey && Object.prototype.hasOwnProperty.call(LS_KEYS, docKey)
        ? (LS_KEYS as Record<string, LsStorageKey>)[docKey as LsKeyId]
        : null
    const owner =
      docKey && storageKey && Object.prototype.hasOwnProperty.call(LS_KEY_OWNERS, docKey)
        ? ((LS_KEY_OWNERS as Record<string, LsKeyOwner>)[docKey as LsKeyId] as LsKeyOwner)
        : null
    return {
      key: meta.key,
      type: meta.type,
      source: meta.source,
      docKey,
      storageKey: storageKey ?? null,
      owner,
    }
  })
}

export function getSettingsMarkdownTable(): string {
  const records = getSettingsMarkdownRecords()
  const rows = records.map(record => {
    const lsKeyRaw = record.storageKey ?? ''
    const ownerRaw = record.owner ?? ''
    return [
      `\`${record.key}\``,
      record.type,
      record.source,
      lsKeyRaw ? `\`${lsKeyRaw}\`` : '',
      ownerRaw ? `\`${ownerRaw}\`` : '',
    ]
  })
  return serializeMarkdownPipeTable({
    columns: ['Setting key', 'Type', 'Source', 'LS key (if any)', 'Owner'],
    rows,
  }).join('\n')
}

function main() {
  const table = getSettingsMarkdownTable()
  process.stdout.write(`${table}\n`)
}

main()
