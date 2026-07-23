import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { load as loadYaml } from 'js-yaml'
const repositoryRoot = process.cwd()
const flightFeatureRoot = 'canvas/src/features/game-flight-sim'
const flightSeedPath = 'docs/workspace-seeds/knowgrph-game-flight-sim-demo.md'
const physicsSeedPath = 'docs/workspace-seeds/knowgrph-physics-playground-demo.md'
const requiredPaths = [
  `${flightFeatureRoot}/FlightSimFloatingPanelView.tsx`,
  `${flightFeatureRoot}/FlightSimHud.tsx`,
  `${flightFeatureRoot}/FlightSimMissionStage.tsx`,
  `${flightFeatureRoot}/FlightSimWebglUnsupportedState.tsx`,
  `${flightFeatureRoot}/assetSpec/flightSimAssetSpec.ts`,
  `${flightFeatureRoot}/assetSpec/vehicle-airplane.scene.json`,
  `${flightFeatureRoot}/flightModel.ts`,
  `${flightFeatureRoot}/flightSimDecisionAdmission.ts`,
  `${flightFeatureRoot}/flightSimDecisionStore.ts`,
  `${flightFeatureRoot}/flightSimHydrationGate.ts`,
  `${flightFeatureRoot}/flightSimInput.ts`,
  `${flightFeatureRoot}/flightSimMcpContract.mjs`,
  `${flightFeatureRoot}/flightSimMcpRuntime.ts`,
  `${flightFeatureRoot}/flightSimMission.ts`,
  `${flightFeatureRoot}/flightSimModel.ts`,
  `${flightFeatureRoot}/flightSimMotionControlAdapter.ts`,
  `${flightFeatureRoot}/flightSimPendingDecisions.ts`,
  `${flightFeatureRoot}/flightSimRuntime.ts`,
  `${flightFeatureRoot}/flightSimSimulationClock.ts`,
  `${flightFeatureRoot}/flightSimSpatialProfile.ts`,
  `${flightFeatureRoot}/index.ts`,
  'canvas/src/features/agent-ready/flightSimAgentReadyContract.mjs',
  'canvas/src/features/agent-ready/flightSimWebMcpTools.ts',
  'canvas/src/features/agent-ready/knowgrphAgentReadyToolContract.mjs',
  'canvas/src/features/agent-ready/webMcpRuntime.ts',
  'canvas/src/features/canvas/FlightSimRunReadyDemoRuntime.tsx',
  'canvas/src/features/three/useFlightSimCamera.ts',
  'canvas/src/features/workspace-fs/workspaceDecisionStore.ts',
  'canvas/src/features/workspace-fs/workspaceRunReadyDemos.ts',
  'canvas/src/lib/three/ThreeGameplayOverlay.tsx',
  'canvas/src/lib/three/ThreeGraph.impl.tsx',
  'canvas/src/__tests__/flightSimCore.test.ts',
  'canvas/src/__tests__/flightSimDecisionStore.test.ts',
  'canvas/src/__tests__/flightSimMcpRuntime.test.ts',
  'canvas/src/__tests__/flightSimRuntime.test.ts',
  'canvas/src/__tests__/flightSimSourceAuthority.test.ts',
  'canvas/src/__tests__/xrAgenticEcsComposition.test.ts',
  'ecs/index.js',
  'ecs/worldTick.js',
  flightSeedPath,
  physicsSeedPath,
  'scripts/workspace-seed-authority.mjs',
  'package.json',
  'canvas/package.json',
]
const forbiddenDependencies = [
  '@dimforge/rapier3d',
  '@dimforge/rapier3d-compat',
  'ammo.js',
  'behaviortree',
  'bitecs',
  'cannon',
  'cannon-es',
  'oimo',
  'recast-navigation',
  'recastnavigation',
  'yuka',
]
const forbiddenFeaturePatterns = [
  [/<Canvas(?:\s|>)/, 'a feature-local Canvas'],
  [/\bnew\s+(?:THREE\.)?WebGLRenderer\s*\(/, 'a feature-local renderer'],
  [/\bfetch\s*\(/, 'fetch'],
  [/\bWebSocket\s*\(/, 'WebSocket'],
  [/\bEventSource\s*\(/, 'EventSource'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/navigator\.credentials/, 'credentials access'],
  [/\bgetUserMedia\s*\(/, 'camera access'],
  [/\brequestReasoning\s*\(/, 'reasoning'],
  [/\b(?:OpenAI|Anthropic)\b/, 'a model SDK'],
  [/\b(?:Arnie016|flight-simulator-fable5)\b/i, 'the inspiration-only external project'],
]
async function readText(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8')
}
async function listFiles(relativeDirectory) {
  const absoluteDirectory = path.join(repositoryRoot, relativeDirectory)
  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const relativePath = path.posix.join(relativeDirectory, entry.name)
    if (entry.isDirectory()) {
      if (['.git', '.wrangler', 'dist', 'node_modules'].includes(entry.name)) return []
      return listFiles(relativePath)
    }
    return entry.isFile() ? [relativePath] : []
  }))
  return nested.flat().sort()
}

function requireMarkers(source, markers, label) {
  const missing = markers.filter(marker => !source.includes(marker))
  if (missing.length > 0) {
    throw new Error(`${label} is missing required source markers: ${missing.join(', ')}`)
  }
}

function parseFrontmatter(source, relativePath) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) throw new Error(`${relativePath} must begin with YAML frontmatter`)
  let value
  try {
    value = loadYaml(match[1])
  } catch (error) {
    throw new Error(`${relativePath} has invalid YAML frontmatter: ${error.message}`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${relativePath} frontmatter must be an object`)
  }
  return value
}

function requireOrderedMarkers(source, markers, label) {
  let cursor = -1
  for (const marker of markers) {
    const next = source.indexOf(marker, cursor + 1)
    if (next < 0) throw new Error(`${label} must contain ${marker} after the preceding readiness step`)
    cursor = next
  }
}

for (const relativePath of requiredPaths) {
  try {
    await readText(relativePath)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Flight Sim readiness requires ${relativePath}`)
    }
    throw error
  }
}

const allFeaturePaths = await listFiles(flightFeatureRoot)
const featurePaths = allFeaturePaths
  .filter(relativePath => /\.(?:tsx?|mjs|json)$/.test(relativePath))
const featureSources = await Promise.all(featurePaths.map(async relativePath => ({
  relativePath,
  source: await readText(relativePath),
})))

for (const { relativePath, source } of featureSources) {
  const lineCount = source.split(/\r?\n/).length
  if (lineCount > 600) throw new Error(`${relativePath} exceeds the 600-line feature limit`)
  for (const [pattern, capability] of forbiddenFeaturePatterns) {
    if (pattern.test(source)) {
      throw new Error(`${relativePath} introduces forbidden Flight Sim capability: ${capability}`)
    }
  }
  for (const dependency of forbiddenDependencies) {
    if (source.includes(`'${dependency}'`) || source.includes(`"${dependency}"`)) {
      throw new Error(`${relativePath} imports forbidden Flight Sim dependency ${dependency}`)
    }
  }
}

const featureIndexSource = await readText(`${flightFeatureRoot}/index.ts`)
requireMarkers(featureIndexSource, [
  "export * from './flightSimModel'",
  "export * from './flightSimSpatialProfile'",
  "export * from './flightSimMission'",
  "export * from './flightSimInput'",
  "export * from './flightSimRuntime'",
  "export * from './assetSpec/flightSimAssetSpec'",
  "export { FlightSimMissionStage } from './FlightSimMissionStage'",
  "export { FlightSimHud } from './FlightSimHud'",
], 'Flight Sim public feature surface')

const threeOwners = featureSources
  .filter(({ source }) => /from\s+['"](?:@react-three\/fiber|three(?:\/[^'"]*)?)['"]/.test(source))
  .map(({ relativePath }) => relativePath)
if (
  threeOwners.length !== 1
  || threeOwners[0] !== `${flightFeatureRoot}/FlightSimMissionStage.tsx`
) {
  throw new Error(
    `Flight Sim Three ownership must remain actor-only in FlightSimMissionStage.tsx, received ${threeOwners.join(', ')}`,
  )
}

const ecsWorldOwners = featureSources
  .filter(({ source }) => /\bcreateWorld\s*\(/.test(source))
  .map(({ relativePath }) => relativePath)
if (
  ecsWorldOwners.length !== 1
  || ecsWorldOwners[0] !== `${flightFeatureRoot}/flightSimMission.ts`
) {
  throw new Error(
    `Flight Sim must create only its native ECS mission World, received ${ecsWorldOwners.join(', ')}`,
  )
}

const missionStageSource = await readText(`${flightFeatureRoot}/FlightSimMissionStage.tsx`)
requireMarkers(missionStageSource, [
  'export function FlightSimMissionStage',
  'readFlightSimSnapshot',
  'subscribeFlightSimSnapshot',
  'FLIGHT_SIM_AIRCRAFT_ASSET_SPEC',
  "shouldPauseOnPointerRelease: () => readXrNativeControllerCamera().mode === 'fixed-follow'", 'blocksProgrammaticCamera: false',
  "snapshot.phase === 'ready' || snapshot.phase === 'flying'",
  "gl.domElement.dataset.kgFlightSimFirstFrame = '1'",
], 'Flight Sim actor stage')
if (
  /<(?:Canvas|ambientLight|directionalLight|hemisphereLight|pointLight|spotLight|Environment|Sky|Stars|FlightSimHud)\b/.test(
    missionStageSource,
  )
  || /\b(?:terrain|arena|fallback world)\b/i.test(missionStageSource)
) {
  throw new Error('FlightSimMissionStage must render only Flight actors and objective overlays')
}

const gameplayOverlaySource = await readText('canvas/src/lib/three/ThreeGameplayOverlay.tsx')
requireMarkers(gameplayOverlaySource, [
  "import('@/features/game-flight-sim/FlightSimMissionStage')",
  'default: mod.FlightSimMissionStage',
  'if (props.flightSimActive)',
  '<FlightSimMissionStageLazy coordinateScale={props.coordinateScale} />',
], 'shared Three gameplay overlay')
const threeGraphSource = await readText('canvas/src/lib/three/ThreeGraph.impl.tsx')
requireMarkers(threeGraphSource, [
  "from '@/lib/three/ThreeGameplayOverlay'",
  'const flightStageActive = mode === \'xr\' && flightSimActive',
  '<ThreeGameplayMissionStage',
  'flightSimActive={flightStageActive}',
  'gameplayCoordinateScale={gameplayCoordinateScale}',
], 'shared Three renderer')
const flightCameraSource = await readText('canvas/src/features/three/useFlightSimCamera.ts')
requireMarkers(flightCameraSource, [
  "from '@/features/game-flight-sim/flightSimRuntime'",
  'readXrNativeControllerCamera().mode === \'fixed-follow\'',
  'controls.enablePan = false',
  'controls.enableRotate = false',
  'controls.enableZoom = false',
  'renderer.xr.isPresenting',
], 'shared Flight camera owner')
const controlsSource = await readText('canvas/src/features/three/Controls.tsx') + await readText('canvas/src/features/three/threeViewportInputOwnership.ts') + await readText('canvas/src/features/three/xrCameraPlaybackControlsRuntime.ts')
requireMarkers(controlsSource, [
  "from './useFlightSimCamera'",
  'useXrGameplayCameraArbitration({',
  'flightSimActive,',
  'coordinateScale: gameplayCoordinateScale',
  'blocksProgrammaticCamera: options.blocksProgrammaticCamera !== false', 'viewportInputOwnership.blocksProgrammaticCamera',
], 'shared camera arbitration')

const missionSource = await readText(`${flightFeatureRoot}/flightSimMission.ts`) + await readText(`${flightFeatureRoot}/flightSimDecisionAdmission.ts`)
requireMarkers(missionSource, [
  "from '../../../../ecs/index.js'",
  'createWorld({ systems: [flightSystem] })',
  'worldTick(mission.world, Object.freeze({',
  'controls: normalizeFlightSimInput(input),',
  'result.deferred_decisions.length !== 0 || result.cost_logs.length !== 1',
  'FLIGHT_SIM_MAX_MISSION_TICKS',
  'FLIGHT_SIM_TIMEOUT_COLLIDER_ID',
  'export function cloneFlightSimMission',
  'export function validateFlightSimMissionDecisions', 'Flight Sim completion requires the full waypoint history', 'flightSimDecisionId(runId, tick, event, suffix)',
  "cost.model !== 'none'",
  'cost.prompt_tokens !== 0',
  'cost.completion_tokens !== 0',
  'cost.cache_hits !== 0',
  'cost.estimated_cost_usd !== 0',
  'cost.incomplete !== false',
  'return FLIGHT_SIM_ZERO_COST_LOG',
], 'native Flight Sim ECS mission')

const modelSource = await readText(`${flightFeatureRoot}/flightSimModel.ts`)
requireMarkers(modelSource, [
  'export const FLIGHT_SIM_FIXED_STEP_SECONDS = 1 / 60',
  'export const FLIGHT_SIM_MAX_MISSION_TICKS = 60 * 90', 'export const FLIGHT_SIM_MAX_PERSISTED_RUN_ID',
  'export const FLIGHT_SIM_MISSION_ENTITY_REF',
  'export const FLIGHT_SIM_NEUTRAL_INPUT: FlightSimTickInput = Object.freeze({',
  "model: 'none'",
  'prompt_tokens: 0',
  'completion_tokens: 0',
  'cache_hits: 0',
  'estimated_cost_usd: 0',
  'incomplete: false',
  'return Object.freeze({',
  'exactKeys(payload, eventPayloadKeys',
  'Flight Sim Decision decisionId is not canonical', 'Flight Sim Decision producedAt is not canonical',
], 'immutable Flight Sim model')
const runtimeSource = await readText(`${flightFeatureRoot}/flightSimRuntime.ts`)
requireMarkers(runtimeSource, [
  'type AdvanceRequest = Readonly<{',
  'input: FlightSimTickInput',
  'const captured = capturedInput()',
  'const request = Object.freeze({',
  'input: captured.input,',
  'throttleSetpoint: captured.throttleSetpoint,',
  'const workingMission = cloneFlightSimMission(activeMission)',
  'tickFlightSimMission(',
  'mission !== activeMission || generation !== request.generation',
  'mission = workingMission',
  'createFlightSimPendingDecisionIndex(freezeDecision)',
  'pendingDecisions.discardRun(runId)',
  'tickQueue.then(() => advanceCurrentMission(request))',
  'flightSimSurfaceOpenTail.then(() => performFlightSimSurfaceOpen(options))',
  'readFlightSimDecisionStore().hydrationBlocked', 'reportFlightSimDecisionLoadFailure(hydrated.runtimeError)',
  'defaultRuntime.resetPersistence()',
  'export async function persistFlightSimPendingDecisions',
  'const decisions = [...defaultRuntime.read().pendingDecisions]',
  'queueFlightSimDecisions(decisions)',
  'const saved = await persistPendingFlightSimDecisions(options)',
  "saved.status === 'saved' && decisions.length > 0",
  'defaultRuntime.acknowledgeDecisions(decisions.map(item => item.decisionId))',
], 'fixed-input Flight Sim runtime')
const pendingDecisionSource = await readText(`${flightFeatureRoot}/flightSimPendingDecisions.ts`)
requireMarkers(pendingDecisionSource, [
  'const flightStateIdByRun = new Map<number, string>()',
  'if (previousId) pending.delete(previousId)',
  'discardRun(runId)',
], 'bounded pending Flight Decisions')
const inputSource = await readText(`${flightFeatureRoot}/flightSimInput.ts`) + await readText(`${flightFeatureRoot}/flightSimMotionControlAdapter.ts`)
requireMarkers(inputSource, [
  'consumeInput()',
  "window.addEventListener('blur', onBlur)",
  "document.addEventListener('visibilitychange', onVisibilityChange)",
  'shouldRequestPointerLock?.() === false', "yaw: digital(codes.has('KeyQ'), codes.has('KeyE'))", 'yaw: input.modifier ? -input.moveX : 0',
], 'Flight input cancellation')
const simulationClockSource = await readText(
  `${flightFeatureRoot}/flightSimSimulationClock.ts`,
)
requireMarkers(simulationClockSource, [
  'export function createFlightSimSimulationClock',
  'if (disposed || running || !requested || scheduled) return',
  'lastStartedAt + options.minimumStepIntervalMs - now()',
  '.then(options.runStep)',
  'if (scheduled) cancelScheduled(scheduled.handle)',
], 'serialized Flight Sim simulation clock')

const spatialProfileSource = await readText(`${flightFeatureRoot}/flightSimSpatialProfile.ts`)
requireMarkers(spatialProfileSource, [
  "from '@/features/three/xrCanonicalSceneSpatialSource'",
  'resolveXrCanonicalSceneProjection',
  'resolveXrCanonicalSceneSpatialSource',
  'export function createFlightSimSpatialProfile',
  'export function readFlightSimXrSpatialProfile',
  'export function resolveFlightSimAabbMotion',
  "'flight-sim:boundary-west'",
  "'flight-sim:boundary-ceiling'",
  'startedOverlapping?.penetration',
], 'canonical XR Flight Sim spatial profile')
const hudSource = await readText(`${flightFeatureRoot}/FlightSimHud.tsx`)
requireMarkers(hudSource, [
  'data-kg-flight-sim-pitch',
  'data-kg-flight-sim-roll',
  'data-kg-flight-sim-save-status', 'data-kg-flight-sim-effective-save-status',
  'grid min-w-0 grid-cols-3', 'disabled={!flightControlsEnabled}',
  "'Retry save'",
], 'Flight HUD readiness')
const cameraPanelSource = await readText('canvas/src/features/strybldr/cameraPanelSurfaceRuntime.ts')
requireMarkers(cameraPanelSource, [
  "state.canvas3dMode === 'xr'",
  'if (state.floatingPanelOpen) return true',
], 'shared Camera companion continuity')

const seedSource = await readText(flightSeedPath)
const seed = parseFrontmatter(seedSource, flightSeedPath)
const runReadyDemo = seed.run_ready_demo
const sharedScene = seed.shared_xr_scene
const assetPipeline = seed.asset_pipeline
const flightSim = seed.flight_sim
if (
  seed.status !== 'runtime-ready'
  || seed.runtime_status !== 'runtime-ready'
  || seed.runtime_claim !== 'local-runtime-ready'
  || seed.publish_scope !== 'local-only'
  || !runReadyDemo
  || runReadyDemo.id !== 'flight-sim'
  || runReadyDemo.activation !== 'applied-source-document'
  || runReadyDemo.identity_conflict !== 'fail closed when path and source identity disagree'
  || runReadyDemo.canonical_source_file !== `/${flightSeedPath}`
  || runReadyDemo.presentation !== 'shared-xr-gameplay-overlay'
  || !Array.isArray(runReadyDemo.external_dependencies)
  || runReadyDemo.external_dependencies.length !== 0
  || !sharedScene
  || sharedScene.source_authority !== `/${physicsSeedPath}`
  || sharedScene.world_ownership !== 'overlay-only'
  || sharedScene.renderer_owner !== 'canvas/src/lib/three/ThreeGraph.impl.tsx'
  || sharedScene.collider_owner !== 'canvas/src/features/three/xrCanonicalSceneSpatialSource.ts'
  || sharedScene.second_canvas_forbidden !== true
  || !flightSim
  || flightSim.invocation !== '/flight.sim @canvas #flight operation=open'
  || flightSim.inspect_tool !== 'knowgrph.inspect_local_flight_sim'
  || flightSim.control_tool !== 'knowgrph.control_local_flight_sim'
) {
  throw new Error('Flight Sim seed must remain a source-authored overlay on the canonical XR world')
}
if (
  !assetPipeline
  || !String(assetPipeline.primary || '').includes('TypeScript + JSON')
  || !String(assetPipeline.admission || '').includes('only the exact TypeScript+JSON')
  || !String(assetPipeline.opaque_binary_fallback || '').includes('not admitted')
  || assetPipeline.glb_fallback_count !== 0
  || assetPipeline.runtime_model_calls !== 0
  || assetPipeline.runtime_network_calls !== 0
) {
  throw new Error('Flight Sim seed must retain TypeScript+JSON-only, zero-fallback asset authority')
}

const runReadySource = await readText('canvas/src/features/workspace-fs/workspaceRunReadyDemos.ts')
requireMarkers(runReadySource, [
  "export const FLIGHT_SIM_RUN_READY_DEMO_ID = 'flight-sim'",
  'export const resolveWorkspaceRunReadyDemoIdForDocument = (',
  "if (!sourceId || (pathId && pathId !== sourceId)) return ''",
  'readWorkspaceRunReadyDemoId(documentPath, documentText) === FLIGHT_SIM_RUN_READY_DEMO_ID',
], 'source-authored Flight Sim activation')
const activationSource = await readText('canvas/src/features/canvas/FlightSimRunReadyDemoRuntime.tsx')
requireMarkers(activationSource, [
  'isFlightSimRunReadyDemoActive(markdownDocumentName, markdownDocumentText)',
  'ownsDocumentLaunchRef',
  'exitFlightSimSurface({ restorePreviousSurface: false })',
], 'Flight Sim source activation runtime')

const seedAuthoritySource = await readText('scripts/workspace-seed-authority.mjs')
const projectionStart = seedAuthoritySource.indexOf('AGENTIC_WORKSPACE_SEED_PROJECTION_INVENTORY')
const projectionEnd = seedAuthoritySource.indexOf('])', projectionStart)
const projectionInventory = seedAuthoritySource.slice(projectionStart, projectionEnd + 2)
if (
  projectionStart < 0
  || !projectionInventory.includes('PHYSICS_SEED_BASENAME')
  || projectionInventory.includes('FLIGHT_SEED_BASENAME')
) {
  throw new Error('Flight Sim must remain local-only until a separate protected Agentic projection')
}

const assetSpecPath = `${flightFeatureRoot}/assetSpec/vehicle-airplane.scene.json`
const assetSpec = JSON.parse(await readText(assetSpecPath))
if (
  assetSpec.schema !== 'knowgrph.img2threejs-scene/v1'
  || assetSpec.id !== 'vehicle-airplane'
  || assetSpec.representation !== 'typescript-json'
  || assetSpec.renderer !== 'xr-procedural-vehicle'
  || assetSpec.opaqueBinaryFallback !== null
  || assetSpec.runtimeModelCalls !== 0
  || assetSpec.runtimeNetworkCalls !== 0
) {
  throw new Error('Flight Sim aircraft must use the committed local TypeScript+JSON spec as primary')
}
const assetLoaderSource = await readText(`${flightFeatureRoot}/assetSpec/flightSimAssetSpec.ts`)
requireMarkers(assetLoaderSource, [
  "source.representation !== 'typescript-json'",
  'source.opaqueBinaryFallback !== null',
  'source.runtimeModelCalls !== 0 || source.runtimeNetworkCalls !== 0',
  'export const FLIGHT_SIM_OPAQUE_BINARY_FALLBACK_COUNT = 0',
], 'Flight Sim asset-spec loader')
const unexpectedGlbFiles = allFeaturePaths.filter(relativePath => /\.glb$/i.test(relativePath))
if (unexpectedGlbFiles.length > 0) {
  throw new Error(
    `Flight Sim Must scope has a TypeScript+JSON spec and must not ship an opaque GLB: ${unexpectedGlbFiles.join(', ')}`,
  )
}

const decisionStoreSource = await readText(`${flightFeatureRoot}/flightSimDecisionStore.ts`)
requireMarkers(decisionStoreSource, [
  "from '@/features/workspace-fs/workspaceDecisionStore'",
  "'/game-flight-sim/mission-1-decisions.md'",
  'validateDecisions: validateFlightSimDecisions',
], 'Flight Sim Decision-store wrapper')
const genericDecisionStoreSource = await readText(
  'canvas/src/features/workspace-fs/workspaceDecisionStore.ts',
)
requireMarkers(genericDecisionStoreSource, [
  "from '../../../../ecs/decisionDocument.js'",
  'const pending = new Map<string, TDecision>()',
  'let mutationQueue: Promise<WorkspaceDecisionStoreSnapshot> | null = null',
  'if (snapshot.hydrationBlocked) return publish({})',
  'verification.persistedCount !== 0',
  'verification.idempotentCount !== batch.length',
  'Decision save rollback read-back mismatch',
], 'generic browser-local Decision store')
if (/from\s+['"]node:|persistDecisions|persistDecision\s*\(/.test(genericDecisionStoreSource)) {
  throw new Error('generic Workspace Decision persistence must remain browser-safe')
}

const contractModule = await import(pathToFileURL(
  path.join(repositoryRoot, `${flightFeatureRoot}/flightSimMcpContract.mjs`),
).href)
if (
  contractModule.FLIGHT_SIM_MCP_SCHEMA !== 'knowgrph-flight-sim-mcp/v1'
  || JSON.stringify(contractModule.FLIGHT_SIM_WEB_MCP_TOOL_IDS) !== JSON.stringify({
    inspect: 'inspect_local_flight_sim',
    control: 'control_local_flight_sim',
  })
  || JSON.stringify(contractModule.FLIGHT_SIM_INVOCATION_COMMANDS) !== JSON.stringify({
    control: '/flight.sim',
  })
  || JSON.stringify(contractModule.FLIGHT_SIM_INVOCATION_BINDINGS) !== JSON.stringify({
    canvas: '@canvas',
  })
  || JSON.stringify(contractModule.FLIGHT_SIM_INVOCATION_SEMANTICS) !== JSON.stringify({
    flight: '#flight',
  })
) {
  throw new Error('Flight Sim must retain one strict native invocation tuple and two WebMCP ids')
}

const agentReadyModule = await import(pathToFileURL(
  path.join(repositoryRoot, 'canvas/src/features/agent-ready/flightSimAgentReadyContract.mjs'),
).href)
const agentReadyContracts = agentReadyModule.buildFlightSimAgentReadyToolContracts({
  buildWebName: name => `knowgrph.${name}`,
  readOnlyAnnotations: Object.freeze({ readOnlyHint: true }),
  mutationAnnotations: Object.freeze({ readOnlyHint: false }),
})
if (
  agentReadyContracts.length !== 2
  || JSON.stringify(agentReadyContracts.map(contract => contract.webName)) !== JSON.stringify([
    'knowgrph.inspect_local_flight_sim',
    'knowgrph.control_local_flight_sim',
  ])
) {
  throw new Error('Flight Sim must expose exactly two browser-local Agent Ready tools')
}
const webMcpRuntimeSource = await readText('canvas/src/features/agent-ready/webMcpRuntime.ts')
requireMarkers(webMcpRuntimeSource, [
  'FLIGHT_SIM_WEB_MCP_TOOL_BUILDERS',
  '...FLIGHT_SIM_WEB_MCP_TOOL_BUILDERS',
], 'browser WebMCP registry')
const flightMcpRuntimeSource = await readText(`${flightFeatureRoot}/flightSimMcpRuntime.ts`)
requireMarkers(flightMcpRuntimeSource, [
  'persistFlightSimPendingDecisions',
  'const saved = await persistFlightSimPendingDecisions()',
], 'Flight Sim MCP save facade')
if (/\bpersistPendingFlightSimDecisions\b/.test(flightMcpRuntimeSource)) {
  throw new Error('Flight Sim MCP must save through the core runtime acknowledgement facade')
}

const serverSourcePaths = [
  ...(await listFiles('mcp')),
  ...(await listFiles('cloudflare/workers/knowgrph-mcp')),
].filter(relativePath => (
  /\.(?:js|mjs|cjs|ts|tsx|json)$/.test(relativePath)
  && !relativePath.includes('/__tests__/')
  && !relativePath.includes('/__pbt__/')
))
for (const relativePath of serverSourcePaths) {
  const source = await readText(relativePath)
  if (
    source.includes('inspect_local_flight_sim')
    || source.includes('control_local_flight_sim')
    || source.includes('/flight.sim')
  ) {
    throw new Error(`Flight Sim must not register a stdio or HTTP tool in ${relativePath}`)
  }
}

const rootPackage = JSON.parse(await readText('package.json'))
const canvasPackage = JSON.parse(await readText('canvas/package.json'))
const dependencies = {
  ...rootPackage.dependencies,
  ...rootPackage.devDependencies,
  ...canvasPackage.dependencies,
  ...canvasPackage.devDependencies,
}
for (const dependency of forbiddenDependencies) {
  if (Object.hasOwn(dependencies, dependency)) {
    throw new Error(`Flight Sim must not add external engine dependency ${dependency}`)
  }
}

const sourceTestCommand = canvasPackage.scripts?.['test:smoke:game-flight-sim:source'] || ''
requireMarkers(sourceTestCommand, [
  '--test-concurrency=1',
  'src/__tests__/flightSim*.test.ts',
  'src/__tests__/xrAgenticEcsComposition.test.ts',
], 'Flight Sim focused source-test command')
if (/--test-concurrency=(?!1\b)/.test(sourceTestCommand)) {
  throw new Error('Flight Sim focused source tests must run serially')
}

const runtimeReadyCommand = rootPackage.scripts?.['game-flight-sim:runtime-ready'] || ''
requireOrderedMarkers(runtimeReadyCommand, [
  'npm run smoke:prepare',
  'node ./scripts/check-game-flight-sim-readiness.mjs',
  'npm run ecs:test',
  'npm -C canvas run test:smoke:game-flight-sim:source',
  'npm -C canvas run check',
  'KG_SKIP_DOCS_UPDATE=1 npm -C canvas run build',
], 'Flight Sim runtime-ready command')
if (/(?:browser-smoke|wrangler|deploy|cloudflare)/i.test(runtimeReadyCommand)) {
  throw new Error('Flight Sim source readiness must remain Dev-only and deployment-free')
}

const sourceTestPaths = (await listFiles('canvas/src/__tests__'))
  .filter(relativePath => /\/flightSim.*\.test\.ts$/.test(relativePath))
if (sourceTestPaths.length < 3) {
  throw new Error('Flight Sim requires focused source tests for runtime, persistence, and invocation authority')
}

console.log(
  `OK flight-sim source readiness (${featurePaths.length} feature files, ${sourceTestPaths.length} focused test files, browser-only MCP pair)`,
)
