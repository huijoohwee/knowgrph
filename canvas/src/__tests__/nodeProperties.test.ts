import { readNodeProperties, readNodePropertyPathValue } from '@/lib/graph/nodeProperties'

export function testNodePropertiesHelpersProvideStableEmptyRootAndPathReads() {
  const emptyA = readNodeProperties(null)
  const emptyB = readNodeProperties({ properties: null } as never)
  if (emptyA !== emptyB) {
    throw new Error('expected node property helper to reuse a stable empty object for missing properties')
  }

  const node = {
    properties: {
      title: 'Hello',
      nested: {
        value: 42,
      },
    },
  } as const

  const properties = readNodeProperties(node)
  if (properties.title !== 'Hello') {
    throw new Error('expected node property helper to expose direct property values')
  }
  if (readNodePropertyPathValue(node, 'properties.nested.value') !== 42) {
    throw new Error('expected node property path helper to resolve nested property schema paths')
  }
  if (readNodePropertyPathValue(node, 'missing.value') !== undefined) {
    throw new Error('expected node property path helper to return undefined for missing paths')
  }
}
