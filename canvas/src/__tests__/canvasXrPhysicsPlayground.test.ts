import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  XR_PHYSICS_WORLD_AXES,
  XR_PHYSICS_CONTROLLER_MODES,
  projectXrPhysicsWorldToCanvasStage,
  resolveXrPhysicsPlaygroundState,
} from '@/features/three/xrPhysicsPlaygroundModel'
import {
  readXrPhysicsPlaygroundControls,
  setXrPhysicsPlaygroundMode,
} from '@/features/three/xrPhysicsPlaygroundControls'

export function testXrPhysicsPlaygroundUsesNativeBoundedInteractionModel() {
  if (XR_PHYSICS_CONTROLLER_MODES.join('|') !== 'roll|thrust') {
    throw new Error(`expected XR physics controller modes to stay native and minimal, got ${XR_PHYSICS_CONTROLLER_MODES.join('|')}`)
  }
  if (XR_PHYSICS_WORLD_AXES.x !== 'lateral-left-right' || XR_PHYSICS_WORLD_AXES.y !== 'vertical-gravity-up' || XR_PHYSICS_WORLD_AXES.z !== 'forward-depth') {
    throw new Error(`expected XR physics world axes to stay X/Z movement and Y-up, got ${JSON.stringify(XR_PHYSICS_WORLD_AXES)}`)
  }

  const metrics = { cx: 0, cy: 0, z: -100, span: 400 }
  const projected = projectXrPhysicsWorldToCanvasStage(metrics, [12, 34, -56])
  if (projected[0] !== 12 || projected[1] !== -56 || projected[2] !== -66) {
    throw new Error(`expected Y-up world position to project to canvas x/z/depth+y, got ${projected.join(',')}`)
  }
  const rolling = resolveXrPhysicsPlaygroundState(metrics, 1)
  const thrusting = resolveXrPhysicsPlaygroundState(metrics, 6)
  if (rolling.activeMode !== 'roll' || thrusting.activeMode !== 'thrust') {
    throw new Error(`expected XR physics playground to alternate roll/thrust modes, got ${rolling.activeMode}/${thrusting.activeMode}`)
  }
  if (rolling.collisionBoundaryRadius < 80 || rolling.collisionBoundaryRadius > 260) {
    throw new Error(`expected bounded collision radius, got ${rolling.collisionBoundaryRadius}`)
  }
  if (thrusting.stabilization <= rolling.stabilization) {
    throw new Error(`expected thrust mode to expose stronger stabilization, got ${rolling.stabilization}/${thrusting.stabilization}`)
  }
  if (!rolling.velocityVector.some(value => Math.abs(value) > 0) || !thrusting.velocityVector.some(value => Math.abs(value) > 0)) {
    throw new Error('expected XR physics playground to expose non-zero velocity vectors')
  }
  if (rolling.rollPosition[1] !== rolling.rollWorldPosition[2] || rolling.rollPosition[2] !== metrics.z + rolling.rollWorldPosition[1]) {
    throw new Error(`expected roll world X/Y/Z to project consistently, got ${JSON.stringify({ world: rolling.rollWorldPosition, projected: rolling.rollPosition })}`)
  }

  const controlled = resolveXrPhysicsPlaygroundState(metrics, 1, {
    activeMode: 'thrust',
    moveX: 1,
    moveY: -1,
    thrust: true,
    stabilize: true,
  })
  if (controlled.activeMode !== 'thrust') {
    throw new Error(`expected explicit native controls to select thrust mode, got ${controlled.activeMode}`)
  }
  if (controlled.stabilization <= thrusting.stabilization || controlled.inputIntensity <= 0) {
    throw new Error(`expected explicit native controls to increase stabilization/input, got ${controlled.stabilization}/${controlled.inputIntensity}`)
  }
  if (controlled.thrustPosition[2] <= thrusting.thrustPosition[2]) {
    throw new Error(`expected thrust control input to lift the thrust body, got ${controlled.thrustPosition[2]} <= ${thrusting.thrustPosition[2]}`)
  }
  setXrPhysicsPlaygroundMode('roll')
  if (readXrPhysicsPlaygroundControls().activeMode !== 'roll') {
    throw new Error('expected shared XR physics controls to expose roll mode')
  }
  setXrPhysicsPlaygroundMode('thrust')
  if (readXrPhysicsPlaygroundControls().activeMode !== 'thrust') {
    throw new Error('expected shared XR physics controls to expose thrust mode')
  }
  setXrPhysicsPlaygroundMode('roll')

  const stageSource = readFileSync(resolve(process.cwd(), 'src/features/three/XrGraphStage.tsx'), 'utf8')
  const modelSource = readFileSync(resolve(process.cwd(), 'src/features/three/xrPhysicsPlaygroundModel.ts'), 'utf8')
  const controlsSource = readFileSync(resolve(process.cwd(), 'src/features/three/xrPhysicsPlaygroundControls.ts'), 'utf8')
  const panelSource = readFileSync(resolve(process.cwd(), 'src/lib/three/ThreeGraphXr.tsx'), 'utf8')
  for (const marker of [
    'kg_graph_xr_physics_playground',
    'kg_graph_xr_physics_roll_controller',
    'kg_graph_xr_physics_thrust_controller',
    'kg_graph_xr_physics_velocity_vector',
    'kg_graph_xr_physics_camera_anchor',
    'kg_graph_xr_physics_collision_boundaries',
    'kg_graph_xr_physics_playground_terrain',
    'kg_graph_xr_physics_ball_spawn_platform',
    'kg_graph_xr_physics_rocket_spawn_platform',
    'kg_graph_xr_physics_jump_ramp',
    'kg_graph_xr_physics_thrust_ramp',
    'kg_graph_xr_physics_collision_obstacle_',
    'kg_graph_xr_physics_roll_swap_pad',
    'kg_graph_xr_physics_thrust_swap_pad',
    'kg_graph_xr_physics_input_map_panel',
    'projectPhysicsWorldPosition',
  ]) {
    if (!stageSource.includes(marker)) throw new Error(`expected XR graph stage to expose ${marker}`)
  }
  for (const marker of [
    'installXrPhysicsKeyboardControls',
    'subscribeXrPhysicsPlaygroundControls',
    'setXrPhysicsPlaygroundMode',
    'data-kg-canvas-xr-physics-mode-option',
  ]) {
    if (!`${stageSource}\n${controlsSource}\n${panelSource}`.includes(marker)) {
      throw new Error(`expected XR physics playground to expose native interaction marker ${marker}`)
    }
  }
  for (const forbiddenProviderToken of ['8thwall', 'XR8', 'studio-physics-playground-example', 'ecs.registerComponent']) {
    if (`${stageSource}\n${modelSource}\n${controlsSource}\n${panelSource}`.includes(forbiddenProviderToken)) {
      throw new Error(`expected XR physics playground to stay provider-neutral without copied token ${forbiddenProviderToken}`)
    }
  }
}
