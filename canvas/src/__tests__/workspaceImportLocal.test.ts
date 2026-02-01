import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { importWorkspaceLocalFiles, importWorkspaceLocalFolder } from '@/components/BottomPanel/markdownWorkspace/workspaceImport'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'

const createFile = (name: string, text: string) => {
  const blob = new Blob([text], { type: 'text/plain' })
  return new File([blob], name, { type: 'text/plain' })
}

export async function testWorkspaceImportLocalFilesCreatesExpectedEntries() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const files = [createFile('a.md', '# A\n'), createFile('b.txt', 'hello\n')]
    const res = await importWorkspaceLocalFiles({ fs, files, parentPath: '/' })
    if (res.createdPaths.length !== 2) throw new Error('expected 2 created paths')

    const entries = await fs.listEntries()
    const names = entries.filter(e => e.kind === 'file').map(e => e.name).sort()
    if (!names.includes('a.md') || !names.includes('b.txt')) {
      throw new Error(`expected imported files to exist, got: ${names.join(', ')}`)
    }
  } finally {
    restore()
  }
}

export async function testWorkspaceImportLocalFolderCreatesNestedFolders() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const file = createFile('note.md', '# Note\n')
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'MyFolder/sub/note.md',
      configurable: true,
    })

    const files = [file]
    const res = await importWorkspaceLocalFolder({ fs, files })
    if (res.createdPaths.length !== 1) throw new Error('expected 1 created path')

    const entries = await fs.listEntries()
    const hasMyFolder = entries.some(e => e.kind === 'folder' && e.name === 'MyFolder')
    const hasSub = entries.some(e => e.kind === 'folder' && e.name === 'sub')
    const hasNote = entries.some(e => e.kind === 'file' && e.name === 'note.md')
    if (!hasMyFolder || !hasSub || !hasNote) {
      throw new Error('expected nested folder import to create folders and file')
    }
  } finally {
    restore()
  }
}

export async function testNormalizeWorkspacePathCollapsesExtraSlashes() {
  const actual = normalizeWorkspacePath('///a//b///c.md')
  if (actual !== '/a/b/c.md') throw new Error(`expected /a/b/c.md, got: ${actual}`)
}

export async function testWorkspaceImportSkipsUnsupportedFilesButContinues() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const supported = createFile('ok.md', '# ok\n')
    const unsupported = new File([new Blob(['x'], { type: 'image/png' })], 'image.png', { type: 'image/png' })

    Object.defineProperty(supported, 'webkitRelativePath', { value: 'MyFolder/ok.md', configurable: true })
    Object.defineProperty(unsupported, 'webkitRelativePath', { value: 'MyFolder/image.png', configurable: true })

    const res = await importWorkspaceLocalFolder({ fs, files: [supported, unsupported] })
    if (res.createdPaths.length !== 1) throw new Error(`expected 1 created path, got ${res.createdPaths.length}`)
    if (res.skipped.length !== 1) throw new Error(`expected 1 skipped file, got ${res.skipped.length}`)
    if (res.failed.length !== 0) throw new Error(`expected 0 failed files, got ${res.failed.length}`)

    const entries = await fs.listEntries()
    const hasOk = entries.some(e => e.kind === 'file' && e.name === 'ok.md')
    const hasImage = entries.some(e => e.kind === 'file' && e.name === 'image.png')
    if (!hasOk) throw new Error('expected ok.md to be imported')
    if (hasImage) throw new Error('expected image.png to be skipped')
  } finally {
    restore()
  }
}
