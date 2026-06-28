import { spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const devServerPort = String(process.env.KG_STORYBOARD_DROP_SMOKE_PORT || '4176')
const devServerBaseUrl = `http://localhost:${devServerPort}`
const devServerUrl = `${devServerBaseUrl}/__smoke__/storyboard-rich-media-drop`

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForServerReady(url, timeoutMs) {
  const start = Date.now()
  let lastError = null
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.ok || response.status === 304) return
    } catch (error) {
      lastError = error
    }
    await wait(1000)
  }
  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${String(lastError)}` : ''}`)
}

async function isServerReady(url, timeoutMs) {
  try {
    await waitForServerReady(url, timeoutMs)
    return true
  } catch {
    return false
  }
}

function terminateProcess(child) {
  if (!child || child.killed) return Promise.resolve()
  return new Promise(resolve => {
    const finish = () => resolve()
    child.once('exit', finish)
    child.kill('SIGTERM')
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL')
    }, 2000)
  })
}

async function run() {
  let devServer = null
  const reuseExistingServer = await isServerReady(devServerUrl, 1500)

  if (!reuseExistingServer) {
    devServer = spawn(npmCommand, ['run', 'dev', '--', '--port', devServerPort, '--strictPort'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    })
  } else {
    console.log(`[storyboard-rich-media-drop-smoke] reusing existing dev server at ${devServerUrl}`)
  }

  try {
    await Promise.race([
      waitForServerReady(devServerUrl, 120000),
      ...(devServer
        ? [new Promise((_, reject) => {
          devServer.once('exit', code => reject(new Error(`Dev server exited before ready with code ${code ?? 'null'}`)))
        })]
        : []),
    ])

    await new Promise((resolve, reject) => {
      const smoke = spawn('python3', ['scripts/verify_storyboard_rich_media_drop_browser_smoke.py'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: {
          ...process.env,
          KG_STORYBOARD_DROP_SMOKE_BASE_URL: devServerBaseUrl,
        },
      })
      smoke.once('exit', code => {
        if (code === 0) {
          resolve()
          return
        }
        reject(new Error(`Browser smoke exited with code ${code ?? 'null'}`))
      })
      smoke.once('error', reject)
    })
  } finally {
    await terminateProcess(devServer)
  }
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
