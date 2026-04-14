import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testGeospatialOverlayHostNotGatedBySidebar = () => {
  const canvasPath = path.resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx')
  const text = readUtf8(canvasPath)
  const viewportPath = path.resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx')
  const viewportText = readUtf8(viewportPath)
  if (text.includes("active={isSidebarOpen && sidePanelTab === 'geo'}")) {
    throw new Error('GeospatialOverlayHost must not be gated by SidePanel expand/collapse')
  }
  if (!text.includes('geospatialModeEnabled')) throw new Error('Expected geospatialModeEnabled state to exist')
  if (!(text.includes('geospatialModeEnabled &&') || viewportText.includes('geospatialModeEnabled &&'))) {
    throw new Error('Expected GeospatialOverlayHost to mount only when Geospatial Mode is enabled')
  }
}

export const testCanvasForbidsGraphWhenGeospatialEnabled = () => {
  const viewportPath = path.resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx')
  const text = readUtf8(viewportPath)

  if (!text.includes('!geospatialModeEnabled && canvasRenderMode === \'2d\'')) {
    throw new Error('Expected 2D canvas to be gated off while Geospatial Mode is enabled')
  }
  if (!text.includes('!geospatialModeEnabled && canvasRenderMode === \'3d\'')) {
    throw new Error('Expected 3D canvas to be gated off while Geospatial Mode is enabled')
  }
  if (!(text.includes('!geospatialModeEnabled') && text.includes('<MinimapLazy />'))) {
    throw new Error('Expected minimap overlay to be gated by Geospatial Mode')
  }
}

export const testGympgrphGeospatialKeysAreNamespacedOnly = () => {
  const configPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'lib', 'config.ts')
  const text = readUtf8(configPath)
  if (text.includes("'ui:geospatial:") || text.includes('"ui:geospatial:')) {
    throw new Error('Legacy ui:geospatial keys must not exist (collision risk)')
  }
  if (text.includes('LS_KEYS_LEGACY')) throw new Error('Legacy key map must not exist (collision risk)')
  if (!text.includes('kg:ui:geospatial:') && !text.includes('grph-shared/geospatial/constants')) {
    throw new Error('Expected namespaced kg:ui:geospatial keys (direct) or shared GEOSPATIAL_LS_KEYS import')
  }
  if (!(text.includes('geospatialViewMode') || text.includes('GEOSPATIAL_LS_KEYS'))) {
    throw new Error('Expected persisted geospatialViewMode key to exist via direct key or shared key map alias')
  }
}

export const testGympgrphDefaultViewModeIs2d = () => {
  const slicePath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'hooks', 'store', 'geospatialSlice.ts')
  const text = readUtf8(slicePath)
  if (!text.includes('LS_KEYS.geospatialViewMode')) {
    throw new Error('Expected geospatialViewMode persistence key usage')
  }
  if (!text.includes("'2d'")) {
    throw new Error("Expected geospatialViewMode default to include '2d'")
  }
}

export const testGeospatialOverlayHostSupportsMapLibreGlobeRenderer = () => {
  const hostPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'GeospatialHost.tsx')
  const text = readUtf8(hostPath)
  if (!text.includes('useMapLibreBasemap')) throw new Error('Expected GeospatialOverlayHost to use MapLibre basemap hook')
  if (!text.includes('basemap3d')) throw new Error('Expected GeospatialOverlayHost to create dedicated 3D basemap instance')
  if (!text.includes("projectionMode: 'mercator'")) throw new Error('Expected GeospatialOverlayHost 3D view to use stable MapLibre mercator projection')
  if (!text.includes('geospatialViewMode')) throw new Error('Expected host to read geospatialViewMode')
}

export const testGeospatialOverlayHostProvidesSvgFallbackBasemapAndDisablesDefaultMapLibreRuntime = () => {
  const hostPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'GeospatialHost.tsx')
  const text = readUtf8(hostPath)
  if (!text.includes('function SvgGeospatialFallback')) {
    throw new Error('Expected GeospatialOverlayHost to provide a built-in SVG fallback basemap surface')
  }
  if (!text.includes('const mapLibreRuntimeEnabled = false')) {
    throw new Error('Expected GeospatialOverlayHost default runtime path to disable MapLibre basemap mounting')
  }
  if (!text.includes('<SvgGeospatialFallback')) {
    throw new Error('Expected GeospatialOverlayHost to render the SVG fallback basemap')
  }
}

export const testGeospatialOverlayHostSvgFallbackRendersHighFidelitySvgBasemap = () => {
  const hostPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'GeospatialHost.tsx')
  const text = readUtf8(hostPath)
  if (!text.includes('HIGH_FIDELITY_WORLD_SVG_URL')) {
    throw new Error('Expected GeospatialOverlayHost SVG fallback to reference a local high-fidelity SVG basemap asset')
  }
  if (!text.includes('simple-world-map-edit.svg')) {
    throw new Error('Expected GeospatialOverlayHost SVG fallback to use the vendored world SVG asset')
  }
  if (!text.includes('<image')) {
    throw new Error('Expected GeospatialOverlayHost SVG fallback to place the SVG basemap image into the fallback surface')
  }
}

export const testGeospatialOverlayHostSvgFallbackAppliesMaplikeVisualPolish = () => {
  const hostPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'GeospatialHost.tsx')
  const text = readUtf8(hostPath)
  const requiredSnippets = [
    'kg-geo-fallback-ocean-sheen',
    'kg-geo-fallback-frame-stroke',
    'kg-geo-fallback-map-filter',
    'kg-geo-fallback-point-shadow',
    'rgba(59,130,246,0.92)',
    'rgba(245,158,11,0.98)',
  ]
  const missing = requiredSnippets.filter(snippet => !text.includes(snippet))
  if (missing.length) {
    throw new Error(`Expected GeospatialOverlayHost SVG fallback to include refined MapLibre-like styling: ${missing.join(', ')}`)
  }
}

export const testGeospatialOverlayHostAvoidsClusteredGeoJsonOnGlobeRenderer = () => {
  const hostPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'GeospatialHost.tsx')
  const text = readUtf8(hostPath)
  if (!text.includes("viewMode === 'map2d' && isPointOnlyFeatureCollection")) {
    throw new Error('Expected GeospatialOverlayHost to restrict GeoJSON clustering to 2D MapLibre mode')
  }
}

export const testGeospatialOverlayHostSkipsGraphGeoJsonProjectionIn3d = () => {
  const hostPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'GeospatialHost.tsx')
  const text = readUtf8(hostPath)
  if (!text.includes("if (viewMode === 'map3d')")) {
    throw new Error('Expected GeospatialOverlayHost to short-circuit graph GeoJSON projection in 3D mode')
  }
  if (!text.includes("graphDataAppliedRef.current[viewMode] = ''")) {
    throw new Error('Expected GeospatialOverlayHost to reset applied graph source state when 3D projection is skipped')
  }
}

export const testGeospatialOverlayHostProjectsSnapshotGraphDataToMapLayer = () => {
  const hostPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'GeospatialHost.tsx')
  const text = readUtf8(hostPath)
  if (!text.includes('getSnapshotGraphData')) {
    throw new Error('Expected host to read snapshot.graphData')
  }
  if (!text.includes('buildFeatureCollectionFromGraphData')) {
    throw new Error('Expected host to project graph nodes into FeatureCollection')
  }
  if (!text.includes("['geo']") || !text.includes("['lat']") || !text.includes("['lng']")) {
    throw new Error('Expected host graph projection to read node.properties.geo.lat/lng')
  }
  if (!text.includes('ensureDatasetLayer') || !text.includes('setGeoJsonSourceData')) {
    throw new Error('Expected host to publish projected graph features into MapLibre source/layer')
  }
}

export const testGeospatialOverlayHostClearsStaleDataAndSeparatesClusterSources = () => {
  const hostPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'GeospatialHost.tsx')
  const text = readUtf8(hostPath)
  if (!text.includes('clearGeoJsonSourceData')) {
    throw new Error('Expected host to clear stale GeoJSON source data during rapid graph switches')
  }
  if (!text.includes('graphSourceIdClustered') || !text.includes('graphSourceIdUnclustered')) {
    throw new Error('Expected host to separate clustered and unclustered source IDs to avoid stale layer/source mode mismatch')
  }
  if (!text.includes('featureCount <= 0') || !text.includes("graphDataAppliedRef.current[viewMode] = ''")) {
    throw new Error('Expected host to reset source state when active graph has no geospatial features')
  }
}

export const testSourceFilesPersistenceUsesContentHashNotLengthOnly = () => {
  const persistencePath = path.resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx')
  const text = readUtf8(persistencePath)
  if (!text.includes('hashStringToHex')) {
    throw new Error('Expected source-files persistence comparator to use text hashing')
  }
  if (text.includes("String(x?.text || '').length !== String(y?.text || '').length")) {
    throw new Error('Source-files persistence must not compare by text length only')
  }
}

export const testGeospatialPanelHostIsNotEmpty = () => {
  const hostPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'GeospatialPanelHost.tsx')
  const text = readUtf8(hostPath)
  if (!text.includes('Basemap style URL')) throw new Error('Expected GeospatialPanelHost to render basemap style controls')
  if (!text.includes('Fit to data')) throw new Error('Expected GeospatialPanelHost to render fit controls')
}

export const testGympgrphDefaultInteractionModeIsAlways = () => {
  const slicePath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'hooks', 'store', 'geospatialSlice.ts')
  const text = readUtf8(slicePath)
  if (!text.includes("LS_KEYS.geospatialInteractionMode")) throw new Error('Expected geospatialInteractionMode persistence key usage')
  if (!text.includes("'always'")) throw new Error('Expected default interaction mode to include always')
}

export const testHoldSpaceKeyHandlingPreventsScrollAndIgnoresInputs = () => {
  const heldKeyPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'features', 'geospatial', 'useHeldKey.ts')
  const text = readUtf8(heldKeyPath)
  if (!text.includes('preventDefault')) throw new Error('Expected Space hold to preventDefault to avoid page scroll')
  if (!(text.includes('closest(') || text.includes('closest?.('))) {
    throw new Error('Expected hold-space logic to ignore input/textarea/select/contenteditable')
  }
}

export const testHostEnableForcesAlwaysInteractionMode = () => {
  const hostBridgePath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'hostBridge.ts')
  const text = readUtf8(hostBridgePath)
  if (!text.includes("s.setGeospatialInteractionMode('always')")) {
    throw new Error('Expected enabling Geospatial Mode to force interactionMode=always for immediate navigation')
  }
}

export const testHostTailwindScansGympgrphClasses = () => {
  const tailwindConfigPath = path.resolve(process.cwd(), 'tailwind.config.js')
  const text = readUtf8(tailwindConfigPath)
  if (!text.includes('../gympgrph/src/**/*.{js,ts,jsx,tsx}')) {
    throw new Error('Expected knowgrph host Tailwind config to scan gympgrph sources for class generation')
  }
}

export const testGeospatialModeEventContractIsShared = () => {
  const hostEventsPath = path.resolve(process.cwd(), 'src', 'features', 'geospatial', 'events.ts')
  const hostEventsText = readUtf8(hostEventsPath)
  if (!hostEventsText.includes("from 'grph-shared/geospatial/events'")) {
    throw new Error('Expected host geospatial events to re-export from grph-shared/geospatial/events')
  }
  if (hostEventsText.includes('export type GeospatialModeChangedDetail')) {
    throw new Error('Host must not redefine GeospatialModeChangedDetail (cross-repo drift risk)')
  }

  const canvasPath = path.resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx')
  const canvasText = readUtf8(canvasPath)
  if (!canvasText.includes('onGeospatialModeChanged')) {
    throw new Error('Expected Canvas to subscribe via onGeospatialModeChanged helper')
  }
  if (canvasText.includes('addEventListener(GEOSPATIAL_MODE_CHANGED_EVENT')) {
    throw new Error('Canvas must not attach raw GEOSPATIAL_MODE_CHANGED_EVENT listener (use helper)')
  }

  const toolbarPath = path.resolve(process.cwd(), 'src', 'components', 'Toolbar.tsx')
  const toolbarText = readUtf8(toolbarPath)
  const toolbarContextPath = path.resolve(process.cwd(), 'src', 'components', 'toolbar', 'useCanvasToolbarContext.ts')
  const toolbarContextText = readUtf8(toolbarContextPath)
  if (!(toolbarText.includes('onGeospatialModeChanged') || toolbarContextText.includes('onGeospatialModeChanged'))) {
    throw new Error('Expected Toolbar or delegated toolbar context to subscribe via onGeospatialModeChanged helper')
  }
  if (
    toolbarText.includes('addEventListener(GEOSPATIAL_MODE_CHANGED_EVENT') ||
    toolbarContextText.includes('addEventListener(GEOSPATIAL_MODE_CHANGED_EVENT')
  ) {
    throw new Error('Toolbar integration must not attach raw GEOSPATIAL_MODE_CHANGED_EVENT listener (use helper)')
  }

  const slicePath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'hooks', 'store', 'geospatialSlice.ts')
  const sliceText = readUtf8(slicePath)
  if (!sliceText.includes("emitGeospatialModeChanged({")) {
    throw new Error('Expected gympgrph geospatialSlice to emit via emitGeospatialModeChanged helper')
  }
  if (sliceText.includes('new CustomEvent(UI_EVENTS.geospatialModeChanged')) {
    throw new Error('gympgrph must not emit raw UI_EVENTS.geospatialModeChanged CustomEvent (drift risk)')
  }
}

export const testRemoteFetchProxyDoesNotAbortOnCloseOrTruncate = () => {
  const vitePath = path.resolve(process.cwd(), 'vite.config.ts')
  const text = readUtf8(vitePath)
  if (!text.includes('function createRemoteFetchHandler')) {
    throw new Error('Expected vite.config.ts to include createRemoteFetchHandler for /__fetch_remote')
  }
  if (text.includes("res.on('close'") || text.includes('res.on("close"')) {
    throw new Error('Remote fetch proxy must not abort upstream fetch on response close events')
  }
  if (text.includes("req.on('close'") || text.includes('req.on("close"')) {
    throw new Error('Remote fetch proxy must not abort upstream fetch on request close events')
  }
  if (!text.includes("res.setHeader('Content-Length', String(buf.byteLength))")) {
    throw new Error('Expected remote fetch proxy to set Content-Length from full buffered body')
  }
}

export const testGympgrphMapLibreBasemapSupportsGlobeProjection = () => {
  const hookPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'features', 'geospatial', 'useMapLibreBasemap.ts')
  const text = readUtf8(hookPath)
  if (!text.includes("projectionMode: 'mercator' | 'globe'")) throw new Error('Expected basemap hook to support mercator and globe projection modes')
  if (!text.includes("map.setProjection?.({ type: 'globe' })")) throw new Error('Expected basemap hook to set globe projection in 3D mode')
  if (!text.includes("canvasRenderMode === '3d'")) throw new Error('Expected basemap hook to apply 3D camera defaults')
}

export const testGympgrphMapLibreBasemapBlankDefaultStaysOffForSvgFallback = () => {
  const hookPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'features', 'geospatial', 'useMapLibreBasemap.ts')
  const text = readUtf8(hookPath)
  if (!text.includes("if (!trimmed) return null")) {
    throw new Error('Expected empty basemap style URL to stay off so the SVG fallback remains authoritative')
  }
  if (!text.includes("if (trimmed === SAFE_SVG_FALLBACK_STYLE_SENTINEL) return null")) {
    throw new Error('Expected SVG fallback basemap sentinel to keep MapLibre disabled')
  }
  if (!text.includes("tiles.openfreemap.org/styles/liberty")) {
    throw new Error('Expected hook to classify the previous OpenFreeMap Liberty default path as non-default')
  }
  const helperPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'features', 'geospatial', 'basemapStyle.ts')
  const helperText = readUtf8(helperPath)
  if (!helperText.includes("SAFE_SVG_FALLBACK_STYLE_SENTINEL = 'kg:style:svg-fallback'")) {
    throw new Error('Expected basemap style helper to expose an SVG fallback sentinel')
  }
}

export const testGympgrphGeospatialStyleStorageNormalizesUnsafeRemoteStyles = () => {
  const helperPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'features', 'geospatial', 'basemapStyle.ts')
  const helperText = readUtf8(helperPath)
  if (!helperText.includes('normalizePersistedGeospatialStyleUrl')) {
    throw new Error('Expected a shared geospatial basemap style normalization helper')
  }
  if (!helperText.includes("if (lower.startsWith('http://') || lower.startsWith('https://')) return ''")) {
    throw new Error('Expected persisted remote style URLs to normalize back to the safe default path')
  }

  const hostPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'GeospatialHost.tsx')
  const hostText = readUtf8(hostPath)
  if (!hostText.includes('normalizePersistedGeospatialStyleUrl(raw)')) {
    throw new Error('Expected GeospatialHost to normalize persisted style URLs when reading runtime basemap state')
  }
}

export const testGympgrphMapLibreBasemapFallsBackFromUnsafeGlobeRuntimeErrors = () => {
  const hookPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'features', 'geospatial', 'useMapLibreBasemap.ts')
  const text = readUtf8(hookPath)
  if (!text.includes('isKnownUnsafeGlobeRuntimeError')) {
    throw new Error('Expected basemap hook to classify known unsafe globe runtime errors')
  }
  if (!text.includes("setRuntimeProjectionMode('mercator')")) {
    throw new Error('Expected basemap hook to fall back from globe to mercator on known unsafe runtime errors')
  }
}

export const testGympgrphMapLibreLoggerSuppressesAbortNoise = () => {
  const hookPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'features', 'geospatial', 'useMapLibreBasemap.ts')
  const text = readUtf8(hookPath)
  if (!text.includes('setLogger')) throw new Error('Expected MapLibre logger override to be installed')
  if (!text.includes('/__fetch_remote')) throw new Error('Expected logger to filter /__fetch_remote abort noise')
  if (!text.toLowerCase().includes('err_aborted') && !text.toLowerCase().includes('aborterror')) {
    throw new Error('Expected logger to match aborted request errors')
  }
}

export const testGympgrphFitToSelectionRequestExists = () => {
  const fitPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'geospatialFit.ts')
  const fitText = readUtf8(fitPath)
  if (!fitText.includes('requestGeospatialFitToSelection')) {
    throw new Error('Expected gympgrph to export requestGeospatialFitToSelection')
  }
  if (!fitText.includes('store.requestGeospatialFitToSelection')) {
    throw new Error('Expected requestGeospatialFitToSelection to delegate to store.requestGeospatialFitToSelection')
  }
  const typesPath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'hooks', 'store', 'types.ts')
  const typesText = readUtf8(typesPath)
  if (!typesText.includes("mode: 'data' | 'selection'")) {
    throw new Error("Expected geospatial fit request mode to include 'selection'")
  }
  const slicePath = path.resolve(process.cwd(), '..', 'gympgrph', 'src', 'hooks', 'store', 'geospatialSlice.ts')
  const sliceText = readUtf8(slicePath)
  if (!sliceText.includes("mode: 'selection'")) {
    throw new Error("Expected geospatialSlice requestGeospatialFitToSelection to set mode: 'selection'")
  }
}

export const testHostGeoZoomToSelectionCallsGympgrphSelectionFit = () => {
  const viewportPath = path.resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx')
  const viewportText = readUtf8(viewportPath)
  if (!viewportText.includes('requestGeospatialFitToSelection')) {
    throw new Error('Expected host CanvasViewport to call requestGeospatialFitToSelection when zoomToSelectionMode changes')
  }
  if (!viewportText.includes('setGeospatialAutoFitEnabled')) {
    throw new Error('Expected host CanvasViewport to sync Fit-to-Screen to setGeospatialAutoFitEnabled')
  }
}

export const testZIndexSsotIsUsedForToastsAndFloatingPanels = () => {
  const zPath = path.resolve(process.cwd(), 'src', 'lib', 'ui', 'zIndex.ts')
  const zText = readUtf8(zPath)
  if (!zText.includes('Z_INDEX_FLOATING_PANEL_DEFAULT')) throw new Error('Expected Z_INDEX_FLOATING_PANEL_DEFAULT to exist')
  if (!zText.includes('Z_INDEX_TOAST')) throw new Error('Expected Z_INDEX_TOAST to exist')
  const toastPath = path.resolve(process.cwd(), 'src', 'components', 'ui', 'ToastHost.tsx')
  const toastText = readUtf8(toastPath)
  if (toastText.includes('z-[2500]') || toastText.includes('z-[5000]')) {
    throw new Error('ToastHost must not hardcode z-index classes (use zIndex SSOT)')
  }
  if (!toastText.includes('Z_INDEX_TOAST')) throw new Error('Expected ToastHost to use Z_INDEX_TOAST')
  const slicePath = path.resolve(process.cwd(), 'src', 'hooks', 'store', 'panelLayoutUiSlice.ts')
  const sliceText = readUtf8(slicePath)
  if (sliceText.includes('floatingPanelZIndex, 5000')) {
    throw new Error('Expected floatingPanelZIndex default to use SSOT constant, not hardcoded 5000')
  }
}
