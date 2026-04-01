import { computeViewerScrollTopForElement } from '@/components/BottomPanel/markdownScrollUtils'

export const testMarkdownScrollUtilsRespectsScrollPaddingTop = () => {
  const top = computeViewerScrollTopForElement({
    viewerTopPx: 100,
    viewerScrollTopPx: 0,
    elementTopPx: 520,
    scrollPaddingTopPx: 146,
  })
  if (top !== 274) {
    throw new Error(`expected target top 274 but got ${top}`)
  }
}

export const testMarkdownScrollUtilsClampsTargetTopToZero = () => {
  const top = computeViewerScrollTopForElement({
    viewerTopPx: 100,
    viewerScrollTopPx: 0,
    elementTopPx: 120,
    scrollPaddingTopPx: 200,
  })
  if (top !== 0) {
    throw new Error(`expected target top 0 but got ${top}`)
  }
}

