import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeSelectionConfig } from '@/lib/graph/schema'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const threeSettingsRegistry: SettingMeta[] = [
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
      const next = raw === 'shaderLine' ? raw : 'mesh'
      s().setThreeEdgeRenderer(next as 'mesh' | 'shaderLine')
    },
    docKey: 'three.graph.edgeRenderer',
    default: () => 'mesh',
    options: ['mesh', 'shaderLine'],
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
  {
    key: 'three.globe.effectsEnabled',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.globeEffectsEnabled !== false
    },
    write: (v) => s().setThreeConfig({ globeEffectsEnabled: Boolean(v) }),
    docKey: 'three.globe.effectsEnabled',
    default: () => true,
  },
  {
    key: 'three.globe.particleCount',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeParticleCount === 'number' ? schema.three.globeParticleCount : 720
    },
    write: (v) => s().setThreeConfig({ globeParticleCount: Number(v) }),
    docKey: 'three.globe.particleCount',
    default: () => 720,
  },
  {
    key: 'three.globe.atmosphereOpacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeAtmosphereOpacity === 'number' ? schema.three.globeAtmosphereOpacity : 0.22
    },
    write: (v) => s().setThreeConfig({ globeAtmosphereOpacity: Number(v) }),
    docKey: 'three.globe.atmosphereOpacity',
    default: () => 0.22,
  },
  {
    key: 'three.globe.gridDensity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeGridDensity === 'number' ? schema.three.globeGridDensity : 12
    },
    write: (v) => s().setThreeConfig({ globeGridDensity: Number(v) }),
    docKey: 'three.globe.gridDensity',
    default: () => 12,
  },
  {
    key: 'three.globe.orbitRingCount',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeOrbitRingCount === 'number' ? schema.three.globeOrbitRingCount : 4
    },
    write: (v) => s().setThreeConfig({ globeOrbitRingCount: Number(v) }),
    docKey: 'three.globe.orbitRingCount',
    default: () => 4,
  },
  {
    key: 'three.globe.toolNodeCount',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeToolNodeCount === 'number' ? schema.three.globeToolNodeCount : 24
    },
    write: (v) => s().setThreeConfig({ globeToolNodeCount: Number(v) }),
    docKey: 'three.globe.toolNodeCount',
    default: () => 24,
  },
  {
    key: 'three.globe.arcCount',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeArcCount === 'number' ? schema.three.globeArcCount : 12
    },
    write: (v) => s().setThreeConfig({ globeArcCount: Number(v) }),
    docKey: 'three.globe.arcCount',
    default: () => 12,
  },
  {
    key: 'three.globe.arcTravelerCount',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeArcTravelerCount === 'number' ? schema.three.globeArcTravelerCount : 1
    },
    write: (v) => s().setThreeConfig({ globeArcTravelerCount: Number(v) }),
    docKey: 'three.globe.arcTravelerCount',
    default: () => 1,
  },
  {
    key: 'three.globe.autoRotateSpeed',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeAutoRotateSpeed === 'number' ? schema.three.globeAutoRotateSpeed : 0.08
    },
    write: (v) => s().setThreeConfig({ globeAutoRotateSpeed: Number(v) }),
    docKey: 'three.globe.autoRotateSpeed',
    default: () => 0.08,
  },
  {
    key: 'three.globe.cameraEllipseEnabled',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.globeCameraEllipseEnabled !== false
    },
    write: (v) => s().setThreeConfig({ globeCameraEllipseEnabled: Boolean(v) }),
    docKey: 'three.globe.cameraEllipseEnabled',
    default: () => true,
  },
  {
    key: 'three.globe.cameraEllipseSpeed',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeCameraEllipseSpeed === 'number' ? schema.three.globeCameraEllipseSpeed : 0.045
    },
    write: (v) => s().setThreeConfig({ globeCameraEllipseSpeed: Number(v) }),
    docKey: 'three.globe.cameraEllipseSpeed',
    default: () => 0.045,
  },
  {
    key: 'three.globe.cameraEllipseRadiusXFactor',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeCameraEllipseRadiusXFactor === 'number' ? schema.three.globeCameraEllipseRadiusXFactor : 1.24
    },
    write: (v) => s().setThreeConfig({ globeCameraEllipseRadiusXFactor: Number(v) }),
    docKey: 'three.globe.cameraEllipseRadiusXFactor',
    default: () => 1.24,
  },
  {
    key: 'three.globe.cameraEllipseRadiusZFactor',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeCameraEllipseRadiusZFactor === 'number' ? schema.three.globeCameraEllipseRadiusZFactor : 1.02
    },
    write: (v) => s().setThreeConfig({ globeCameraEllipseRadiusZFactor: Number(v) }),
    docKey: 'three.globe.cameraEllipseRadiusZFactor',
    default: () => 1.02,
  },
  {
    key: 'three.globe.cameraEllipseHeightFactor',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeCameraEllipseHeightFactor === 'number' ? schema.three.globeCameraEllipseHeightFactor : 0.26
    },
    write: (v) => s().setThreeConfig({ globeCameraEllipseHeightFactor: Number(v) }),
    docKey: 'three.globe.cameraEllipseHeightFactor',
    default: () => 0.26,
  },
  {
    key: 'three.globe.cameraEllipseFollow',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeCameraEllipseFollow === 'number' ? schema.three.globeCameraEllipseFollow : 0.06
    },
    write: (v) => s().setThreeConfig({ globeCameraEllipseFollow: Number(v) }),
    docKey: 'three.globe.cameraEllipseFollow',
    default: () => 0.06,
  },
  {
    key: 'three.globe.hubOrbitEnabled',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.globeHubOrbitEnabled !== false
    },
    write: (v) => s().setThreeConfig({ globeHubOrbitEnabled: Boolean(v) }),
    docKey: 'three.globe.hubOrbitEnabled',
    default: () => true,
  },
  {
    key: 'three.globe.hubOrbitStrength',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeHubOrbitStrength === 'number' ? schema.three.globeHubOrbitStrength : 0.22
    },
    write: (v) => s().setThreeConfig({ globeHubOrbitStrength: Number(v) }),
    docKey: 'three.globe.hubOrbitStrength',
    default: () => 0.22,
  },
  {
    key: 'three.globe.hubOrbitSpeed',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeHubOrbitSpeed === 'number' ? schema.three.globeHubOrbitSpeed : 0.24
    },
    write: (v) => s().setThreeConfig({ globeHubOrbitSpeed: Number(v) }),
    docKey: 'three.globe.hubOrbitSpeed',
    default: () => 0.24,
  },
  {
    key: 'three.globe.hubOrbitRadiusFactor',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeHubOrbitRadiusFactor === 'number' ? schema.three.globeHubOrbitRadiusFactor : 0.2
    },
    write: (v) => s().setThreeConfig({ globeHubOrbitRadiusFactor: Number(v) }),
    docKey: 'three.globe.hubOrbitRadiusFactor',
    default: () => 0.2,
  },
  {
    key: 'three.globe.sphereEllipsoidX',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeSphereEllipsoidX === 'number' ? schema.three.globeSphereEllipsoidX : 1.08
    },
    write: (v) => s().setThreeConfig({ globeSphereEllipsoidX: Number(v) }),
    docKey: 'three.globe.sphereEllipsoidX',
    default: () => 1.08,
  },
  {
    key: 'three.globe.sphereEllipsoidY',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeSphereEllipsoidY === 'number' ? schema.three.globeSphereEllipsoidY : 0.88
    },
    write: (v) => s().setThreeConfig({ globeSphereEllipsoidY: Number(v) }),
    docKey: 'three.globe.sphereEllipsoidY',
    default: () => 0.88,
  },
  {
    key: 'three.globe.sphereEllipsoidZ',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.globeSphereEllipsoidZ === 'number' ? schema.three.globeSphereEllipsoidZ : 1
    },
    write: (v) => s().setThreeConfig({ globeSphereEllipsoidZ: Number(v) }),
    docKey: 'three.globe.sphereEllipsoidZ',
    default: () => 1,
  },
  {
    key: 'three.globe.labelDepthFade',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.globeLabelDepthFade !== false
    },
    write: (v) => s().setThreeConfig({ globeLabelDepthFade: Boolean(v) }),
    docKey: 'three.globe.labelDepthFade',
    default: () => true,
  },
  {
    key: 'three.globe.labelBackfaceCulling',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.globeLabelBackfaceCulling !== false
    },
    write: (v) => s().setThreeConfig({ globeLabelBackfaceCulling: Boolean(v) }),
    docKey: 'three.globe.labelBackfaceCulling',
    default: () => true,
  },
  {
    key: 'three.media.iframeOverlay.poolMax',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlayPoolMax,
    write: (v) => s().setThreeIframeOverlayPoolMax(Number(v)),
    docKey: 'three.media.iframeOverlay.poolMax',
    default: () => 24,
  },
  {
    key: 'three.media.iframeOverlay.maxVisibleDefault',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlayMaxVisibleDefault,
    write: (v) => s().setThreeIframeOverlayMaxVisibleDefault(Number(v)),
    docKey: 'three.media.iframeOverlay.maxVisibleDefault',
    default: () => 8,
  },
  {
    key: 'three.media.iframeOverlay.maxVisibleCompact',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlayMaxVisibleCompact,
    write: (v) => s().setThreeIframeOverlayMaxVisibleCompact(Number(v)),
    docKey: 'three.media.iframeOverlay.maxVisibleCompact',
    default: () => 6,
  },
  {
    key: 'three.media.iframeOverlay.maxDistanceDefault',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlayMaxDistanceDefault,
    write: (v) => s().setThreeIframeOverlayMaxDistanceDefault(Number(v)),
    docKey: 'three.media.iframeOverlay.maxDistanceDefault',
    default: () => 620,
  },
  {
    key: 'three.media.iframeOverlay.maxDistanceCompact',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlayMaxDistanceCompact,
    write: (v) => s().setThreeIframeOverlayMaxDistanceCompact(Number(v)),
    docKey: 'three.media.iframeOverlay.maxDistanceCompact',
    default: () => 520,
  },
  {
    key: 'three.media.iframeOverlay.baseWidthRatioDefault',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlayBaseWidthRatioDefault,
    write: (v) => s().setThreeIframeOverlayBaseWidthRatioDefault(Number(v)),
    docKey: 'three.media.iframeOverlay.baseWidthRatioDefault',
    default: () => 0.2,
  },
  {
    key: 'three.media.iframeOverlay.baseWidthRatioCompact',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlayBaseWidthRatioCompact,
    write: (v) => s().setThreeIframeOverlayBaseWidthRatioCompact(Number(v)),
    docKey: 'three.media.iframeOverlay.baseWidthRatioCompact',
    default: () => 0.16,
  },
  {
    key: 'three.media.iframeOverlay.baseWidthMinPxDefault',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlayBaseWidthMinPxDefault,
    write: (v) => s().setThreeIframeOverlayBaseWidthMinPxDefault(Number(v)),
    docKey: 'three.media.iframeOverlay.baseWidthMinPxDefault',
    default: () => 210,
  },
  {
    key: 'three.media.iframeOverlay.baseWidthMinPxCompact',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlayBaseWidthMinPxCompact,
    write: (v) => s().setThreeIframeOverlayBaseWidthMinPxCompact(Number(v)),
    docKey: 'three.media.iframeOverlay.baseWidthMinPxCompact',
    default: () => 180,
  },
  {
    key: 'three.media.iframeOverlay.baseWidthMaxPxDefault',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlayBaseWidthMaxPxDefault,
    write: (v) => s().setThreeIframeOverlayBaseWidthMaxPxDefault(Number(v)),
    docKey: 'three.media.iframeOverlay.baseWidthMaxPxDefault',
    default: () => 360,
  },
  {
    key: 'three.media.iframeOverlay.baseWidthMaxPxCompact',
    type: 'number',
    source: 'store',
    read: () => s().threeIframeOverlayBaseWidthMaxPxCompact,
    write: (v) => s().setThreeIframeOverlayBaseWidthMaxPxCompact(Number(v)),
    docKey: 'three.media.iframeOverlay.baseWidthMaxPxCompact',
    default: () => 300,
  },
]
