import React from 'react'
import {
  readUploadedMediaPanelItemRuntimeUrl,
  type UploadedMediaPanelItem,
} from '@/lib/storage/uploadedMediaPanelItems'

export type MediaCatalogPreviewPreloadItem = Pick<UploadedMediaPanelItem, 'id' | 'kind' | 'name'> & {
  url: string
}

export function resolveMediaCatalogPreviewPreloadItems(
  items: readonly UploadedMediaPanelItem[],
): MediaCatalogPreviewPreloadItem[] {
  return items.flatMap(item => {
    const url = readUploadedMediaPanelItemRuntimeUrl(item)
    if (!url || (item.kind !== 'image' && item.kind !== 'video')) return []
    return [{ id: item.id, kind: item.kind, name: item.name, url }]
  })
}

function releasePreloadElement(element: HTMLImageElement | HTMLVideoElement): void {
  if (element.tagName === 'VIDEO') {
    try {
      ;(element as HTMLVideoElement).pause()
    } catch {
      void 0
    }
  }
  element.removeAttribute('src')
  if (element.tagName === 'VIDEO') {
    try {
      ;(element as HTMLVideoElement).load()
    } catch {
      void 0
    }
  }
}

function MediaCatalogPreviewPreloadResource(props: { item: MediaCatalogPreviewPreloadItem }) {
  const { item } = props
  const resourceRef = React.useRef<HTMLImageElement | HTMLVideoElement | null>(null)

  React.useEffect(() => {
    const resource = resourceRef.current
    if (!resource) return
    // Strict Mode replays cleanup; setup must restore the source it owns.
    resource.setAttribute('src', item.url)
    if (resource.tagName === 'VIDEO') {
      try {
        ;(resource as HTMLVideoElement).load()
      } catch {
        void 0
      }
    }
    return () => {
      releasePreloadElement(resource)
    }
  }, [item.url])

  if (item.kind === 'video') {
    return (
      <video
        ref={resourceRef as React.RefObject<HTMLVideoElement | null>}
        preload="metadata"
        muted
        playsInline
        aria-label={`Preload ${item.name}`}
        data-kg-media-catalog-preview-preload="1"
        data-kg-media-catalog-preview-preload-id={item.id}
        data-kg-media-catalog-preview-preload-kind="video"
      />
    )
  }

  return (
    <img
      ref={resourceRef as React.RefObject<HTMLImageElement | null>}
      alt=""
      decoding="async"
      loading="eager"
      data-kg-media-catalog-preview-preload="1"
      data-kg-media-catalog-preview-preload-id={item.id}
      data-kg-media-catalog-preview-preload-kind="image"
    />
  )
}

export function MediaCatalogPreviewPreloads(props: {
  items: readonly MediaCatalogPreviewPreloadItem[]
}) {
  if (!props.items.length) return null
  return (
    <aside
      aria-hidden="true"
      className="pointer-events-none fixed -left-2 -top-2 h-px w-px overflow-hidden opacity-0"
      data-kg-media-catalog-preview-preloads="1"
    >
      {props.items.map(item => <MediaCatalogPreviewPreloadResource key={item.id} item={item} />)}
    </aside>
  )
}
