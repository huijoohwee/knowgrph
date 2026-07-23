import path from 'node:path'

import { runLocalViteBrowserSmoke } from './lib/run-local-vite-browser-smoke.mjs'

process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT ||= path.resolve(process.cwd(), '../docs')
process.env.VITE_KNOWGRPH_WORKSPACE_SEEDS_ABS_ROOT ||= path.resolve(process.cwd(), '../docs/workspace-seeds')
process.env.VITE_KNOWGRPH_RUN_READY_REPO_LOCAL ||= '1'
// The smoke must prove that applying the authored Source File activates Flight.
delete process.env.VITE_KNOWGRPH_RUN_READY_DEMO

async function run() {
  await runLocalViteBrowserSmoke({
    logLabel: 'game-flight-sim-browser-smoke',
    devServerPort: String(process.env.KG_GAME_FLIGHT_SIM_SMOKE_PORT || '4187'),
    devServerPath: '/',
    baseUrlEnvName: 'KG_GAME_FLIGHT_SIM_SMOKE_BASE_URL',
    verifierCommand: 'python3',
    verifierArgs: ['scripts/verify_game_flight_sim_browser_smoke.py'],
    verifierFailureLabel: 'Game Flight Sim browser smoke',
    prepareBeforeStart: false,
    devServerStartMode: 'vite-runner',
  })
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
