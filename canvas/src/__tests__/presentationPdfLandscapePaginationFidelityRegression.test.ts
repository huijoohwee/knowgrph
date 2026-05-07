import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testPresentationPdfLandscapePaginationEnforcesOneSlidePerA4Page() {
  const printPath = resolve(process.cwd(), 'src', 'lib', 'print', 'printElementToPdf.ts')
  const printText = readFileSync(printPath, 'utf8')
  const presentationHelpersPath = resolve(process.cwd(), 'src', 'lib', 'print', 'printElementToPdf.presentation.ts')
  const presentationHelpersText = readFileSync(presentationHelpersPath, 'utf8')

  if (
    !printText.includes("orientation === 'landscape' ? 0.6 : 0.4")
    || !printText.includes("const presentationSectionHeightEpsilonMm = preservePresentationLayout")
  ) {
    throw new Error('expected presentation PDF pagination to keep non-zero section-height epsilon for A4 landscape split protection')
  }

  if (
    !printText.includes('> [data-kg-presentation-page="1"]:not(:first-child)')
    || !printText.includes('break-before: page !important;')
    || !printText.includes('page-break-before: always !important;')
  ) {
    throw new Error('expected presentation PDF pagination CSS to enforce one slide per page using a single inter-page break strategy')
  }
  if (
    printText.includes('break-after: page !important;')
    || printText.includes('page-break-after: always !important;')
  ) {
    throw new Error('expected presentation PDF pagination CSS to forbid double-break strategy that can cause blank split pages')
  }

  if (
    !printText.includes('> [data-kg-presentation-page="1"] {\n          margin: 0 !important;')
    || !printText.includes('display: block !important;')
    || !printText.includes('width: ${fittedSlideWidthMmCss} !important;')
    || !printText.includes('height: ${presentationSectionHeightMmCss} !important;')
    || !printText.includes('overflow: hidden !important;')
  ) {
    throw new Error('expected presentation PDF page containers to use full printable block page boxes with hidden overflow for stable one-slide-per-page landscape rendering')
  }
  if (!printText.includes('const slideVerticalOffsetMmCss = toCssMm(Math.max(0, (presentationSectionHeightRawMm - presentationSlideMm.heightMm) / 2))')) {
    throw new Error('expected presentation PDF geometry to compute deterministic vertical centering offset without flex/grid pagination flow')
  }
  if (
    printText.includes('position: absolute !important;')
    || printText.includes('top: ${slideOffsetYmmCss} !important;')
    || printText.includes('left: ${slideOffsetXmmCss} !important;')
  ) {
    throw new Error('expected presentation PDF slide surfaces to avoid absolute offset placement that can drift/split across print engines')
  }
  if (
    presentationHelpersText.includes('serializeToString(svg)')
    || presentationHelpersText.includes('section.replaceChildren(img)')
    || !presentationHelpersText.includes('section.replaceChildren(svg)')
  ) {
    throw new Error('expected presentation PDF slide surfaces to stay live inline SVG+foreignObject and forbid serialized image-surface fallback')
  }
  if (
    !printText.includes('foreignObject {')
    || !printText.includes('foreignObject > div {')
    || !printText.includes('[data-kg-presentation-page-frame="1"]')
    || !printText.includes('contain: layout paint size !important;')
    || !printText.includes('break-inside: avoid-page !important;')
    || !printText.includes('[data-kg-presentation-slide-surface="1"] *')
  ) {
    throw new Error('expected presentation PDF landscape CSS to hard-clip per-page frame and SVG foreignObject surfaces with strict containment for one-slide fidelity')
  }
  if (
    presentationHelpersText.includes("svg.setAttribute('width', String(slideWidthPx))")
    || presentationHelpersText.includes("svg.setAttribute('height', String(slideHeightPx))")
    || presentationHelpersText.includes("fo.setAttribute('width', String(slideWidthPx))")
    || presentationHelpersText.includes("fo.setAttribute('height', String(slideHeightPx))")
    || !presentationHelpersText.includes("svg.setAttribute('width', '100%')")
    || !presentationHelpersText.includes("svg.setAttribute('height', '100%')")
    || !presentationHelpersText.includes("fo.setAttribute('width', '100%')")
    || !presentationHelpersText.includes("fo.setAttribute('height', '100%')")
  ) {
    throw new Error('expected presentation PDF slide SVG and foreignObject surfaces to use percentage sizing and forbid pixel attribute sizing that can trigger multi-page split')
  }
  if (!presentationHelpersText.includes("frame.setAttribute('data-kg-presentation-page-frame', '1')")) {
    throw new Error('expected presentation page flattening to isolate each slide surface in a per-page frame wrapper')
  }
  if (
    !printText.includes('ensurePresentationPrintDeck(clone)')
    || !presentationHelpersText.includes('export const ensurePresentationPrintDeck')
    || !presentationHelpersText.includes('const resolvePresentationDeckElement = (root: Element): HTMLElement | null => {')
    || !presentationHelpersText.includes("const sections = deck.querySelectorAll(':scope > section')")
  ) {
    throw new Error('expected presentation PDF path to synthesize and resolve print deck roots reliably (root-is-deck and nested-deck) before section materialization')
  }
  if (
    !printText.includes("const compact = normalized.toFixed(3).replace(/\\.?0+$/, '')")
    || !printText.includes("const safe = compact.length > 0 ? compact : '0'")
  ) {
    throw new Error('expected mm CSS serialization to preserve zero as 0mm and avoid invalid margin tokens like \"mm\"')
  }
  if (
    !printText.includes("const cloneIsDeckRoot = clone.matches('[data-testid=\"markdown-presentation-print-deck\"]')")
    || !printText.includes('if (!cloneIsDeckRoot) freezePresentationScrollViewports(clone)')
  ) {
    throw new Error('expected presentation deck-root export path to skip viewport freeze and avoid top-region clipping in landscape PDF fidelity')
  }
  if (
    !printText.includes("const preferNativeLandscapeSlides = preservePresentationLayout && orientation === 'landscape' && cloneIsDeckRoot")
    || !printText.includes('if (!preferNativeLandscapeSlides) {')
  ) {
    throw new Error('expected landscape deck-root export to bypass SVG foreignObject conversion and preserve native slide section rendering')
  }
  if (
    !presentationHelpersText.includes('const frameContent = surface || section || article')
    || !printText.includes('> [data-kg-presentation-page-frame="1"] > section,')
    || !printText.includes('min-width: 100% !important;')
    || !printText.includes('max-width: 100% !important;')
    || !printText.includes("root.setAttribute('data-kg-native-presentation-landscape', '1')")
    || !printText.includes('[data-kg-native-presentation-landscape="1"] [aria-label="Slide Content"]')
  ) {
    throw new Error('expected presentation page flattening and CSS to support native section/article frame content when slide-surface SVG is bypassed')
  }
}
