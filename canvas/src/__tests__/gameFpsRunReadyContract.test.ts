import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME,
  GAME_FPS_RUN_READY_DEMO_ID,
  isWorkspaceRepoLocalRunReadyBootstrap,
  isGameFpsRunReadyDemoActive,
  resolveWorkspaceRunReadyDemoIdForDocumentPath,
  resolveWorkspaceRunReadyDemoSeed,
} from '@/features/workspace-fs/workspaceRunReadyDemos'
import { readWorkspaceActiveDocumentResolvedText } from '@/features/source-files/sourceFilesRuntimeActive'

const repoRoot = path.resolve(process.cwd(), '..')

function source(relPath: string): string {
  return readFileSync(path.join(repoRoot, relPath), 'utf8')
}

export function testGameFpsRunReadyRegistryUsesCanonicalSourceDocument() {
  const seed = resolveWorkspaceRunReadyDemoSeed(GAME_FPS_RUN_READY_DEMO_ID)
  if (
    !seed
    || seed.validationSeedRelPath !== GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME
    || seed.sourceRoot !== 'knowgrph/docs'
    || seed.cleanCanvasRecommended !== true
  ) {
    throw new Error(`unexpected Game FPS run-ready seed ${JSON.stringify(seed)}`)
  }
  const canonicalPaths = [
    `/${GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME}`,
    `/workspace-seeds/${GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME}`,
    `/docs/workspace-seeds/${GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME}`,
  ]
  for (const canonicalPath of canonicalPaths) {
    if (resolveWorkspaceRunReadyDemoIdForDocumentPath(canonicalPath) !== GAME_FPS_RUN_READY_DEMO_ID) {
      throw new Error(`canonical Game FPS source path did not activate: ${canonicalPath}`)
    }
    if (!isGameFpsRunReadyDemoActive(canonicalPath)) {
      throw new Error(`Game FPS helper rejected canonical source path: ${canonicalPath}`)
    }
  }
  for (const unrelated of [
    `/imports/${GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME}`,
    `/docs/workspace-seeds/${GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME}.backup`,
  ]) {
    if (resolveWorkspaceRunReadyDemoIdForDocumentPath(unrelated)) {
      throw new Error(`unrelated Game FPS-like path activated: ${unrelated}`)
    }
  }
  const importedSourceText = `---\nrun_ready_demo:\n  id: "${GAME_FPS_RUN_READY_DEMO_ID}"\n---\n\n# Imported Game Mode source\n`
  if (!isGameFpsRunReadyDemoActive('/imports/operator-supplied-source.md', importedSourceText)) {
    throw new Error('source-authored Game FPS identity must activate independently of its import path')
  }

  const previousDemo = process.env.VITE_KNOWGRPH_RUN_READY_DEMO
  const previousRepoLocal = process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL
  try {
    process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL = '1'
    process.env.VITE_KNOWGRPH_RUN_READY_DEMO = GAME_FPS_RUN_READY_DEMO_ID
    if (!isWorkspaceRepoLocalRunReadyBootstrap()) {
      throw new Error('Game FPS repo-local environment did not activate its offline bootstrap')
    }
    process.env.VITE_KNOWGRPH_RUN_READY_DEMO = 'xr-physics'
    if (!isWorkspaceRepoLocalRunReadyBootstrap()) {
      throw new Error('XR repo-local environment did not retain the shared offline bootstrap')
    }
    process.env.VITE_KNOWGRPH_RUN_READY_DEMO = 'game_fps'
    if (!isWorkspaceRepoLocalRunReadyBootstrap()) {
      throw new Error('normalized Game FPS demo id did not retain repo-local policy')
    }
  } finally {
    if (previousDemo === undefined) delete process.env.VITE_KNOWGRPH_RUN_READY_DEMO
    else process.env.VITE_KNOWGRPH_RUN_READY_DEMO = previousDemo
    if (previousRepoLocal === undefined) delete process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL
    else process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL = previousRepoLocal
  }
}

export function testGameFpsRunReadySurfaceReusesSingleThreeCanvas() {
  const threeGraph = source('canvas/src/lib/three/ThreeGraph.impl.tsx')
  const stage = source('canvas/src/features/game-fps/GameFpsMissionStage.tsx')
  const hud = source('canvas/src/features/game-fps/GameFpsHud.tsx')
  const runtime = source('canvas/src/features/game-fps/gameFpsRuntime.ts')
  const webglUnsupported = source('canvas/src/features/game-fps/GameFpsWebglUnsupportedState.tsx')
  const webglSupport = source('canvas/src/lib/three/webglSupport.ts')
  const canvasPage = source('canvas/src/pages/Canvas.tsx')
  const viewport = source('canvas/src/components/CanvasViewport.tsx')
  const gameCanvasCount = (stage.match(/<Canvas(?:\s|>)/g) || []).length
  if (gameCanvasCount !== 0) throw new Error('Game FPS stage must not create another R3F Canvas')
  if ((threeGraph.match(/<GameFpsMissionStageLazy\b/g) || []).length !== 1) {
    throw new Error('ThreeGraph must mount exactly one Game FPS stage')
  }
  if (!threeGraph.includes('sceneComposition.renderOrbitControls ? <ControlsLazy')) {
    throw new Error('Game FPS activation must suppress OrbitControls')
  }
  if (!threeGraph.includes('sceneComposition.renderAuthoredWorld ? <XrWorldPlacement')
    || !threeGraph.includes('data-kg-authored-xr-scene-retained')) {
    throw new Error('XR Game Mode must retain the shared authored world in the existing Canvas')
  }
  if (!canvasPage.includes('data-kg-game-fps-run-ready')) {
    throw new Error('Canvas page is missing the full-frame Game FPS readiness selector')
  }
  if (!viewport.includes('<GameFpsHudLazy />')) {
    throw new Error('Canvas viewport is missing the Game FPS HUD owner')
  }
  if (!stage.includes("advanceGameModeSimulationBy(deltaSeconds).catch(() => undefined)")) {
    throw new Error('Game FPS stage must consume rejected ticks after the runtime publishes its error')
  }
  if (hud.includes('advanceGameFpsBy') || hud.includes('restartGameFpsMission') || !hud.includes('restartGameMode')) {
    throw new Error('Game FPS HUD must only normalize input and route restart through the central Game Mode owner')
  }
  if (!runtime.includes('publishRuntimeFailure(error)') || !hud.includes('data-kg-game-fps-runtime-error')) {
    throw new Error('Game FPS rejected ticks must publish a visible HUD error')
  }
  if (!threeGraph.includes('<GameFpsWebglUnsupportedState />')
    || !webglUnsupported.includes('data-kg-game-fps-error="webgl-unsupported"')) {
    throw new Error('Game FPS must expose a visible local error when WebGL is unavailable')
  }
  if (!threeGraph.includes('useState(readWebglSupport)')
    || !threeGraph.includes('gameMode.active ? gameMode.webglSupported : webglSupported')
    || threeGraph.includes('setWebglSupported')
    || !webglSupport.includes("canvas.getContext('webgl2')")) {
    throw new Error('Game FPS must resolve WebGL support synchronously before mounting R3F Canvas')
  }
  if (!threeGraph.includes('const rendererLifecycleKey = `scene-canvas-${mode}`')) {
    throw new Error('Game Mode must retain the current R3F Canvas identity while changing stages')
  }
}

export function testGameFpsBrowserSmokeContractIsLocalAndInteractive() {
  const runner = source('canvas/scripts/run_game_fps_browser_smoke.mjs')
  const verifier = source('canvas/scripts/verify_game_fps_browser_smoke.py')
  const remoteGrammar = source('canvas/src/features/agentic-os/agenticOsRemoteGrammarClient.ts')
  const sourceFilesRuntime = source('canvas/src/features/source-files/sourceFilesRuntimeActive.ts')
  const seedProvider = source('canvas/src/features/workspace-fs/workspaceSeedProvider.ts')
  for (const expected of [
    "VITE_KNOWGRPH_RUN_READY_DEMO ||= 'game-fps'",
    "devServerStartMode: 'vite-runner'",
  ]) {
    if (!runner.includes(expected)) throw new Error(`Game FPS browser runner missing ${expected}`)
  }
  for (const expected of [
    'data-kg-game-fps-first-frame',
    'data-kg-game-fps-player-x',
    'data-kg-game-fps-action',
    'restoredPhase',
    'preservedBeforeReset',
    'data-kg-game-fps-save-error',
    'nonLocalRequests',
    'consoleErrors',
  ]) {
    if (!verifier.includes(expected)) throw new Error(`Game FPS verifier missing ${expected}`)
  }
  if (!remoteGrammar.includes('if (isWorkspaceRepoLocalRunReadyBootstrap()) return')) {
    throw new Error('repo-local run-ready bootstrap must not prime the remote grammar control plane')
  }
  if (!seedProvider.includes("agenticDocsAbsRoot: repoLocalRunReady ? ''")) {
    throw new Error('repo-local Game FPS bootstrap must not resolve a missing sibling docs checkout')
  }
  if (!sourceFilesRuntime.includes("if (isWorkspaceRepoLocalRunReadyBootstrap()) return ''")) {
    throw new Error('repo-local run-ready activation must not scan the unrelated docs mirror')
  }
}

export async function testGameFpsRepoLocalActiveSourceSkipsDocsMirrorFetch() {
  const previousDemo = process.env.VITE_KNOWGRPH_RUN_READY_DEMO
  const previousRepoLocal = process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL
  const previousFetch = globalThis.fetch
  const requestedUrls: string[] = []
  try {
    process.env.VITE_KNOWGRPH_RUN_READY_DEMO = GAME_FPS_RUN_READY_DEMO_ID
    process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL = '1'
    globalThis.fetch = (async (input: string | URL | Request) => {
      requestedUrls.push(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
      return new Response('', { status: 500 })
    }) as typeof fetch
    const currentText = '# Game FPS source remains authoritative'
    const resolved = await readWorkspaceActiveDocumentResolvedText({
      activePath: '/knowgrph-game-fps-demo.md',
      currentText,
    })
    if (resolved !== currentText) throw new Error('Game FPS active source text changed during local bootstrap')
    if (requestedUrls.length !== 0) {
      throw new Error(`Game FPS active source scanned docs mirror: ${JSON.stringify(requestedUrls)}`)
    }
  } finally {
    globalThis.fetch = previousFetch
    if (previousDemo === undefined) delete process.env.VITE_KNOWGRPH_RUN_READY_DEMO
    else process.env.VITE_KNOWGRPH_RUN_READY_DEMO = previousDemo
    if (previousRepoLocal === undefined) delete process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL
    else process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL = previousRepoLocal
  }
}

export function testGameFpsDecisionStoreUsesBrowserSafeCanonicalMerge() {
  const decisionStore = source('canvas/src/features/game-fps/gameFpsDecisionStore.ts')
  if (!decisionStore.includes("from '../../../../ecs/decisionDocument.js'")) {
    throw new Error('Game FPS Decision store must reuse the canonical browser-safe merge owner')
  }
  if (/from\s+['"]node:|persistDecisions|persistDecision\s*\(/.test(decisionStore)) {
    throw new Error('Game FPS browser store must not import Node Decision persistence')
  }
  if (!decisionStore.includes('verification.persistedCount !== 0')) {
    throw new Error('Game FPS Decision store must verify save read-back before clearing pending records')
  }
}
