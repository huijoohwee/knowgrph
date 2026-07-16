import { JSDOM } from 'jsdom'
import { shouldStoryboardCardOverlayYieldToTextEditTarget } from '@/components/StoryboardWidgetCanvas/storyboardCardSummaryEditTarget'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function testStoryboardCardOverlayLetsLocalTextSurfaceOpenBeforeSelection() {
  const dom = new JSDOM('<article><section data-kg-storyboard-card-text-column="1"><span data-blank="1"></span><button>Run</button></section><section data-kg-storyboard-card-output-pane="1"><section data-kg-card-inline-edit="1"><span>Add output</span></section></section><span data-card-chrome="1"></span></article>')
  const doc = dom.window.document
  const inlineOutput = doc.querySelector('[data-kg-card-inline-edit="1"] span')
  const blankSummary = doc.querySelector('[data-blank="1"]')
  const button = doc.querySelector('button')
  const cardChrome = doc.querySelector('[data-card-chrome="1"]')
  assert(inlineOutput && shouldStoryboardCardOverlayYieldToTextEditTarget(inlineOutput), 'expected unselected Add output clicks to reach the local editor before graph selection')
  assert(blankSummary && shouldStoryboardCardOverlayYieldToTextEditTarget(blankSummary), 'expected blank summary clicks to reach the local editor before graph selection')
  assert(button && !shouldStoryboardCardOverlayYieldToTextEditTarget(button), 'expected text-column controls to preserve card selection ownership')
  assert(cardChrome && !shouldStoryboardCardOverlayYieldToTextEditTarget(cardChrome), 'expected ordinary card chrome to preserve card selection ownership')
}
