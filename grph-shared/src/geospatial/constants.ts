export const GEOSPATIAL_MODE_CHANGED_EVENT = 'kg:geospatialModeChanged' as const

export const GEOSPATIAL_STYLE_URL_CHANGED_EVENT = 'kg:geospatialStyleUrlChanged' as const
export const GEOSPATIAL_POINT_STYLE_CHANGED_EVENT = 'kg:geospatialPointStyleChanged' as const

export const GEOSPATIAL_LS_KEYS = {
  geospatialOverlayEnabled: 'kg:ui:geospatial:overlayEnabled',
  geospatialViewMode: 'kg:ui:geospatial:viewMode',
  geospatialStyleUrl: 'kg:ui:geospatial:styleUrl',
  geospatialPointStyleConfig: 'kg:ui:geospatial:pointStyleConfig',
  geospatialOverlayOpacity: 'kg:ui:geospatial:overlayOpacity',
  geospatialInteractionMode: 'kg:ui:geospatial:interactionMode',
  geospatialProjectionMode: 'kg:ui:geospatial:projectionMode',
  geospatialAnimateCamera: 'kg:ui:geospatial:animateCamera',
  geospatialAutoFitEnabled: 'kg:ui:geospatial:autoFitEnabled',
  geospatialDatasets: 'kg:ui:geospatial:datasets',
  geospatialDatasetTimeoutMs: 'kg:ui:geospatial:datasetTimeoutMs',
  geospatialDatasetMaxBytes: 'kg:ui:geospatial:datasetMaxBytes',
  geospatialGraphPoiColor: 'kg:ui:geospatial:graphPoiColor',
  geospatialGraphPoiSelectedColor: 'kg:ui:geospatial:graphPoiSelectedColor',
  geospatialGraphEdgeColor: 'kg:ui:geospatial:graphEdgeColor',
  geospatialGraphEdgeSelectedColor: 'kg:ui:geospatial:graphEdgeSelectedColor',
  geospatialGlobeAutoRotate: 'kg:ui:geospatial:globeAutoRotate',
  geospatialGlobeAutoRotateSpeed: 'kg:ui:geospatial:globeAutoRotateSpeed',
  geospatialTraversalAirplaneEnabled: 'kg:ui:geospatial:traversalAirplaneEnabled',
  geospatialTraversalAirplaneSpeed: 'kg:ui:geospatial:traversalAirplaneSpeed',
  geospatialClusterEnabled: 'kg:ui:geospatial:clusterEnabled',
  geospatialClusterRadius: 'kg:ui:geospatial:clusterRadius',
  geospatialClusterMaxZoom: 'kg:ui:geospatial:clusterMaxZoom',
} as const
