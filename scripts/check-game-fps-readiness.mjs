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
  'canvas/src/features/game-fps/gameFpsDecisionStore.ts',
  'canvas/src/features/game-fps/gameModeRuntime.ts',
  'canvas/src/features/game-fps/gameModeXrSpatialProfile.ts',
  'canvas/src/features/game-fps/gameModeMcpContract.mjs',
  'canvas/src/features/game-fps/gameModeMcpRuntime.ts',
  'canvas/src/features/game-fps/GameModeFloatingPanelView.tsx',
  'canvas/src/features/game-fps/GameFpsMissionStage.tsx',
  'canvas/src/features/game-fps/GameFpsHud.tsx',
  'canvas/src/features/canvas/GameFpsRunReadyDemoRuntime.tsx',
  'canvas/src/features/three/xrCanonicalSceneSpatialSource.ts',
  'canvas/src/features/three/xrSceneSurfaceRuntime.ts',
  'canvas/src/features/three/toolbarXrScenePanelRouting.ts',
  'canvas/src/lib/canvas/canvasSurfaceOwnershipRuntime.ts',
  'canvas/src/__tests__/gameFpsMissionCore.test.ts',
  'canvas/src/__tests__/gameFpsRuntimeConcurrency.test.ts',
  'canvas/src/__tests__/gameModeRuntime.test.ts',
  'canvas/src/__tests__/gameModePersistenceRuntime.test.ts',
  'canvas/src/__tests__/gameModeSpatialSourceRuntime.test.ts',
  'canvas/src/__tests__/canvasSurfaceGameDeparture.test.ts',
  'canvas/src/__tests__/canvasXrSharedSurfaceOwnership.test.ts',
  'docs/workspace-seeds/knowgrph-game-fps-demo.md',
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

try {
  await stat(path.join(root, 'canvas/src/features/game-fps/gameModeSceneComposition.ts'))
  throw new Error('the deleted Game-owned replacement scene source must remain absent')
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
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
const missionStageTags = [...missionStageSource.matchAll(/^\s*<([a-z][A-Za-z0-9]*)\b/gm)].map(match => match[1])
const missionStageComponentTags = [...missionStageSource.matchAll(/^\s*<([A-Z][A-Za-z0-9]*)\b/gm)].map(match => match[1])
const allowedMissionStageTags = ['group', 'mesh', 'capsuleGeometry', 'meshStandardMaterial']
if (missionStageTags.length !== allowedMissionStageTags.length
  || missionStageTags.some(tag => !allowedMissionStageTags.includes(tag))
  || missionStageComponentTags.length > 0) {
  throw new Error(`Game FPS stage must contain only its actor root and NPC mesh template, received ${[...missionStageTags, ...missionStageComponentTags].join(', ')}`)
}

const seedPath = 'docs/workspace-seeds/knowgrph-game-fps-demo.md'
const seed = parseFrontmatter(await text(seedPath), seedPath)
if (seed?.run_ready_demo?.id !== 'game-fps') throw new Error('game-fps seed id is not canonical')
if (seed?.mission?.npc_count !== 4) throw new Error('game-fps seed must declare exactly four NPCs')
if (seed?.mission?.model_calls !== 0 || seed?.mission?.network_required !== false) {
  throw new Error('game-fps seed must declare a zero-model, local-only mission')
}
if (seed?.persistence?.automatic_git_commit !== false) {
  throw new Error('game-fps seed must not claim automatic Git commits')
}
if (seed?.kgFloatingPanelView !== 'gameMode' || seed?.kgFloatingPanelOpen !== true) {
  throw new Error('game-fps seed must open the canonical Game Mode FloatingPanel')
}
if (seed?.kgCanvasRenderMode !== '3d' || seed?.kgCanvasSurfaceMode !== 'xr' || seed?.kgCanvas3dMode !== 'xr') {
  throw new Error('game-fps seed must select the canonical shared XR Canvas surface')
}
if (seed?.game_mode?.invocation !== '/game.mode @canvas #gameplay operation=start'
  || seed?.game_mode?.inspect_tool !== 'knowgrph.inspect_local_game_mode'
  || seed?.game_mode?.control_tool !== 'knowgrph.control_local_game_mode') {
  throw new Error('game-fps seed must declare the canonical Game Mode invocation and browser WebMCP pair')
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

console.log(`OK game-fps source contract (${featureFiles.length} feature modules, authored-XR local-only mission)`)
