import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME,
  XR_PHYSICS_RUN_READY_DEMO_ID,
  resolveWorkspaceRunReadyDemoIdForDocument,
  resolveWorkspaceRunReadyDemoSeed,
} from '@/features/workspace-fs/workspaceRunReadyDemos'

const canvasRoot = process.cwd()
const repoRoot = resolve(canvasRoot, '..')
const source = (...parts: string[]) => readFileSync(resolve(repoRoot, ...parts), 'utf8')

test('XR Physics is the only source-backed authority for the Game Mode overlay', () => {
  const physicsSource = source('docs', 'workspace-seeds', XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME)
  const canvasScripts = JSON.parse(source('canvas', 'package.json')).scripts as Record<string, string>
  assert.equal(resolveWorkspaceRunReadyDemoSeed('game-fps'), null)
  assert.equal(
    resolveWorkspaceRunReadyDemoIdForDocument(
      '/docs/workspace-seeds/knowgrph-game-fps-demo.md',
      '---\nrun_ready_demo:\n  id: game-fps\n---\n',
    ),
    '',
  )
  assert.equal(
    resolveWorkspaceRunReadyDemoIdForDocument(
      `/docs/workspace-seeds/${XR_PHYSICS_DEMO_WORKSPACE_SEED_BASENAME}`,
      physicsSource,
    ),
    XR_PHYSICS_RUN_READY_DEMO_ID,
  )

  assert.equal(
    existsSync(resolve(canvasRoot, 'src/features/canvas/GameFpsRunReadyDemoRuntime.tsx')),
    false,
  )
  assert.equal(
    existsSync(resolve(repoRoot, 'docs/workspace-seeds/knowgrph-game-fps-demo.md')),
    false,
  )
  assert.doesNotMatch(
    source('canvas', 'src', 'features', 'canvas', 'CanvasStartupRuntimes.tsx'),
    /GameFpsRunReadyDemoRuntime/,
  )
  assert.equal(JSON.parse(source('package.json')).scripts?.['demo:game-fps'], undefined)
  assert.equal(canvasScripts['predev:game-fps'], undefined)
  assert.equal(canvasScripts['dev:game-fps'], undefined)
  assert.equal(
    existsSync(resolve(canvasRoot, 'src/__tests__/gameFpsRunReadyContract.test.ts')),
    false,
  )
  assert.equal(existsSync(resolve(canvasRoot, 'src/tests/subsetGameFpsSmoke.ts')), false)
})

test('Game Mode browser proof starts explicitly on the XR Physics source', () => {
  const launcher = source('canvas', 'scripts', 'run_game_fps_browser_smoke.mjs')
  const verifier = source('canvas', 'scripts', 'verify_game_fps_browser_smoke.py')
  assert.match(launcher, /VITE_KNOWGRPH_RUN_READY_DEMO \|\|= 'xr-physics'/)
  assert.doesNotMatch(launcher, /VITE_KNOWGRPH_RUN_READY_DEMO \|\|= 'game-fps'/)
  assert.match(verifier, /Game Mode activated before an explicit invocation/)
  assert.match(verifier, /\/game\.mode @canvas #gameplay operation=start/)
  assert.match(verifier, /assert_scene_contract\(scene, game_active=False\)/)
  assert.match(verifier, /name\.startswith\("kg_xr_empty_world"\)/)
  assert.match(verifier, /let occlusionWaitCount = 0/)
  assert.match(verifier, /if \(!target\) \{[\s\S]*await runtime\.advanceGameFpsBy\(0\.2\)[\s\S]*continue/)
  assert.doesNotMatch(verifier, /if \(!target\) throw/)
})
