import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSourceFileRecord } from '@/features/source-files/sourceFileParsedState'
import { useGraphStore } from '@/hooks/useGraphStore'

export function testSetSourceFilesSkipsEquivalentNormalizedSnapshots() {
  const previousSourceFiles = useGraphStore.getState().sourceFiles
  const canonical = buildSourceFileRecord({
    id: `sf-stable-${Date.now()}`,
    name: 'stable-source.md',
    text: '# stable',
    enabled: true,
    status: 'parsed',
    parserId: 'frontmatter',
    textHash: 'hash-stable',
    source: { kind: 'local', path: 'workspace:/stable-source.md' },
  })
  const observedUpdates = { value: 0 }
  const unsubscribe = useGraphStore.subscribe(
    state => state.sourceFiles,
    () => {
      observedUpdates.value += 1
    },
  )
  const readObservedUpdates = (): number => observedUpdates.value
  try {
    useGraphStore.getState().setSourceFiles([canonical])
    observedUpdates.value = 0
    const before = useGraphStore.getState().sourceFiles
    useGraphStore.getState().setSourceFiles([{
      ...canonical,
      source: { kind: 'local', path: 'workspace:/stable-source.md' },
    }])
    if (readObservedUpdates() !== 0) {
      throw new Error('expected equivalent Source Files replacement to skip store publication')
    }
    if (useGraphStore.getState().sourceFiles !== before) {
      throw new Error('expected equivalent Source Files replacement to preserve sourceFiles array identity')
    }
    useGraphStore.getState().setSourceFiles([{ ...canonical, text: '# changed' }])
    if (readObservedUpdates() !== 1) {
      throw new Error('expected changed Source Files replacement to publish exactly one store update')
    }
  } finally {
    unsubscribe()
    useGraphStore.getState().setSourceFiles(previousSourceFiles)
  }
}

export function testSourceFilesSliceUsesSharedEqualityForReplacementSnapshots() {
  const slicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'sourceFilesSlice.ts')
  const text = readFileSync(slicePath, 'utf8')
  if (!text.includes('normalizeSourceFiles(files)')) {
    throw new Error('expected sourceFiles store slice replacements to normalize through the shared helper')
  }
  if (!text.includes('areSourceFileRecordsEqual') || !text.includes('areSourceFileListsEqual')) {
    throw new Error('expected sourceFiles store slice replacements to skip equivalent canonical snapshots through shared equality')
  }
}
