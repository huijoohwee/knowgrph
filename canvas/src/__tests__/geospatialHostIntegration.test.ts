import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testGeospatialOverlayHostNotGatedBySidebar = () => {
  const canvasPath = path.resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx')
  const text = readUtf8(canvasPath)
  if (text.includes("active={isSidebarOpen && sidePanelTab === 'geo'}")) {
    throw new Error('GeospatialOverlayHost must not be gated by SidePanel expand/collapse')
  }
  if (!text.includes('geospatialModeEnabled')) throw new Error('Expected geospatialModeEnabled state to exist')
  if (!text.includes('geospatialModeEnabled &&')) {
    throw new Error('Expected GeospatialOverlayHost to mount only when Geospatial Mode is enabled')
  }
}

export const testCanvasForbidsGraphWhenGeospatialEnabled = () => {
  const canvasPath = path.resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx')
  const text = readUtf8(canvasPath)

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
  if (!text.includes('kg:ui:geospatial:')) throw new Error('Expected namespaced kg:ui:geospatial keys')
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
