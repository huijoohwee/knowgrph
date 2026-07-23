function requireMarkers(source, markers, label) {
  const missing = markers.filter(marker => !source.includes(marker))
  if (missing.length > 0) {
    throw new Error(`${label} is missing required markers: ${missing.join(', ')}`)
  }
}

function exactArray(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must be exactly ${expected.join(', ')}`)
  }
}

export async function assertFlightSimVerificationReadiness({ readText }) {
  const packageSource = JSON.parse(await readText('package.json'))
  if (
    packageSource.scripts?.['game-flight-sim:runtime-ready']
      !== 'node ./scripts/run-game-flight-sim-runtime-ready.mjs'
    || packageSource.scripts?.['game-flight-sim:orchestration:test']
      !== 'node --test ./scripts/__tests__/game-flight-sim-verification-aggregation.test.mjs && python3 -m unittest discover -s ./canvas/scripts/__tests__ -p \'test_game_flight_sim_smoke_ledger.py\''
    || packageSource.scripts?.['game-flight-sim:negative-gates:test']
      !== 'node --test ./scripts/__tests__/game-flight-sim-negative-gates.test.mjs ./scripts/__tests__/game-flight-sim-readiness-contract.test.mjs'
  ) {
    throw new Error('Flight Sim runtime readiness must use the named aggregate and negative gates')
  }

  const runnerSource = await readText('scripts/run-game-flight-sim-runtime-ready.mjs')
  const stageInventory = runnerSource.slice(
    runnerSource.indexOf('export const FLIGHT_SIM_RUNTIME_VERIFICATIONS'),
    runnerSource.indexOf('export function executeVerificationCommand'),
  )
  const stageNames = [...stageInventory.matchAll(/^\s+name: '([^']+)',$/gm)]
    .map(match => match[1])
  exactArray(stageNames, [
    'linked package preparation',
    'source authority',
    'native Agentic ECS integration',
    'focused Flight Sim source tests',
    'negative authoring, dependency, license, and named-contamination gates',
    'verification aggregation contracts',
    'Canvas TypeScript',
    'production build',
  ], 'Flight Sim aggregate verification stages')
  requireMarkers(runnerSource, [
    'export const FLIGHT_SIM_RUNTIME_VERIFICATIONS = Object.freeze([',
    'collectNamedVerifications({',
    "name: 'repository source immutability'",
    "throwForNamedFailures('Game Flight Sim runtime readiness', failures)",
  ], 'Flight Sim named runtime aggregate')

  const offlineAuthoringSource = await readText(
    'scripts/lib/game-flight-sim-offline-authoring.mjs',
  )
  requireMarkers(offlineAuthoringSource, [
    "'image-to-3d-model-call'",
    "'network-fetch'",
    "'cloudflare-resource-request'",
    'blocked disallowed operation before commit',
    'export async function runFlightSimOfflineAuthoringTransaction({',
    'await commit(outputs)',
  ], 'Flight Sim offline authoring transaction')
  const generatorSource = await readText(
    'scripts/generate-game-flight-sim-optional-prop-glb.mjs',
  )
  requireMarkers(generatorSource, [
    'runFlightSimOfflineAuthoringTransaction',
    'attemptedOperations,',
    'commit: async',
  ], 'Flight Sim offline GLB generator')

  const negativeGateTests = await readText(
    'scripts/__tests__/game-flight-sim-negative-gates.test.mjs',
  )
  requireMarkers(negativeGateTests, [
    'names every disallowed operation before commit and preserves bytes',
    'names a crafted unauthorized runtime package',
    'names a crafted non-OSI license',
    'reports a crafted external-project boundary violation',
  ], 'Flight Sim crafted negative gates')

  const deadlineSource = await readText(
    'canvas/src/features/game-flight-sim/flightSimDeadlineRuntime.ts',
  )
  requireMarkers(deadlineSource, [
    'FLIGHT_SIM_GAMEPLAY_NETWORK_BLOCK_LIMIT_MS = 1_000',
    'FLIGHT_SIM_HUD_UPDATE_LIMIT_MS = 100',
    'FLIGHT_SIM_READY_FRAME_LIMIT_MS = 100',
    'FLIGHT_SIM_WEBGL_ADMISSION_LIMIT_MS = 100',
    'export function measureFlightSimWebglAdmission(',
    'export function measureFlightSimGameplayNetworkBlock(',
  ], 'Flight Sim production deadline owner')
  const deadlineIntegrationSource = await readText(
    'canvas/src/features/game-flight-sim/flightSimDeadlineIntegration.ts',
  )
  requireMarkers(deadlineIntegrationSource, [
    'measureFlightSimWebglAdmission(() => readWebglSupport())',
    'export function startFlightSimWithReadyFrame(',
    'export function rejectFlightSimGameplayNetworkAttemptWithinDeadline(',
    'blockFlightSimGameplayNetworkAttempt(mission, operation, executor)',
  ], 'Flight Sim production deadline integration')
  const deadlineTests = await readText(
    'canvas/src/__tests__/flightSimDeadlineContracts.test.ts',
  )
  requireMarkers(deadlineTests, [
    'actual WebGL probe is synchronous and a probe over 100 ms fails closed',
    'ready-frame and HUD deadlines record asynchronous presentation semantics',
    'production runtime blocks a gameplay network attempt within 1 s and retains mission state',
  ], 'Flight Sim deadline tests')
  const browserDeadlineSource = await readText(
    'canvas/scripts/lib/game_flight_sim_smoke_deadlines.py',
  )
  requireMarkers(browserDeadlineSource, [
    'def verify_flight_deadline_contracts(page: Page)',
    'Flight WebGL admission was not synchronous within 100 ms',
    'Flight ready frame was not presented within 100 ms',
    'Flight gameplay network attempt was not blocked within 1 s',
    'Flight HUD did not reflect its runtime update within 100 ms',
  ], 'Flight Sim browser deadline proof')
  const browserPhasesSource = await readText(
    'canvas/scripts/lib/game_flight_sim_smoke_runtime_phases.py',
  )
  requireMarkers(browserPhasesSource, [
    'from lib.game_flight_sim_smoke_deadlines import verify_flight_deadline_contracts',
    'lambda: verify_flight_deadline_contracts(page)',
  ], 'Flight Sim browser deadline integration')
  const browserAggregateSource = await readText(
    'canvas/scripts/run_game_flight_sim_browser_smoke.mjs',
  )
  requireMarkers(browserAggregateSource, [
    'const deadlineContracts = {',
    'observation?.synchronous === contract.synchronous',
    'observation?.limitMs === contract.limitMs',
    "'fetch:browser-deadline-proof'",
  ], 'Flight Sim exact deadline evidence aggregate')
}
