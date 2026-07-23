import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { load as loadYaml } from 'js-yaml'
import {
  FLIGHT_SIM_DEMO_REPO_REL_PATH,
  FLIGHT_SIM_DEMO_WORKSPACE_SEED_BASENAME,
  FLIGHT_SIM_RUN_READY_DEMO_ID,
  XR_PHYSICS_DEMO_REPO_REL_PATH,
  resolveWorkspaceRunReadyDemoIdForDocument,
  resolveWorkspaceRunReadyDemoSeed,
} from '@/features/workspace-fs/workspaceRunReadyDemos'

const repoRoot = resolve(process.cwd(), '..')
const seedPath = resolve(repoRoot, FLIGHT_SIM_DEMO_REPO_REL_PATH)
const seedSource = readFileSync(seedPath, 'utf8')

function frontmatter(source: string): Record<string, unknown> {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  assert.ok(match)
  const parsed = loadYaml(match[1])
  assert.ok(parsed && typeof parsed === 'object' && !Array.isArray(parsed))
  return parsed as Record<string, unknown>
}

test('Flight Sim activation is source-authored and path conflicts fail closed', () => {
  assert.equal(
    resolveWorkspaceRunReadyDemoSeed(FLIGHT_SIM_RUN_READY_DEMO_ID)?.validationSeedRelPath,
    FLIGHT_SIM_DEMO_WORKSPACE_SEED_BASENAME,
  )
  assert.equal(
    resolveWorkspaceRunReadyDemoIdForDocument('/imports/local-flight.md', seedSource),
    FLIGHT_SIM_RUN_READY_DEMO_ID,
  )
  assert.equal(
    resolveWorkspaceRunReadyDemoIdForDocument(FLIGHT_SIM_DEMO_REPO_REL_PATH, seedSource),
    FLIGHT_SIM_RUN_READY_DEMO_ID,
  )
  assert.equal(
    resolveWorkspaceRunReadyDemoIdForDocument(XR_PHYSICS_DEMO_REPO_REL_PATH, seedSource),
    '',
  )
})

test('Flight Sim source declares an overlay on the canonical XR world', () => {
  const meta = frontmatter(seedSource)
  assert.deepEqual(meta.run_ready_demo, {
    id: 'flight-sim',
    activation: 'applied-source-document',
    identity_authority: 'source-authored run_ready_demo.id',
    imported_path_alias_required: false,
    identity_conflict: 'fail closed when path and source identity disagree',
    dev_command: 'npm run dev',
    canonical_source_file: '/docs/workspace-seeds/knowgrph-game-flight-sim-demo.md',
    env_selector: 'VITE_KNOWGRPH_RUN_READY_DEMO=flight-sim',
    validation_seed_path: '/knowgrph-game-flight-sim-demo.md',
    source_root: 'knowgrph/docs',
    source_backed: true,
    clean_canvas_recommended: true,
    native_runtime: true,
    presentation: 'shared-xr-gameplay-overlay',
    document_presentation: 'runtime-ready-workspace-demo',
    auto_start: true,
    external_dependencies: [],
    forbid_external_copy_or_dependency: true,
  })
  assert.deepEqual(meta.shared_xr_scene, {
    source_authority: '/docs/workspace-seeds/knowgrph-physics-playground-demo.md',
    world_ownership: 'overlay-only',
    renderer_owner: 'canvas/src/lib/three/ThreeGraph.impl.tsx',
    collider_owner: 'canvas/src/features/three/xrCanonicalSceneSpatialSource.ts',
    second_canvas_forbidden: true,
  })
  const authority = readFileSync(resolve(repoRoot, 'scripts/workspace-seed-authority.mjs'), 'utf8')
  const projectionStart = authority.indexOf('AGENTIC_WORKSPACE_SEED_PROJECTION_INVENTORY')
  const projectionEnd = authority.indexOf('])', projectionStart)
  const projectionInventory = authority.slice(projectionStart, projectionEnd + 2)
  assert.match(projectionInventory, /PHYSICS_SEED_BASENAME/)
  assert.doesNotMatch(projectionInventory, /FLIGHT_SEED_BASENAME/)
})

test('Flight Sim reuses shared fixed-follow and free-orbit camera ownership', () => {
  const controls = readFileSync(
    resolve(repoRoot, 'canvas/src/features/three/Controls.tsx'),
    'utf8',
  )
  const flightCamera = readFileSync(
    resolve(repoRoot, 'canvas/src/features/three/useFlightSimCamera.ts'),
    'utf8',
  )
  assert.match(controls, /useXrGameplayCameraArbitration\(\{/)
  assert.match(controls, /flightSimActive,/)
  assert.match(flightCamera, /readXrNativeControllerCamera\(\)\.mode === 'fixed-follow'/)
  assert.match(flightCamera, /renderer\.xr\.isPresenting/)
  assert.doesNotMatch(flightCamera, /new\s+(?:THREE\.)?PerspectiveCamera/)
})
