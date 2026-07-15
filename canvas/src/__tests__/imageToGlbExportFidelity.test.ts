import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildImageToGlbExporterOptions } from '@/features/image-to-glb/imageToGlbRuntimeExport'
import {
  applyImageToGlbPreviewCameraPlacement,
  computeImageToGlbPreviewCamera,
} from '@/features/image-to-glb/imageToGlbPreviewCamera'
import type { GlbFit } from '@/lib/three/GlbAssetModel'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

function readCanvasSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

export function testImageToGlbExporterOptionsMatchInstalledThreeRuntime() {
  const scene = new THREE.Scene()
  const clip = new THREE.AnimationClip('procedural-motion', 1, [])
  scene.animations = [clip]
  const options = buildImageToGlbExporterOptions(scene, true) as Record<string, unknown>
  const optionKeys = Object.keys(options).sort().join(',')
  const expectedKeys = 'animations,binary,includeCustomExtensions,maxTextureSize,onlyVisible,trs'
  if (optionKeys !== expectedKeys) {
    throw new Error(`expected only installed Three.js GLTFExporter options, got ${optionKeys}`)
  }
  if (
    options.binary !== true
    || options.trs !== false
    || options.onlyVisible !== true
    || options.maxTextureSize !== Infinity
    || options.includeCustomExtensions !== false
    || options.animations !== scene.animations
  ) {
    throw new Error(`unexpected Image-to-GLB exporter policy: ${JSON.stringify(options)}`)
  }
  if ('embedImages' in options || 'truncateDrawRange' in options || 'forceIndices' in options) {
    throw new Error('expected Image-to-GLB to avoid options absent from the installed Three.js GLTFExporter runtime')
  }
}

export function testImageToGlbSurfaceReadinessWaitsForGltfLoader() {
  const surfaceSource = readCanvasSource('../features/image-to-glb/ImageToGlbSurface.tsx')
  const modelSource = readCanvasSource('../lib/three/GlbAssetModel.tsx')
  const settleAssetBody = surfaceSource.match(/const settleAsset = \(dataUrl: string\) => \{([\s\S]*?)\n {4}\}/)?.[1] || ''
  if (!settleAssetBody.includes('setAsset(buildModelAsset') || settleAssetBody.includes("setLoadState('ready')")) {
    throw new Error('expected data acquisition to mount the asset without claiming GLTFLoader readiness')
  }
  for (const contract of [
    'onLoad={handleModelReady}',
    'onError={handleModelError}',
    "setLoadState('ready')",
    "setLoadState('error')",
  ]) {
    if (!surfaceSource.includes(contract)) throw new Error(`missing GLB surface load-state contract: ${contract}`)
  }
  for (const contract of [
    'onLoadRef.current?.(scene)',
    'onErrorRef.current?.(error)',
    "failLoad(new Error('GLTFLoader returned no renderable scene.'))",
  ]) {
    if (!modelSource.includes(contract)) throw new Error(`missing GLTFLoader completion contract: ${contract}`)
  }
}

export function testImageToGlbPreviewCameraFramesLoadedBoundsAcrossPanelAspects() {
  const scaledSize: [number, number, number] = [118, 78, 96]
  const fit: GlbFit = {
    flatAxis: null,
    floorY: -39,
    position: [0, 0, 0],
    preserveFlatFacing: false,
    scale: 1,
    size: scaledSize,
    scaledSize,
    stageSpan: 330,
  }
  for (const aspect of [16 / 9, 1, 9 / 16]) {
    const placement = computeImageToGlbPreviewCamera(fit, aspect)
    const camera = new THREE.PerspectiveCamera(placement.fov, aspect, placement.near, placement.far)
    camera.position.set(...placement.position)
    camera.lookAt(...placement.target)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
    let maximumX = 0
    let maximumY = 0
    for (const x of [-scaledSize[0] / 2, scaledSize[0] / 2]) {
      for (const y of [-scaledSize[1] / 2, scaledSize[1] / 2]) {
        for (const z of [-scaledSize[2] / 2, scaledSize[2] / 2]) {
          const projected = new THREE.Vector3(x, y, z).project(camera)
          maximumX = Math.max(maximumX, Math.abs(projected.x))
          maximumY = Math.max(maximumY, Math.abs(projected.y))
        }
      }
    }
    if (maximumX > 0.92 || maximumY > 0.92 || Math.max(maximumX, maximumY) < 0.68) {
      throw new Error(`expected responsive camera occupancy without clipping at ${aspect.toFixed(3)}, got ${maximumX.toFixed(3)}x${maximumY.toFixed(3)}`)
    }
  }
}

export function testImageToGlbOrbitControlsResetToLatestSafeFit() {
  const { dom, restore } = initJsdomHarness()
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 4000)
  const canvas = dom.window.document.createElement('canvas')
  const controls = new OrbitControls(camera, canvas)
  try {
    const placement = computeImageToGlbPreviewCamera({
      flatAxis: null,
      floorY: -38,
      position: [0, 0, 0],
      preserveFlatFacing: false,
      scale: 1,
      size: [118, 78, 96],
      scaledSize: [118, 78, 96],
      stageSpan: 330,
    }, 16 / 9)
    controls.enableDamping = true
    applyImageToGlbPreviewCameraPlacement({ camera, controls, placement })
    const expectedPosition = camera.position.clone()
    const expectedTarget = controls.target.clone()
    camera.position.add(new THREE.Vector3(25, -14, 18))
    controls.target.add(new THREE.Vector3(8, 4, -6))
    controls.update()
    controls.reset()
    controls.update()

    if (camera.position.distanceTo(expectedPosition) > 1e-6 || controls.target.distanceTo(expectedTarget) > 1e-6) {
      throw new Error('expected OrbitControls reset to restore the latest responsive GLB fit')
    }
    if (
      controls.minDistance !== placement.minDistance
      || controls.maxDistance !== placement.maxDistance
      || camera.near !== placement.near
      || camera.far !== placement.far
    ) {
      throw new Error('expected GLB controls to retain bounds-derived dolly and clipping constraints')
    }
  } finally {
    controls.dispose()
    restore()
  }
}

export function testImageToGlbSurfaceOwnsOrbitPanZoomLifecycle() {
  const controlsSource = readCanvasSource('../features/image-to-glb/ImageToGlbPreviewCameraControls.tsx')
  const requiredContracts = [
    "from 'three/examples/jsm/controls/OrbitControls.js'",
    'next.enablePan = true',
    'next.enableRotate = true',
    'next.enableZoom = true',
    'next.zoomToCursor = true',
    'controls.update(delta)',
    'controls.dispose()',
  ]
  for (const contract of requiredContracts) {
    if (!controlsSource.includes(contract)) throw new Error(`missing GLB OrbitControls lifecycle contract: ${contract}`)
  }
}
