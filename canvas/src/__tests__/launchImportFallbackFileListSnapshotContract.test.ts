import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testLaunchImportFallbackSnapshotsFileListBeforeClearingInput() {
  const p = resolve(process.cwd(), 'src', 'lib', 'toolbar', 'LaunchDropdown.impl.tsx')
  const text = readFileSync(p, 'utf8')

  if (!text.includes('else void importLocalFilesFallback(files ? Array.from(files) : [])')) {
    throw new Error('expected Launch import local files fallback to snapshot FileList before clearing input')
  }
  if (!text.includes('else void importLocalFolderFallback(files ? Array.from(files) : [])')) {
    throw new Error('expected Launch import folder fallback to snapshot FileList before clearing input')
  }
}

