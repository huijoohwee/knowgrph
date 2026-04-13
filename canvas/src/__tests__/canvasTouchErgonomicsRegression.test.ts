import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (filePath: string): string => fs.readFileSync(filePath, 'utf8')

export function testToolbarTouchErgonomicsStaySourceDriven() {
  const root = process.cwd()
  const toolbarText = readUtf8(path.resolve(root, 'src/components/Toolbar.tsx'))
  const cssText = readUtf8(path.resolve(root, 'src/index.css'))

  if (!toolbarText.includes("touchAction: 'pan-x manipulation'")) {
    throw new Error('expected toolbar to allow horizontal touch scrolling without shrinking tap targets')
  }
  if (!toolbarText.includes("App-toolbar--touch-scroll")) {
    throw new Error('expected toolbar to opt into the shared touch-scroll class on narrow or coarse viewports')
  }
  if (!cssText.includes('.App-toolbar--touch-scroll')) {
    throw new Error('expected toolbar touch scrolling behavior to stay centralized in shared CSS')
  }
  if (!cssText.includes('min-height: var(--kg-control-height, 36px);')) {
    throw new Error('expected collapsed toolbar and header height to follow the shared control height token')
  }
}

export function testCanvasTouchTargetsStayLargeAndViewportSuppressesBrowserGestures() {
  const root = process.cwd()
  const dropdownText = readUtf8(path.resolve(root, 'src/components/toolbar/ToolbarDropdownSelect.tsx'))
  const viewportText = readUtf8(path.resolve(root, 'src/components/CanvasViewport.tsx'))

  if (!dropdownText.includes('min-h-[var(--kg-touch-target)]')) {
    throw new Error('expected toolbar dropdown rows to keep touch-sized hit targets')
  }
  if (!viewportText.includes("touchAction: 'manipulation'")) {
    throw new Error('expected canvas viewport shell to disable double-tap browser zoom delays')
  }
  if (!viewportText.includes("overscrollBehavior: 'none'")) {
    throw new Error('expected canvas viewport shell to contain browser overscroll gestures')
  }
}
