export type GeospatialDatasetFormat = 'auto' | 'geojson' | 'records'

export type GeospatialDatasetSourceUrl = Readonly<{
  kind: 'url'
  url: string
}>

export type GeospatialDataset = Readonly<{
  id: string
  label: string
  enabled: boolean
  source: GeospatialDatasetSourceUrl
  format: GeospatialDatasetFormat
}>

export type GeospatialDatasetStatus =
  | Readonly<{ state: 'idle' }>
  | Readonly<{ state: 'loading'; loadedBytes?: number; totalBytes?: number }>
  | Readonly<{ state: 'ready'; featureCount: number }>
  | Readonly<{ state: 'error'; message: string }>
