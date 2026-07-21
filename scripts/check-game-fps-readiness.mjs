import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { load as loadYaml } from 'js-yaml'

const root = process.cwd()
const requiredPaths = [
  'canvas/src/features/game-fps/gameFpsModel.ts',
  'canvas/src/features/game-fps/gameFpsMission.ts',
  'canvas/src/features/game-fps/gameFpsNpcPolicy.ts',
  'canvas/src/features/game-fps/gameFpsRuntime.ts',
  'canvas/src/features/game-fps/gameFpsSimulationClock.ts',
  'canvas/src/features/game-fps/gameFpsDecisionStore.ts',
  'canvas/src/features/game-fps/gameModeRuntime.ts',
  'canvas/src/features/game-fps/gameModeXrSpatialProfile.ts',
  'canvas/src/features/game-fps/gameModeMcpContract.mjs',
  'canvas/src/features/game-fps/gameModeMcpRuntime.ts',
  'canvas/src/features/game-fps/GameModeFloatingPanelView.tsx',
  'canvas/src/features/game-fps/GameFpsMissionStage.tsx',
  'canvas/src/features/game-fps/GameFpsHud.tsx',
  'canvas/src/features/canvas/CanvasStartupRuntimes.tsx',
  'canvas/src/features/workspace-fs/workspaceRunReadyDemos.ts',
  'canvas/src/features/three/xrCanonicalSceneSpatialSource.ts',
  'canvas/src/features/three/xrSceneSurfaceRuntime.ts',
  'canvas/src/features/three/toolbarXrScenePanelRouting.ts',
  'canvas/src/lib/canvas/canvasSurfaceOwnershipRuntime.ts',
  'canvas/src/__tests__/gameFpsMissionCore.test.ts',
  'canvas/src/__tests__/gameFpsRuntimeConcurrency.test.ts',
  'canvas/src/__tests__/gameModeRuntime.test.ts',
  'canvas/src/__tests__/gameModeMotionInputRuntime.test.ts',
  'canvas/src/__tests__/gameModePersistenceRuntime.test.ts',
  'canvas/src/__tests__/gameModeSpatialSourceRuntime.test.ts',
  'canvas/src/__tests__/gameModeSourceAuthority.test.ts',
  'canvas/src/__tests__/canvasSurfaceGameDeparture.test.ts',
  'canvas/src/__tests__/canvasXrSharedSurfaceOwnership.test.ts',
  'docs/workspace-seeds/knowgrph-physics-playground-demo.md',
  'docs/documents/knowgrph-game-fps-prd-tad.md',
  'docs/documents/knowgrph-game-fps-runtime-readiness.md',
  'ecs/decisionDocument.js',
]
const forbiddenDependencies = [
  '@dimforge/rapier3d',
  '@dimforge/rapier3d-compat',
  'bitecs',
  'behaviortree',
  'recast-navigation',
  'recastnavigation',
  'yuka',
]
const forbiddenRuntimePatterns = [
  [/\bfetch\s*\(/, 'fetch'],
  [/\bWebSocket\s*\(/, 'WebSocket'],
  [/navigator\.credentials/, 'navigator.credentials'],
  [/getUserMedia\s*\(/, 'getUserMedia'],
  [/requestReasoning\s*\(/, 'requestReasoning'],
]

async function text(relPath) {
  return readFile(path.join(root, relPath), 'utf8')
}

async function listProductionSourceFiles(absDir) {
  const entries = await readdir(absDir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const absPath = path.join(absDir, entry.name)
    if (entry.isDirectory()) return listProductionSourceFiles(absPath)
    if (!entry.isFile()) return []
    const relPath = path.relative(root, absPath).split(path.sep).join('/')
    if (!/\.(?:jsx?|mjs|tsx?)$/.test(relPath)
      || /(?:^|\/)(?:__tests__|tests)(?:\/|$)/.test(relPath)
      || /\.test\.[^.]+$/.test(relPath)) return []
    return [relPath]
  }))
  return nested.flat()
}

function parseFrontmatter(markdown, relPath) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)
  if (!match) throw new Error(`${relPath} must begin with YAML frontmatter`)
  return loadYaml(match[1])
}

for (const relPath of requiredPaths) await text(relPath)

const forbiddenStandaloneSourcePaths = [
  'canvas/src/features/canvas/GameFpsRunReadyDemoRuntime.tsx',
  'canvas/src/features/game-fps/gameModeSceneComposition.ts',
  'canvas/src/__tests__/gameFpsPersistedSeed.test.ts',
  'canvas/src/__tests__/gameFpsRunReadyContract.test.ts',
  'canvas/src/tests/subsetGameFpsSmoke.ts',
  'docs/workspace-seeds/knowgrph-game-fps-demo.md',
]
for (const relPath of forbiddenStandaloneSourcePaths) {
  try {
    await stat(path.join(root, relPath))
    throw new Error(`the deleted standalone Game Mode source must remain absent: ${relPath}`)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

const standaloneRouteOwners = [
  ['canvas/src/features/canvas/CanvasStartupRuntimes.tsx', /GameFpsRunReadyDemoRuntime/],
  ['canvas/src/features/workspace-fs/workspaceRunReadyDemos.ts', /GAME_FPS_(?:RUN_READY_DEMO_ID|DEMO_)|isGameFpsRunReadyDemoActive|knowgrph-game-fps-demo\.md/],
  ['canvas/src/components/CanvasViewport.tsx', /isGameFpsRunReadyDemoActive|gameFpsRunReadyDemo/],
  ['canvas/src/pages/Canvas.tsx', /isGameFpsRunReadyDemoActive|gameFpsRunReadyDemo|data-kg-game-fps-run-ready/],
  ['canvas/package.json', /"(?:predev|dev):game-fps"|VITE_KNOWGRPH_RUN_READY_DEMO=game-fps|gameFpsPersistedSeed|subsetGameFpsSmoke/],
  ['canvas/src/tests/registry/postParserCases7.ts', /gameFpsRunReadyContract|canvas\.gameFps\.runReady|activeSourceSkipsDocsMirror/],
  ['package.json', /"demo:game-fps"/],
]
for (const [relPath, pattern] of standaloneRouteOwners) {
  if (pattern.test(await text(relPath))) {
    throw new Error(`standalone Game Mode source authority returned in ${relPath}`)
  }
}

const canvasPackage = JSON.parse(await text('canvas/package.json'))
const dependencies = { ...canvasPackage.dependencies, ...canvasPackage.devDependencies }
for (const dependency of forbiddenDependencies) {
  if (Object.hasOwn(dependencies, dependency)) {
    throw new Error(`Game FPS must not add ${dependency}`)
  }
}

const featureDir = path.join(root, 'canvas/src/features/game-fps')
const featureFiles = (await readdir(featureDir)).filter(name => /\.(?:tsx?|mjs)$/.test(name)).sort()
const featureSources = await Promise.all(featureFiles.map(async name => ({
  name,
  source: await readFile(path.join(featureDir, name), 'utf8'),
})))
for (const { name, source } of featureSources) {
  if (source.split(/\r?\n/).length > 600) throw new Error(`${name} exceeds 600 lines`)
  if (/<Canvas(?:\s|>)/.test(source)) throw new Error(`${name} must reuse the existing Three Canvas`)
  if (/arena|fallback/i.test(`${name}\n${source}`)) {
    throw new Error(`${name} contains forbidden alternate scene ownership`)
  }
  for (const [pattern, label] of forbiddenRuntimePatterns) {
    if (pattern.test(source)) throw new Error(`${name} contains forbidden runtime capability ${label}`)
  }
}

const gameThreeOwners = featureSources
  .filter(({ source }) => /@react-three\/fiber|from ['"]three['"]/.test(source))
  .map(({ name }) => name)
if (gameThreeOwners.length !== 1 || gameThreeOwners[0] !== 'GameFpsMissionStage.tsx') {
  throw new Error(`Game FPS Three ownership must be actor-only in GameFpsMissionStage.tsx, received ${gameThreeOwners.join(', ')}`)
}

const productionSourcePaths = (await listProductionSourceFiles(path.join(root, 'canvas/src'))).sort()
const productionSources = await Promise.all(productionSourcePaths.map(async relPath => ({
  relPath,
  source: await text(relPath),
})))
const gameAwarePattern = /\b(?:GameFpsMissionStage|gameFpsActive|gameMode\.active|readGameModeSnapshot|subscribeGameModeSnapshot)\b|from\s+['"][^'"]*(?:features\/game-fps|\/game-fps\/|\.\/game(?:Fps|Mode))/
const threePresentationPattern = /@react-three\/fiber|from\s+['"]three(?:\/|['"])|<(?:Canvas|primitive|group|mesh|ambientLight|directionalLight|hemisphereLight|pointLight|spotLight|Environment|Sky|Stars|[A-Za-z][A-Za-z0-9]*Geometry)\b/
const gameAwareThreeOwners = productionSources
  .filter(({ source }) => gameAwarePattern.test(source) && threePresentationPattern.test(source))
  .map(({ relPath }) => relPath)
const expectedGameAwareThreeOwners = [
  'canvas/src/features/game-fps/GameFpsMissionStage.tsx',
  'canvas/src/lib/three/ThreeGraph.impl.tsx',
]
if (JSON.stringify(gameAwareThreeOwners) !== JSON.stringify(expectedGameAwareThreeOwners)) {
  throw new Error(`Game-aware Three ownership must remain renderer mount plus actor-only stage, received ${gameAwareThreeOwners.join(', ')}`)
}
const missionStageSource = featureSources.find(({ name }) => name === 'GameFpsMissionStage.tsx')?.source || ''
const simulationClockSource = featureSources.find(({ name }) => name === 'gameFpsSimulationClock.ts')?.source || ''
const modelSource = featureSources.find(({ name }) => name === 'gameFpsModel.ts')?.source || ''
const decisionStoreSource = featureSources.find(({ name }) => name === 'gameFpsDecisionStore.ts')?.source || ''
const missionStageTags = [...missionStageSource.matchAll(/^\s*<([a-z][A-Za-z0-9]*)\b/gm)].map(match => match[1])
const missionStageComponentTags = [...missionStageSource.matchAll(/^\s*<([A-Z][A-Za-z0-9]*)\b/gm)].map(match => match[1])
const allowedMissionStageTags = ['group', 'mesh', 'capsuleGeometry', 'meshStandardMaterial']
if (missionStageTags.length !== allowedMissionStageTags.length
  || missionStageTags.some(tag => !allowedMissionStageTags.includes(tag))
  || missionStageComponentTags.length > 0) {
  throw new Error(`Game FPS stage must contain only its actor root and NPC mesh template, received ${[...missionStageTags, ...missionStageComponentTags].join(', ')}`)
}
if (!modelSource.includes('export const GAME_FPS_FIXED_STEP_SECONDS = 1 / 60')
  || !missionStageSource.includes('window.setInterval(clock.requestStep, SIMULATION_CLOCK_INTERVAL_MS)')
  || !missionStageSource.includes('window.clearInterval(timer)')
  || !missionStageSource.includes('clock.dispose()')
  || !missionStageSource.includes('bindGameFpsSimulationInputQueue(clock.queueInputStep)')
  || !missionStageSource.includes('advanceGameModeSimulationBy(GAME_FPS_FIXED_STEP_SECONDS)')
  || missionStageSource.includes('advanceGameModeSimulationBy(deltaSeconds)')
  || !missionStageSource.includes('minimumStepIntervalMs: SIMULATION_CLOCK_INTERVAL_MS')
  || !missionStageSource.includes('onStepError: reportGameModeSimulationFailure')
  || !missionStageSource.includes('isMotionControlPoseTracked(pose)')
  || !simulationClockSource.includes('lastStepStartedAt + options.minimumStepIntervalMs - now()')
  || !simulationClockSource.includes('queueInputStep: requestStep')) {
  throw new Error('Game Mode must retain one fixed, disposable, input-queued simulation clock with visible failures')
}
if (!missionStageSource.includes('readGameModeSnapshot().simulationStatus')
  || missionStageSource.includes('subscribeGameModeSnapshot')
  || missionStageSource.includes('useSyncExternalStore')) {
  throw new Error('Game Mode simulation gating must read the runtime owner without a render-loop subscription')
}
if (!missionStageSource.includes('readyFrameCountRef.current >= READY_FRAME_COUNT')
  || !missionStageSource.includes('deltaSeconds <= GAME_FPS_MAX_FRAME_SECONDS')) {
  throw new Error('Game Mode browser readiness must wait for a settled retained-Canvas frame pump')
}
if (!decisionStoreSource.includes("from '../../../../ecs/decisionDocument.js'")
  || /from\s+['"]node:|persistDecisions|persistDecision\s*\(/.test(decisionStoreSource)
  || !decisionStoreSource.includes('verification.persistedCount !== 0')) {
  throw new Error('Game Mode Decisions must retain the canonical browser-safe merge and verified read-back owner')
}

const physicsSeedPath = 'docs/workspace-seeds/knowgrph-physics-playground-demo.md'
const physicsSeedSource = await text(physicsSeedPath)
const physicsSeed = parseFrontmatter(physicsSeedSource, physicsSeedPath)
if (physicsSeed?.run_ready_demo?.id !== 'xr-physics') {
  throw new Error('the canonical source seed must remain xr-physics')
}
if (physicsSeed?.game_mode?.invocation !== '/game.mode @canvas #gameplay operation=open'
  || physicsSeed?.game_mode?.operation_invocations?.start !== '/game.mode @canvas #gameplay operation=start'
  || physicsSeed?.game_mode?.inspect_tool !== 'knowgrph.inspect_local_game_mode'
  || physicsSeed?.game_mode?.control_tool !== 'knowgrph.control_local_game_mode') {
  throw new Error('the Physics source must declare explicit Game Mode overlay invocation and browser WebMCP ownership')
}

async function resolveAgenticCanvasOsDocsRoot() {
  const configured = String(process.env.KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT || '').trim()
  if (configured) {
    const resolved = path.resolve(configured)
    try {
      if ((await stat(resolved)).isDirectory()) return resolved
    } catch {
      // The configured source is mandatory when provided.
    }
    throw new Error(`KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT is not a readable directory: ${resolved}`)
  }
  const visited = new Set()
  let cursor = root
  while (true) {
    for (const candidate of [
      path.join(cursor, 'agentic-canvas-os', 'docs'),
      path.join(path.dirname(cursor), 'agentic-canvas-os', 'docs'),
    ]) {
      if (visited.has(candidate)) continue
      visited.add(candidate)
      try {
        if ((await stat(candidate)).isDirectory()) return candidate
      } catch {
        // Keep walking toward a shared workspace root.
      }
    }
    const parent = path.dirname(cursor)
    if (parent === cursor) return null
    cursor = parent
  }
}

const agenticCanvasOsDocsRoot = await resolveAgenticCanvasOsDocsRoot()
if (agenticCanvasOsDocsRoot) {
  const projectedPhysicsSeedPath = path.join(
    agenticCanvasOsDocsRoot,
    'workspace-seeds',
    'knowgrph-physics-playground-demo.md',
  )
  const projectedPhysicsSeedSource = await readFile(projectedPhysicsSeedPath, 'utf8')
  if (projectedPhysicsSeedSource !== physicsSeedSource) {
    throw new Error(`Physics source bytes differ from the Agentic Canvas OS projection: ${projectedPhysicsSeedPath}`)
  }
}

const threeGraph = await text('canvas/src/lib/three/ThreeGraph.impl.tsx')
const stageMounts = threeGraph.match(/<GameFpsMissionStageLazy\b/g)?.length ?? 0
if (stageMounts !== 1) throw new Error(`expected one Game FPS stage mount, received ${stageMounts}`)
const positiveGameConditionedMounts = [...threeGraph.matchAll(
  /(?<![!\w])(?:gameFpsActive|gameMode\.active)\s*(?:\?|&&)\s*<([A-Z][A-Za-z0-9]*)/g,
)].map(match => match[1])
if (positiveGameConditionedMounts.length !== 1
  || positiveGameConditionedMounts[0] !== 'GameFpsMissionStageLazy') {
  throw new Error(`Game-conditioned Three mounts must remain actor-only, received ${positiveGameConditionedMounts.join(', ')}`)
}
if (!threeGraph.includes('{!gameFpsActive ? <ControlsLazy')) {
  throw new Error('Game FPS must suppress the shared OrbitControls owner')
}
const xrWorldPlacement = threeGraph.match(/<XrWorldPlacement\b[\s\S]*?<\/XrWorldPlacement>/)?.[0] || ''
const authoredWorldTargets = ['SceneLazy', 'GlbAssetModel', 'SpatialCaptureManifestStage']
const missingPauseTargets = authoredWorldTargets.filter(component => {
  const mount = xrWorldPlacement.match(new RegExp(`<${component}\\b[\\s\\S]*?\\n\\s*/>`))?.[0] || ''
  return !mount.includes('paused={authoredWorldPaused}')
})
const spatialCaptureMount = xrWorldPlacement.match(/<SpatialCaptureManifestStage\b[\s\S]*?\n\s*\/>/)?.[0] || ''
if (!xrWorldPlacement.includes('{gameFpsStage}')
  || !threeGraph.includes('const authoredWorldPaused = resolveAuthoredWorldPaused(paused, gameFpsActive)')
  || missingPauseTargets.length > 0
  || !spatialCaptureMount.includes('dimmed={paused}')
  || (xrWorldPlacement.match(/paused=\{authoredWorldPaused\}/g) || []).length !== authoredWorldTargets.length) {
  throw new Error(`XR Game Mode must freeze every retained authored-world branch; missing ${missingPauseTargets.join(',') || 'exact pause ownership'}`)
}

console.log(`OK game-mode source contract (${featureFiles.length} feature modules, one Physics source plus explicit authored-XR overlay)`)
