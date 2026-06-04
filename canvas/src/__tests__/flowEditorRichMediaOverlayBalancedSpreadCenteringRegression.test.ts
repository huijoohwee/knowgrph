import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorRichMediaOverlayBalancedSpreadUsesSharedCentered16x9Planner() {
  const overlaysPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const loopPath = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const overlaysText = readFileSync(overlaysPath, 'utf8')
  const loopText = readFileSync(loopPath, 'utf8')

  if (!overlaysText.includes("import { computeBalancedSpreadViewportMargins } from '@/lib/ui/overlayBalancedSpread'")) {
    throw new Error('expected FlowCanvas rich media overlays to reuse shared balanced spread viewport margins')
  }
  if (!overlaysText.includes("preset: 'richMedia'")) {
    throw new Error('expected FlowCanvas rich media overlays to request the shared rich-media balanced spread viewport preset')
  }
  if (!overlaysText.includes('clampToViewport: richMediaInfiniteCanvasMode\n        ? null')
    || !overlaysText.includes(': { margin: mediaViewportMargin }')) {
    throw new Error('expected bounded FlowCanvas rich media overlays to clamp layout through the shared balanced-spread-derived viewport margins')
  }
  if (!loopText.includes('computeBalancedSpreadLayout')) {
    throw new Error('expected rich media overlay layout loop to reuse the shared balanced spread layout helper for reseed planning')
  }
  if (!loopText.includes('computeBalancedSpreadViewportMargins')) {
    throw new Error('expected rich media overlay layout loop to reuse the shared balanced spread viewport margins helper')
  }
  if (!loopText.includes("preset: 'richMedia'")) {
    throw new Error('expected rich media overlay layout loop to plan within the shared rich-media 16:9 viewport preset')
  }
  if (!loopText.includes('const layout = computeBalancedSpreadLayout({')) {
    throw new Error('expected rich media overlay layout loop to reseed dense collectives through the shared balanced layout planner')
  }
  if (!loopText.includes('marginLeftPx: spreadMargins.left')) {
    throw new Error('expected rich media overlay layout loop to apply shared left viewport margin to balanced reseed planning')
  }
  if (!loopText.includes('marginRightPx: spreadMargins.right')) {
    throw new Error('expected rich media overlay layout loop to apply shared right viewport margin to balanced reseed planning')
  }
  if (!loopText.includes('marginTopPx: spreadMargins.top')) {
    throw new Error('expected rich media overlay layout loop to apply shared top viewport margin to balanced reseed planning')
  }
  if (!loopText.includes('marginBottomPx: spreadMargins.bottom')) {
    throw new Error('expected rich media overlay layout loop to apply shared bottom viewport margin to balanced reseed planning')
  }
  if (!loopText.includes('return ordered.map((item, index) => {')) {
    throw new Error('expected rich media overlay layout loop to assign balanced reseed cells deterministically by ordered item ids')
  }
}
