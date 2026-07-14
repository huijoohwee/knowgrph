import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MediaCatalogRichMediaPreview } from '@/features/command-menu/MediaCatalogRichMediaPreview'
import { resolveMediaCatalogPreviewAdjacentItems } from '@/features/command-menu/useMediaCatalogPreviewNavigation'
import type { UploadedMediaPanelItem } from '@/lib/storage/uploadedMediaPanelItems'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { waitForFrames } from '@/tests/lib/reactRootHarness'

const PREVIEW_ITEMS: UploadedMediaPanelItem[] = [
  {
    id: 'keyboard-image',
    name: 'keyboard-image.svg',
    kind: 'image',
    localUrl: '',
    linkUrl: '/demo/placeholder.svg',
    contentType: 'image/svg+xml',
    sizeBytes: 1,
    status: 'local',
    storage: null,
    error: null,
  },
  {
    id: 'keyboard-audio',
    name: 'keyboard-audio.wav',
    kind: 'audio',
    localUrl: '',
    linkUrl: 'data:audio/wav;base64,UklGRg==',
    contentType: 'audio/wav',
    sizeBytes: 1,
    status: 'local',
    storage: null,
    error: null,
  },
  {
    id: 'keyboard-video',
    name: 'keyboard-video.mp4',
    kind: 'video',
    localUrl: '',
    linkUrl: 'data:video/mp4;base64,AAAA',
    contentType: 'video/mp4',
    sizeBytes: 1,
    status: 'local',
    storage: null,
    error: null,
  },
]

function KeyboardNavigationHarness() {
  const [item, setItem] = React.useState(PREVIEW_ITEMS[0]!)
  const [open, setOpen] = React.useState(true)
  return open ? (
    <MediaCatalogRichMediaPreview
      item={item}
      items={PREVIEW_ITEMS}
      onClose={() => setOpen(false)}
      onNavigate={setItem}
    />
  ) : <p data-kg-media-catalog-preview-closed="1">Preview closed</p>
}

export async function assertMediaCatalogPreviewKeyboardNavigation() {
  const threeItemSequence = [
    PREVIEW_ITEMS[0]!,
    PREVIEW_ITEMS[2]!,
    { ...PREVIEW_ITEMS[0]!, id: 'keyboard-image-second', name: 'keyboard-image-second.svg' },
  ]
  const adjacentItems = resolveMediaCatalogPreviewAdjacentItems(threeItemSequence, 0)
  if (adjacentItems.map(item => item.id).join(',') !== 'keyboard-image-second,keyboard-video') {
    throw new Error('expected preload planning to return the distinct previous and next media items')
  }
  const dedupedAdjacentItems = resolveMediaCatalogPreviewAdjacentItems([PREVIEW_ITEMS[0]!, PREVIEW_ITEMS[2]!], 0)
  if (dedupedAdjacentItems.map(item => item.id).join(',') !== 'keyboard-video') {
    throw new Error('expected two-item wraparound to preload its shared adjacent item once')
  }
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let fullscreenTarget: Element | null = null
  let exitFullscreenCalls = 0
  let releasedVideoPauseCalls = 0
  let releasedVideoLoadCalls = 0
  const videoPrototype = dom.window.HTMLVideoElement.prototype
  const originalVideoPause = Object.getOwnPropertyDescriptor(videoPrototype, 'pause')
  const originalVideoLoad = Object.getOwnPropertyDescriptor(videoPrototype, 'load')
  Object.defineProperty(videoPrototype, 'pause', {
    configurable: true,
    value: function pause() {
      if (this.getAttribute('data-kg-media-catalog-preview-preload') === '1') releasedVideoPauseCalls += 1
    },
  })
  Object.defineProperty(videoPrototype, 'load', {
    configurable: true,
    value: function load() {
      if (this.getAttribute('data-kg-media-catalog-preview-preload') === '1' && !this.hasAttribute('src')) {
        releasedVideoLoadCalls += 1
      }
    },
  })
  Object.defineProperty(dom.window.document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenTarget,
  })
  Object.defineProperty(dom.window.document, 'exitFullscreen', {
    configurable: true,
    value: () => {
      fullscreenTarget = null
      exitFullscreenCalls += 1
      dom.window.document.dispatchEvent(new dom.window.Event('fullscreenchange'))
      return Promise.resolve()
    },
  })
  Object.defineProperty(dom.window.HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: function requestFullscreen() {
      fullscreenTarget = this as Element
      dom.window.document.dispatchEvent(new dom.window.Event('fullscreenchange'))
      return Promise.resolve()
    },
  })
  try {
    await act(async () => {
      root.render(<KeyboardNavigationHarness />)
      await waitForFrames(dom.window, 3)
    })
    const assertPreviewKind = (kind: 'image' | 'video') => {
      const preview = dom.window.document.querySelector('[data-kg-media-catalog-preview="1"]')
      if (!(preview instanceof dom.window.HTMLElement)) throw new Error('expected expanded media catalog preview')
      if (preview.getAttribute('data-kg-media-catalog-preview-kind') !== kind) throw new Error(`expected ${kind} after keyboard navigation`)
      if (preview.getAttribute('data-kg-media-catalog-preview-count') !== '2') throw new Error('expected navigation to exclude audio and include two image/video items')
      if (!preview.querySelector(kind === 'video' ? 'video' : 'img')) throw new Error(`expected Rich Media Panel to render ${kind}`)
    }
    const assertPreloadKind = (kind: 'image' | 'video') => {
      const preview = dom.window.document.querySelector('[data-kg-media-catalog-preview="1"]')
      if (!(preview instanceof dom.window.HTMLElement)) throw new Error('expected expanded media catalog preview for preload assertion')
      if (preview.getAttribute('data-kg-media-catalog-preview-preload-count') !== '1') {
        throw new Error('expected the duplicate previous/next item to preload once')
      }
      if (preview.getAttribute('data-kg-media-catalog-preview-preload-kinds') !== kind) {
        throw new Error(`expected adjacent ${kind} preload metadata`)
      }
      const preloadContainer = preview.querySelector('[data-kg-media-catalog-preview-preloads="1"]')
      if (!(preloadContainer instanceof dom.window.HTMLElement) || preloadContainer.hasAttribute('hidden')) {
        throw new Error('expected preload resources to stay visually isolated without suppressing browser fetches')
      }
      const resource = preview.querySelector(`[data-kg-media-catalog-preview-preload-kind="${kind}"]`)
      if (!(resource instanceof dom.window.HTMLElement) || !resource.hasAttribute('src')) {
        throw new Error(`expected adjacent ${kind} preload resource`)
      }
      return resource
    }
    assertPreviewKind('image')
    const initialVideoPreload = assertPreloadKind('video')
    const fullscreenButton = dom.window.document.querySelector('[data-kg-media-catalog-preview-fullscreen="1"]')
    if (!(fullscreenButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected expanded Rich Media Panel to restore the fullscreen action')
    await act(async () => {
      fullscreenButton.click()
      await waitForFrames(dom.window, 1)
    })
    if (!(fullscreenTarget instanceof dom.window.HTMLElement) || fullscreenTarget.getAttribute('data-kg-media-catalog-preview') !== '1') {
      throw new Error('expected fullscreen action to target the expanded Rich Media Panel preview')
    }
    if (fullscreenButton.getAttribute('aria-label') !== 'Exit fullscreen' || fullscreenButton.getAttribute('aria-pressed') !== 'true') {
      throw new Error('expected fullscreen action to switch to its exit state after fullscreenchange')
    }
    await act(async () => {
      fullscreenButton.click()
      await waitForFrames(dom.window, 1)
    })
    if (fullscreenTarget || exitFullscreenCalls !== 1) throw new Error('expected fullscreen exit action to leave the expanded Rich Media Panel fullscreen state')
    if (fullscreenButton.getAttribute('aria-label') !== 'Enter fullscreen' || fullscreenButton.getAttribute('aria-pressed') !== 'false') {
      throw new Error('expected fullscreen action to return to its enter state after exit')
    }
    for (const [key, kind] of [
      ['ArrowRight', 'video'],
      ['ArrowDown', 'image'],
      ['ArrowLeft', 'video'],
      ['ArrowUp', 'image'],
    ] as const) {
      await act(async () => {
        dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
        await waitForFrames(dom.window, 2)
      })
      assertPreviewKind(kind)
      assertPreloadKind(kind === 'image' ? 'video' : 'image')
    }
    if (initialVideoPreload.hasAttribute('src') || releasedVideoPauseCalls < 1 || releasedVideoLoadCalls < 1) {
      throw new Error('expected obsolete video preload to pause, clear its source, and release its resource')
    }
    const previousButton = dom.window.document.querySelector('[data-kg-media-catalog-preview-previous="1"]')
    const nextButton = dom.window.document.querySelector('[data-kg-media-catalog-preview-next="1"]')
    if (!(previousButton instanceof dom.window.HTMLButtonElement) || !(nextButton instanceof dom.window.HTMLButtonElement)) {
      throw new Error('expected expanded preview to expose visible Previous and Next media controls')
    }
    await act(async () => {
      nextButton.click()
      await waitForFrames(dom.window, 2)
    })
    assertPreviewKind('video')
    assertPreloadKind('image')
    await act(async () => {
      previousButton.click()
      await waitForFrames(dom.window, 2)
    })
    assertPreviewKind('image')
    assertPreloadKind('video')
    const preview = dom.window.document.querySelector('[data-kg-media-catalog-preview="1"]')
    if (!(preview instanceof dom.window.HTMLElement) || preview.getAttribute('data-kg-media-catalog-preview-touch-navigation') !== 'horizontal-swipe') {
      throw new Error('expected expanded preview to expose horizontal touch-swipe navigation')
    }
    const dispatchTouch = (type: 'touchstart' | 'touchend', x: number, y: number) => {
      const event = new dom.window.Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, type === 'touchstart' ? 'touches' : 'changedTouches', {
        value: [{ clientX: x, clientY: y }],
      })
      preview.dispatchEvent(event)
    }
    await act(async () => {
      dispatchTouch('touchstart', 420, 200)
      dispatchTouch('touchend', 180, 210)
      await waitForFrames(dom.window, 2)
    })
    assertPreviewKind('video')
    await act(async () => {
      dispatchTouch('touchstart', 180, 200)
      dispatchTouch('touchend', 420, 210)
      await waitForFrames(dom.window, 2)
    })
    assertPreviewKind('image')
    await act(async () => {
      dispatchTouch('touchstart', 300, 100)
      dispatchTouch('touchend', 310, 300)
      await waitForFrames(dom.window, 2)
    })
    assertPreviewKind('image')
    const finalVideoPreload = assertPreloadKind('video')
    const closeButton = dom.window.document.querySelector('[data-kg-media-catalog-preview-close="1"]')
    if (!(closeButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected media preview close action')
    await act(async () => {
      closeButton.click()
      await waitForFrames(dom.window, 2)
    })
    if (dom.window.document.querySelector('[data-kg-media-catalog-preview="1"]')) {
      throw new Error('expected close action to unmount the expanded preview')
    }
    if (dom.window.document.querySelector('[data-kg-media-catalog-preview-preload="1"]') || finalVideoPreload.hasAttribute('src')) {
      throw new Error('expected close action to remove and release adjacent preload resources')
    }
  } finally {
    await act(async () => root.unmount())
    if (originalVideoPause) Object.defineProperty(videoPrototype, 'pause', originalVideoPause)
    if (originalVideoLoad) Object.defineProperty(videoPrototype, 'load', originalVideoLoad)
    restore()
  }
}
