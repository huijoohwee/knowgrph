import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const repoRoot = resolve(process.cwd(), '..')

test('Flight browser proof activates only after applying the authored source', () => {
  const runner = readFileSync(
    resolve(
      repoRoot,
      'canvas/scripts/run_game_flight_sim_browser_smoke.mjs',
    ),
    'utf8',
  )
  const verifier = readFileSync(
    resolve(
      repoRoot,
      'canvas/scripts/verify_game_flight_sim_browser_smoke.py',
    ),
    'utf8',
  )
  const runtimePhases = readFileSync(
    resolve(
      repoRoot,
      'canvas/scripts/lib/game_flight_sim_smoke_runtime_phases.py',
    ),
    'utf8',
  )
  const serverOwner = readFileSync(
    resolve(
      repoRoot,
      'canvas/scripts/lib/run-local-vite-browser-smoke.mjs',
    ),
    'utf8',
  )
  const launcherRegression = readFileSync(
    resolve(
      repoRoot,
      'canvas/scripts/__tests__/game-flight-sim-browser-smoke-launcher.test.mjs',
    ),
    'utf8',
  )
  const previewPageVerifier = readFileSync(
    resolve(
      repoRoot,
      'canvas/scripts/__tests__/verify_game_flight_sim_preview_page.py',
    ),
    'utf8',
  )
  const touchVerifier = readFileSync(
    resolve(
      repoRoot,
      'canvas/scripts/lib/game_flight_sim_smoke_mobile.py',
    ),
    'utf8',
  )
  const missionVerifier = readFileSync(
    resolve(
      repoRoot,
      'canvas/scripts/lib/game_flight_sim_smoke_mission.py',
    ),
    'utf8',
  )
  const sceneVerifier = readFileSync(
    resolve(
      repoRoot,
      'canvas/scripts/lib/game_flight_sim_smoke_scene.py',
    ),
    'utf8',
  )
  assert.match(
    runner,
    /delete process\.env\.VITE_KNOWGRPH_RUN_READY_DEMO/,
  )
  assert.doesNotMatch(
    runner,
    /VITE_KNOWGRPH_RUN_READY_DEMO\s*\|\|=\s*['"]flight-sim['"]/,
  )
  assert.doesNotMatch(
    runner,
    /VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH\s*=/,
  )
  assert.match(runner, /const runCount = 2/)
  assert.match(runner, /existingServerPolicy: 'forbid'/)
  assert.match(runner, /buildExactProductionPreview\(candidate\)/)
  assert.match(runner, /KG_SKIP_DOCS_UPDATE: '1'/)
  assert.match(runner, /VITE_BASE_PATH: '\/'/)
  assert.match(runner, /indexSource\.includes\('\/@vite\/client'\)/)
  assert.match(runner, /devServerStartMode: 'vite-preview-runner'/)
  assert.match(runner, /productionBuild,/)
  assert.ok(
    runner.indexOf(
      'const productionBuild = await buildExactProductionPreview(candidate)',
    ) < runner.indexOf('const runs = await runSerialBrowserProof({'),
  )
  assert.match(runner, /KG_GAME_FLIGHT_SIM_EXPECTED_HEAD/)
  assert.match(runner, /KG_GAME_FLIGHT_SIM_EXPECTED_SOURCE_SHA256/)
  assert.match(runner, /freshServerPerRun: true/)
  assert.match(
    runner,
    /candidate\?\.runtimeRevision !== candidateHead/,
  )
  assert.match(
    runner,
    /candidate\?\.runtimeBranch !== candidateBranch/,
  )
  assert.match(
    runner,
    /source\?\.authoredSeedSha256 !== sourceSha256/,
  )
  assert.match(
    runner,
    /source\?\.workspaceSourceSha256 !== sourceSha256/,
  )
  assert.match(
    runner,
    /inputProof\?\.touchInteraction\?\.runId[\s\S]*missionProof\?\.runId/,
  )
  assert.match(runner, /missionProof\?\.phase !== 'completed'/)
  assert.match(runner, /missionProof\?\.transitions\?\.length !== 3/)
  assert.match(
    runner,
    /gameplayNetworkBlock:\s*\{[\s\S]*?source: 'flight-runtime-network-guard'/,
  )
  assert.match(runner, /gameplayWebSocketBlock:\s*\{[\s\S]*?source: 'flight-runtime-network-guard'/)
  assert.match(runner, /gameplayWebSocketTransportObserved === false/)
  assert.match(runner, /assertExactFlightSimBrowserVerificationLedger/)
  assert.match(verifier, /page\.on\("websocket", record_websocket\)/)
  assert.match(verifier, /context\.route\("\*\*\/\*", route_request\)/)
  assert.match(verifier, /context\.on\("request", record_request\)/)
  assert.match(verifier, /context\.on\("response", record_response\)/)
  assert.doesNotMatch(verifier, /page\.route\("\*\*\/\*", route_request\)/)
  assert.doesNotMatch(verifier, /page\.on\("request", record_request\)/)
  assert.doesNotMatch(verifier, /page\.on\("response", record_response\)/)
  assert.match(verifier, /request\.service_worker is not None/)
  assert.doesNotMatch(verifier, /request\.frame/)
  assert.match(verifier, /"serviceWorkerRequests": \[/)
  assert.match(verifier, /context\.route_web_socket\("\*\*\/\*", route_websocket\)/)
  for (const prePageContextOwner of [
    'context.route("**/*", route_request)',
    'context.on("request", record_request)',
    'context.on("response", record_response)',
    'context.route_web_socket("**/*", route_websocket)',
  ]) {
    assert.ok(
      verifier.indexOf(prePageContextOwner)
        < verifier.indexOf('page = context.new_page()'),
    )
  }
  assert.doesNotMatch(verifier, /page\.route_web_socket\(websocket_probe_url/)
  assert.doesNotMatch(verifier, /\.connect_to_server\(/)
  assert.match(verifier, /"webSocketAttempts": \{/)
  assert.match(verifier, /"optionalBeacon": active_scene\["optionalBeacon"\]/)
  assert.match(runner, /assertExactFlightSimRendererOptionalBeacon\(/)
  assert.match(touchVerifier, /chromium-cdp-emulated-touch/)
  assert.match(touchVerifier, /pointer_down\.get\("isTrusted"\) is not True/)
  assert.match(missionVerifier, /accelerated-public-production-runtime/)
  assert.match(missionVerifier, /snapshot\.tick !== prior\.tick \+ 1/)
  assert.match(sceneVerifier, /expected_landing_pad_count = 1/)
  assert.match(
    serverOwner,
    /refusing responsive pre-existing server/,
  )
  assert.match(serverOwner, /Unsupported devServerStartMode/)
  assert.match(serverOwner, /devServerStartMode === 'vite-preview-runner'/)
  assert.match(serverOwner, /\['--outDir', previewOutDir\]/)
  assert.match(launcherRegression, /runLocalViteBrowserSmoke\(\{/)
  assert.match(launcherRegression, /existingServerPolicy: 'forbid'/)
  assert.match(launcherRegression, /devServerStartMode: 'vite-preview-runner'/)
  assert.match(launcherRegression, /previewOutDir,/)
  assert.match(launcherRegression, /kgFlightSimPreactivationReady = '1'/)
  assert.match(
    previewPageVerifier,
    /context\.route_web_socket\("\*\*\/\*", block_websocket\)/,
  )
  assert.ok(
    previewPageVerifier.indexOf(
      'context.route_web_socket("**/*", block_websocket)',
    ) < previewPageVerifier.indexOf('page = context.new_page()'),
  )
  assert.doesNotMatch(previewPageVerifier, /\.connect_to_server\(/)
  assert.match(
    previewPageVerifier,
    /data-kg-flight-sim-hud="1"/,
  )
  for (const proofField of [
    'runtimeRevision',
    'FIRST_PLAYABLE_FRAME_LIMIT_MS',
    'touchInteraction',
    'missionProof',
    'verificationLedger',
  ]) {
    assert.match(verifier, new RegExp(proofField))
  }
  for (const proofField of [
    'authoredSeedSha256',
    'workspaceSourceSha256',
    'durationMs',
    'verify_flight_deadline_contracts',
    'verify_mobile_touch_interaction',
    'complete_authored_flight_mission',
  ]) {
    assert.match(runtimePhases, new RegExp(proofField))
  }
  assert.ok(
    runtimePhases.indexOf(
      'source_application, source = apply_and_verify_exact_authored_source',
    )
      < runtimePhases.indexOf("page.locator('[data-kg-flight-sim-hud=\"1\"]')"),
  )
  assert.ok(
    runtimePhases.indexOf('"runtime deadline contracts"')
      < runtimePhases.indexOf('"first playable frame"'),
  )
  assert.match(
    runtimePhases,
    /"first playable frame"[\s\S]*depends_on=\("runtime deadline contracts",\)/,
  )
})
