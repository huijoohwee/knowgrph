import { buildNumericTooltip } from '@/lib/config'

export const ARROW_LENGTH_TOOLTIP = buildNumericTooltip({
  defaultValue: 8,
  min: 2,
  max: 24,
  interval: 1,
  impact: 'Longer arrows make edge direction clearer; shorter arrows reduce clutter in dense graphs.',
})

export const LINK_OPACITY_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.6,
  min: 0,
  max: 1,
  interval: 0.05,
  impact: 'Higher opacity makes edges stand out; lower values keep background structure subtle.',
})

export const LINK_CURVATURE_TOOLTIP = buildNumericTooltip({
  defaultValue: 0,
  min: 0,
  max: 1.5,
  interval: 0.05,
  impact: 'Higher curvature separates overlapping edges; lower curvature keeps links straighter.',
})

export const CURVE_ROTATION_TOOLTIP = buildNumericTooltip({
  defaultValue: 0,
  min: -Math.PI,
  max: Math.PI,
  interval: 0.05,
  impact: 'Adjusts which side curves bow toward; extreme values can feel visually heavy or distracting.',
})

export const DIRECTIONAL_PARTICLES_TOOLTIP = buildNumericTooltip({
  defaultValue: 0,
  min: 0,
  max: 32,
  interval: 1,
  impact: 'More particles emphasize flow direction; zero hides animated edge particles entirely.',
})

export const ARROW_POSITION_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.85,
  min: 0.2,
  max: 1,
  interval: 0.05,
  impact: 'Higher values move arrows toward targets; lower values keep them nearer sources.',
})

export const PARTICLE_SPEED_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.6,
  min: 0.1,
  max: 2,
  interval: 0.05,
  impact: 'Higher speeds make flow animation faster; lower speeds favor calm, readable motion.',
})

export const SELECTED_EDGE_WIDTH_TOOLTIP = buildNumericTooltip({
  defaultValue: 3,
  min: 1,
  max: 6,
  interval: 0.25,
  impact: 'Thicker selected edges highlight focus paths; thinner edges reduce visual dominance.',
})

export const NODE_MOTION_TOOLTIP = buildNumericTooltip({
  defaultValue: 1,
  min: 0,
  max: 2,
  interval: 0.1,
  impact: 'Higher motion keeps nodes gently moving; zero disables idle motion entirely.',
})

export const MINIMAP_OPACITY_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.7,
  min: 0.2,
  max: 1,
  interval: 0.05,
  impact: 'Higher opacity makes minimap more visible; lower values keep the main canvas dominant.',
})

export const SPHERE_RADIUS_TOOLTIP = buildNumericTooltip({
  defaultValue: 120,
  min: 60,
  max: 260,
  interval: 5,
  impact: 'Larger radius spreads nodes outward; smaller radius packs the graph closer together.',
})

export const MIN_SPACING_TOOLTIP = buildNumericTooltip({
  defaultValue: 0,
  min: 0,
  max: 80,
  interval: 2,
  impact: 'Higher spacing separates nodes more; lower spacing allows tighter, denser layouts.',
})

export const LAYOUT_SEED_TOOLTIP = buildNumericTooltip({
  defaultValue: 1,
  impact: 'Changing seed tweaks layout randomness while keeping overall graph structure stable.',
})

export const POLYGON_ELEVATION_TOOLTIP = buildNumericTooltip({
  defaultValue: -0.1,
  min: -5,
  max: 5,
  interval: 0.1,
  impact: 'Negative values sink graph layers slightly under nodes; positive values lift them above.',
})

export const POLYGON_OPACITY_MULTIPLIER_TOOLTIP = buildNumericTooltip({
  defaultValue: 1,
  min: 0,
  max: 2,
  interval: 0.05,
  impact: 'Higher values make 3D graph layer surfaces denser; lower values keep them faint and subtle.',
})

export const FOG_NEAR_TOOLTIP = buildNumericTooltip({
  defaultValue: 180,
  min: 50,
  max: 400,
  interval: 5,
  impact: 'Higher values start fog farther from the camera; lower values fade foreground sooner.',
})

export const FOG_FAR_TOOLTIP = buildNumericTooltip({
  defaultValue: 360,
  min: 80,
  max: 600,
  interval: 5,
  impact: 'Higher values push the fog horizon outward; lower values tighten the visible depth range.',
})

export const STAR_COUNT_TOOLTIP = buildNumericTooltip({
  defaultValue: 0,
  min: 0,
  max: 4000,
  interval: 100,
  impact: 'More stars create a denser background; fewer stars keep focus on the main graph.',
})

export const STARFIELD_RADIUS_TOOLTIP = buildNumericTooltip({
  defaultValue: 650,
  min: 60,
  max: 800,
  interval: 10,
  impact: 'Larger radius pushes stars farther out; smaller radius pulls them closer to the camera.',
})

export const STARFIELD_BRIGHTNESS_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.9,
  min: 0,
  max: 1,
  interval: 0.05,
  impact: 'Higher brightness makes stars pop; lower values keep the starfield subtle and soft.',
})

export const CAMERA_DAMPING_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.08,
  min: 0,
  max: 0.3,
  interval: 0.01,
  impact: 'Higher damping slows camera easing; lower damping feels snappier but less smooth.',
})

export const ROTATE_SPEED_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.6,
  min: 0.1,
  max: 2,
  interval: 0.05,
  impact: 'Higher rotate speed spins the scene faster; lower speed favors slow inspection.',
})

export const ZOOM_SPEED_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.8,
  min: 0.2,
  max: 2,
  interval: 0.05,
  impact: 'Higher zoom speed changes distance quickly; lower speed improves fine control.',
})

export const PAN_SPEED_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.5,
  min: 0.1,
  max: 2,
  interval: 0.05,
  impact: 'Higher pan speed moves the camera faster; lower speed helps precise positioning.',
})

export const AUTO_ROTATE_SPEED_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.4,
  min: 0,
  max: 3,
  interval: 0.1,
  impact: 'Higher values spin auto-rotation faster; lower values keep idle motion gentle.',
})

export const SELECTED_NODE_GLOW_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.8,
  min: 0,
  max: 3,
  interval: 0.1,
  impact: 'Higher glow intensities make selected nodes brighter; lower values reduce halo strength.',
})

export const DIMMED_NODE_OPACITY_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.2,
  min: 0,
  max: 1,
  interval: 0.05,
  impact: 'Lower opacity fades unselected nodes more; higher values keep context visible.',
})

export const DIMMED_EDGE_OPACITY_TOOLTIP = buildNumericTooltip({
  defaultValue: 0.2,
  min: 0,
  max: 1,
  interval: 0.05,
  impact: 'Lower opacity fades unselected edges; higher values keep surrounding connections clearer.',
})
