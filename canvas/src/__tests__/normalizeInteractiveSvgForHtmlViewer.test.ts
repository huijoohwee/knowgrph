import { normalizeInteractiveSvgForHtmlViewer } from '@/components/BottomPanel/markdownWorkspace/main/exports/normalizeInteractiveSvg'

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

