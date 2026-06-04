import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testTimelineTransportRateSelectUsesSharedResponsiveCssOwner() {
  const transportText = readUtf8('src/components/timeline/TimelineTransportControls.tsx')
  const cssText = readUtf8('src/components/timeline/TimelineTransportControls.css')

  if (!transportText.includes('timeline-rate-select ant-select ant-select-sm ant-select-single ant-select-show-arrow')) {
    throw new Error('expected timeline transport rate select to use the shared responsive CSS class owner')
  }
  if (!cssText.includes('.timeline-player .timeline-rate-select') || !cssText.includes('--kg-timeline-rate-select-width')) {
    throw new Error('expected timeline rate select width to live in the timeline transport CSS owner')
  }
  if (!cssText.includes('inline-size: min(') || !cssText.includes('max-width: 100%')) {
    throw new Error('expected timeline rate select to stay bounded on narrow viewports')
  }
  if (transportText.includes('style={{ width: 90 }}')) {
    throw new Error('expected timeline transport component to avoid local fixed rate-select width literals')
  }
}
