import fs from 'node:fs'
import path from 'node:path'
import { parseGraph } from '@/lib/graph/io/adapter'
import { resolveSandboxRoot, isFile } from '@/tests/lib/sandboxRoot'

const readUtf8Prefix = (absPath: string, maxBytes: number): string => {
  const fd = fs.openSync(absPath, 'r')
  try {
    const buf = Buffer.allocUnsafe(maxBytes)
    const bytes = fs.readSync(fd, buf, 0, maxBytes, 0)
    return buf.subarray(0, bytes).toString('utf8')
  } finally {
    fs.closeSync(fd)
  }
}

export const testAirportsJsonGeodataParsingUsesSampling = () => {
  const sandboxRoot = resolveSandboxRoot()
  if (!sandboxRoot) return

  const airportsPath = path.join(sandboxRoot, 'test-data', 'airports.json')
  if (!isFile(airportsPath)) return

  const prefix = readUtf8Prefix(airportsPath, 20 * 1024 * 1024)
  const { data, diag } = parseGraph('airports.json', prefix)

  if (data.context !== 'geodata') {
    throw new Error(`Expected airports.json to parse as geodata, got context=${String(data.context)}`)
  }
  if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
    throw new Error('Expected sampled geodata nodes')
  }
  const hasGeo = data.nodes.some(n => {
    const props = (n as any)?.properties
    const geo = props && typeof props === 'object' ? (props.geo as any) : null
    return geo && typeof geo.lat === 'number' && typeof geo.lng === 'number'
  })
  if (!hasGeo) throw new Error('Expected at least one node to contain properties.geo.{lat,lng}')

  const warnings = Array.isArray(diag.warnings) ? diag.warnings.join(' ') : ''
  if (!warnings.toLowerCase().includes('sampled')) {
    throw new Error(`Expected geodata sampling warning, got: ${JSON.stringify(diag.warnings || [])}`)
  }
}

