import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { load as loadYaml } from 'js-yaml'

const root = process.cwd()
const requiredPaths = [
  'canvas/src/features/game-fps/gameFpsModel.ts',
  'canvas/src/features/game-fps/gameFpsMission.ts',
  'canvas/src/features/game-fps/gameFpsRuntime.ts',
  'canvas/src/features/game-fps/gameFpsDecisionStore.ts',
  'canvas/src/features/game-fps/gameModeRuntime.ts',
  'canvas/src/features/game-fps/gameModeMcpContract.mjs',
  'canvas/src/features/game-fps/gameModeMcpRuntime.ts',
  'canvas/src/features/game-fps/GameModeFloatingPanelView.tsx',
  'canvas/src/features/game-fps/GameFpsMissionStage.tsx',
  'canvas/src/features/game-fps/GameFpsHud.tsx',
  'canvas/src/features/canvas/GameFpsRunReadyDemoRuntime.tsx',
  'canvas/src/__tests__/gameFpsMissionCore.test.ts',
  'canvas/src/__tests__/gameModeRuntime.test.ts',
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

function parseFrontmatter(markdown, relPath) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)
  if (!match) throw new Error(`${relPath} must begin with YAML frontmatter`)
  return loadYaml(match[1])
}

for (const relPath of requiredPaths) await text(relPath)

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
  for (const [pattern, label] of forbiddenRuntimePatterns) {
    if (pattern.test(source)) throw new Error(`${name} contains forbidden runtime capability ${label}`)
  }
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
if (seed?.game_mode?.invocation !== '/game.mode @canvas #gameplay operation=start'
  || seed?.game_mode?.inspect_tool !== 'knowgrph.inspect_local_game_mode'
  || seed?.game_mode?.control_tool !== 'knowgrph.control_local_game_mode') {
  throw new Error('game-fps seed must declare the canonical Game Mode invocation and browser WebMCP pair')
}

const threeGraph = await text('canvas/src/lib/three/ThreeGraph.impl.tsx')
const stageMounts = threeGraph.match(/<GameFpsMissionStageLazy\b/g)?.length ?? 0
if (stageMounts !== 1) throw new Error(`expected one Game FPS stage mount, received ${stageMounts}`)
if (!threeGraph.includes('!gameFpsActive ? <ControlsLazy')) {
  throw new Error('Game FPS must suppress the shared OrbitControls owner')
}

console.log(`OK game-fps source contract (${featureFiles.length} feature modules, procedural local-only mission)`)
