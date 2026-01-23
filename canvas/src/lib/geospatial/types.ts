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
  | Readonly<{ state: 'loading' }>
  | Readonly<{ state: 'ready'; featureCount: number }>
  | Readonly<{ state: 'error'; message: string }>

export type GeospatialOverlaySettings = Readonly<{
  styleUrl: string
  overlayOpacity: number
  datasets: GeospatialDataset[]
}>

