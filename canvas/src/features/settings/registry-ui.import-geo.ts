import { useGraphStore } from '@/hooks/useGraphStore'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const uiImportGeoSettingsRegistry: SettingMeta[] = [
  {
    key: 'autoEnableGeospatialOnGeoImport',
    type: 'boolean',
    source: 'store',
    read: () => s().autoEnableGeospatialOnGeoImport,
    write: v => s().setAutoEnableGeospatialOnGeoImport(!!v),
    docKey: 'autoEnableGeospatialOnGeoImport',
    default: () => true,
  },
]

