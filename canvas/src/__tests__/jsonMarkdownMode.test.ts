import { LS_KEYS } from '@/lib/config'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { jsonToMarkdown } from '@/features/markdown/jsonToMarkdown'

export async function testJsonMarkdownModeUpdatesMarkdownFromJsonSource() {
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage })
  try {
    const json = {
      items: [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ],
    }
    const text = JSON.stringify(json)

    lsSetJson<'auto' | 'table' | 'key-value' | 'hierarchical'>(
      LS_KEYS.jsonMarkdownMode,
      'auto',
    )

    const initialMode = lsJson<'auto' | 'table' | 'key-value' | 'hierarchical'>(
      LS_KEYS.jsonMarkdownMode,
      'auto',
      value =>
        value === 'table' ||
        value === 'key-value' ||
        value === 'hierarchical' ||
        value === 'auto'
          ? value
          : 'auto',
    )
    if (initialMode !== 'auto') {
      throw new Error(`expected auto mode from LS, got ${initialMode}`)
    }

    const renderedTable = jsonToMarkdown(json, { defaultMode: 'table' }, 'table')
    const renderedKeyValue = jsonToMarkdown(
      json,
      { defaultMode: 'key-value' },
      'key-value',
    )

    if (!renderedTable || !renderedTable.trim()) {
      throw new Error('expected non-empty table markdown from jsonToMarkdown')
    }
    if (!renderedKeyValue || !renderedKeyValue.trim()) {
      throw new Error('expected non-empty key-value markdown from jsonToMarkdown')
    }

    const measureSimilarity = (a: string, b: string): number => {
      const aa = a.trim()
      const bb = b.trim()
      if (!aa || !bb) return 0
      const minLen = Math.min(aa.length, bb.length)
      if (!minLen) return 0
      let same = 0
      const limit = Math.min(minLen, 1024)
      for (let i = 0; i < limit; i += 1) {
        if (aa[i] === bb[i]) same += 1
      }
      return same / limit
    }

    const tableVsKeyValue = measureSimilarity(renderedTable, renderedKeyValue)
    if (tableVsKeyValue > 0.9) {
      throw new Error('expected table and key-value markdown to differ for sample JSON')
    }

    await Promise.resolve(text)
  } finally {
    restore()
  }
}

