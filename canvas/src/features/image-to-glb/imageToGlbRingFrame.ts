import * as THREE from 'three'
import type { ImageToGlbPartManifestEntry } from './imageToGlbContract'
import type { ImageToGlbReferenceAnalysis, ImageToGlbSilhouetteSpan } from './imageToGlbSceneFactory'

export type RingFrameConstructionPlan = {
  apertureRadius: number
  innerLipMajorRadius: number
  innerLipTubeRadius: number
  innerLipY: number
  outerDiameter: number
  outerRadius: number
  ribCount: number
  ribEndRadius: number
  ribRadius: number
  ribStartRadius: number
  ribY: number
  shellThickness: number
  shellY: number
  supportBottomRadius: number
  supportBottomY: number
  supportCount: number
  supportRadius: number
  supportTopRadius: number
  supportTopY: number
  totalHeight: number
  trayDepthScale: number
  trayHeight: number
  trayRadius: number
  trayY: number
}

type RgbColor = { b: number; g: number; r: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const rounded = (value: number) => Number(value.toFixed(5))

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] || 0) + (sorted[middle] || 0)) / 2
    : sorted[middle] || 0
}

function spansByBand(spans: readonly ImageToGlbSilhouetteSpan[]): ImageToGlbSilhouetteSpan[][] {
  const bands = new Map<string, ImageToGlbSilhouetteSpan[]>()
  for (const span of spans) {
    const key = span.y.toFixed(4)
    const band = bands.get(key)
    if (band) band.push(span)
    else bands.set(key, [span])
  }
  return [...bands.values()]
}

function centralGapRatio(spans: readonly ImageToGlbSilhouetteSpan[]): number {
  const gaps = spansByBand(spans)
    .filter(band => {
      const y = band[0]?.y || 0
      return y >= 0.04 && y <= 0.42 && band.length >= 2
    })
    .map(band => {
      const negative = band
        .filter(span => span.x < 0)
        .map(span => span.x + span.width / 2)
        .sort((first, second) => second - first)[0]
      const positive = band
        .filter(span => span.x > 0)
        .map(span => span.x - span.width / 2)
        .sort((first, second) => first - second)[0]
      return Number.isFinite(negative) && Number.isFinite(positive) ? Number(positive) - Number(negative) : 0
    })
    .filter(gap => gap > 0.08 && gap < 0.7)
  return clamp(median(gaps) || 0.38, 0.32, 0.46)
}

function upperShellHeightRatio(spans: readonly ImageToGlbSilhouetteSpan[]): number {
  const upper = spans.filter(span => span.y >= 0.18)
  if (upper.length === 0) return 0.17
  const top = Math.max(...upper.map(span => span.y + span.height / 2))
  const bottom = Math.min(...upper.map(span => span.y - span.height / 2))
  return clamp(top - bottom, 0.14, 0.22)
}

export function deriveRingFrameConstructionPlan(analysis: ImageToGlbReferenceAnalysis): RingFrameConstructionPlan {
  const outerDiameter = 2.8
  const outerRadius = outerDiameter / 2
  const totalHeight = outerDiameter / clamp(analysis.aspectRatio, 1.38, 1.72)
  const shellThickness = totalHeight * upperShellHeightRatio(analysis.spans)
  const shellY = totalHeight / 2 - shellThickness / 2
  const apertureRadius = outerDiameter * centralGapRatio(analysis.spans) / 2
  const trayDiameterRatio = clamp(analysis.bottomWidthRatio * 0.96, 0.4, 0.56)
  const trayRadius = outerDiameter * trayDiameterRatio / 2
  const trayHeight = totalHeight * 0.13
  const trayY = -totalHeight / 2 + trayHeight / 2
  const innerLipTubeRadius = outerDiameter * 0.018
  return {
    apertureRadius: rounded(apertureRadius),
    innerLipMajorRadius: rounded(apertureRadius + innerLipTubeRadius),
    innerLipTubeRadius: rounded(innerLipTubeRadius),
    innerLipY: rounded(shellY - shellThickness * 0.22),
    outerDiameter,
    outerRadius,
    ribCount: 8,
    ribEndRadius: rounded(outerRadius - outerDiameter * 0.055),
    ribRadius: rounded(outerDiameter * 0.015),
    ribStartRadius: rounded(apertureRadius + outerDiameter * 0.025),
    ribY: rounded(shellY + shellThickness * 0.24),
    shellThickness: rounded(shellThickness),
    shellY: rounded(shellY),
    supportBottomRadius: rounded(trayRadius * 0.91),
    supportBottomY: rounded(trayY + trayHeight * 0.42),
    supportCount: 4,
    supportRadius: rounded(outerDiameter * 0.027),
    supportTopRadius: rounded(outerRadius * 0.7),
    supportTopY: rounded(shellY - shellThickness * 0.46),
    totalHeight: rounded(totalHeight),
    trayDepthScale: 0.78,
    trayHeight: rounded(trayHeight),
    trayRadius: rounded(trayRadius),
    trayY: rounded(trayY),
  }
}

function colorNumber(color: RgbColor): number {
  return (clamp(Math.round(color.r), 0, 255) << 16)
    | (clamp(Math.round(color.g), 0, 255) << 8)
    | clamp(Math.round(color.b), 0, 255)
}

function createMaterial(color: RgbColor, name: string): THREE.MeshPhysicalMaterial {
  const result = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.28,
    clearcoatRoughness: 0.36,
    color: colorNumber(color),
    metalness: 0.08,
    roughness: 0.38,
  })
  result.name = name
  return result
}

function addNamedMesh(group: THREE.Group, mesh: THREE.Mesh, name: string): void {
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function shellProfile(plan: RingFrameConstructionPlan): THREE.Vector2[] {
  const bevel = plan.outerDiameter * 0.035
  const half = plan.shellThickness / 2
  return [
    new THREE.Vector2(plan.apertureRadius, -half * 0.62),
    new THREE.Vector2(plan.apertureRadius + bevel * 0.45, half * 0.18),
    new THREE.Vector2(plan.apertureRadius + bevel, half * 0.74),
    new THREE.Vector2(plan.outerRadius - bevel, half),
    new THREE.Vector2(plan.outerRadius, half * 0.34),
    new THREE.Vector2(plan.outerRadius - bevel * 0.25, -half * 0.42),
    new THREE.Vector2(plan.outerRadius - bevel, -half),
    new THREE.Vector2(plan.apertureRadius + bevel, -half),
    new THREE.Vector2(plan.apertureRadius, -half * 0.62),
  ]
}

function trayProfile(plan: RingFrameConstructionPlan): THREE.Vector2[] {
  const half = plan.trayHeight / 2
  return [
    new THREE.Vector2(0, -half * 0.46),
    new THREE.Vector2(plan.trayRadius * 0.68, -half * 0.58),
    new THREE.Vector2(plan.trayRadius * 0.94, -half * 0.18),
    new THREE.Vector2(plan.trayRadius, half * 0.28),
    new THREE.Vector2(plan.trayRadius * 0.92, half * 0.56),
    new THREE.Vector2(plan.trayRadius * 0.18, half * 0.18),
    new THREE.Vector2(0, -half * 0.46),
  ]
}

function addPart(partManifest: ImageToGlbPartManifestEntry[], name: string, primitive: string, role: string): void {
  partManifest.push({ name, primitive, role })
}

export function buildRingFrameScene(args: {
  accent: RgbColor
  color: RgbColor
  partManifest: ImageToGlbPartManifestEntry[]
  plan: RingFrameConstructionPlan
}): THREE.Group {
  const { partManifest, plan } = args
  const primary = createMaterial(args.color, 'Reference primary material')
  const secondary = createMaterial(args.accent, 'Reference accent material')
  const group = new THREE.Group()
  const shell = new THREE.Mesh(new THREE.LatheGeometry(shellProfile(plan), 72), primary)
  shell.position.y = plan.shellY
  addNamedMesh(group, shell, 'Upper annular shell')
  addPart(partManifest, shell.name, 'LatheGeometry', 'flattened upper shell and central aperture')

  const innerLip = new THREE.Mesh(
    new THREE.TorusGeometry(plan.innerLipMajorRadius, plan.innerLipTubeRadius, 14, 64),
    secondary,
  )
  innerLip.rotation.x = Math.PI / 2
  innerLip.position.y = plan.innerLipY
  addNamedMesh(group, innerLip, 'Central recessed rim')
  addPart(partManifest, innerLip.name, 'TorusGeometry', 'recessed inner aperture boundary')

  for (let index = 0; index < plan.ribCount; index += 1) {
    const angle = (index / plan.ribCount) * Math.PI * 2
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const curve = new THREE.CatmullRomCurve3([
      direction.clone().multiplyScalar(plan.ribStartRadius).setY(plan.ribY - plan.ribRadius * 0.25),
      direction.clone().multiplyScalar((plan.ribStartRadius + plan.ribEndRadius) / 2).setY(plan.ribY + plan.ribRadius * 0.5),
      direction.clone().multiplyScalar(plan.ribEndRadius).setY(plan.ribY - plan.ribRadius * 0.15),
    ])
    const name = `Radial upper rib ${index + 1}`
    addNamedMesh(group, new THREE.Mesh(new THREE.TubeGeometry(curve, 20, plan.ribRadius, 10, false), primary), name)
    addPart(partManifest, name, 'TubeGeometry', 'aperture-safe upper shell segmentation')
  }

  for (let index = 0; index < plan.supportCount; index += 1) {
    const angle = Math.PI / 4 + (index / plan.supportCount) * Math.PI * 2
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle))
    const curve = new THREE.CatmullRomCurve3([
      direction.clone().multiplyScalar(plan.supportTopRadius).setY(plan.supportTopY),
      direction.clone().multiplyScalar(plan.supportTopRadius * 1.06).addScaledVector(tangent, plan.outerDiameter * 0.018).setY(plan.supportTopY - plan.totalHeight * 0.25),
      direction.clone().multiplyScalar(plan.supportBottomRadius * 1.08).setY(plan.supportBottomY + plan.totalHeight * 0.2),
      direction.clone().multiplyScalar(plan.supportBottomRadius).setY(plan.supportBottomY),
    ])
    const name = `Curved support ${index + 1}`
    addNamedMesh(group, new THREE.Mesh(new THREE.TubeGeometry(curve, 44, plan.supportRadius, 12, false), primary), name)
    addPart(partManifest, name, 'TubeGeometry', 'four-way upper-to-tray load path')
  }

  const tray = new THREE.Mesh(new THREE.LatheGeometry(trayProfile(plan), 64), secondary)
  tray.position.y = plan.trayY
  tray.scale.z = plan.trayDepthScale
  addNamedMesh(group, tray, 'Lower tray')
  addPart(partManifest, tray.name, 'LatheGeometry', 'rounded lower platform')

  const lowerRim = new THREE.Mesh(
    new THREE.TorusGeometry(plan.trayRadius - plan.supportRadius, plan.supportRadius * 0.72, 12, 56),
    primary,
  )
  lowerRim.rotation.x = Math.PI / 2
  lowerRim.scale.y = plan.trayDepthScale
  lowerRim.position.y = plan.trayY + plan.trayHeight * 0.38
  addNamedMesh(group, lowerRim, 'Lower tray rim')
  addPart(partManifest, lowerRim.name, 'TorusGeometry', 'lower silhouette boundary')
  group.userData.ringFrameConstructionPlan = plan
  return group
}

function colorHex(color: RgbColor): string {
  return `0x${colorNumber(color).toString(16).padStart(6, '0')}`
}

export function createRingFrameProgram(args: {
  accent: RgbColor
  color: RgbColor
  plan: RingFrameConstructionPlan
}): string {
  return `import * as THREE from 'three'

export function buildImageToGlbReviewedScene() {
  const plan = ${JSON.stringify(args.plan, null, 2)} as const
  const group = new THREE.Group()
  const primary = new THREE.MeshPhysicalMaterial({ color: ${colorHex(args.color)}, roughness: 0.38, metalness: 0.08, clearcoat: 0.28, clearcoatRoughness: 0.36 })
  const secondary = new THREE.MeshPhysicalMaterial({ color: ${colorHex(args.accent)}, roughness: 0.38, metalness: 0.08, clearcoat: 0.28, clearcoatRoughness: 0.36 })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; group.add(mesh); return mesh
  }
  const bevel = plan.outerDiameter * 0.035, shellHalf = plan.shellThickness / 2
  const shellProfile = [
    new THREE.Vector2(plan.apertureRadius, -shellHalf * 0.62), new THREE.Vector2(plan.apertureRadius + bevel * 0.45, shellHalf * 0.18),
    new THREE.Vector2(plan.apertureRadius + bevel, shellHalf * 0.74), new THREE.Vector2(plan.outerRadius - bevel, shellHalf),
    new THREE.Vector2(plan.outerRadius, shellHalf * 0.34), new THREE.Vector2(plan.outerRadius - bevel * 0.25, -shellHalf * 0.42),
    new THREE.Vector2(plan.outerRadius - bevel, -shellHalf), new THREE.Vector2(plan.apertureRadius + bevel, -shellHalf),
    new THREE.Vector2(plan.apertureRadius, -shellHalf * 0.62),
  ]
  const shell = add('Upper annular shell', new THREE.LatheGeometry(shellProfile, 72), primary); shell.position.y = plan.shellY
  const innerLip = add('Central recessed rim', new THREE.TorusGeometry(plan.innerLipMajorRadius, plan.innerLipTubeRadius, 14, 64), secondary)
  innerLip.rotation.x = Math.PI / 2; innerLip.position.y = plan.innerLipY
  for (let index = 0; index < plan.ribCount; index += 1) {
    const angle = index / plan.ribCount * Math.PI * 2, direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const curve = new THREE.CatmullRomCurve3([
      direction.clone().multiplyScalar(plan.ribStartRadius).setY(plan.ribY - plan.ribRadius * 0.25),
      direction.clone().multiplyScalar((plan.ribStartRadius + plan.ribEndRadius) / 2).setY(plan.ribY + plan.ribRadius * 0.5),
      direction.clone().multiplyScalar(plan.ribEndRadius).setY(plan.ribY - plan.ribRadius * 0.15),
    ])
    add(\`Radial upper rib \${index + 1}\`, new THREE.TubeGeometry(curve, 20, plan.ribRadius, 10, false), primary)
  }
  for (let index = 0; index < plan.supportCount; index += 1) {
    const angle = Math.PI / 4 + index / plan.supportCount * Math.PI * 2
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)), tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle))
    const curve = new THREE.CatmullRomCurve3([
      direction.clone().multiplyScalar(plan.supportTopRadius).setY(plan.supportTopY),
      direction.clone().multiplyScalar(plan.supportTopRadius * 1.06).addScaledVector(tangent, plan.outerDiameter * 0.018).setY(plan.supportTopY - plan.totalHeight * 0.25),
      direction.clone().multiplyScalar(plan.supportBottomRadius * 1.08).setY(plan.supportBottomY + plan.totalHeight * 0.2),
      direction.clone().multiplyScalar(plan.supportBottomRadius).setY(plan.supportBottomY),
    ])
    add(\`Curved support \${index + 1}\`, new THREE.TubeGeometry(curve, 44, plan.supportRadius, 12, false), primary)
  }
  const trayHalf = plan.trayHeight / 2
  const trayProfile = [
    new THREE.Vector2(0, -trayHalf * 0.46), new THREE.Vector2(plan.trayRadius * 0.68, -trayHalf * 0.58),
    new THREE.Vector2(plan.trayRadius * 0.94, -trayHalf * 0.18), new THREE.Vector2(plan.trayRadius, trayHalf * 0.28),
    new THREE.Vector2(plan.trayRadius * 0.92, trayHalf * 0.56), new THREE.Vector2(plan.trayRadius * 0.18, trayHalf * 0.18),
    new THREE.Vector2(0, -trayHalf * 0.46),
  ]
  const tray = add('Lower tray', new THREE.LatheGeometry(trayProfile, 64), secondary); tray.position.y = plan.trayY; tray.scale.z = plan.trayDepthScale
  const lowerRim = add('Lower tray rim', new THREE.TorusGeometry(plan.trayRadius - plan.supportRadius, plan.supportRadius * 0.72, 12, 56), primary)
  lowerRim.rotation.x = Math.PI / 2; lowerRim.scale.y = plan.trayDepthScale; lowerRim.position.y = plan.trayY + plan.trayHeight * 0.38
  return group
}`
}
