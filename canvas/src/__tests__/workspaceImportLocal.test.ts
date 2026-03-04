import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  hydrateWorkspaceFileFromPendingLocalImport,
  importWorkspaceLocalFiles,
  importWorkspaceLocalFolder,
  isPendingLocalImportStubText,
  peekPendingWorkspaceLocalImport,
} from '@/components/BottomPanel/markdownWorkspace/workspaceImport'
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

export async function testWorkspaceImportLocalFilesSvgPreservesBytes() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">', '<circle cx="5" cy="5" r="4"/>', '</svg>', ''].join('\n')
    const files = [createFile('icon.svg', svg)]
    const res = await importWorkspaceLocalFiles({ fs, files, parentPath: '/' })
    if (res.createdPaths.length !== 1) throw new Error('expected 1 created path')

    const entries = await fs.listEntries()
    const svgPath = entries.find(e => e.kind === 'file' && e.name === 'icon.svg')?.path || ''
    if (!svgPath) throw new Error('expected icon.svg to be created')

    const text = await fs.readFileText(svgPath)
    if (text !== svg) throw new Error(`expected icon.svg contents to match exactly, got: ${JSON.stringify(text)}`)
  } finally {
    restore()
  }
}

export async function testWorkspaceImportWorkspaceFileJsonLdConvertsToMarkdown() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const payload = {
      '@context': {
        kg: 'http://example.org/kg#',
        version: 'kg:version',
        document: 'kg:document',
        path: 'kg:path',
        text: 'kg:text',
      },
      '@type': 'kg:WorkspaceFile',
      version: 1,
      document: {
        '@type': 'kg:WorkspaceDocument',
        path: 'docs/note.md',
        text: '# Note\n',
      },
    }

    const files = [createFile('note.workspace.jsonld', `${JSON.stringify(payload, null, 2)}\n`)]
    const res = await importWorkspaceLocalFiles({ fs, files, parentPath: '/' })
    if (res.createdPaths.length !== 1) throw new Error('expected 1 created path')

    const entries = await fs.listEntries()
    const notePath = entries.find(e => e.kind === 'file' && e.name === 'note.md')?.path || ''
    if (!notePath) throw new Error('expected note.md to be created from workspace file')

    const text = await fs.readFileText(notePath)
    if (text !== '# Note\n') throw new Error(`expected note.md contents to match workspace document text, got: ${JSON.stringify(text)}`)
  } finally {
    restore()
  }
}

export async function testWorkspaceImportWorkspaceFileJsonLdPreservesMdxExtension() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const payload = {
      '@context': {
        kg: 'http://example.org/kg#',
        version: 'kg:version',
        document: 'kg:document',
        path: 'kg:path',
        text: 'kg:text',
      },
      '@type': 'kg:WorkspaceFile',
      version: 1,
      document: {
        '@type': 'kg:WorkspaceDocument',
        path: 'docs/note.mdx',
        text: '# Note MDX\n',
      },
    }

    const files = [createFile('note.workspace.jsonld', `${JSON.stringify(payload, null, 2)}\n`)]
    const res = await importWorkspaceLocalFiles({ fs, files, parentPath: '/' })
    if (res.createdPaths.length !== 1) throw new Error('expected 1 created path')

    const entries = await fs.listEntries()
    const notePath = entries.find(e => e.kind === 'file' && e.name === 'note.mdx')?.path || ''
    if (!notePath) throw new Error('expected note.mdx to be created from workspace file')

    const text = await fs.readFileText(notePath)
    if (text !== '# Note MDX\n') throw new Error(`expected note.mdx contents to match, got: ${JSON.stringify(text)}`)
  } finally {
    restore()
  }
}

export async function testWorkspaceImportDoesNotAcceptLegacyKgw() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const supported = createFile('ok.md', '# ok\n')
    const legacy = createFile(
      'legacy.kgw',
      `${JSON.stringify(
        {
          kind: 'kg:workspaceFile',
          version: 1,
          document: { path: 'legacy.md', text: '# Legacy\n' },
        },
        null,
        2,
      )}\n`,
    )

    const res = await importWorkspaceLocalFiles({ fs, files: [supported, legacy], parentPath: '/' })
    if (res.createdPaths.length !== 1) throw new Error(`expected 1 created path, got ${res.createdPaths.length}`)
    if (!res.skipped.some(s => s.name === 'legacy.kgw' && s.reason === 'unsupported')) {
      throw new Error('expected legacy.kgw to be skipped as unsupported')
    }

    const entries = await fs.listEntries()
    const hasLegacy = entries.some(e => e.kind === 'file' && e.name === 'legacy.kgw')
    if (hasLegacy) throw new Error('expected legacy.kgw not to be imported into workspace fs')
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

    const notePath = entries.find(e => e.kind === 'file' && e.name === 'note.md')?.path || ''
    if (!notePath) throw new Error('expected note.md path')
    const before = await fs.readFileText(notePath)
    if (!before || !isPendingLocalImportStubText(before)) {
      throw new Error('expected folder import to write a pending-import stub instead of eager file contents')
    }
    const pending = peekPendingWorkspaceLocalImport(notePath)
    if (!pending) throw new Error('expected pending local import handle for note.md')
    const hydrated = await hydrateWorkspaceFileFromPendingLocalImport({ fs, path: notePath })
    if (!hydrated || hydrated.text.trim() !== '# Note') {
      throw new Error('expected hydration to load original file text')
    }
    const after = await fs.readFileText(notePath)
    if (!after || !after.includes('# Note')) throw new Error('expected hydrated file to be written into workspace fs')
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

export async function testWorkspaceImportLocalFolderHydratesOnlyOpenedFile() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const a = createFile('a.md', '# A\n')
    Object.defineProperty(a, 'webkitRelativePath', { value: 'MyFolder/a.md', configurable: true })
    const b = createFile('b.md', '# B\n')
    Object.defineProperty(b, 'webkitRelativePath', { value: 'MyFolder/b.md', configurable: true })

    await importWorkspaceLocalFolder({ fs, files: [a, b] })
    const entries = await fs.listEntries()
    const aPath = entries.find(e => e.kind === 'file' && e.name === 'a.md')?.path || ''
    const bPath = entries.find(e => e.kind === 'file' && e.name === 'b.md')?.path || ''
    if (!aPath || !bPath) throw new Error('expected both a.md and b.md paths')

    const hydratedA = await hydrateWorkspaceFileFromPendingLocalImport({ fs, path: aPath })
    if (!hydratedA || !hydratedA.text.includes('# A')) throw new Error('expected a.md to hydrate')

    const bText = await fs.readFileText(bPath)
    if (!bText || !isPendingLocalImportStubText(bText)) throw new Error('expected b.md to remain pending until opened')
    const pendingB = peekPendingWorkspaceLocalImport(bPath)
    if (!pendingB) throw new Error('expected b.md to remain pending after hydrating a.md')
  } finally {
    restore()
  }
}
