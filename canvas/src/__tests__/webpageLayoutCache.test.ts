import { clearCachedWebpageLayoutSnapshots, getCachedWebpageLayoutSnapshot, setCachedWebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutCache'

import type { WebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutExport'

export function testWebpageLayoutCacheEvictsOldest() {
  clearCachedWebpageLayoutSnapshots()

  const mk = (n: number): WebpageLayoutSnapshot =>
    ({
      meta: { kind: 'layout', title: `t${n}`, href: `https://example.invalid/${n}`, viewport: { w: 1, h: 1 }, scroll: { x: 0, y: 0, height: 1 }, ts: n },
      elements: [],
    }) as unknown as WebpageLayoutSnapshot

  for (let i = 1; i <= 9; i += 1) {
    setCachedWebpageLayoutSnapshot(`https://example.invalid/${i}`, mk(i), 'layout:v1')
  }

  if (getCachedWebpageLayoutSnapshot('https://example.invalid/1', 'layout:v1')) throw new Error('expected oldest entry to be evicted')
  if (!getCachedWebpageLayoutSnapshot('https://example.invalid/2', 'layout:v1')) throw new Error('expected entry 2 to remain')
  if (!getCachedWebpageLayoutSnapshot('https://example.invalid/9', 'layout:v1')) throw new Error('expected newest entry to remain')
}
