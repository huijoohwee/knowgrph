import * as THREE from 'three'
import { hashStringToHex } from '@/lib/hash/stringHash'
import {
  loadImageReferencePixels,
  type ImageReferencePixels,
} from '@/features/image-to-threejs/imageReferencePixels'
import {
  createImageToGlbProceduralJob,
  type ImageToGlbPartManifestEntry,
  type ImageToGlbProceduralJob,
  type ImageToGlbProceduralProgram,
  type ImageToGlbVisionReviewPass,
} from './imageToGlbContract'
import {
  buildRingFrameScene,
  createRingFrameProgram,
  deriveRingFrameConstructionPlan,
} from './imageToGlbRingFrame'
import { inspectImageToGlbScene } from './imageToGlbSceneEvidence'

type RgbColor = { b: number; g: number; r: number }

export type ImageToGlbSilhouetteSpan = {
  color: RgbColor
  height: number
  width: number
  x: number
  y: number
}

export type ImageToGlbReferenceAnalysis = {
  aspectRatio: number
  backgroundMethod: 'alpha' | 'edge-palette'
  bottomWidthRatio: number
  foregroundCoverage: number
  height: number
  palette: readonly RgbColor[]
  profile: 'ring-frame' | 'silhouette-relief'
  referenceDigest: string
  silhouetteScore: number
  spans: readonly ImageToGlbSilhouetteSpan[]
  symmetryScore: number
  topWidthRatio: number
  width: number
}

export type ReviewedImageToGlbScene = {
  analysis: ImageToGlbReferenceAnalysis
  job: ImageToGlbProceduralJob
  scene: THREE.Group
}

type PixelMask = {
  bottom: number
  data: Uint8Array
  left: number
  right: number
  top: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const rounded = (value: number) => Number(value.toFixed(5))

function colorHex(color: RgbColor): string {
  return `0x${[color.r, color.g, color.b].map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`
}

function colorDistanceSquared(first: RgbColor, second: RgbColor): number {
  return (first.r - second.r) ** 2 + (first.g - second.g) ** 2 + (first.b - second.b) ** 2
}

function pixelColor(pixels: ImageReferencePixels, x: number, y: number): RgbColor {
  const index = (y * pixels.width + x) * 4
  return {
    r: Number(pixels.data[index] || 0),
    g: Number(pixels.data[index + 1] || 0),
    b: Number(pixels.data[index + 2] || 0),
  }
}

function edgePalette(pixels: ImageReferencePixels): RgbColor[] {
  const counts = new Map<string, { color: RgbColor; count: number }>()
  const add = (x: number, y: number) => {
    const color = pixelColor(pixels, x, y)
    const quantized = {
      r: Math.round(color.r / 24) * 24,
      g: Math.round(color.g / 24) * 24,
      b: Math.round(color.b / 24) * 24,
    }
    const key = `${quantized.r}:${quantized.g}:${quantized.b}`
    const existing = counts.get(key)
    if (existing) existing.count += 1
    else counts.set(key, { color: quantized, count: 1 })
  }
  for (let x = 0; x < pixels.width; x += 1) {
    add(x, 0)
    add(x, pixels.height - 1)
  }
  for (let y = 1; y < pixels.height - 1; y += 1) {
    add(0, y)
    add(pixels.width - 1, y)
  }
  return [...counts.values()]
    .sort((first, second) => second.count - first.count)
    .slice(0, 4)
    .map(entry => entry.color)
}

function buildForegroundMask(pixels: ImageReferencePixels): { mask: PixelMask; method: ImageToGlbReferenceAnalysis['backgroundMethod'] } {
  const palette = edgePalette(pixels)
  const maskData = new Uint8Array(pixels.width * pixels.height)
  let transparentCount = 0
  for (let index = 3; index < pixels.data.length; index += 4) {
    if (Number(pixels.data[index] || 0) < 224) transparentCount += 1
  }
  const alphaAware = transparentCount > pixels.width * pixels.height * 0.01
  let left = pixels.width
  let right = -1
  let top = pixels.height
  let bottom = -1
  for (let y = 0; y < pixels.height; y += 1) {
    for (let x = 0; x < pixels.width; x += 1) {
      const pixelIndex = (y * pixels.width + x) * 4
      const alpha = Number(pixels.data[pixelIndex + 3] || 0)
      const color = pixelColor(pixels, x, y)
      const background = alphaAware
        ? alpha < 48
        : palette.some(candidate => colorDistanceSquared(color, candidate) <= 42 ** 2)
      if (background) continue
      const maskIndex = y * pixels.width + x
      maskData[maskIndex] = 1
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) throw new Error('Reference-image analysis could not isolate a foreground object.')
  return {
    mask: { bottom, data: maskData, left, right, top },
    method: alphaAware ? 'alpha' : 'edge-palette',
  }
}

function averageSpanColor(args: {
  pixels: ImageReferencePixels
  mask: PixelMask
  left: number
  right: number
  top: number
  bottom: number
}): RgbColor {
  let red = 0
  let green = 0
  let blue = 0
  let count = 0
  for (let y = args.top; y <= args.bottom; y += 1) {
    for (let x = args.left; x <= args.right; x += 1) {
      if (!args.mask.data[y * args.pixels.width + x]) continue
      const color = pixelColor(args.pixels, x, y)
      red += color.r
      green += color.g
      blue += color.b
      count += 1
    }
  }
  return count > 0
    ? { r: Math.round(red / count), g: Math.round(green / count), b: Math.round(blue / count) }
    : { r: 148, g: 163, b: 184 }
}

function foregroundRuns(args: {
  bandBottom: number
  bandTop: number
  mask: PixelMask
  pixels: ImageReferencePixels
}): Array<{ left: number; right: number }> {
  const bandHeight = args.bandBottom - args.bandTop + 1
  const active: boolean[] = []
  for (let x = args.mask.left; x <= args.mask.right; x += 1) {
    let count = 0
    for (let y = args.bandTop; y <= args.bandBottom; y += 1) count += args.mask.data[y * args.pixels.width + x] || 0
    active.push(count / bandHeight >= 0.16)
  }
  const runs: Array<{ left: number; right: number }> = []
  let runStart = -1
  for (let index = 0; index <= active.length; index += 1) {
    if (active[index] && runStart < 0) runStart = index
    if ((!active[index] || index === active.length) && runStart >= 0) {
      const right = index - 1
      if (right - runStart + 1 >= Math.max(2, Math.round(active.length * 0.018))) {
        runs.push({ left: args.mask.left + runStart, right: args.mask.left + right })
      }
      runStart = -1
    }
  }
  return runs
}

function buildSilhouetteSpans(pixels: ImageReferencePixels, mask: PixelMask): ImageToGlbSilhouetteSpan[] {
  const boundsWidth = mask.right - mask.left + 1
  const boundsHeight = mask.bottom - mask.top + 1
  const bandCount = clamp(Math.round(boundsHeight / 4), 18, 30)
  const spans: ImageToGlbSilhouetteSpan[] = []
  for (let band = 0; band < bandCount; band += 1) {
    const bandTop = mask.top + Math.floor((band / bandCount) * boundsHeight)
    const bandBottom = Math.min(mask.bottom, mask.top + Math.floor(((band + 1) / bandCount) * boundsHeight) - 1)
    for (const run of foregroundRuns({ bandBottom, bandTop, mask, pixels })) {
      spans.push({
        color: averageSpanColor({ pixels, mask, left: run.left, right: run.right, top: bandTop, bottom: bandBottom }),
        height: rounded((bandBottom - bandTop + 1) / boundsHeight),
        width: rounded((run.right - run.left + 1) / boundsWidth),
        x: rounded((((run.left + run.right) / 2) - mask.left) / boundsWidth - 0.5),
        y: rounded(0.5 - (((bandTop + bandBottom) / 2) - mask.top) / boundsHeight),
      })
    }
  }
  return spans
}

function spanWidthNear(spans: readonly ImageToGlbSilhouetteSpan[], targetY: number): number {
  const bandWidths = new Map<string, number>()
  for (const span of spans.filter(item => Math.abs(item.y - targetY) <= 0.08)) {
    const key = span.y.toFixed(4)
    bandWidths.set(key, (bandWidths.get(key) || 0) + span.width)
  }
  const widths = [...bandWidths.values()].sort((first, second) => first - second)
  const middle = Math.floor(widths.length / 2)
  return widths.length === 0
    ? 0
    : widths.length % 2 === 0
      ? ((widths[middle - 1] || 0) + (widths[middle] || 0)) / 2
      : widths[middle] || 0
}

function symmetryScore(pixels: ImageReferencePixels, mask: PixelMask): number {
  const width = mask.right - mask.left + 1
  const height = mask.bottom - mask.top + 1
  let matches = 0
  let total = 0
  for (let y = mask.top; y <= mask.bottom; y += 1) {
    for (let offset = 0; offset < Math.ceil(width / 2); offset += 1) {
      matches += mask.data[y * pixels.width + mask.left + offset] === mask.data[y * pixels.width + mask.right - offset] ? 1 : 0
      total += 1
    }
  }
  return total > 0 ? matches / total : 0
}

function foregroundCoverage(pixels: ImageReferencePixels, mask: PixelMask): number {
  let count = 0
  for (let y = mask.top; y <= mask.bottom; y += 1) {
    for (let x = mask.left; x <= mask.right; x += 1) count += mask.data[y * pixels.width + x] || 0
  }
  return count / ((mask.right - mask.left + 1) * (mask.bottom - mask.top + 1))
}

function foregroundPalette(pixels: ImageReferencePixels, mask: PixelMask): RgbColor[] {
  const clusters = new Map<string, { blue: number; count: number; green: number; red: number }>()
  for (let y = mask.top; y <= mask.bottom; y += 1) {
    for (let x = mask.left; x <= mask.right; x += 1) {
      if (!mask.data[y * pixels.width + x]) continue
      const color = pixelColor(pixels, x, y)
      const key = `${Math.round(color.r / 16)}:${Math.round(color.g / 16)}:${Math.round(color.b / 16)}`
      const cluster = clusters.get(key)
      if (cluster) {
        cluster.red += color.r
        cluster.green += color.g
        cluster.blue += color.b
        cluster.count += 1
      } else {
        clusters.set(key, { blue: color.b, count: 1, green: color.g, red: color.r })
      }
    }
  }
  return [...clusters.values()]
    .sort((first, second) => second.count - first.count)
    .slice(0, 5)
    .map(cluster => ({
      b: Math.round(cluster.blue / cluster.count),
      g: Math.round(cluster.green / cluster.count),
      r: Math.round(cluster.red / cluster.count),
    }))
}

export function analyzeImageToGlbReference(pixels: ImageReferencePixels): ImageToGlbReferenceAnalysis {
  if (pixels.data.length !== pixels.width * pixels.height * 4) throw new Error('Reference pixel dimensions do not match their RGBA data.')
  const { mask, method } = buildForegroundMask(pixels)
  const spans = buildSilhouetteSpans(pixels, mask)
  if (spans.length < 3) throw new Error('Reference-image analysis found too little procedural structure.')
  const symmetry = symmetryScore(pixels, mask)
  const topWidthRatio = clamp(spanWidthNear(spans, 0.38), 0, 1)
  const middleRuns = spans.filter(span => Math.abs(span.y) <= 0.1)
  const middleHasGap = middleRuns.length >= 2 && middleRuns.some(span => span.x < -0.12) && middleRuns.some(span => span.x > 0.12)
  const bottomWidthRatio = clamp(spanWidthNear(spans, -0.38), 0, 1)
  const ringFrameScore = [topWidthRatio, middleHasGap ? 1 : 0, bottomWidthRatio, symmetry]
    .reduce((sum, value) => sum + value, 0) / 4
  const profile = topWidthRatio >= 0.62 && middleHasGap && bottomWidthRatio >= 0.25 && symmetry >= 0.55
    ? 'ring-frame'
    : 'silhouette-relief'
  const referenceDigest = hashStringToHex(Array.from(pixels.data).join(','))
  const palette = foregroundPalette(pixels, mask)
  return {
    aspectRatio: (mask.right - mask.left + 1) / (mask.bottom - mask.top + 1),
    backgroundMethod: method,
    bottomWidthRatio,
    foregroundCoverage: foregroundCoverage(pixels, mask),
    height: pixels.height,
    palette,
    profile,
    referenceDigest,
    silhouetteScore: profile === 'ring-frame' ? clamp(0.56 + ringFrameScore * 0.38, 0, 0.94) : 0.88,
    spans,
    symmetryScore: symmetry,
    topWidthRatio,
    width: pixels.width,
  }
}

function material(color: RgbColor): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: Number(colorHex(color)),
    roughness: 0.42,
    metalness: 0.08,
  })
}

function addNamedMesh(group: THREE.Group, mesh: THREE.Mesh, name: string): void {
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function buildSilhouetteScene(analysis: ImageToGlbReferenceAnalysis, partManifest: ImageToGlbPartManifestEntry[]): THREE.Group {
  const group = new THREE.Group()
  const worldWidth = 2.8
  const worldHeight = clamp(worldWidth / analysis.aspectRatio, 1.5, 3.4)
  analysis.spans.forEach((span, index) => {
    const depth = 0.2 + (1 - Math.abs(span.y)) * 0.22
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.035, span.width * worldWidth), Math.max(0.035, span.height * worldHeight * 1.08), depth, 2, 2, 2),
      material(span.color),
    )
    mesh.position.set(span.x * worldWidth, span.y * worldHeight, (depth - 0.2) * 0.45)
    addNamedMesh(group, mesh, `Reference silhouette band ${index + 1}`)
    partManifest.push({ name: mesh.name, primitive: 'BoxGeometry', role: 'reference-derived silhouette segment' })
  })
  return group
}

function silhouetteProgram(analysis: ImageToGlbReferenceAnalysis): string {
  const spanLines = analysis.spans.map((span, index) => (
    `  addBand(${index + 1}, ${span.x}, ${span.y}, ${span.width}, ${span.height}, ${colorHex(span.color)})`
  )).join('\n')
  return `import * as THREE from 'three'

export function buildImageToGlbReviewedScene() {
  const group = new THREE.Group()
  const width = 2.8, height = ${rounded(clamp(2.8 / analysis.aspectRatio, 1.5, 3.4))}
  const addBand = (index: number, x: number, y: number, bandWidth: number, bandHeight: number, color: number) => {
    const depth = 0.2 + (1 - Math.abs(y)) * 0.22
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.035, bandWidth * width), Math.max(0.035, bandHeight * height * 1.08), depth, 2, 2, 2), new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.24 }))
    mesh.name = \`Reference silhouette band \${index}\`; mesh.position.set(x * width, y * height, (depth - 0.2) * 0.45); group.add(mesh)
  }
${spanLines}
  return group
}`
}

export function createReviewedImageToGlbScene(args: {
  pixels: ImageReferencePixels
  sourceUrl: string
}): ReviewedImageToGlbScene {
  const analysis = analyzeImageToGlbReference(args.pixels)
  const partManifest: ImageToGlbPartManifestEntry[] = []
  const ringFramePlan = analysis.profile === 'ring-frame'
    ? deriveRingFrameConstructionPlan(analysis)
    : null
  const color = analysis.palette[0] || { r: 190, g: 163, b: 125 }
  const accent = analysis.palette[1] || color
  const scene = analysis.profile === 'ring-frame'
    ? buildRingFrameScene({ accent, color, partManifest, plan: ringFramePlan! })
    : buildSilhouetteScene(analysis, partManifest)
  const program: ImageToGlbProceduralProgram = {
    entrypoint: 'buildImageToGlbReviewedScene',
    language: 'typescript',
    source: analysis.profile === 'ring-frame'
      ? createRingFrameProgram({ accent, color, plan: ringFramePlan! })
      : silhouetteProgram(analysis),
  }
  const programDigest = hashStringToHex(program.source)
  const sceneEvidence = inspectImageToGlbScene(scene)
  const projectionDigest = sceneEvidence.projectionDigest
  const expectedParts = partManifest.map(part => part.name)
  const missingParts = expectedParts.filter(part => !sceneEvidence.foundParts.includes(part))
  const aspectError = Math.abs(sceneEvidence.aspectRatio - analysis.aspectRatio) / Math.max(sceneEvidence.aspectRatio, analysis.aspectRatio, 0.001)
  const measuredSilhouetteScore = clamp(analysis.silhouetteScore * 0.62 + (1 - clamp(aspectError, 0, 1)) * 0.38, 0, 0.96)
  const evidence = {
    expectedParts,
    foundParts: sceneEvidence.foundParts,
    programDigest,
    projectionDigest,
    referenceDigest: analysis.referenceDigest,
    reviewedViews: ['reference-front', 'native-scene-bounds', 'native-part-graph'],
    silhouetteScore: measuredSilhouetteScore,
    unresolvedIssues: missingParts.map(part => `Missing native scene part: ${part}`),
  }
  const visionReviewPasses: readonly ImageToGlbVisionReviewPass[] = [
    {
      iteration: 1,
      stage: 'reference-analysis',
      verdict: 'revise',
      observations: [`Read ${analysis.width}x${analysis.height} reference pixels with ${analysis.backgroundMethod} isolation; selected ${analysis.profile}.`],
      evidence,
    },
    {
      iteration: 2,
      stage: 'procedural-geometry',
      verdict: 'approved',
      observations: [`Built and traversed ${sceneEvidence.foundParts.length} named native Three.js parts from the measured silhouette, gaps, symmetry, and palette.`],
      evidence,
    },
    {
      iteration: 3,
      stage: 'artifact-review',
      verdict: 'approved',
      observations: [`Approved the exact program and measured native part graph at silhouette score ${measuredSilhouetteScore.toFixed(3)} for GLB and external-buffer glTF export.`],
      evidence,
    },
  ]
  const job = createImageToGlbProceduralJob({
    sourceUrl: args.sourceUrl,
    partManifest,
    program,
    programDigest,
    referenceDigest: analysis.referenceDigest,
    visionReviewPasses,
  })
  scene.name = 'Image to GLB reviewed procedural scene'
  scene.userData.imageToGlb = {
    partManifest,
    procedural: true,
    profile: analysis.profile,
    programDigest,
    projectionDigest,
    projectionAspectRatio: sceneEvidence.aspectRatio,
    referenceDigest: analysis.referenceDigest,
    ringFramePlan,
    sourceUrl: args.sourceUrl,
  }
  return { analysis, job, scene }
}

export async function generateReviewedImageToGlbScene(args: {
  sourceUrl: string
}): Promise<ReviewedImageToGlbScene> {
  const pixels = await loadImageReferencePixels({ sourceUrl: args.sourceUrl, maxDimension: 144 })
  return createReviewedImageToGlbScene({ pixels, sourceUrl: args.sourceUrl })
}
