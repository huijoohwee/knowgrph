import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildCanonicalNodeLookup, getCanonicalNodeLookupValue } from '@/lib/graph/canonicalNodeIds'

export function testCanonicalNodeLookupHelpersResolveComposedIds() {
  const lookup = buildCanonicalNodeLookup<string>([
    ['layer-a::node-1', 'node-1-value'],
    ['node-2', 'node-2-value'],
  ])

  if (getCanonicalNodeLookupValue(lookup, 'layer-a::node-1') !== 'node-1-value') {
    throw new Error('expected canonical node lookup helper to resolve exact composed ids')
  }
  if (getCanonicalNodeLookupValue(lookup, 'node-1') !== 'node-1-value') {
    throw new Error('expected canonical node lookup helper to resolve inner ids from composed ids')
  }
  if (getCanonicalNodeLookupValue(lookup, 'node-2') !== 'node-2-value') {
    throw new Error('expected canonical node lookup helper to preserve plain node ids')
  }
}

export function testRendererPathsReuseCanonicalNodeLookupHelpers() {
  const linksText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'links.ts'),
    'utf8',
  )
  const tickText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'sceneHandlers.simulationTick2d.ts'),
    'utf8',
  )
  const canonicalText = readFileSync(
    resolve(process.cwd(), 'src', 'lib', 'graph', 'canonicalNodeIds.ts'),
    'utf8',
  )

  if (!canonicalText.includes('export function buildCanonicalNodeLookup') || !canonicalText.includes('export function getCanonicalNodeLookupValue')) {
    throw new Error('expected canonical node id helpers to provide shared lookup-building and lookup-resolution utilities')
  }
  if (!linksText.includes('buildCanonicalNodeLookup') || !linksText.includes('getCanonicalNodeLookupValue')) {
    throw new Error('expected GraphCanvas links layer to reuse shared canonical node lookup helpers instead of inline composed-id parsing')
  }
  if (!tickText.includes('buildCanonicalNodeLookup') || !tickText.includes('getCanonicalNodeLookupValue')) {
    throw new Error('expected GraphCanvas simulation tick handler to reuse shared canonical node lookup helpers instead of inline composed-id parsing')
  }
}
