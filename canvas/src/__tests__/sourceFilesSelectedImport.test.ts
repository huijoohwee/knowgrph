import { importSelectedSourceFiles } from '@/features/source-files/importSelectedSourceFiles'
import { useGraphStore } from '@/hooks/useGraphStore'

const makeFile = (name: string, text: string): File => new File([text], name, { type: 'text/markdown' })

export async function testImportSelectedSourceFilesAddsTextFilesToSourceFiles() {
  const store = useGraphStore.getState()
  const previous = store.sourceFiles
  try {
    store.setSourceFiles([])
    const count = await importSelectedSourceFiles([
      makeFile('alpha.md', '# Alpha\n'),
      makeFile('ignore.png', 'not imported as text'),
    ])
    if (count !== 1) throw new Error(`expected one selected text Source File import, got ${count}`)
    const imported = useGraphStore.getState().sourceFiles
    const alpha = imported.find(file => file.name === 'alpha.md') || null
    if (!alpha) throw new Error(`expected alpha.md in Source Files, got ${JSON.stringify(imported.map(file => file.name))}`)
    if (alpha.text !== '# Alpha\n') throw new Error(`expected imported text to be preserved, got ${JSON.stringify(alpha.text)}`)
    if (!alpha.enabled || alpha.source?.kind !== 'local' || alpha.source.path !== 'alpha.md') {
      throw new Error(`expected selected Source File to be enabled local source, got ${JSON.stringify(alpha)}`)
    }
  } finally {
    store.setSourceFiles(previous)
  }
}
