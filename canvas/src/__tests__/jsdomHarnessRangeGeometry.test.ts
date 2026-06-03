import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export function testJsdomHarnessProvidesRangeGeometryApis() {
  const originalRange = (globalThis as { Range?: unknown }).Range
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body></body></html>')

  try {
    const doc = dom.window.document
    const text = doc.createTextNode('selectable text')
    doc.body.appendChild(text)
    const range = doc.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 10)

    const rangeWithGeometry = range as Range & {
      getBoundingClientRect: () => DOMRect
      getClientRects: () => DOMRectList
    }

    if (typeof rangeWithGeometry.getBoundingClientRect !== 'function') {
      throw new Error('expected jsdom harness to provide Range.getBoundingClientRect')
    }
    if (typeof rangeWithGeometry.getClientRects !== 'function') {
      throw new Error('expected jsdom harness to provide Range.getClientRects')
    }

    const rect = rangeWithGeometry.getBoundingClientRect()
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) {
      throw new Error('expected Range.getBoundingClientRect to return finite coordinates')
    }

    const rects = rangeWithGeometry.getClientRects()
    if (typeof rects.length !== 'number' || typeof rects.item !== 'function') {
      throw new Error('expected Range.getClientRects to return a DOMRectList-like value')
    }
    if (Array.from(rects).length !== rects.length) {
      throw new Error('expected Range.getClientRects result to be iterable through Array.from')
    }
    if ((globalThis as { Range?: unknown }).Range !== dom.window.Range) {
      throw new Error('expected jsdom harness to expose the active Range constructor globally')
    }
  } finally {
    restore()
  }

  if ((globalThis as { Range?: unknown }).Range !== originalRange) {
    throw new Error('expected jsdom harness restore to reset the global Range constructor')
  }
}
