import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testLaunchImportFallbackSnapshotsFileListBeforeClearingInput() {
  const p = resolve(process.cwd(), 'src', 'lib', 'toolbar', 'LaunchDropdown.impl.tsx')
  const text = readFileSync(p, 'utf8')
  const dispatch = readFileSync(resolve(process.cwd(), 'src', 'lib', 'toolbar', 'launchImportDispatch.ts'), 'utf8')

  if (!text.includes('runLaunchImportLocalFiles({') || !text.includes('fallback: importLocalFilesFallback')) {
    throw new Error('expected Launch import local files to use the shared bridge/fallback dispatcher')
  }
  if (!dispatch.includes('const snapshot = args.files ? Array.from(args.files as ArrayLike<File>) : []')) {
    throw new Error('expected Launch import local files dispatcher to snapshot FileList before clearing input')
  }
  if (!text.includes('else void importLocalFolderFallback(files ? Array.from(files) : [])')) {
    throw new Error('expected Launch import folder fallback to snapshot FileList before clearing input')
  }
}
