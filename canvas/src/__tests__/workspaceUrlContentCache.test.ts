import { getInflightWorkspaceUrlContent, resetWorkspaceUrlContentCacheForTests, setInflightWorkspaceUrlContent } from '@/features/markdown-workspace/workspaceImport/urlContentCache'

export function testWorkspaceUrlContentCacheEvictsStaleInflightImportRequest() {
  resetWorkspaceUrlContentCacheForTests()
  const originalNow = Date.now
  try {
    let now = 1_000
    Date.now = () => now
    const pending = new Promise<never>(() => {})
    const key = 'import:default:test-key'

    setInflightWorkspaceUrlContent(key, pending)
    if (getInflightWorkspaceUrlContent(key) !== pending) {
      throw new Error('expected fresh inflight import request to be reused')
    }

    now += 20_001
    if (getInflightWorkspaceUrlContent(key) !== null) {
      throw new Error('expected stale inflight import request to be evicted')
    }
  } finally {
    Date.now = originalNow
    resetWorkspaceUrlContentCacheForTests()
  }
}
