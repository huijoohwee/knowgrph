import { normalizeInteractiveSvgForHtmlViewer } from '@/components/BottomPanel/markdownWorkspace/main/exports/normalizeInteractiveSvg'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export function testNormalizeInteractiveSvgExtractsInitialViewAndStripsTransform() {
  const input =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g transform="translate(12.5, -3) scale(0.8)"><circle data-node-id="n" cx="0" cy="0" r="1"/></g></svg>'

  const out = normalizeInteractiveSvgForHtmlViewer(input)
  if (!out.initialView) throw new Error('Expected initialView to be detected')
  if (Math.abs(out.initialView.k - 0.8) > 1e-9) throw new Error('Unexpected k')
  if (Math.abs(out.initialView.x - 12.5) > 1e-9) throw new Error('Unexpected x')
  if (Math.abs(out.initialView.y - -3) > 1e-9) throw new Error('Unexpected y')
  if (out.svgMarkup.includes('transform="translate(12.5, -3) scale(0.8)"')) {
    throw new Error('Expected transform to be stripped from outer g')
  }
  if (!out.svgMarkup.includes('data-node-id="n"')) throw new Error('Expected svg content to be preserved')
}

export function testNormalizeInteractiveSvgExtractsMatrixInitialView() {
  const input =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g transform="matrix(2,0,0,2,15,-7)"><circle data-node-id="n" cx="0" cy="0" r="1"/></g></svg>'
  const out = normalizeInteractiveSvgForHtmlViewer(input)
  if (!out.initialView) throw new Error('Expected initialView from matrix transform')
  if (Math.abs(out.initialView.k - 2) > 1e-9) throw new Error('Unexpected matrix k')
  if (Math.abs(out.initialView.x - 15) > 1e-9) throw new Error('Unexpected matrix x')
  if (Math.abs(out.initialView.y - -7) > 1e-9) throw new Error('Unexpected matrix y')
  if (out.svgMarkup.includes('matrix(2,0,0,2,15,-7)')) throw new Error('Expected matrix transform removed after extraction')
}

export function testNormalizeInteractiveSvgPrefersNodeLayerTransform() {
  const bootstrap = typeof document === 'undefined' ? initJsdomHarness() : null
  try {
  const input =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g transform="translate(1,2) scale(3)"><g data-kg-layer="bg"/></g><g transform="translate(10,20) scale(0.5)"><circle data-node-id="n" cx="0" cy="0" r="1"/></g></svg>'
  const out = normalizeInteractiveSvgForHtmlViewer(input)
  if (!out.initialView) throw new Error('Expected initialView from node transform')
  if (Math.abs(out.initialView.k - 0.5) > 1e-9) throw new Error('Expected node-layer scale selected')
  if (Math.abs(out.initialView.x - 10) > 1e-9 || Math.abs(out.initialView.y - 20) > 1e-9) {
    throw new Error('Expected node-layer translate selected')
  }
  } finally {
    bootstrap?.restore()
  }
}
