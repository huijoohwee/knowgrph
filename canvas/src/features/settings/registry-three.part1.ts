import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeSelectionConfig } from '@/lib/graph/schema'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const threeSettingsRegistryPart1: SettingMeta[] = [
  {
    key: 'three.camera.autoClip',
    type: 'boolean',
    source: 'store',
    read: () => s().threeCameraAutoClip === true,
    write: (v) => s().setThreeCameraAutoClip(Boolean(v)),
    docKey: 'three.camera.autoClip',
    default: () => true,
  },
  {
    key: 'three.camera.autoClipNearFactor',
    type: 'number',
    source: 'store',
    read: () => s().threeCameraAutoClipNearFactor,
    write: (v) => s().setThreeCameraAutoClipNearFactor(Number(v)),
    docKey: 'three.camera.autoClipNearFactor',
    default: () => 0.0001,
  },
  {
    key: 'three.camera.autoClipFarFactor',
    type: 'number',
    source: 'store',
    read: () => s().threeCameraAutoClipFarFactor,
    write: (v) => s().setThreeCameraAutoClipFarFactor(Number(v)),
    docKey: 'three.camera.autoClipFarFactor',
    default: () => 200,
  },
  {
    key: 'three.iframeOverlay.sizeScaleFactor',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlaySizeScaleFactor,
    write: (v) => s().setThreeIframeOverlaySizeScaleFactor(Number(v)),
    docKey: 'three.iframeOverlay.sizeScaleFactor',
    default: () => 260,
  },
  {
    key: 'three.graph.edgeRenderer',
    type: 'string',
    source: 'store',
    read: () => s().threeEdgeRenderer,
    write: (v) => {
      const raw = String(v || '')
      const next = raw === 'shaderLine' || raw === 'tubeBridge' ? raw : 'mesh'
      s().setThreeEdgeRenderer(next as 'mesh' | 'shaderLine' | 'tubeBridge')
    },
    docKey: 'three.graph.edgeRenderer',
    default: () => 'mesh',
    options: ['mesh', 'shaderLine', 'tubeBridge'],
  },
  {
    key: 'three.voxel.districts.enabled',
    type: 'boolean',
    source: 'store',
    read: () => (s().schema?.three?.voxelDistrictsEnabled ?? true) === true,
    write: (v) => s().setThreeConfig({ voxelDistrictsEnabled: Boolean(v) }),
    docKey: 'three.voxel.districts.enabled',
    default: () => true,
  },
  {
    key: 'three.voxel.districts.paddingCells',
    type: 'number',
    source: 'store',
    read: () => (typeof s().schema?.three?.voxelDistrictPaddingCells === 'number' ? s().schema!.three!.voxelDistrictPaddingCells! : 2),
    write: (v) => s().setThreeConfig({ voxelDistrictPaddingCells: Number(v) }),
    docKey: 'three.voxel.districts.paddingCells',
    default: () => 2,
  },
  {
    key: 'three.voxel.districts.opacity',
    type: 'number',
    source: 'store',
    read: () => (typeof s().schema?.three?.voxelDistrictOpacity === 'number' ? s().schema!.three!.voxelDistrictOpacity! : 0.14),
    write: (v) => s().setThreeConfig({ voxelDistrictOpacity: Number(v) }),
    docKey: 'three.voxel.districts.opacity',
    default: () => 0.14,
  },
  {
    key: 'three.voxel.bridges.tubeRadius',
    type: 'number',
    source: 'store',
    read: () => (typeof s().schema?.three?.voxelBridgeTubeRadius === 'number' ? s().schema!.three!.voxelBridgeTubeRadius! : 2.2),
    write: (v) => s().setThreeConfig({ voxelBridgeTubeRadius: Number(v) }),
    docKey: 'three.voxel.bridges.tubeRadius',
    default: () => 2.2,
  },
  {
    key: 'three.voxel.bridges.opacity',
    type: 'number',
    source: 'store',
    read: () => (typeof s().schema?.three?.voxelBridgeTubeOpacity === 'number' ? s().schema!.three!.voxelBridgeTubeOpacity! : 0.55),
    write: (v) => s().setThreeConfig({ voxelBridgeTubeOpacity: Number(v) }),
    docKey: 'three.voxel.bridges.opacity',
    default: () => 0.55,
  },
  {
    key: 'three.voxel.bridges.pulseStrength',
    type: 'number',
    source: 'store',
    read: () => (typeof s().schema?.three?.voxelBridgeTubePulseStrength === 'number' ? s().schema!.three!.voxelBridgeTubePulseStrength! : 0.45),
    write: (v) => s().setThreeConfig({ voxelBridgeTubePulseStrength: Number(v) }),
    docKey: 'three.voxel.bridges.pulseStrength',
    default: () => 0.45,
  },
  {
    key: 'three.voxel.bridges.particles.enabled',
    type: 'boolean',
    source: 'store',
    read: () => (s().schema?.three?.voxelBridgeParticlesEnabled ?? true) === true,
    write: (v) => s().setThreeConfig({ voxelBridgeParticlesEnabled: Boolean(v) }),
    docKey: 'three.voxel.bridges.particles.enabled',
    default: () => true,
  },
  {
    key: 'three.voxel.bridges.particles.density',
    type: 'number',
    source: 'store',
    read: () => (typeof s().schema?.three?.voxelBridgeParticleDensity === 'number' ? s().schema!.three!.voxelBridgeParticleDensity! : 0.7),
    write: (v) => s().setThreeConfig({ voxelBridgeParticleDensity: Number(v) }),
    docKey: 'three.voxel.bridges.particles.density',
    default: () => 0.7,
  },
  {
    key: 'three.voxel.bridges.particles.speed',
    type: 'number',
    source: 'store',
    read: () => (typeof s().schema?.three?.voxelBridgeParticleSpeed === 'number' ? s().schema!.three!.voxelBridgeParticleSpeed! : 0.75),
    write: (v) => s().setThreeConfig({ voxelBridgeParticleSpeed: Number(v) }),
    docKey: 'three.voxel.bridges.particles.speed',
    default: () => 0.75,
  },
  {
    key: 'three.graph.shaderLineWidthPx',
    type: 'number',
    source: 'store',
    read: () => s().threeShaderLineWidthPx,
    write: (v) => s().setThreeShaderLineWidthPx(Number(v)),
    docKey: 'three.graph.shaderLineWidthPx',
    default: () => 2,
  },
  {
    key: 'three.selection.selectedNodeGlowIntensity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema | null
      const sel = getThreeSelectionConfig(schema)
      return sel.selectedNodeGlowIntensity
    },
    write: (v) => s().setThreeConfig({ selection: { selectedNodeGlowIntensity: Number(v) } }),
    docKey: 'three.selection.selectedNodeGlowIntensity',
    default: () => 0.8,
  },
  {
    key: 'three.selection.dimmedNodeOpacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema | null
      const sel = getThreeSelectionConfig(schema)
      return sel.dimmedNodeOpacity
    },
    write: (v) => s().setThreeConfig({ selection: { dimmedNodeOpacity: Number(v) } }),
    docKey: 'three.selection.dimmedNodeOpacity',
    default: () => 0.2,
  },
  {
    key: 'three.selection.dimmedEdgeOpacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema | null
      const sel = getThreeSelectionConfig(schema)
      return sel.dimmedEdgeOpacity
    },
    write: (v) => s().setThreeConfig({ selection: { dimmedEdgeOpacity: Number(v) } }),
    docKey: 'three.selection.dimmedEdgeOpacity',
    default: () => 0.2,
  },
  {
    key: 'three.selection.selectedEdgeWidth',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema | null
      const sel = getThreeSelectionConfig(schema)
      return sel.selectedEdgeWidth
    },
    write: (v) => s().setThreeConfig({ selection: { selectedEdgeWidth: Number(v) } }),
    docKey: 'three.selection.selectedEdgeWidth',
    default: () => 3,
  },
  {
    key: 'three.camera.backgroundColor',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.backgroundColor ?? ''
    },
    write: (v) => s().setThreeConfig({ backgroundColor: String(v || '') }),
    docKey: 'three.camera.backgroundColor',
    default: () => '',
  },
  {
    key: 'three.camera.fogColor',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.fogColor ?? ''
    },
    write: (v) => s().setThreeConfig({ fogColor: String(v || '') }),
    docKey: 'three.camera.fogColor',
    default: () => '#1e1b4b',
  },
  {
    key: 'three.camera.fogNear',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.fogNear === 'number' ? schema.three.fogNear : 180
    },
    write: (v) => s().setThreeConfig({ fogNear: Number(v) }),
    docKey: 'three.camera.fogNear',
    default: () => 180,
  },
  {
    key: 'three.camera.fogFar',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.fogFar === 'number' ? schema.three.fogFar : 360
    },
    write: (v) => s().setThreeConfig({ fogFar: Number(v) }),
    docKey: 'three.camera.fogFar',
    default: () => 360,
  },
  {
    key: 'three.camera.dampingFactor',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.cameraDampingFactor === 'number' ? schema.three.cameraDampingFactor : 0.08
    },
    write: (v) => s().setThreeConfig({ cameraDampingFactor: Number(v) }),
    docKey: 'three.camera.dampingFactor',
    default: () => 0.08,
  },
  {
    key: 'three.camera.rotateSpeed',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.cameraRotateSpeed === 'number' ? schema.three.cameraRotateSpeed : 0.6
    },
    write: (v) => s().setThreeConfig({ cameraRotateSpeed: Number(v) }),
    docKey: 'three.camera.rotateSpeed',
    default: () => 0.6,
  },
  {
    key: 'three.camera.zoomSpeed',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.cameraZoomSpeed === 'number' ? schema.three.cameraZoomSpeed : 0.8
    },
    write: (v) => s().setThreeConfig({ cameraZoomSpeed: Number(v) }),
    docKey: 'three.camera.zoomSpeed',
    default: () => 0.8,
  },
  {
    key: 'three.camera.panSpeed',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.cameraPanSpeed === 'number' ? schema.three.cameraPanSpeed : 0.5
    },
    write: (v) => s().setThreeConfig({ cameraPanSpeed: Number(v) }),
    docKey: 'three.camera.panSpeed',
    default: () => 0.5,
  },
  {
    key: 'three.camera.autoRotate',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return !!schema.three?.cameraAutoRotate
    },
    write: (v) => s().setThreeConfig({ cameraAutoRotate: Boolean(v) }),
    docKey: 'three.camera.autoRotate',
    default: () => false,
  },
  {
    key: 'three.camera.autoRotateSpeed',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.cameraAutoRotateSpeed === 'number' ? schema.three.cameraAutoRotateSpeed : 0.4
    },
    write: (v) => s().setThreeConfig({ cameraAutoRotateSpeed: Number(v) }),
    docKey: 'three.camera.autoRotateSpeed',
    default: () => 0.4,
  },
  {
    key: 'three.graph.linkDirectionalArrowLength',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.linkDirectionalArrowLength === 'number' ? schema.three.linkDirectionalArrowLength : 8
    },
    write: (v) => s().setThreeConfig({ linkDirectionalArrowLength: Number(v) }),
    docKey: 'three.graph.linkDirectionalArrowLength',
    default: () => 8,
  },
  {
    key: 'three.graph.linkOpacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.linkOpacity === 'number' ? schema.three.linkOpacity : 0.6
    },
    write: (v) => s().setThreeConfig({ linkOpacity: Number(v) }),
    docKey: 'three.graph.linkOpacity',
    default: () => 0.6,
  },
  {
    key: 'three.graph.linkCurvature',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.linkCurvature === 'number' ? schema.three.linkCurvature : 0.0
    },
    write: (v) => s().setThreeConfig({ linkCurvature: Number(v) }),
    docKey: 'three.graph.linkCurvature',
    default: () => 0.0,
  },
  {
    key: 'three.graph.linkCurveRotation',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.linkCurveRotation === 'number' ? schema.three.linkCurveRotation : 0.0
    },
    write: (v) => s().setThreeConfig({ linkCurveRotation: Number(v) }),
    docKey: 'three.graph.linkCurveRotation',
    default: () => 0.0,
  },
  {
    key: 'three.graph.linkDirectionalParticles',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.linkDirectionalParticles === 'number' ? schema.three.linkDirectionalParticles : 0
    },
    write: (v) => s().setThreeConfig({ linkDirectionalParticles: Number(v) }),
    docKey: 'three.graph.linkDirectionalParticles',
    default: () => 0,
  },
  {
    key: 'three.graph.linkDirectionalParticleSpeed',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.linkDirectionalParticleSpeed === 'number'
        ? schema.three.linkDirectionalParticleSpeed
        : 0.6
    },
    write: (v) => s().setThreeConfig({ linkDirectionalParticleSpeed: Number(v) }),
    docKey: 'three.graph.linkDirectionalParticleSpeed',
    default: () => 0.6,
  },
  {
    key: 'three.graph.nodeSizingFormula',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.nodeSizingFormula ?? 'schema'
    },
    write: (v) => {
      const val = String(v || '') === 'importance' ? 'importance' : 'schema'
      s().setThreeConfig({ nodeSizingFormula: val as 'schema' | 'importance' })
    },
    docKey: 'three.graph.nodeSizingFormula',
    default: () => 'schema',
    options: ['schema', 'importance'],
  },
  {
    key: 'three.graph.edgeWidthFormula',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.edgeWidthFormula ?? 'schema'
    },
    write: (v) => {
      const val = String(v || '') === 'weight' ? 'weight' : 'schema'
      s().setThreeConfig({ edgeWidthFormula: val as 'schema' | 'weight' })
    },
    docKey: 'three.graph.edgeWidthFormula',
    default: () => 'schema',
    options: ['schema', 'weight'],
  },
  {
    key: 'three.graph.layerOpacityByLayer.1',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const map = schema.three?.layerOpacityByLayer || {}
      return typeof map['1'] === 'number' ? map['1'] : 1.0
    },
    write: (v) => {
      const schema = s().schema
      const prev = schema.three?.layerOpacityByLayer || {}
      s().setThreeConfig({ layerOpacityByLayer: { ...prev, '1': Number(v) } })
    },
    docKey: 'three.graph.layerOpacityByLayer.1',
    default: () => 1.0,
  },
]
