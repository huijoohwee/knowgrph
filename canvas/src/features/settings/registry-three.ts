import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeSelectionConfig } from '@/lib/graph/schema'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const threeSettingsRegistry: SettingMeta[] = [
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
  {
    key: 'three.graph.layerOpacityByLayer.2',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const map = schema.three?.layerOpacityByLayer || {}
      return typeof map['2'] === 'number' ? map['2'] : 0.9
    },
    write: (v) => {
      const schema = s().schema
      const prev = schema.three?.layerOpacityByLayer || {}
      s().setThreeConfig({ layerOpacityByLayer: { ...prev, '2': Number(v) } })
    },
    docKey: 'three.graph.layerOpacityByLayer.2',
    default: () => 0.9,
  },
  {
    key: 'three.graph.layerOpacityByLayer.3',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const map = schema.three?.layerOpacityByLayer || {}
      return typeof map['3'] === 'number' ? map['3'] : 0.8
    },
    write: (v) => {
      const schema = s().schema
      const prev = schema.three?.layerOpacityByLayer || {}
      s().setThreeConfig({ layerOpacityByLayer: { ...prev, '3': Number(v) } })
    },
    docKey: 'three.graph.layerOpacityByLayer.3',
    default: () => 0.8,
  },
  {
    key: 'three.graph.nodeMotionIntensity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.nodeMotionIntensity === 'number' ? schema.three.nodeMotionIntensity : 1.0
    },
    write: (v) => s().setThreeConfig({ nodeMotionIntensity: Number(v) }),
    docKey: 'three.graph.nodeMotionIntensity',
    default: () => 1.0,
  },
  {
    key: 'three.graph.minimapOpacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.minimapOpacity === 'number' ? schema.three.minimapOpacity : 0.7
    },
    write: (v) => s().setThreeConfig({ minimapOpacity: Number(v) }),
    docKey: 'three.graph.minimapOpacity',
    default: () => 0.7,
  },
  {
    key: 'three.graph.polygons.elevationOffset',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.three?.polygons?.elevationOffset
      return typeof raw === 'number' ? raw : -0.1
    },
    write: (v) => {
      const schema = s().schema
      const prev = schema.three?.polygons || {}
      s().setThreeConfig({ polygons: { ...prev, elevationOffset: Number(v) } })
    },
    docKey: 'three.graph.polygons.elevationOffset',
    default: () => -0.1,
  },
  {
    key: 'three.graph.polygons.opacityMultiplier',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      const raw = schema.three?.polygons?.opacityMultiplier
      return typeof raw === 'number' ? raw : 1
    },
    write: (v) => {
      const schema = s().schema
      const prev = schema.three?.polygons || {}
      s().setThreeConfig({ polygons: { ...prev, opacityMultiplier: Number(v) } })
    },
    docKey: 'three.graph.polygons.opacityMultiplier',
    default: () => 1,
  },
  {
    key: 'three.graph.starfieldEnabled',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return !!schema.three?.starfieldEnabled
    },
    write: (v) => s().setThreeConfig({ starfieldEnabled: Boolean(v) }),
    docKey: 'three.graph.starfieldEnabled',
    default: () => false,
  },
  {
    key: 'three.graph.starfieldCount',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.starfieldCount === 'number' ? schema.three.starfieldCount : 0
    },
    write: (v) => s().setThreeConfig({ starfieldCount: Number(v) }),
    docKey: 'three.graph.starfieldCount',
    default: () => 0,
  },
  {
    key: 'three.graph.starfieldRadius',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.starfieldRadius === 'number'
        ? schema.three.starfieldRadius
        : (typeof schema.three?.sphereRadius === 'number' ? schema.three.sphereRadius : 260)
    },
    write: (v) => s().setThreeConfig({ starfieldRadius: Number(v) }),
    docKey: 'three.graph.starfieldRadius',
    default: () => 650,
  },
  {
    key: 'three.graph.starfieldOpacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.starfieldOpacity === 'number' ? schema.three.starfieldOpacity : 0.9
    },
    write: (v) => s().setThreeConfig({ starfieldOpacity: Number(v) }),
    docKey: 'three.graph.starfieldOpacity',
    default: () => 0.9,
  },
  {
    key: 'three.graph.starfieldColor',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.starfieldColor ?? ''
    },
    write: (v) => s().setThreeConfig({ starfieldColor: String(v || '') }),
    docKey: 'three.graph.starfieldColor',
    default: () => '#facc15',
  },
  {
    key: 'three.layout.sphereRadius',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.sphereRadius === 'number' ? schema.three.sphereRadius : 120
    },
    write: (v) => s().setThreeConfig({ sphereRadius: Number(v) }),
    docKey: 'three.layout.sphereRadius',
    default: () => 120,
  },
  {
    key: 'three.layout.seed',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.seed === 'number' ? schema.three.seed : 1
    },
    write: (v) => s().setThreeConfig({ seed: Number(v) }),
    docKey: 'three.layout.seed',
    default: () => 1,
  },
  {
    key: 'three.layout.minSpacing',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.minSpacing === 'number' ? schema.three.minSpacing : 0
    },
    write: (v) => s().setThreeConfig({ minSpacing: Number(v) }),
    docKey: 'three.layout.minSpacing',
    default: () => 0,
  },
]
