import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  resolveXrCanonicalSceneProjection,
  resolveXrCanonicalSceneSpatialSource,
} from '@/features/three/xrCanonicalSceneSpatialSource'

function readSource(...parts: string[]): string {
  return readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')
}

export function testXrPhysicsHomeSceneAuthorityRejectsFallbackVariants(): void {
  for (const controllerPhase of ['off', 'running', 'paused']) {
    const projection = resolveXrCanonicalSceneProjection({
      controllerPhase,
      physicsRunReady: true,
    })
    if (projection !== 'native-controller') {
      throw new Error(`expected xr-physics to retain native scene authority during ${controllerPhase}`)
    }
  }

  const spatialSource = resolveXrCanonicalSceneSpatialSource({
    projection: 'native-controller',
    stageId: 'singapore',
  })
  if (spatialSource.projection !== 'native-controller'
    || spatialSource.stage.id !== 'singapore'
    || spatialSource.staticColliders.length === 0) {
    throw new Error(`expected Home to resolve the canonical Singapore native terrain, got ${JSON.stringify({
      projection: spatialSource.projection,
      stageId: spatialSource.stage.id,
      staticColliderCount: spatialSource.staticColliders.length,
    })}`)
  }

  const xrGraphStageSource = readSource('features', 'three', 'XrGraphStage.tsx')
  const threeGraphSource = readSource('lib', 'three', 'ThreeGraph.impl.tsx')
  const gameMissionSource = readSource('features', 'game-fps', 'GameFpsMissionStage.tsx')
  const staleCompositionPath = resolve(
    process.cwd(),
    'src',
    'features',
    'game-fps',
    'gameModeSceneComposition.ts',
  )

  for (const marker of [
    "const nativeControllerOwnsStage = projection === 'native-controller'",
    '{!nativeControllerOwnsStage ? (',
    '<XrMotionReferenceStage',
    '<XrNativeControllerDemoStage',
    'retainStage={runReadyDemo}',
  ]) {
    if (!xrGraphStageSource.includes(marker)) {
      throw new Error(`expected canonical XR stage ownership marker ${marker}`)
    }
  }
  if (!threeGraphSource.includes("const hasXrEmptyWorld = mode === 'xr' && !xrDocumentLoaded && !xrPhysicsRunReadyDemo")
    || !threeGraphSource.includes('xrPhysicsRunReadyDemo ? XR_PHYSICS_RUN_READY_GRAPH : null')) {
    throw new Error('expected xr-physics to materialize its source graph without entering the source-free empty world')
  }

  const forbiddenLegacyMarkers = [
    'GameFpsArenaEnvironment',
    'GAME_FPS_ARENA_CLEAR_COLOR',
    'gamePresentation',
    'kg_game_fps_arena',
    'resolveGameModeSceneComposition',
  ]
  const activeSceneSources = `${threeGraphSource}\n${gameMissionSource}`
  for (const marker of forbiddenLegacyMarkers) {
    if (activeSceneSources.includes(marker)) {
      throw new Error(`expected upstream scene cleanup to remove legacy fallback marker ${marker}`)
    }
  }
  if (existsSync(staleCompositionPath)) {
    throw new Error('expected the alternate Game Mode scene-composition owner to stay deleted')
  }
}
