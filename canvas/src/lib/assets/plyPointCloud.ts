export type PlyPointCloud = {
  kind: 'point-cloud' | 'gaussian-splat'
  positions: Float32Array
  colors: Float32Array | null
  opacities: Float32Array | null
  splatScales: Float32Array | null
  splatRotations: Float32Array | null
  sourcePointCount: number
  pointCount: number
  bounds: {
    min: [number, number, number]
    max: [number, number, number]
    center: [number, number, number]
    maxExtent: number
  }
}

type PlyFormat = 'ascii' | 'binary_little_endian' | 'binary_big_endian'

type PlyProperty = {
  name: string
  type: string
  list: boolean
}

type PlyHeader = {
  format: PlyFormat
  vertexCount: number
  properties: PlyProperty[]
  bodyOffset: number
}

export type PlyPointCloudBinaryLayout = {
  bodyOffset: number
  format: Exclude<PlyFormat, 'ascii'>
  headerBytes: Uint8Array
  rowBytes: number
  sourcePointCount: number
}

const PLY_END_HEADER = new TextEncoder().encode('end_header')
const GAUSSIAN_SPLAT_SH_C0 = 0.28209479177387814
const GAUSSIAN_SPLAT_DEFAULT_LOG_SCALE_Z = Math.log(1e-6)
const PROGRESSIVE_SOURCE_ORDER_MIN_POINTS = 100_000

const TYPE_BYTES: Record<string, number> = {
  char: 1,
  int8: 1,
  uchar: 1,
  uint8: 1,
  short: 2,
  int16: 2,
  ushort: 2,
  uint16: 2,
  int: 4,
  int32: 4,
  uint: 4,
  uint32: 4,
  float: 4,
  float32: 4,
  double: 8,
  float64: 8,
}

function findHeaderEnd(bytes: Uint8Array): number {
  for (let index = 0; index <= bytes.length - PLY_END_HEADER.length; index += 1) {
    let matched = true
    for (let cursor = 0; cursor < PLY_END_HEADER.length; cursor += 1) {
      if (bytes[index + cursor] !== PLY_END_HEADER[cursor]) {
        matched = false
        break
      }
    }
    if (!matched) continue
    let end = index + PLY_END_HEADER.length
    while (end < bytes.length && bytes[end] !== 10) end += 1
    return Math.min(bytes.length, end + 1)
  }
  return -1
}

function parseHeader(bytes: Uint8Array): PlyHeader {
  const bodyOffset = findHeaderEnd(bytes)
  if (bodyOffset <= 0) throw new Error('PLY header end not found')
  const headerText = new TextDecoder().decode(bytes.subarray(0, bodyOffset))
  const lines = headerText.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines[0] !== 'ply') throw new Error('PLY magic header missing')
  let format: PlyFormat | '' = ''
  let activeElement = ''
  let vertexCount = 0
  const properties: PlyProperty[] = []
  for (const line of lines) {
    const parts = line.split(/\s+/)
    if (parts[0] === 'format') {
      if (parts[1] === 'ascii' || parts[1] === 'binary_little_endian' || parts[1] === 'binary_big_endian') format = parts[1]
      continue
    }
    if (parts[0] === 'element') {
      activeElement = parts[1] || ''
      if (activeElement === 'vertex') vertexCount = Math.max(0, Number.parseInt(parts[2] || '0', 10) || 0)
      continue
    }
    if (activeElement === 'vertex' && parts[0] === 'property') {
      if (parts[1] === 'list') {
        properties.push({ name: parts[4] || '', type: parts[3] || '', list: true })
      } else {
        properties.push({ name: parts[2] || '', type: parts[1] || '', list: false })
      }
    }
  }
  if (!format) throw new Error('PLY format unsupported')
  if (vertexCount <= 0) throw new Error('PLY vertex element missing')
  return { format, vertexCount, properties, bodyOffset }
}

function readBinaryValue(view: DataView, offset: number, type: string, littleEndian: boolean): number {
  switch (type) {
    case 'char':
    case 'int8': return view.getInt8(offset)
    case 'uchar':
    case 'uint8': return view.getUint8(offset)
    case 'short':
    case 'int16': return view.getInt16(offset, littleEndian)
    case 'ushort':
    case 'uint16': return view.getUint16(offset, littleEndian)
    case 'int':
    case 'int32': return view.getInt32(offset, littleEndian)
    case 'uint':
    case 'uint32': return view.getUint32(offset, littleEndian)
    case 'double':
    case 'float64': return view.getFloat64(offset, littleEndian)
    default: return view.getFloat32(offset, littleEndian)
  }
}

function resolvePropertyIndex(properties: PlyProperty[], names: string[]): number {
  return properties.findIndex(prop => names.includes(prop.name.toLowerCase()))
}

function updateBounds(bounds: PlyPointCloud['bounds'], x: number, y: number, z: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return
  bounds.min[0] = Math.min(bounds.min[0], x)
  bounds.min[1] = Math.min(bounds.min[1], y)
  bounds.min[2] = Math.min(bounds.min[2], z)
  bounds.max[0] = Math.max(bounds.max[0], x)
  bounds.max[1] = Math.max(bounds.max[1], y)
  bounds.max[2] = Math.max(bounds.max[2], z)
}

function finalizeBounds(bounds: PlyPointCloud['bounds']): void {
  if (
    !Number.isFinite(bounds.min[0])
    || !Number.isFinite(bounds.min[1])
    || !Number.isFinite(bounds.min[2])
    || !Number.isFinite(bounds.max[0])
    || !Number.isFinite(bounds.max[1])
    || !Number.isFinite(bounds.max[2])
  ) {
    bounds.min = [0, 0, 0]
    bounds.max = [0, 0, 0]
    bounds.center = [0, 0, 0]
    bounds.maxExtent = 1
    return
  }
  bounds.center = [
    (bounds.min[0] + bounds.max[0]) * 0.5,
    (bounds.min[1] + bounds.max[1]) * 0.5,
    (bounds.min[2] + bounds.max[2]) * 0.5,
  ]
  bounds.maxExtent = Math.max(
    1,
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  )
}

function normalizeColor(value: number, property: PlyProperty | null): number {
  if (!Number.isFinite(value)) return 1
  if (property && /^(?:float|float32|double|float64)$/.test(property.type)) return Math.max(0, Math.min(1, value))
  return Math.max(0, Math.min(1, value / 255))
}

function normalizeGaussianSplatColor(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(0, Math.min(1, 0.5 + GAUSSIAN_SPLAT_SH_C0 * value))
}

function normalizeGaussianSplatOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(0.001, Math.min(1, 1 / (1 + Math.exp(-value))))
}

function normalizeGaussianSplatScale(value: number): number {
  return Math.max(0.000001, Math.min(4, Math.exp(Math.max(-14, Math.min(4, Number.isFinite(value) ? value : -8)))))
}

function writeProjectedPlyPosition(out: Float32Array, offset: number, x: number, y: number, z: number): void {
  out[offset] = -x
  out[offset + 1] = -y
  out[offset + 2] = z
}

function writeProjectedPlyQuaternion(out: Float32Array, offset: number, w: number, x: number, y: number, z: number): void {
  const projectedW = -z
  const projectedX = -y
  const projectedY = x
  const projectedZ = w
  const length = Math.hypot(projectedW, projectedX, projectedY, projectedZ)
  if (!(length > 1e-6)) {
    out[offset] = 0
    out[offset + 1] = 0
    out[offset + 2] = 0
    out[offset + 3] = 1
    return
  }
  const invLength = 1 / length
  out[offset] = projectedX * invLength
  out[offset + 1] = projectedY * invLength
  out[offset + 2] = projectedZ * invLength
  out[offset + 3] = projectedW * invLength
}

function resolveSamplePointCount(sourcePointCount: number, maxPoints: number): number {
  return Math.min(sourcePointCount, Math.max(1, Math.floor(Number.isFinite(maxPoints) ? maxPoints : sourcePointCount)))
}

function resolveSampleVertexIndex(sampleIndex: number, samplePointCount: number, sourcePointCount: number): number {
  if (samplePointCount >= sourcePointCount) return sampleIndex
  if (samplePointCount <= 1 || sourcePointCount <= 1) return 0
  return Math.min(sourcePointCount - 1, Math.round((sampleIndex * (sourcePointCount - 1)) / (samplePointCount - 1)))
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(Math.floor(a))
  let y = Math.abs(Math.floor(b))
  while (y > 0) {
    const next = x % y
    x = y
    y = next
  }
  return Math.max(1, x)
}

function resolveProgressiveSourceStride(sourcePointCount: number): number {
  if (sourcePointCount <= 2) return 1
  let stride = Math.max(1, Math.floor(sourcePointCount * 0.61803398875))
  if (stride % 2 === 0) stride += 1
  while (stride < sourcePointCount && greatestCommonDivisor(stride, sourcePointCount) !== 1) {
    stride += 2
  }
  return stride < sourcePointCount ? stride : 1
}

function buildVertexIndexResolver(samplePointCount: number, sourcePointCount: number): (sampleIndex: number) => number {
  if (samplePointCount < sourcePointCount) {
    return sampleIndex => resolveSampleVertexIndex(sampleIndex, samplePointCount, sourcePointCount)
  }
  if (sourcePointCount < PROGRESSIVE_SOURCE_ORDER_MIN_POINTS) return sampleIndex => sampleIndex
  const stride = resolveProgressiveSourceStride(sourcePointCount)
  return sampleIndex => (sampleIndex * stride) % sourcePointCount
}

function readAsciiNumber(parts: string[], index: number, fallback: number): number {
  if (index < 0) return fallback
  const value = Number(parts[index])
  return Number.isFinite(value) ? value : fallback
}

function resolvePlyRowBytes(properties: PlyProperty[]): number {
  let rowBytes = 0
  for (const prop of properties) {
    if (prop.list) return 0
    rowBytes += TYPE_BYTES[prop.type] || 4
  }
  return rowBytes
}

function replaceHeaderVertexCount(headerBytes: Uint8Array, pointCount: number): Uint8Array {
  const text = new TextDecoder().decode(headerBytes)
  const next = text.replace(/^element\s+vertex\s+\d+/im, `element vertex ${Math.max(0, Math.floor(pointCount))}`)
  return new TextEncoder().encode(next)
}

export function readPlyPointCloudBinaryLayout(buffer: ArrayBuffer | Uint8Array): PlyPointCloudBinaryLayout | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const header = parseHeader(bytes)
  if (header.format === 'ascii') return null
  const rowBytes = resolvePlyRowBytes(header.properties)
  if (rowBytes <= 0) return null
  return {
    bodyOffset: header.bodyOffset,
    format: header.format,
    headerBytes: bytes.slice(0, header.bodyOffset),
    rowBytes,
    sourcePointCount: header.vertexCount,
  }
}

export function buildPlyPointCloudPreviewBuffer(args: {
  headerBytes: Uint8Array
  rowChunks: Uint8Array[]
  rowBytes: number
}): Uint8Array | null {
  const rowBytes = Math.max(1, Math.floor(args.rowBytes))
  const rowCount = args.rowChunks.reduce((sum, chunk) => sum + Math.floor(chunk.byteLength / rowBytes), 0)
  if (rowCount <= 0) return null
  const headerBytes = replaceHeaderVertexCount(args.headerBytes, rowCount)
  const out = new Uint8Array(headerBytes.byteLength + rowCount * rowBytes)
  out.set(headerBytes, 0)
  let cursor = headerBytes.byteLength
  for (const chunk of args.rowChunks) {
    const aligned = chunk.byteLength - (chunk.byteLength % rowBytes)
    if (aligned <= 0) continue
    out.set(chunk.subarray(0, aligned), cursor)
    cursor += aligned
  }
  return cursor === out.byteLength ? out : out.slice(0, cursor)
}

export function parsePlyPointCloud(buffer: ArrayBuffer | Uint8Array, maxPoints = 2_000_000): PlyPointCloud {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const header = parseHeader(bytes)
  const xIndex = resolvePropertyIndex(header.properties, ['x'])
  const yIndex = resolvePropertyIndex(header.properties, ['y'])
  const zIndex = resolvePropertyIndex(header.properties, ['z'])
  if (xIndex < 0 || yIndex < 0 || zIndex < 0) throw new Error('PLY vertex coordinates missing')
  const redIndex = resolvePropertyIndex(header.properties, ['red', 'r', 'diffuse_red'])
  const greenIndex = resolvePropertyIndex(header.properties, ['green', 'g', 'diffuse_green'])
  const blueIndex = resolvePropertyIndex(header.properties, ['blue', 'b', 'diffuse_blue'])
  const fDcRedIndex = resolvePropertyIndex(header.properties, ['f_dc_0'])
  const fDcGreenIndex = resolvePropertyIndex(header.properties, ['f_dc_1'])
  const fDcBlueIndex = resolvePropertyIndex(header.properties, ['f_dc_2'])
  const opacityIndex = resolvePropertyIndex(header.properties, ['opacity'])
  const scaleXIndex = resolvePropertyIndex(header.properties, ['scale_0'])
  const scaleYIndex = resolvePropertyIndex(header.properties, ['scale_1'])
  const scaleZIndex = resolvePropertyIndex(header.properties, ['scale_2'])
  const rotWIndex = resolvePropertyIndex(header.properties, ['rot_0'])
  const rotXIndex = resolvePropertyIndex(header.properties, ['rot_1'])
  const rotYIndex = resolvePropertyIndex(header.properties, ['rot_2'])
  const rotZIndex = resolvePropertyIndex(header.properties, ['rot_3'])
  const hasRgbColor = redIndex >= 0 && greenIndex >= 0 && blueIndex >= 0
  const hasGaussianSplatColor = fDcRedIndex >= 0 && fDcGreenIndex >= 0 && fDcBlueIndex >= 0
  const hasGaussianSplatScale = scaleXIndex >= 0 && scaleYIndex >= 0
  const hasGaussianSplatRotation = rotWIndex >= 0 && rotXIndex >= 0 && rotYIndex >= 0 && rotZIndex >= 0
  const isGaussianSplat = hasGaussianSplatColor && hasGaussianSplatScale
  const hasColor = hasRgbColor || hasGaussianSplatColor
  const pointCount = resolveSamplePointCount(header.vertexCount, maxPoints)
  const positions = new Float32Array(pointCount * 3)
  const colors = hasColor ? new Float32Array(pointCount * 3) : null
  const opacities = isGaussianSplat ? new Float32Array(pointCount) : null
  const splatScales = isGaussianSplat ? new Float32Array(pointCount * 3) : null
  const splatRotations = isGaussianSplat ? new Float32Array(pointCount * 4) : null
  const resolveVertexIndex = buildVertexIndexResolver(pointCount, header.vertexCount)
  const bounds: PlyPointCloud['bounds'] = {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    center: [0, 0, 0],
    maxExtent: 1,
  }
  let written = 0

  if (header.format === 'ascii') {
    const text = new TextDecoder().decode(bytes.subarray(header.bodyOffset))
    const lines = text.split(/\r?\n/)
    for (let sampleIndex = 0; sampleIndex < pointCount; sampleIndex += 1) {
      const vertexIndex = resolveVertexIndex(sampleIndex)
      const parts = String(lines[vertexIndex] || '').trim().split(/\s+/)
      const x = readAsciiNumber(parts, xIndex, Number.NaN)
      const y = readAsciiNumber(parts, yIndex, Number.NaN)
      const z = readAsciiNumber(parts, zIndex, Number.NaN)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
      const positionOffset = written * 3
      writeProjectedPlyPosition(positions, positionOffset, x, y, z)
      updateBounds(bounds, positions[positionOffset], positions[positionOffset + 1], positions[positionOffset + 2])
      if (colors) {
        colors[written * 3] = hasRgbColor ? normalizeColor(readAsciiNumber(parts, redIndex, 255), header.properties[redIndex] || null) : normalizeGaussianSplatColor(readAsciiNumber(parts, fDcRedIndex, 0))
        colors[written * 3 + 1] = hasRgbColor ? normalizeColor(readAsciiNumber(parts, greenIndex, 255), header.properties[greenIndex] || null) : normalizeGaussianSplatColor(readAsciiNumber(parts, fDcGreenIndex, 0))
        colors[written * 3 + 2] = hasRgbColor ? normalizeColor(readAsciiNumber(parts, blueIndex, 255), header.properties[blueIndex] || null) : normalizeGaussianSplatColor(readAsciiNumber(parts, fDcBlueIndex, 0))
      }
      const scaleX = readAsciiNumber(parts, scaleXIndex, 0)
      const scaleY = readAsciiNumber(parts, scaleYIndex, 0)
      const scaleZ = readAsciiNumber(parts, scaleZIndex, GAUSSIAN_SPLAT_DEFAULT_LOG_SCALE_Z)
      if (opacities) opacities[written] = opacityIndex >= 0 ? normalizeGaussianSplatOpacity(readAsciiNumber(parts, opacityIndex, 0)) : 1
      if (splatScales) {
        splatScales[written * 3] = normalizeGaussianSplatScale(scaleX)
        splatScales[written * 3 + 1] = normalizeGaussianSplatScale(scaleY)
        splatScales[written * 3 + 2] = normalizeGaussianSplatScale(scaleZ)
      }
      if (splatRotations) {
        writeProjectedPlyQuaternion(
          splatRotations,
          written * 4,
          readAsciiNumber(parts, rotWIndex, 1),
          readAsciiNumber(parts, rotXIndex, 0),
          readAsciiNumber(parts, rotYIndex, 0),
          readAsciiNumber(parts, rotZIndex, 0),
        )
      }
      written += 1
    }
  } else {
    const offsets: number[] = []
    let rowBytes = 0
    for (const prop of header.properties) {
      if (prop.list) throw new Error('PLY vertex list properties unsupported')
      offsets.push(rowBytes)
      rowBytes += TYPE_BYTES[prop.type] || 4
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const littleEndian = header.format === 'binary_little_endian'
    for (let sampleIndex = 0; sampleIndex < pointCount; sampleIndex += 1) {
      const vertexIndex = resolveVertexIndex(sampleIndex)
      const rowOffset = header.bodyOffset + vertexIndex * rowBytes
      const x = readBinaryValue(view, rowOffset + offsets[xIndex], header.properties[xIndex].type, littleEndian)
      const y = readBinaryValue(view, rowOffset + offsets[yIndex], header.properties[yIndex].type, littleEndian)
      const z = readBinaryValue(view, rowOffset + offsets[zIndex], header.properties[zIndex].type, littleEndian)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
      const positionOffset = written * 3
      writeProjectedPlyPosition(positions, positionOffset, x, y, z)
      updateBounds(bounds, positions[positionOffset], positions[positionOffset + 1], positions[positionOffset + 2])
      if (colors) {
        colors[written * 3] = hasRgbColor
          ? normalizeColor(readBinaryValue(view, rowOffset + offsets[redIndex], header.properties[redIndex].type, littleEndian), header.properties[redIndex] || null)
          : normalizeGaussianSplatColor(readBinaryValue(view, rowOffset + offsets[fDcRedIndex], header.properties[fDcRedIndex].type, littleEndian))
        colors[written * 3 + 1] = hasRgbColor
          ? normalizeColor(readBinaryValue(view, rowOffset + offsets[greenIndex], header.properties[greenIndex].type, littleEndian), header.properties[greenIndex] || null)
          : normalizeGaussianSplatColor(readBinaryValue(view, rowOffset + offsets[fDcGreenIndex], header.properties[fDcGreenIndex].type, littleEndian))
        colors[written * 3 + 2] = hasRgbColor
          ? normalizeColor(readBinaryValue(view, rowOffset + offsets[blueIndex], header.properties[blueIndex].type, littleEndian), header.properties[blueIndex] || null)
          : normalizeGaussianSplatColor(readBinaryValue(view, rowOffset + offsets[fDcBlueIndex], header.properties[fDcBlueIndex].type, littleEndian))
      }
      const scaleX = isGaussianSplat ? readBinaryValue(view, rowOffset + offsets[scaleXIndex], header.properties[scaleXIndex].type, littleEndian) : 0
      const scaleY = isGaussianSplat ? readBinaryValue(view, rowOffset + offsets[scaleYIndex], header.properties[scaleYIndex].type, littleEndian) : 0
      const scaleZ = isGaussianSplat && scaleZIndex >= 0 ? readBinaryValue(view, rowOffset + offsets[scaleZIndex], header.properties[scaleZIndex].type, littleEndian) : GAUSSIAN_SPLAT_DEFAULT_LOG_SCALE_Z
      if (opacities) opacities[written] = opacityIndex >= 0 ? normalizeGaussianSplatOpacity(readBinaryValue(view, rowOffset + offsets[opacityIndex], header.properties[opacityIndex].type, littleEndian)) : 1
      if (splatScales) {
        splatScales[written * 3] = normalizeGaussianSplatScale(scaleX)
        splatScales[written * 3 + 1] = normalizeGaussianSplatScale(scaleY)
        splatScales[written * 3 + 2] = normalizeGaussianSplatScale(scaleZ)
      }
      if (splatRotations) {
        writeProjectedPlyQuaternion(
          splatRotations,
          written * 4,
          hasGaussianSplatRotation ? readBinaryValue(view, rowOffset + offsets[rotWIndex], header.properties[rotWIndex].type, littleEndian) : 1,
          hasGaussianSplatRotation ? readBinaryValue(view, rowOffset + offsets[rotXIndex], header.properties[rotXIndex].type, littleEndian) : 0,
          hasGaussianSplatRotation ? readBinaryValue(view, rowOffset + offsets[rotYIndex], header.properties[rotYIndex].type, littleEndian) : 0,
          hasGaussianSplatRotation ? readBinaryValue(view, rowOffset + offsets[rotZIndex], header.properties[rotZIndex].type, littleEndian) : 0,
        )
      }
      written += 1
    }
  }

  finalizeBounds(bounds)
  return {
    kind: isGaussianSplat ? 'gaussian-splat' : 'point-cloud',
    positions: written === pointCount ? positions : positions.slice(0, written * 3),
    colors: colors && written === pointCount ? colors : colors ? colors.slice(0, written * 3) : null,
    opacities: opacities && written === pointCount ? opacities : opacities ? opacities.slice(0, written) : null,
    splatScales: splatScales && written === pointCount ? splatScales : splatScales ? splatScales.slice(0, written * 3) : null,
    splatRotations: splatRotations && written === pointCount ? splatRotations : splatRotations ? splatRotations.slice(0, written * 4) : null,
    sourcePointCount: header.vertexCount,
    pointCount: written,
    bounds,
  }
}
