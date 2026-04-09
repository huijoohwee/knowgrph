import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeSelectionConfig } from '@/lib/graph/schema'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const threeSettingsRegistryPart2: SettingMeta[] = [
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
    key: 'three.layout.voxelAnimationEnabled',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.voxelAnimationEnabled !== false
    },
    write: (v) => s().setThreeConfig({ voxelAnimationEnabled: Boolean(v) }),
    docKey: 'three.layout.voxelAnimationEnabled',
    default: () => true,
  },
  {
    key: 'three.layout.voxelSeedScaleFactor',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelSeedScaleFactor === 'number' ? schema.three.voxelSeedScaleFactor : 1
    },
    write: (v) => s().setThreeConfig({ voxelSeedScaleFactor: Number(v) }),
    docKey: 'three.layout.voxelSeedScaleFactor',
    default: () => 1,
  },
  {
    key: 'three.layout.voxelGridScaleFactor',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelGridScaleFactor === 'number' ? schema.three.voxelGridScaleFactor : 1
    },
    write: (v) => s().setThreeConfig({ voxelGridScaleFactor: Number(v) }),
    docKey: 'three.layout.voxelGridScaleFactor',
    default: () => 1,
  },
  {
    key: 'three.layout.voxelLayerSpacing',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelLayerSpacing === 'number' ? schema.three.voxelLayerSpacing : 84
    },
    write: (v) => s().setThreeConfig({ voxelLayerSpacing: Number(v) }),
    docKey: 'three.layout.voxelLayerSpacing',
    default: () => 84,
  },
  {
    key: 'three.layout.voxelLayerPlateOpacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelLayerPlateOpacity === 'number' ? schema.three.voxelLayerPlateOpacity : 0.06
    },
    write: (v) => s().setThreeConfig({ voxelLayerPlateOpacity: Number(v) }),
    docKey: 'three.layout.voxelLayerPlateOpacity',
    default: () => 0.06,
  },
  {
    key: 'three.layout.voxelLayerPlateRiseDurationMs',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelLayerPlateRiseDurationMs === 'number' ? schema.three.voxelLayerPlateRiseDurationMs : 900
    },
    write: (v) => s().setThreeConfig({ voxelLayerPlateRiseDurationMs: Number(v) }),
    docKey: 'three.layout.voxelLayerPlateRiseDurationMs',
    default: () => 900,
  },
  {
    key: 'three.layout.voxelLayerPlateRiseStaggerMs',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelLayerPlateRiseStaggerMs === 'number' ? schema.three.voxelLayerPlateRiseStaggerMs : 160
    },
    write: (v) => s().setThreeConfig({ voxelLayerPlateRiseStaggerMs: Number(v) }),
    docKey: 'three.layout.voxelLayerPlateRiseStaggerMs',
    default: () => 160,
  },
  {
    key: 'three.layout.voxelClusterPulseStrength',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelClusterPulseStrength === 'number' ? schema.three.voxelClusterPulseStrength : 0.22
    },
    write: (v) => s().setThreeConfig({ voxelClusterPulseStrength: Number(v) }),
    docKey: 'three.layout.voxelClusterPulseStrength',
    default: () => 0.22,
  },
  {
    key: 'three.layout.voxelEdgeHoverOpacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelEdgeHoverOpacity === 'number' ? schema.three.voxelEdgeHoverOpacity : 0.65
    },
    write: (v) => s().setThreeConfig({ voxelEdgeHoverOpacity: Number(v) }),
    docKey: 'three.layout.voxelEdgeHoverOpacity',
    default: () => 0.65,
  },
  {
    key: 'three.layout.voxelIntroDelayMs',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelIntroDelayMs === 'number' ? schema.three.voxelIntroDelayMs : 320
    },
    write: (v) => s().setThreeConfig({ voxelIntroDelayMs: Number(v) }),
    docKey: 'three.layout.voxelIntroDelayMs',
    default: () => 320,
  },
  {
    key: 'three.layout.voxelIntroDurationMs',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelIntroDurationMs === 'number' ? schema.three.voxelIntroDurationMs : 1100
    },
    write: (v) => s().setThreeConfig({ voxelIntroDurationMs: Number(v) }),
    docKey: 'three.layout.voxelIntroDurationMs',
    default: () => 1100,
  },
  {
    key: 'three.layout.voxelDefaultYawDeg',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelDefaultYawDeg === 'number' ? schema.three.voxelDefaultYawDeg : -36
    },
    write: (v) => s().setThreeConfig({ voxelDefaultYawDeg: Number(v) }),
    docKey: 'three.layout.voxelDefaultYawDeg',
    default: () => -36,
  },
  {
    key: 'three.layout.voxelDefaultTiltDeg',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelDefaultTiltDeg === 'number' ? schema.three.voxelDefaultTiltDeg : 32
    },
    write: (v) => s().setThreeConfig({ voxelDefaultTiltDeg: Number(v) }),
    docKey: 'three.layout.voxelDefaultTiltDeg',
    default: () => 32,
  },
  {
    key: 'three.layout.voxelDefaultDistanceFactor',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelDefaultDistanceFactor === 'number' ? schema.three.voxelDefaultDistanceFactor : 2.2
    },
    write: (v) => s().setThreeConfig({ voxelDefaultDistanceFactor: Number(v) }),
    docKey: 'three.layout.voxelDefaultDistanceFactor',
    default: () => 2.2,
  },
  {
    key: 'three.layout.voxelDefaultTargetLift',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelDefaultTargetLift === 'number' ? schema.three.voxelDefaultTargetLift : 8
    },
    write: (v) => s().setThreeConfig({ voxelDefaultTargetLift: Number(v) }),
    docKey: 'three.layout.voxelDefaultTargetLift',
    default: () => 8,
  },
  {
    key: 'three.layout.voxelGhostOpacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelGhostOpacity === 'number' ? schema.three.voxelGhostOpacity : 0.32
    },
    write: (v) => s().setThreeConfig({ voxelGhostOpacity: Number(v) }),
    docKey: 'three.layout.voxelGhostOpacity',
    default: () => 0.32,
  },
  {
    key: 'three.layout.voxelTopCapEmissiveIntensity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelTopCapEmissiveIntensity === 'number' ? schema.three.voxelTopCapEmissiveIntensity : 0.9
    },
    write: (v) => s().setThreeConfig({ voxelTopCapEmissiveIntensity: Number(v) }),
    docKey: 'three.layout.voxelTopCapEmissiveIntensity',
    default: () => 0.9,
  },
  {
    key: 'three.layout.voxelClusterLightIntensity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelClusterLightIntensity === 'number' ? schema.three.voxelClusterLightIntensity : 0.7
    },
    write: (v) => s().setThreeConfig({ voxelClusterLightIntensity: Number(v) }),
    docKey: 'three.layout.voxelClusterLightIntensity',
    default: () => 0.7,
  },
  {
    key: 'three.layout.voxelHubPulseStrength',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelHubPulseStrength === 'number' ? schema.three.voxelHubPulseStrength : 0.07
    },
    write: (v) => s().setThreeConfig({ voxelHubPulseStrength: Number(v) }),
    docKey: 'three.layout.voxelHubPulseStrength',
    default: () => 0.07,
  },
  {
    key: 'three.layout.voxelConceptFloatStrength',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelConceptFloatStrength === 'number' ? schema.three.voxelConceptFloatStrength : 1
    },
    write: (v) => s().setThreeConfig({ voxelConceptFloatStrength: Number(v) }),
    docKey: 'three.layout.voxelConceptFloatStrength',
    default: () => 1,
  },
  {
    key: 'three.layout.voxelIdleAutoRotateDelayMs',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelIdleAutoRotateDelayMs === 'number' ? schema.three.voxelIdleAutoRotateDelayMs : 900
    },
    write: (v) => s().setThreeConfig({ voxelIdleAutoRotateDelayMs: Number(v) }),
    docKey: 'three.layout.voxelIdleAutoRotateDelayMs',
    default: () => 900,
  },
  {
    key: 'three.layout.voxelIdleAutoRotateSpeed',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelIdleAutoRotateSpeed === 'number' ? schema.three.voxelIdleAutoRotateSpeed : 0.12
    },
    write: (v) => s().setThreeConfig({ voxelIdleAutoRotateSpeed: Number(v) }),
    docKey: 'three.layout.voxelIdleAutoRotateSpeed',
    default: () => 0.12,
  },
  {
    key: 'three.layout.voxelLabelsEnabled',
    type: 'boolean',
    source: 'store',
    read: () => {
      const schema = s().schema
      return schema.three?.voxelLabelsEnabled !== false
    },
    write: (v) => s().setThreeConfig({ voxelLabelsEnabled: Boolean(v) }),
    docKey: 'three.layout.voxelLabelsEnabled',
    default: () => true,
  },
  {
    key: 'three.layout.voxelLabelOpacity',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelLabelOpacity === 'number' ? schema.three.voxelLabelOpacity : 0.9
    },
    write: (v) => s().setThreeConfig({ voxelLabelOpacity: Number(v) }),
    docKey: 'three.layout.voxelLabelOpacity',
    default: () => 0.9,
  },
  {
    key: 'three.layout.voxelLabelFontSizePx',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelLabelFontSizePx === 'number' ? schema.three.voxelLabelFontSizePx : 12
    },
    write: (v) => s().setThreeConfig({ voxelLabelFontSizePx: Number(v) }),
    docKey: 'three.layout.voxelLabelFontSizePx',
    default: () => 12,
  },
  {
    key: 'three.layout.voxelLabelMaxChars',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema
      return typeof schema.three?.voxelLabelMaxChars === 'number' ? schema.three.voxelLabelMaxChars : 42
    },
    write: (v) => s().setThreeConfig({ voxelLabelMaxChars: Number(v) }),
    docKey: 'three.layout.voxelLabelMaxChars',
    default: () => 42,
  },
]
