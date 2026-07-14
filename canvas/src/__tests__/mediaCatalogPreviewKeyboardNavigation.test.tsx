import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MediaCatalogRichMediaPreview } from '@/features/command-menu/MediaCatalogRichMediaPreview'
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
  return (
    <MediaCatalogRichMediaPreview
      item={item}
      items={PREVIEW_ITEMS}
      onClose={() => void 0}
      onNavigate={setItem}
    />
  )
}

export async function assertMediaCatalogPreviewKeyboardNavigation() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let fullscreenTarget: Element | null = null
  Object.defineProperty(dom.window.HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: function requestFullscreen() {
      fullscreenTarget = this as Element
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
    assertPreviewKind('image')
    const fullscreenButton = dom.window.document.querySelector('[data-kg-media-catalog-preview-fullscreen="1"]')
    if (!(fullscreenButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected expanded Rich Media Panel to restore the fullscreen action')
    await act(async () => fullscreenButton.click())
    if (!(fullscreenTarget instanceof dom.window.HTMLElement) || fullscreenTarget.getAttribute('data-kg-media-catalog-preview') !== '1') {
      throw new Error('expected fullscreen action to target the expanded Rich Media Panel preview')
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
    }
  } finally {
    await act(async () => root.unmount())
    restore()
  }
}
