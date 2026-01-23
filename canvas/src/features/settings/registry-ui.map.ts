import { useGraphStore } from '@/hooks/useGraphStore'
import type { SettingMeta } from './types'
import {
  DEFAULT_GEOSPATIAL_DATASET_MAX_BYTES,
  DEFAULT_GEOSPATIAL_DATASET_TIMEOUT_MS,
} from '@/lib/geospatial/config'

const s = () => useGraphStore.getState()

export const uiMapSettingsRegistry: SettingMeta[] = [
  {
    key: 'geospatial.datasetFetchTimeoutMs',
    type: 'number',
    source: 'store',
    read: () => s().geospatialDatasetTimeoutMs,
    write: (v) => s().setGeospatialDatasetTimeoutMs(Number(v)),
    default: () => DEFAULT_GEOSPATIAL_DATASET_TIMEOUT_MS,
  },
  {
    key: 'geospatial.datasetFetchMaxBytes',
    type: 'number',
    source: 'store',
    read: () => s().geospatialDatasetMaxBytes,
    write: (v) => s().setGeospatialDatasetMaxBytes(Number(v)),
    default: () => DEFAULT_GEOSPATIAL_DATASET_MAX_BYTES,
  },
]
