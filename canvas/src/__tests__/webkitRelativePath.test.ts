import { parseWebkitRelativePath } from '@/features/source-files/webkitRelativePath'

export const testWebkitRelativePathStripsRootFolder = () => {
  const parsed = parseWebkitRelativePath('MyFolder/sub/notes.md', 'notes.md')
  if (parsed.folderName !== 'MyFolder') throw new Error(`expected folderName MyFolder, got ${String(parsed.folderName)}`)
  if (parsed.rawRelativePath !== 'sub/notes.md') {
    throw new Error(`expected rawRelativePath sub/notes.md, got ${String(parsed.rawRelativePath)}`)
  }
}

export const testWebkitRelativePathFallsBackToFileName = () => {
  const parsed = parseWebkitRelativePath('', 'readme.md')
  if (parsed.folderName !== null) throw new Error('expected folderName null')
  if (parsed.rawRelativePath !== 'readme.md') throw new Error(`expected rawRelativePath readme.md, got ${String(parsed.rawRelativePath)}`)
}
