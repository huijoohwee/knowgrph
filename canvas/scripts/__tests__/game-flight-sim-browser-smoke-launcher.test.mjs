import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { runLocalViteBrowserSmoke } from '../lib/run-local-vite-browser-smoke.mjs'

const canvasRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

function reserveLocalPort() {
  return new Promise((resolvePromise, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Unable to reserve a local Flight preview port'))
        return
      }
      server.close(error => {
        if (error) reject(error)
        else resolvePromise(address.port)
      })
    })
  })
}

test('Flight smoke launcher serves a real preview page without WebSockets', {
  timeout: 120_000,
}, async () => {
  const priorWorkingDirectory = process.cwd()
  const port = await reserveLocalPort()
  const previewOutDir = await mkdtemp(
    join(tmpdir(), 'knowgrph-flight-preview-preflight-'),
  )
  await writeFile(
    join(previewOutDir, 'index.html'),
    `<!doctype html>
<html lang="en">
  <body>
    <main id="root"></main>
    <script type="module">
      document.querySelector('#root').dataset.kgFlightSimPreactivationReady = '1'
    </script>
  </body>
</html>
`,
    'utf8',
  )
  process.chdir(canvasRoot)
  try {
    await runLocalViteBrowserSmoke({
      logLabel: 'game-flight-sim-preview-preflight',
      devServerPort: String(port),
      devServerPath: '/',
      baseUrlEnvName: 'KG_GAME_FLIGHT_SIM_PREVIEW_PREFLIGHT_BASE_URL',
      verifierCommand: 'python3',
      verifierArgs: [
        'scripts/__tests__/verify_game_flight_sim_preview_page.py',
      ],
      verifierFailureLabel: 'Game Flight Sim preview preflight',
      prepareBeforeStart: false,
      devServerStartMode: 'vite-preview-runner',
      existingServerPolicy: 'forbid',
      previewOutDir,
    })
  } finally {
    process.chdir(priorWorkingDirectory)
    await rm(previewOutDir, { force: true, recursive: true })
  }
})
