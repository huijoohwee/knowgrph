import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

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

function runCommand(command, args, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env,
    })
    child.once('exit', code => {
      if (code === 0) {
        resolvePromise()
        return
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'null'}`))
    })
    child.once('error', reject)
  })
}

function startDevServer({ devServerPort, devServerStartMode, env }) {
  if (devServerStartMode === 'vite-runner') {
    const viteCliPath = resolve(process.cwd(), '../node_modules/vite/bin/vite.js')
    return spawn(process.execPath, [viteCliPath, '--configLoader', 'runner', '--port', devServerPort, '--strictPort'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env,
    })
  }
  return spawn(npmCommand, ['run', 'dev', '--', '--port', devServerPort, '--strictPort'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env,
  })
}

export async function runLocalViteBrowserSmoke({
  logLabel,
  devServerPort,
  devServerPath = '/',
  baseUrlEnvName,
  verifierCommand,
  verifierArgs,
  verifierFailureLabel = 'Browser smoke',
  prepareBeforeStart = false,
  devServerStartMode = 'npm-dev',
  existingServerPolicy = 'reuse',
}) {
  if (!['reuse', 'forbid'].includes(existingServerPolicy)) {
    throw new Error(`Unsupported existingServerPolicy: ${existingServerPolicy}`)
  }
  const devServerBaseUrl = `http://localhost:${devServerPort}`
  const normalizedPath = devServerPath.startsWith('/') ? devServerPath : `/${devServerPath}`
  const devServerUrl = `${devServerBaseUrl}${normalizedPath}`
  let devServer = null
  const reuseExistingServer = await isServerReady(devServerUrl, 1500)

  if (reuseExistingServer && existingServerPolicy === 'forbid') {
    throw new Error(
      `[${logLabel}] refusing responsive pre-existing server at ${devServerUrl}; `
      + 'this proof requires a fresh server owned by the candidate checkout',
    )
  }
  if (!reuseExistingServer) {
    if (prepareBeforeStart) {
      await runCommand(npmCommand, ['run', 'predev'], process.env)
    }
    devServer = startDevServer({ devServerPort, devServerStartMode, env: process.env })
  } else {
    console.log(`[${logLabel}] reusing existing dev server at ${devServerUrl}`)
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

    await new Promise((resolvePromise, reject) => {
      const smoke = spawn(verifierCommand, verifierArgs, {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: {
          ...process.env,
          [baseUrlEnvName]: devServerBaseUrl,
        },
      })
      smoke.once('exit', code => {
        if (code === 0) {
          resolvePromise()
          return
        }
        reject(new Error(`${verifierFailureLabel} exited with code ${code ?? 'null'}`))
      })
      smoke.once('error', reject)
    })
  } finally {
    await terminateProcess(devServer)
  }
}
