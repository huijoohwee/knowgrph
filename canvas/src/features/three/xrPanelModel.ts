export type XrPanelSourceKind = 'graph-scene' | 'model-asset' | 'spatial-capture'
export type XrPanelSourceFormat = 'graph' | 'glb' | 'gltf' | 'ply' | 'spz' | 'unknown'
export type XrPanelCapabilityState = 'active' | 'available' | 'fallback' | 'inline-only' | 'source-ready' | 'unavailable'

export type XrBrowserGraphicsCapabilities = {
  webgl: boolean
  webgl2: boolean
  webgpu: boolean
  webxr: boolean
}

export type XrPanelSourceProfile = {
  kind: XrPanelSourceKind
  format: XrPanelSourceFormat
  label: string
  renderPath: string
  ingestionCacheKey: string
  renderCacheKey: string
  isSpatialCapture: boolean
  isModelAsset: boolean
}

export type XrPanelRuntimeStackItem = {
  id: 'webgl' | 'webgpu' | 'webxr' | 'gltf' | 'ply'
  label: string
  state: XrPanelCapabilityState
  value: string
}

export const XR_BROWSER_GRAPHICS_CAPABILITY_DEFAULTS: XrBrowserGraphicsCapabilities = {
  webgl: false,
  webgl2: false,
  webgpu: false,
  webxr: false,
}

function readFrontmatterString(text: string, key: string): string {
  const match = text.match(new RegExp(`^\\s*${key}\\s*:\\s*['"]?([^'"\\n#]+)`, 'im'))
  return String(match?.[1] || '').trim().toLowerCase()
}

export function resolveXrPanelSourceProfile(text: string): XrPanelSourceProfile {
  const spatialFormat = readFrontmatterString(text, 'kgSpatialCaptureFormat')
  const assetFormat = readFrontmatterString(text, 'kgAssetFormat')
  const mimeType = readFrontmatterString(text, 'kgAssetMimeType')
  const ingestionCacheKey = readFrontmatterString(text, 'kgXrIngestionCacheKey')
  const renderCacheKey = readFrontmatterString(text, 'kgXrRenderCacheKey') || ingestionCacheKey
  const isPly = spatialFormat === 'ply' || assetFormat === 'ply' || mimeType.includes('ply')
  const isSpz = spatialFormat === 'spz' || assetFormat === 'spz' || mimeType.includes('spz')
  const isGlb = assetFormat === 'glb' || mimeType.includes('model/gltf-binary')
  const isGltf = assetFormat === 'gltf' || mimeType.includes('model/gltf+json')
  if (isPly || isSpz || spatialFormat) {
    return {
      kind: 'spatial-capture',
      format: isPly ? 'ply' : isSpz ? 'spz' : 'unknown',
      label: isPly ? 'PLY capture' : isSpz ? 'SPZ capture' : 'Spatial capture',
      renderPath: 'source manifest',
      ingestionCacheKey,
      renderCacheKey,
      isSpatialCapture: true,
      isModelAsset: false,
    }
  }
  if (isGlb || isGltf || assetFormat) {
    return {
      kind: 'model-asset',
      format: isGlb ? 'glb' : isGltf ? 'gltf' : 'unknown',
      label: isGlb ? 'GLB model' : isGltf ? 'glTF model' : 'Model asset',
      renderPath: 'asset manifest',
      ingestionCacheKey,
      renderCacheKey,
      isSpatialCapture: false,
      isModelAsset: true,
    }
  }
  return {
    kind: 'graph-scene',
    format: 'graph',
    label: 'Graph scene',
    renderPath: 'active graph',
    ingestionCacheKey,
    renderCacheKey,
    isSpatialCapture: false,
    isModelAsset: false,
  }
}

export function resolveXrPanelRuntimeStack(args: {
  capabilities: XrBrowserGraphicsCapabilities
  profile: XrPanelSourceProfile
  xrActive: boolean
}): XrPanelRuntimeStackItem[] {
  const { capabilities, profile, xrActive } = args
  return [
    {
      id: 'webgl',
      label: 'WebGL',
      state: capabilities.webgl2 ? 'available' : capabilities.webgl ? 'fallback' : 'unavailable',
      value: capabilities.webgl2 ? 'WebGL2' : capabilities.webgl ? 'WebGL' : 'Unavailable',
    },
    {
      id: 'webgpu',
      label: 'WebGPU',
      state: capabilities.webgpu ? 'available' : 'fallback',
      value: capabilities.webgpu ? 'Available' : 'Optional',
    },
    {
      id: 'webxr',
      label: 'WebXR',
      state: xrActive ? 'active' : capabilities.webxr ? 'available' : 'inline-only',
      value: xrActive ? 'Active' : capabilities.webxr ? 'Available' : 'Inline',
    },
    {
      id: 'gltf',
      label: 'glTF',
      state: profile.format === 'glb' || profile.format === 'gltf' ? 'source-ready' : 'available',
      value: profile.format === 'glb' || profile.format === 'gltf' ? profile.label : 'Ready',
    },
    {
      id: 'ply',
      label: 'PLY',
      state: profile.format === 'ply' ? 'source-ready' : 'available',
      value: profile.format === 'ply' ? 'Source' : 'Optional',
    },
  ]
}

export function readBrowserXrGraphicsCapabilities(): XrBrowserGraphicsCapabilities {
  const nav = typeof navigator !== 'undefined' ? navigator as Navigator & { gpu?: unknown; xr?: unknown } : null
  let webgl = false
  let webgl2 = false
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas')
      const gl2 = canvas.getContext('webgl2')
      const gl1 = canvas.getContext('webgl') || (canvas.getContext('experimental-webgl' as never) as unknown as WebGLRenderingContext | null)
      const gl = gl2 || gl1
      webgl2 = !!gl2
      webgl = !!gl
      const loseContext = gl?.getExtension?.('WEBGL_lose_context')
      loseContext?.loseContext?.()
    } catch {
      webgl = false
      webgl2 = false
    }
  }
  return {
    webgl,
    webgl2,
    webgpu: !!nav?.gpu,
    webxr: !!nav?.xr,
  }
}
