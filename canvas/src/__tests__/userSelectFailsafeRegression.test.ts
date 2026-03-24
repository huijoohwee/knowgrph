import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGlobalUserSelectLockHasFailsafeAndIsInstalled() {
  const libPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'interaction-user-select.ts')
  const lib = readFileSync(libPath, 'utf8')
  if (!lib.includes('installGlobalUserSelectFailsafe')) {
    throw new Error('expected interaction-user-select to export installGlobalUserSelectFailsafe')
  }
  if (!lib.includes('resetGlobalUserSelectLock')) {
    throw new Error('expected interaction-user-select to export resetGlobalUserSelectLock')
  }

  const appPath = resolve(process.cwd(), 'src', 'App.tsx')
  const app = readFileSync(appPath, 'utf8')
  if (!app.includes('installGlobalUserSelectFailsafe')) {
    throw new Error('expected App to install the global user-select failsafe')
  }
  if (!app.includes('ensureSpacePanKeyListenerInstalled')) {
    throw new Error('expected App to install the space-pan key listener')
  }
  if (!app.includes('installGlobalInteractionRecovery')) {
    throw new Error('expected App to install global interaction recovery')
  }
}
