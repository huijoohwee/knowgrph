import type { GraphSchema } from '@/lib/graph/schema'

export type ThreePresetLayoutOverrides = {
  charge?: number
  collisionRadius?: number
  applyNodePalette?: boolean
  applyGraphLayerDefaults?: boolean
}

export type ThreePresetCatalogEntry = {
  id: string
  label: string
  threeConfig: Partial<GraphSchema['three']>
  layoutOverrides?: ThreePresetLayoutOverrides
}

export type GraphSizePresetLayoutOverrides = {
  hideLabelsBelowScale?: number
  caps?: {
    maxNodes?: number
    maxEdges?: number
  }
}

export type GraphSizePresetCatalogEntry = {
  id: string
  label: string
  layoutOverrides: GraphSizePresetLayoutOverrides
}

export const threePresetNodePalette = ['#007BFF', '#FFC107', '#28A745', '#FD7E14', '#DC3545']

export const threePresetCatalog: ThreePresetCatalogEntry[] = [
  {
    id: 'demo-3d-orbit',
    label: 'Demo 3D Orbit',
    layoutOverrides: { charge: -350, collisionRadius: 16, applyNodePalette: true },
    threeConfig: {
      linkOpacity: 0.5,
      linkDirectionalArrowLength: 10,
      linkCurvature: 0.22,
      linkCurveRotation: 0,
      linkDirectionalArrowRelPos: 0.85,
      linkDirectionalParticles: 32,
      linkDirectionalParticleSpeed: 0.7,
      nodeMotionIntensity: 0.9,
      sphereRadius: 120,
      seed: 1,
      minSpacing: 0,
      minimapOpacity: 0.7,
      backgroundColor: '#0a0a1a',
      fogColor: '#0a0a1a',
      fogNear: 80,
      fogFar: 220,
      cameraDampingFactor: 0.14,
      cameraRotateSpeed: 0.4,
      cameraZoomSpeed: 0.7,
      cameraPanSpeed: 0.4,
      cameraAutoRotate: true,
      cameraAutoRotateSpeed: 0.18,
      nodeSizingFormula: 'schema',
      edgeWidthFormula: 'schema',
      selection: {
        selectedNodeGlowIntensity: 1.4,
        dimmedNodeOpacity: 0.26,
        dimmedEdgeOpacity: 0.26,
        selectedEdgeWidth: 3.2,
      },
    },
  },
  {
    id: 'demo-3d-christmas',
    label: 'Demo 3D Christmas',
    layoutOverrides: { charge: -350, collisionRadius: 16, applyNodePalette: true },
    threeConfig: {
      linkOpacity: 0.25,
      linkDirectionalArrowLength: 10,
      linkCurvature: 0.22,
      linkCurveRotation: 0,
      linkDirectionalArrowRelPos: 0.85,
      linkDirectionalParticles: 36,
      linkDirectionalParticleSpeed: 0.6,
      nodeMotionIntensity: 0.85,
      sphereRadius: 120,
      seed: 1,
      minSpacing: 0,
      minimapOpacity: 0.7,
      starfieldEnabled: true,
      starfieldCount: 2000,
      starfieldRadius: 520,
      starfieldOpacity: 0.85,
      starfieldColor: '#FFC107',
      backgroundColor: '#020617',
      fogColor: '#020617',
      fogNear: 60,
      fogFar: 260,
      cameraDampingFactor: 0.18,
      cameraRotateSpeed: 0.3,
      cameraZoomSpeed: 0.6,
      cameraPanSpeed: 0.35,
      cameraAutoRotate: true,
      cameraAutoRotateSpeed: 0.12,
      nodeSizingFormula: 'schema',
      edgeWidthFormula: 'schema',
      selection: {
        selectedNodeGlowIntensity: 2.0,
        dimmedNodeOpacity: 0.18,
        dimmedEdgeOpacity: 0.18,
        selectedEdgeWidth: 3.2,
        selectedEdgeColor: '#FFC107',
      },
    },
  },
  {
    id: 'demo-presentation-3d',
    label: 'Demo Presentation 3D',
    threeConfig: {
      linkOpacity: 0.45,
      linkDirectionalArrowLength: 7,
      linkCurvature: 0.16,
      linkCurveRotation: 0,
      linkDirectionalArrowRelPos: 0.85,
      linkDirectionalParticles: 0,
      linkDirectionalParticleSpeed: 0.4,
      nodeMotionIntensity: 0.15,
      fogColor: '#020617',
      fogNear: 130,
      fogFar: 310,
      cameraDampingFactor: 0.18,
      cameraRotateSpeed: 0.38,
      cameraZoomSpeed: 0.65,
      cameraPanSpeed: 0.45,
      cameraAutoRotate: false,
      cameraAutoRotateSpeed: 0.0,
      selection: {
        selectedNodeGlowIntensity: 1.15,
        dimmedNodeOpacity: 0.32,
        dimmedEdgeOpacity: 0.32,
        selectedEdgeWidth: 2.8,
      },
    },
  },
  {
    id: 'demo-3d-layers',
    label: 'Demo 3D Layers',
    layoutOverrides: { charge: -400, collisionRadius: 16 },
    threeConfig: {
      linkDirectionalArrowLength: 10,
      linkOpacity: 0.55,
      linkCurvature: 0.25,
      linkCurveRotation: 0,
      linkDirectionalArrowRelPos: 0.85,
      linkDirectionalParticles: 0,
      linkDirectionalParticleSpeed: 0.6,
      sphereRadius: 120,
      seed: 1,
      minSpacing: 0,
      nodeMotionIntensity: 0.25,
      minimapOpacity: 0.7,
      backgroundColor: '',
      fogColor: '#24243e',
      fogNear: 140,
      fogFar: 340,
      cameraDampingFactor: 0.08,
      cameraRotateSpeed: 0.45,
      cameraZoomSpeed: 0.75,
      cameraPanSpeed: 0.5,
      cameraAutoRotate: false,
      cameraAutoRotateSpeed: 0.0,
      nodeSizingFormula: 'importance',
      edgeWidthFormula: 'weight',
      layerOpacityByLayer: {
        '1': 1.0,
        '2': 0.9,
        '3': 0.8,
      },
      selection: {
        selectedNodeGlowIntensity: 1.05,
        dimmedNodeOpacity: 0.2,
        dimmedEdgeOpacity: 0.2,
        selectedEdgeWidth: 3.25,
      },
    },
  },
  {
    id: 'demo-3d-group-graph-layers',
    label: 'Demo 3D Cluster Layers',
    layoutOverrides: { charge: -350, collisionRadius: 16, applyGraphLayerDefaults: true },
    threeConfig: {
      linkDirectionalArrowLength: 8,
      linkOpacity: 0.4,
      linkCurvature: 0.18,
      linkCurveRotation: 0,
      linkDirectionalArrowRelPos: 0.85,
      linkDirectionalParticles: 0,
      linkDirectionalParticleSpeed: 0.45,
      sphereRadius: 120,
      seed: 1,
      minSpacing: 0,
      nodeMotionIntensity: 0.2,
      minimapOpacity: 0.7,
      backgroundColor: '',
      fogColor: '#020617',
      fogNear: 130,
      fogFar: 320,
      cameraDampingFactor: 0.18,
      cameraRotateSpeed: 0.35,
      cameraZoomSpeed: 0.6,
      cameraPanSpeed: 0.45,
      cameraAutoRotate: false,
      cameraAutoRotateSpeed: 0.0,
      nodeSizingFormula: 'schema',
      edgeWidthFormula: 'schema',
      selection: {
        selectedNodeGlowIntensity: 1.15,
        dimmedNodeOpacity: 0.3,
        dimmedEdgeOpacity: 0.3,
        selectedEdgeWidth: 2.8,
      },
    },
  },
  {
    id: 'demo-3d-presentation-b',
    label: 'Demo 3D Presentation B',
    layoutOverrides: { charge: -400, collisionRadius: 16 },
    threeConfig: {
      linkDirectionalArrowLength: 8,
      linkOpacity: 0.45,
      linkCurvature: 0.2,
      linkCurveRotation: 0,
      linkDirectionalArrowRelPos: 0.85,
      linkDirectionalParticles: 0,
      linkDirectionalParticleSpeed: 0.4,
      sphereRadius: 120,
      seed: 1,
      minSpacing: 0,
      nodeMotionIntensity: 0.15,
      minimapOpacity: 0.7,
      backgroundColor: '',
      fogColor: '#24243e',
      fogNear: 130,
      fogFar: 320,
      cameraDampingFactor: 0.18,
      cameraRotateSpeed: 0.38,
      cameraZoomSpeed: 0.65,
      cameraPanSpeed: 0.45,
      cameraAutoRotate: false,
      cameraAutoRotateSpeed: 0.0,
      nodeSizingFormula: 'importance',
      edgeWidthFormula: 'weight',
      layerOpacityByLayer: {
        '1': 1.0,
        '2': 0.9,
        '3': 0.8,
      },
      selection: {
        selectedNodeGlowIntensity: 1.1,
        dimmedNodeOpacity: 0.3,
        dimmedEdgeOpacity: 0.3,
        selectedEdgeWidth: 2.9,
      },
    },
  },
]

export const graphSizePresetCatalog: GraphSizePresetCatalogEntry[] = [
  {
    id: 'graph-size-small',
    label: 'Graph size: small',
    layoutOverrides: {
      hideLabelsBelowScale: 0.0,
      caps: {
        maxNodes: 2000,
        maxEdges: 10000,
      },
    },
  },
  {
    id: 'graph-size-medium',
    label: 'Graph size: medium',
    layoutOverrides: {
      hideLabelsBelowScale: 0.85,
      caps: {
        maxNodes: 5000,
        maxEdges: 25000,
      },
    },
  },
  {
    id: 'graph-size-large',
    label: 'Graph size: large',
    layoutOverrides: {
      hideLabelsBelowScale: 1.5,
      caps: {
        maxNodes: 10000,
        maxEdges: 50000,
      },
    },
  },
]
