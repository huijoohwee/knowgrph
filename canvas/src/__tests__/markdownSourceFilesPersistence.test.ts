import { LS_KEYS } from '@/lib/config'
import { createMemoryStorage } from '@/tests/lib/memoryStorage'
import {
  persistMarkdownSourceFolderPaths,
  readPersistedMarkdownSourceFolderPaths,
} from '@/features/markdown/ui/markdownSourceFilesPersistence'

export function testMarkdownSourceFilesPersistenceCanonicalizesSharedExpandedPathStorage() {
  const storage = createMemoryStorage()

  const written = persistMarkdownSourceFolderPaths(
    ['/docs', 'docs/guides/', '', 'docs', '\\docs\\guides\\', '/'],
    storage,
  )
  if (JSON.stringify(written) !== JSON.stringify(['docs', 'docs/guides'])) {
    throw new Error(`expected canonical persisted folder paths, got ${JSON.stringify(written)}`)
  }

  const rawStored = storage.getItem(LS_KEYS.markdownExplorerSourceFilesExpandedPaths)
  if (rawStored !== JSON.stringify(['docs', 'docs/guides'])) {
    throw new Error(`expected canonical localStorage payload, got ${String(rawStored)}`)
  }

  storage.setItem(
    LS_KEYS.markdownExplorerSourceFilesExpandedPaths,
    JSON.stringify(['/docs', 'guides/', '', '/docs/api', '\\docs\\api\\']),
  )
  const read = readPersistedMarkdownSourceFolderPaths(storage)
  if (JSON.stringify(read) !== JSON.stringify(['docs', 'docs/api', 'guides'])) {
    throw new Error(`expected canonical readback folder paths, got ${JSON.stringify(read)}`)
  }
}
