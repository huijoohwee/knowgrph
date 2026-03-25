import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testThreeGraphAllowsTableOverlaysEvenInMultiDimMode() {
  const p = resolve(process.cwd(), 'src', 'features', 'three', 'ThreeGraph.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes("if (multiDimTableModeEnabled) return ['code', 'blockquote', 'callout', 'html']")) {
    throw new Error('expected ThreeGraph to not exclude table overlays in multi-dimensional table mode')
  }
  if (!text.includes("return ['table', 'code', 'blockquote', 'callout', 'html']")) {
    throw new Error('expected ThreeGraph to always allow table overlays')
  }
}

