import fs from 'node:fs'
import path from 'node:path'
import { parseGraph } from '@/lib/graph/io/adapter'
import { resolveExternalFixtureRoot, isFile } from '@/tests/lib/externalFixtures'

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
  const fixtureRoot = resolveExternalFixtureRoot()
  if (!fixtureRoot) return

  const airportsPath = path.join(fixtureRoot, 'test-data', 'airports.json')
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
    const props = n.properties as Record<string, unknown>
    const geo = props?.geo as { lat?: unknown; lng?: unknown } | undefined
    return geo && typeof geo.lat === 'number' && typeof geo.lng === 'number'
  })
  if (!hasGeo) throw new Error('Expected at least one node to contain properties.geo.{lat,lng}')

  const warnings = Array.isArray(diag.warnings) ? diag.warnings.join(' ') : ''
  if (!warnings.toLowerCase().includes('sampled')) {
    throw new Error(`Expected geodata sampling warning, got: ${JSON.stringify(diag.warnings || [])}`)
  }
}

export const testGeodataJsonReusesSharedPlainObjectGuard = () => {
  const filePath = path.resolve(process.cwd(), 'src', 'lib', 'graph', 'io', 'geodataJson.ts')
  const text = fs.readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected geodata json parser to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const readPlainObject = (value: unknown): Record<string, unknown> | null => {')) {
    throw new Error('expected geodata json parser to centralize plain-object coercion in one local helper')
  }
  if (!text.includes('const record = readPlainObject(value)')) {
    throw new Error('expected geodata json sampling to reuse the shared local plain-object helper')
  }
  if (!text.includes('...(readPlainObject(record.geo) || {}),')) {
    throw new Error('expected geodata json geo merge to reuse the shared local plain-object helper')
  }
  if (text.includes("const isRecord = (v: unknown): v is Record<string, unknown> =>")) {
    throw new Error('expected geodata json parser to stop defining a local record guard')
  }
}
