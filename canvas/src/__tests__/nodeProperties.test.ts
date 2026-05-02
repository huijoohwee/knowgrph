import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isJsonValue } from '@/lib/graph/jsonValue'
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

export function testGraphValueHelpersReuseSharedPlainObjectGuard() {
  const nodePropertiesPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'nodeProperties.ts')
  const nodePropertiesText = readFileSync(nodePropertiesPath, 'utf8')
  if (!nodePropertiesText.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected nodeProperties to reuse the shared plain-object guard upstream')
  }
  if (nodePropertiesText.includes('function isRecord(')) {
    throw new Error('expected nodeProperties to stop defining a local record guard')
  }

  const jsonValuePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'jsonValue.ts')
  const jsonValueText = readFileSync(jsonValuePath, 'utf8')
  if (!jsonValueText.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected jsonValue to reuse the shared plain-object guard upstream')
  }
  if (jsonValueText.includes('function isRecord(')) {
    throw new Error('expected jsonValue to stop defining a local record guard')
  }

  if (isJsonValue({ ok: ['x', 1, true, null] }) !== true) {
    throw new Error('expected jsonValue helper to accept plain JSON-compatible records')
  }
  if (isJsonValue({ bad: undefined }) !== false) {
    throw new Error('expected jsonValue helper to reject records with undefined members')
  }
}
