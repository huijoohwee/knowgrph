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
  const configPath = path.resolve(process.cwd(), '..', '..', 'gympgrph', 'src', 'lib', 'config.ts')
  const text = readUtf8(configPath)
  if (text.includes("'ui:geospatial:") || text.includes('"ui:geospatial:')) {
    throw new Error('Legacy ui:geospatial keys must not exist (collision risk)')
  }
  if (text.includes('LS_KEYS_LEGACY')) throw new Error('Legacy key map must not exist (collision risk)')
  if (!text.includes('kg:ui:geospatial:') && !text.includes('grph-shared/geospatial/constants')) {
    throw new Error('Expected namespaced kg:ui:geospatial keys (direct) or shared GEOSPATIAL_LS_KEYS import')
  }
  if (!text.includes('geospatialViewMode')) throw new Error('Expected persisted geospatialViewMode key to exist')
}

export const testGympgrphDefaultViewModeIs2d = () => {
  const slicePath = path.resolve(process.cwd(), '..', '..', 'gympgrph', 'src', 'hooks', 'store', 'geospatialSlice.ts')
  const text = readUtf8(slicePath)
  if (!text.includes('LS_KEYS.geospatialViewMode')) {
    throw new Error('Expected geospatialViewMode persistence key usage')
  }
  if (!text.includes("'2d'")) {
    throw new Error("Expected geospatialViewMode default to include '2d'")
  }
}

export const testGeospatialOverlayHostSupportsCesiumRenderer = () => {
  const hostPath = path.resolve(process.cwd(), '..', '..', 'gympgrph', 'src', 'GeospatialHost.tsx')
  const text = readUtf8(hostPath)
  if (!text.includes('CesiumOverlayLazy')) throw new Error('Expected CesiumOverlay host lazy import')
  if (!text.includes('geospatialViewMode')) throw new Error('Expected host to read geospatialViewMode')
}

export const testGympgrphDefaultInteractionModeIsAlways = () => {
  const slicePath = path.resolve(process.cwd(), '..', '..', 'gympgrph', 'src', 'hooks', 'store', 'geospatialSlice.ts')
  const text = readUtf8(slicePath)
  if (!text.includes("LS_KEYS.geospatialInteractionMode")) throw new Error('Expected geospatialInteractionMode persistence key usage')
  if (!text.includes("'always'")) throw new Error('Expected default interaction mode to include always')
}

export const testHoldSpaceKeyHandlingPreventsScrollAndIgnoresInputs = () => {
  const heldKeyPath = path.resolve(process.cwd(), '..', '..', 'gympgrph', 'src', 'features', 'geospatial', 'useHeldKey.ts')
  const text = readUtf8(heldKeyPath)
  if (!text.includes('preventDefault')) throw new Error('Expected Space hold to preventDefault to avoid page scroll')
  if (!text.includes('closest(')) throw new Error('Expected hold-space logic to ignore input/textarea/select/contenteditable')
}

export const testHostEnableForcesAlwaysInteractionMode = () => {
  const hostBridgePath = path.resolve(process.cwd(), '..', '..', 'gympgrph', 'src', 'hostBridge.ts')
  const text = readUtf8(hostBridgePath)
  if (!text.includes("s.setGeospatialInteractionMode('always')")) {
    throw new Error('Expected enabling Geospatial Mode to force interactionMode=always for immediate navigation')
  }
}

export const testHostTailwindScansGympgrphClasses = () => {
  const tailwindConfigPath = path.resolve(process.cwd(), 'tailwind.config.js')
  const text = readUtf8(tailwindConfigPath)
  if (!text.includes('../../gympgrph/src/**/*.{js,ts,jsx,tsx}')) {
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
  if (!toolbarText.includes('onGeospatialModeChanged')) {
    throw new Error('Expected Toolbar to subscribe via onGeospatialModeChanged helper')
  }
  if (toolbarText.includes('addEventListener(GEOSPATIAL_MODE_CHANGED_EVENT')) {
    throw new Error('Toolbar must not attach raw GEOSPATIAL_MODE_CHANGED_EVENT listener (use helper)')
  }

  const slicePath = path.resolve(process.cwd(), '..', '..', 'gympgrph', 'src', 'hooks', 'store', 'geospatialSlice.ts')
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

export const testGympgrphCesiumOverlayAutoFitsToGeoBounds = () => {
  const overlayPath = path.resolve(process.cwd(), '..', '..', 'gympgrph', 'src', 'features', 'geospatial', 'CesiumOverlay.tsx')
  const text = readUtf8(overlayPath)
  if (!text.includes('autoFitEnabled')) throw new Error('Expected CesiumOverlay to reference autoFitEnabled')
  if (!text.includes('computeBoundsFromCollections')) throw new Error('Expected CesiumOverlay to compute bounds for auto-fit')
  if (!text.includes('viewer.camera.flyTo')) throw new Error('Expected CesiumOverlay to fly camera to computed bounds')
  if (!text.includes('Rectangle.fromDegrees')) throw new Error('Expected CesiumOverlay to convert bounds using Rectangle.fromDegrees')
}

export const testGympgrphMapLibreLoggerSuppressesAbortNoise = () => {
  const hookPath = path.resolve(process.cwd(), '..', '..', 'gympgrph', 'src', 'features', 'geospatial', 'useMapLibreBasemap.ts')
  const text = readUtf8(hookPath)
  if (!text.includes('setLogger')) throw new Error('Expected MapLibre logger override to be installed')
  if (!text.includes('/__fetch_remote')) throw new Error('Expected logger to filter /__fetch_remote abort noise')
  if (!text.toLowerCase().includes('err_aborted') && !text.toLowerCase().includes('aborterror')) {
    throw new Error('Expected logger to match aborted request errors')
  }
}
