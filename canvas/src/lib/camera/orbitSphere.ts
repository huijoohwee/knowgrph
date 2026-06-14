export type CameraOrbitSphereGridPoint<TLongitude extends number = number, TLatitude extends number = number> = {
  longitude: TLongitude
  latitude: TLatitude
}

export type CameraOrbitSphereVector = {
  orbitVectorX: number
  orbitVectorY: number
  orbitVectorZ: number
}

export type CameraOrbitSpherePoint = CameraOrbitSphereVector & {
  cameraX: number
  cameraY: number
}

export type CameraOrbitSpherePathPoint = {
  x: number
  y: number
}

export type CameraOrbitSphereFrameRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CameraOrbitSphereFrameEdge = 'left' | 'right' | 'top' | 'bottom'

export type CameraOrbitFrameRayFootprintOptions = {
  minRatio?: number
  maxRatio?: number
  fullDistanceRatio?: number
}

export type CameraOrbitFrameRayProjectionOptions = {
  horizontalWeight?: number
  verticalWeight?: number
  depthPitchRatio?: number
}

export type CameraOrbitFrameRayOptions = {
  footprint?: CameraOrbitFrameRayFootprintOptions
  projection?: CameraOrbitFrameRayProjectionOptions
}

export type CameraOrbitSphereLatitudeRow<TLatitude extends number = number> = {
  degree: TLatitude
  key: string
  cy: number
  rx: number
  ry: number
}

export type CameraOrbitSphereConfig<TLongitude extends number = number, TLatitude extends number = number> = {
  centerX: number
  centerY: number
  radius: number
  longitudeSpanDegrees: number
  longitudeDegrees: readonly TLongitude[]
  latitudeDegrees: readonly TLatitude[]
  latitudeRows: readonly CameraOrbitSphereLatitudeRow<TLatitude>[]
}

export type CameraOrbitSpherePose = CameraOrbitSpherePoint & {
  rotation: number
  rayTargetX: number
  rayTargetY: number
  rayLookTargetX: number
  rayLookTargetY: number
  rayEdgeStartX: number
  rayEdgeStartY: number
  rayEdgeEndX: number
  rayEdgeEndY: number
}

export type CameraOrbitFrameAwareOptions = {
  clearance?: number
  focusYRatio?: number
  maxY?: number
}

export type CameraOrbitSpherePoseOptions = {
  frameAware?: CameraOrbitFrameAwareOptions
  ray?: CameraOrbitFrameRayOptions
}

export type CameraOrbitHandleRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CameraOrbitSphereMeridianGeometry =
  | {
    kind: 'line'
    x: number
    longitude: number
  }
  | {
    kind: 'curve'
    pathD: string
    sweepFlag: 0 | 1
    longitude: number
  }

export const normalizeCameraOrbitDegrees = (degrees: number) => ((degrees % 360) + 360) % 360

export const isPointWithinCameraOrbitRect = (
  point: { x: number; y: number },
  rect: CameraOrbitHandleRect,
  padding = 0,
) => point.x >= rect.x - padding && point.x <= rect.x + rect.width + padding && point.y >= rect.y - padding && point.y <= rect.y + rect.height + padding

export const findNearestCameraOrbitDegree = <T extends number>(value: number, degrees: readonly T[], wrap = false): T => {
  return degrees.reduce((nearest, degree) => {
    const distance = wrap
      ? Math.min(Math.abs(normalizeCameraOrbitDegrees(value - degree)), Math.abs(normalizeCameraOrbitDegrees(degree - value)))
      : Math.abs(value - degree)
    const nearestDistance = wrap
      ? Math.min(Math.abs(normalizeCameraOrbitDegrees(value - nearest)), Math.abs(normalizeCameraOrbitDegrees(nearest - value)))
      : Math.abs(value - nearest)
    return distance < nearestDistance ? degree : nearest
  }, degrees[0])
}

export const resolveCameraOrbitFrameCenter = (frame: CameraOrbitSphereFrameRect) => ({
  x: frame.x + frame.width / 2,
  y: frame.y + frame.height / 2,
})

export const resolveCameraOrbitFrameAwarePoint = (
  cameraPoint: CameraOrbitSpherePoint,
  frame: CameraOrbitSphereFrameRect,
  options: CameraOrbitFrameAwareOptions = {},
): CameraOrbitSpherePoint => {
  if (!isPointWithinCameraOrbitRect({ x: cameraPoint.cameraX, y: cameraPoint.cameraY }, frame)) {
    return cameraPoint
  }
  const focusYRatio = options.focusYRatio ?? 0.78
  const clearance = options.clearance ?? 0
  return {
    ...cameraPoint,
    cameraY: Math.min(options.maxY ?? Number.POSITIVE_INFINITY, frame.y + frame.height * focusYRatio + clearance),
  }
}

export const resolveCameraOrbitFrameFacingEdge = (
  cameraPoint: CameraOrbitSpherePoint,
  frame: CameraOrbitSphereFrameRect,
): CameraOrbitSphereFrameEdge => {
  const center = resolveCameraOrbitFrameCenter(frame)
  const deltaX = cameraPoint.cameraX - center.x
  const deltaY = cameraPoint.cameraY - center.y
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left'
  }
  return deltaY >= 0 ? 'bottom' : 'top'
}

export const resolveCameraOrbitFrameEdgeMidpoint = (frame: CameraOrbitSphereFrameRect, edge: CameraOrbitSphereFrameEdge) => {
  if (edge === 'left' || edge === 'right') {
    return {
      x: edge === 'left' ? frame.x : frame.x + frame.width,
      y: frame.y + frame.height / 2,
    }
  }
  return {
    x: frame.x + frame.width / 2,
    y: edge === 'top' ? frame.y : frame.y + frame.height,
  }
}

const clampCameraOrbitNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const resolveCameraOrbitFrameRayTargetFromDirection = (
  frame: CameraOrbitSphereFrameRect,
  deltaX: number,
  deltaY: number,
) => {
  const center = resolveCameraOrbitFrameCenter(frame)
  const candidates: Array<{ edge: CameraOrbitSphereFrameEdge; x: number; y: number; t: number }> = []
  if (Math.abs(deltaX) > 0.001) {
    const leftT = (frame.x - center.x) / deltaX
    const leftY = center.y + leftT * deltaY
    if (leftT >= 0 && leftY >= frame.y && leftY <= frame.y + frame.height) {
      candidates.push({ edge: 'left', x: frame.x, y: leftY, t: leftT })
    }
    const rightX = frame.x + frame.width
    const rightT = (rightX - center.x) / deltaX
    const rightY = center.y + rightT * deltaY
    if (rightT >= 0 && rightY >= frame.y && rightY <= frame.y + frame.height) {
      candidates.push({ edge: 'right', x: rightX, y: rightY, t: rightT })
    }
  }
  if (Math.abs(deltaY) > 0.001) {
    const topT = (frame.y - center.y) / deltaY
    const topX = center.x + topT * deltaX
    if (topT >= 0 && topX >= frame.x && topX <= frame.x + frame.width) {
      candidates.push({ edge: 'top', x: topX, y: frame.y, t: topT })
    }
    const bottomY = frame.y + frame.height
    const bottomT = (bottomY - center.y) / deltaY
    const bottomX = center.x + bottomT * deltaX
    if (bottomT >= 0 && bottomX >= frame.x && bottomX <= frame.x + frame.width) {
      candidates.push({ edge: 'bottom', x: bottomX, y: bottomY, t: bottomT })
    }
  }
  if (candidates.length > 0) {
    return candidates.reduce((nearest, candidate) => candidate.t < nearest.t ? candidate : nearest)
  }
  return null
}

const resolveCameraOrbitFrameRayTargetFromPoint = (cameraPoint: CameraOrbitSpherePoint, frame: CameraOrbitSphereFrameRect) => {
  const center = resolveCameraOrbitFrameCenter(frame)
  const target = resolveCameraOrbitFrameRayTargetFromDirection(frame, cameraPoint.cameraX - center.x, cameraPoint.cameraY - center.y)
  if (target) return target
  const edge = resolveCameraOrbitFrameFacingEdge(cameraPoint, frame)
  const midpoint = resolveCameraOrbitFrameEdgeMidpoint(frame, edge)
  return {
    edge,
    x: midpoint.x,
    y: midpoint.y,
    t: 0,
  }
}

const resolveCameraOrbitFrameRayDirection = (
  cameraPoint: CameraOrbitSpherePoint,
  options: CameraOrbitFrameRayProjectionOptions = {},
) => {
  const horizontalWeight = options.horizontalWeight ?? 1
  const verticalWeight = options.verticalWeight ?? 1
  const depthPitchRatio = options.depthPitchRatio ?? 0.45
  return {
    deltaX: cameraPoint.orbitVectorX * horizontalWeight,
    deltaY: (cameraPoint.orbitVectorZ * depthPitchRatio - cameraPoint.orbitVectorY) * verticalWeight,
  }
}

const resolveCameraOrbitFrameRayTarget = (
  cameraPoint: CameraOrbitSpherePoint,
  frame: CameraOrbitSphereFrameRect,
  options: CameraOrbitFrameRayProjectionOptions = {},
) => {
  const direction = resolveCameraOrbitFrameRayDirection(cameraPoint, options)
  const vectorTarget = resolveCameraOrbitFrameRayTargetFromDirection(frame, direction.deltaX, direction.deltaY)
  return vectorTarget || resolveCameraOrbitFrameRayTargetFromPoint(cameraPoint, frame)
}

export const resolveCameraOrbitFrameRayFootprint = (
  cameraPoint: CameraOrbitSpherePoint,
  frame: CameraOrbitSphereFrameRect,
  edge: CameraOrbitSphereFrameEdge,
  target: { x: number; y: number },
  options: CameraOrbitFrameRayFootprintOptions = {},
) => {
  const minRatio = options.minRatio ?? 0.42
  const maxRatio = options.maxRatio ?? 1
  const fullDistanceRatio = options.fullDistanceRatio ?? 0.62
  const horizontalEdge = edge === 'top' || edge === 'bottom'
  const footprintAxisLength = horizontalEdge ? frame.width : frame.height
  const distanceAxisLength = Math.max(1, horizontalEdge ? frame.height : frame.width)
  const cameraDistance = horizontalEdge ? Math.abs(cameraPoint.cameraY - target.y) : Math.abs(cameraPoint.cameraX - target.x)
  const distanceRatio = cameraDistance / Math.max(1, distanceAxisLength * fullDistanceRatio)
  const footprintRatio = clampCameraOrbitNumber(Math.max(minRatio, distanceRatio), minRatio, maxRatio)
  const halfFootprint = footprintAxisLength * footprintRatio / 2
  if (horizontalEdge) {
    return {
      rayEdgeStartX: clampCameraOrbitNumber(target.x - halfFootprint, frame.x, frame.x + frame.width),
      rayEdgeStartY: target.y,
      rayEdgeEndX: clampCameraOrbitNumber(target.x + halfFootprint, frame.x, frame.x + frame.width),
      rayEdgeEndY: target.y,
    }
  }
  return {
    rayEdgeStartX: target.x,
    rayEdgeStartY: clampCameraOrbitNumber(target.y - halfFootprint, frame.y, frame.y + frame.height),
    rayEdgeEndX: target.x,
    rayEdgeEndY: clampCameraOrbitNumber(target.y + halfFootprint, frame.y, frame.y + frame.height),
  }
}

export const resolveCameraOrbitFrameRay = (
  cameraPoint: CameraOrbitSpherePoint,
  frame: CameraOrbitSphereFrameRect,
  options: CameraOrbitFrameRayOptions = {},
) => {
  const center = resolveCameraOrbitFrameCenter(frame)
  const target = resolveCameraOrbitFrameRayTarget(cameraPoint, frame, options.projection)

  return {
    rayTargetX: target.x,
    rayTargetY: target.y,
    rayLookTargetX: center.x,
    rayLookTargetY: center.y,
    ...resolveCameraOrbitFrameRayFootprint(cameraPoint, frame, target.edge, target, options.footprint),
  }
}

export const resolveCameraOrbitSmoothPath = (points: readonly CameraOrbitSpherePathPoint[]) => {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(3)},${points[0].y.toFixed(3)}`
  const segments = [`M ${points[0].x.toFixed(3)},${points[0].y.toFixed(3)}`]
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index]
    const current = points[index]
    const next = points[index + 1]
    const afterNext = points[index + 2] || next
    const controlStart = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    }
    const controlEnd = {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6,
    }
    segments.push([
      'C',
      controlStart.x.toFixed(3),
      controlStart.y.toFixed(3),
      controlEnd.x.toFixed(3),
      controlEnd.y.toFixed(3),
      next.x.toFixed(3),
      next.y.toFixed(3),
    ].join(' '))
  }
  return segments.join(' ')
}

export const resolveCameraOrbitSphereGridPoints = <TLongitude extends number, TLatitude extends number>(
  config: CameraOrbitSphereConfig<TLongitude, TLatitude>,
) => config.latitudeDegrees.flatMap(latitude => config.longitudeDegrees.map(longitude => ({ longitude, latitude })))

export const resolveCameraOrbitSphereLatitudeRow = <TLongitude extends number, TLatitude extends number>(
  config: CameraOrbitSphereConfig<TLongitude, TLatitude>,
  latitude: number,
) => config.latitudeRows.find(row => row.degree === latitude) || config.latitudeRows[Math.max(0, Math.floor(config.latitudeRows.length / 2))]

export const resolveCameraOrbitSphereGridHighlight = <TLongitude extends number, TLatitude extends number>(
  config: CameraOrbitSphereConfig<TLongitude, TLatitude>,
  orbitX: number,
  orbitY: number,
): CameraOrbitSphereGridPoint<TLongitude, TLatitude> => {
  const latitude = findNearestCameraOrbitDegree(Math.max(-90, Math.min(90, -orbitY * 90)), config.latitudeDegrees)
  if (Math.abs(orbitX) < 0.001 && Math.abs(orbitY) < 0.001) {
    return {
      latitude,
      longitude: config.longitudeDegrees[0],
    }
  }
  const longitude = findNearestCameraOrbitDegree(normalizeCameraOrbitDegrees(orbitX * config.longitudeSpanDegrees), config.longitudeDegrees, true)
  return { latitude, longitude }
}

export const resolveCameraOrbitSphereOrbitFromGridPoint = <TLongitude extends number, TLatitude extends number>(
  config: CameraOrbitSphereConfig<TLongitude, TLatitude>,
  gridPoint: CameraOrbitSphereGridPoint<TLongitude, TLatitude>,
) => {
  const normalizedLongitude = normalizeCameraOrbitDegrees(gridPoint.longitude)
  const signedLongitude = normalizedLongitude > 180 ? normalizedLongitude - 360 : normalizedLongitude
  return {
    orbitX: Math.max(-1, Math.min(1, signedLongitude / config.longitudeSpanDegrees)),
    orbitY: Math.max(-1, Math.min(1, -gridPoint.latitude / 90)),
  }
}

export const resolveCameraOrbitSphereVectorFromGridPoint = <TLongitude extends number, TLatitude extends number>(
  gridPoint: CameraOrbitSphereGridPoint<TLongitude, TLatitude>,
): CameraOrbitSphereVector => {
  const latitudeRadians = gridPoint.latitude * Math.PI / 180
  const longitudeRadians = normalizeCameraOrbitDegrees(gridPoint.longitude) * Math.PI / 180
  const latitudeCosine = Math.cos(latitudeRadians)
  return {
    orbitVectorX: latitudeCosine * Math.sin(longitudeRadians),
    orbitVectorY: Math.sin(latitudeRadians),
    orbitVectorZ: latitudeCosine * Math.cos(longitudeRadians),
  }
}

export const resolveCameraOrbitSpherePointFromGridPoint = <TLongitude extends number, TLatitude extends number>(
  config: CameraOrbitSphereConfig<TLongitude, TLatitude>,
  gridPoint: CameraOrbitSphereGridPoint<TLongitude, TLatitude>,
): CameraOrbitSpherePoint => {
  const latitudeGeometry = resolveCameraOrbitSphereLatitudeRow(config, gridPoint.latitude)
  const normalizedLongitude = normalizeCameraOrbitDegrees(gridPoint.longitude)
  const longitudeRadians = normalizedLongitude * Math.PI / 180
  const vector = resolveCameraOrbitSphereVectorFromGridPoint(gridPoint)
  return {
    ...vector,
    cameraX: config.centerX + latitudeGeometry.rx * Math.sin(longitudeRadians),
    cameraY: latitudeGeometry.cy + latitudeGeometry.ry * Math.cos(longitudeRadians),
  }
}

export const resolveCameraOrbitSphereGridMeridianGeometry = <TLongitude extends number, TLatitude extends number>(
  config: CameraOrbitSphereConfig<TLongitude, TLatitude>,
  longitude: number,
): CameraOrbitSphereMeridianGeometry => {
  const normalizedLongitude = normalizeCameraOrbitDegrees(longitude)
  const longitudeSine = Math.sin(normalizedLongitude * Math.PI / 180)
  if (Math.abs(longitudeSine) < 0.001) {
    return {
      kind: 'line',
      x: config.centerX,
      longitude: normalizedLongitude,
    }
  }
  const meridianPoints = [
    { x: config.centerX, y: config.centerY - config.radius },
    ...[...config.latitudeRows]
      .sort((left, right) => left.cy - right.cy)
      .map(row => {
        const point = resolveCameraOrbitSpherePointFromGridPoint(config, { longitude: normalizedLongitude as TLongitude, latitude: row.degree })
        return { x: point.cameraX, y: point.cameraY }
      }),
    { x: config.centerX, y: config.centerY + config.radius },
  ]
  return {
    kind: 'curve',
    pathD: resolveCameraOrbitSmoothPath(meridianPoints),
    sweepFlag: normalizedLongitude > 180 ? 0 : 1,
    longitude: normalizedLongitude,
  }
}

export const resolveCameraOrbitSpherePose = <TLongitude extends number, TLatitude extends number>(
  config: CameraOrbitSphereConfig<TLongitude, TLatitude>,
  orbitX: number,
  orbitY: number,
  frame: CameraOrbitSphereFrameRect,
  options: CameraOrbitSpherePoseOptions = {},
): CameraOrbitSpherePose => {
  const gridPoint = resolveCameraOrbitSphereGridHighlight(config, orbitX, orbitY)
  const cameraPoint = resolveCameraOrbitFrameAwarePoint(resolveCameraOrbitSpherePointFromGridPoint(config, gridPoint), frame, options.frameAware)
  const ray = resolveCameraOrbitFrameRay(cameraPoint, frame, options.ray)
  return {
    ...cameraPoint,
    rotation: Math.atan2(ray.rayLookTargetY - cameraPoint.cameraY, ray.rayLookTargetX - cameraPoint.cameraX) * 180 / Math.PI,
    ...ray,
  }
}

export const resolveCameraOrbitSphereGridPointFromRenderedPoint = <TLongitude extends number, TLatitude extends number>(
  config: CameraOrbitSphereConfig<TLongitude, TLatitude>,
  point: { x: number; y: number },
  frame: CameraOrbitSphereFrameRect,
  frameAwareOptions: CameraOrbitFrameAwareOptions = {},
): CameraOrbitSphereGridPoint<TLongitude, TLatitude> => {
  const gridPoints = resolveCameraOrbitSphereGridPoints(config)
  return gridPoints.reduce((nearest, gridPoint) => {
    const cameraPoint = resolveCameraOrbitFrameAwarePoint(resolveCameraOrbitSpherePointFromGridPoint(config, gridPoint), frame, frameAwareOptions)
    const distance = Math.hypot(point.x - cameraPoint.cameraX, point.y - cameraPoint.cameraY)
    return distance < nearest.distance ? { gridPoint, distance } : nearest
  }, { gridPoint: gridPoints[0], distance: Number.POSITIVE_INFINITY }).gridPoint
}

export const resolveCameraOrbitPreviewSvgPoint = (
  preview: HTMLElement,
  clientX: number,
  clientY: number,
  viewBox: { width: number; height: number },
) => {
  const rect = preview.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) / Math.max(1, rect.width)) * viewBox.width,
    y: ((clientY - rect.top) / Math.max(1, rect.height)) * viewBox.height,
  }
}

export const isPointOnCameraOrbitHandle = (
  point: { x: number; y: number },
  pose: Pick<CameraOrbitSpherePose, 'cameraX' | 'cameraY' | 'rotation'>,
  rects: readonly CameraOrbitHandleRect[],
  padding = 0,
) => {
  const radians = (-pose.rotation * Math.PI) / 180
  const translatedX = point.x - pose.cameraX
  const translatedY = point.y - pose.cameraY
  const localPoint = {
    x: translatedX * Math.cos(radians) - translatedY * Math.sin(radians),
    y: translatedX * Math.sin(radians) + translatedY * Math.cos(radians),
  }
  return rects.some(rect => isPointWithinCameraOrbitRect(localPoint, rect, padding))
}
