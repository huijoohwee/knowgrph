import {
  readCachedWorkspaceDocsMirrorEntries,
  resetWorkspaceSeedProviderStorageCacheForTests,
} from '@/features/workspace-fs/workspaceSeedProviderStorageCache'

export async function testWorkspaceDocsMirrorExportCacheReusesFreshEntriesAndExpires() {
  resetWorkspaceSeedProviderStorageCacheForTests()
  const originalNow = Date.now
  try {
    let now = 1_000
    Date.now = () => now
    const loadCounter = { value: 0 }
    const load = async () => {
      loadCounter.value += 1
      return [{
        relPath: 'docs/demo.md',
        text: `# Demo ${loadCounter.value}`,
        updatedAtMs: now,
      }]
    }

    const first = await readCachedWorkspaceDocsMirrorEntries({ cacheKey: 'docs-root:demo', load })
    const second = await readCachedWorkspaceDocsMirrorEntries({ cacheKey: 'docs-root:demo', load })
    if (loadCounter.value !== 1) {
      throw new Error(`expected fresh docs mirror cache hit to avoid duplicate loading, got ${loadCounter.value}`)
    }
    if (second[0]?.text !== '# Demo 1') {
      throw new Error(`expected fresh docs mirror cache hit to preserve first loaded text, got ${String(second[0]?.text || '')}`)
    }

    first[0]!.text = '# Mutated caller copy'
    const third = await readCachedWorkspaceDocsMirrorEntries({ cacheKey: 'docs-root:demo', load })
    if (third[0]?.text !== '# Demo 1') {
      throw new Error('expected docs mirror cache reads to return cloned entries instead of mutable cache memory')
    }

    now += 30_001
    const expired = await readCachedWorkspaceDocsMirrorEntries({ cacheKey: 'docs-root:demo', load })
    if (Number(loadCounter.value) !== 2 || expired[0]?.text !== '# Demo 2') {
      throw new Error(`expected docs mirror cache to reload after TTL expiry, count=${loadCounter.value}, text=${String(expired[0]?.text || '')}`)
    }
  } finally {
    Date.now = originalNow
    resetWorkspaceSeedProviderStorageCacheForTests()
  }
}
