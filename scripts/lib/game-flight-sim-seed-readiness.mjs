import {
  requireOrderedSourceMarkers as requireOrderedMarkers,
  requireSourceMarkers as requireMarkers,
} from './source-readiness-assertions.mjs'

export async function assertFlightSimSeedReadiness({
  seed,
  flightSeedPath,
  physicsSeedPath,
  readText,
}) {
  const runReadyDemo = seed.run_ready_demo
  const sharedScene = seed.shared_xr_scene
  const assetPipeline = seed.asset_pipeline
  const flightSim = seed.flight_sim
  if (
    seed.status !== 'runtime-ready'
    || seed.runtime_status !== 'runtime-ready'
    || seed.runtime_claim !== 'local-runtime-ready'
    || seed.publish_scope !== 'local-only'
    || seed.kgCanvasSurfaceMode !== 'xr'
    || seed.kgCanvasRenderMode !== '3d'
    || seed.kgCanvas3dMode !== 'xr'
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
    || sharedScene.surface_owner !== 'XR Mode'
    || sharedScene.renderer_owner !== 'canvas/src/lib/three/ThreeGraph.impl.tsx'
    || sharedScene.collider_owner !== 'canvas/src/features/three/xrCanonicalSceneSpatialSource.ts'
    || sharedScene.camera_owner !== 'canvas/src/features/three/useXrNativeControllerDemoCamera.ts'
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
    || !String(assetPipeline.admission || '').includes('required vehicle-airplane')
    || !String(assetPipeline.opaque_binary_fallback || '').includes('optional-beacon')
    || assetPipeline.required_aircraft_glb_fallback_count !== 0
    || assetPipeline.optional_prop_glb_fallback_count !== 1
    || assetPipeline.glb_fallback_count !== 1
    || assetPipeline.optional_glb_sha256 !== 'be41f87bb745ba35c439336d932dd69c34223d26e117443a3c8556e44fce70cd'
    || assetPipeline.optional_glb_license !== 'CC0-1.0'
    || assetPipeline.runtime_model_calls !== 0
    || assetPipeline.runtime_network_calls !== 0
  ) {
    throw new Error('Flight Sim seed must retain spec-primary aircraft authority and one exact optional local GLB')
  }

  const grammarAutoHydrationSource = await readText(
    'canvas/src/features/agentic-os/useAgenticOsRemoteGrammarAutoHydration.tsx',
  )
  requireMarkers(grammarAutoHydrationSource, [
    'AgenticOsRemoteGrammarAutoHydrationContext = React.createContext(true)',
    'useSourceFilesBootstrapReady()',
    'isNativeXrRunReadyDemoActive(',
    'return args.sourceFilesReady && !args.offlineNativeXrActive',
  ], 'offline native XR automatic grammar fence')
  const grammarClientSource = await readText(
    'canvas/src/features/agentic-os/agenticOsRemoteGrammarClient.ts',
  )
  requireMarkers(grammarClientSource, [
    'useAgenticOsRemoteGrammarAutoHydration()',
    'if (!autoHydrationAllowed || sigils.length === 0) return',
  ], 'automatic remote grammar hydration policy')
  const appSource = await readText('canvas/src/App.tsx')
  requireOrderedMarkers(appSource, [
    '<CanvasSourceAuthorityBoundary>',
    '<AgenticOsRemoteGrammarAutoHydrationBoundary>',
    '<KnowgrphRuntimeIdentityRuntime />',
  ], 'source-aware automatic grammar boundary')

  const runReadySource = await readText(
    'canvas/src/features/workspace-fs/workspaceRunReadyDemos.ts',
  )
  requireMarkers(runReadySource, [
    "export const FLIGHT_SIM_RUN_READY_DEMO_ID = 'flight-sim'",
    'export const diagnoseWorkspaceRunReadyDemoActivation = (',
    'export const resolveWorkspaceRunReadyDemoIdForDocument = (',
    "'RUN_READY_IDENTITY_CONFLICT'",
    "'RUN_READY_IDENTITY_UNREGISTERED'",
    "return diagnostic.ok ? diagnostic.id : ''",
    'readWorkspaceRunReadyDemoId(documentPath, documentText) === FLIGHT_SIM_RUN_READY_DEMO_ID',
  ], 'source-authored Flight Sim activation')
  const activationSource = await readText(
    'canvas/src/features/canvas/FlightSimRunReadyDemoRuntime.tsx',
  )
  requireMarkers(activationSource, [
    'isFlightSimRunReadyDemoActive(markdownDocumentName, markdownDocumentText)',
    'ownsDocumentLaunchRef',
    'exitFlightSimSurface({ restorePreviousSurface: false })',
  ], 'Flight Sim source activation runtime')
}
