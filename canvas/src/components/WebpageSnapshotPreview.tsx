import React from 'react'
import { SharedWebpageSnapshotSurface } from '@/components/SharedWebpageSnapshotSurface'
import { buildWebpageLayoutCacheKey, getUiWebpageSnapshotPreset } from '@/lib/websites/webpageLayoutPresets'
import { normalizeWebpageLikeUrl } from 'grph-shared/url'
import {
  useWebpageLayoutSnapshotLifecycle,
  useWebpageSnapshotSurfaceAssets,
} from '@/lib/websites/webpageSnapshotShared'

export default function WebpageSnapshotPreview(props: {
  url: string
  title?: string
  className?: string
  style?: React.CSSProperties
}) {
  const url = React.useMemo(() => normalizeWebpageLikeUrl(String(props.url || '').trim()), [props.url])
  const title = String(props.title || '').trim()
  const layoutPreset = React.useMemo(() => getUiWebpageSnapshotPreset(), [])
  const layoutCacheKey = React.useMemo(() => buildWebpageLayoutCacheKey(layoutPreset), [layoutPreset])
  const { snap, blocked } = useWebpageLayoutSnapshotLifecycle({
    url,
    layoutPreset,
    layoutCacheKey,
    allowNodeJsUserAgent: true,
    requireProbeReady: true,
    yieldBeforeProbe: true,
    maxAttempts: 4,
  })

  const {
    fallbackInfo,
    metaImageSrc,
    faviconSrc,
    hostIconSrc,
  } = useWebpageSnapshotSurfaceAssets({ url, title })

  return (
    <SharedWebpageSnapshotSurface
      url={url}
      title={title}
      titleLabel={fallbackInfo.titleLabel}
      hostLabel={fallbackInfo.hostLabel}
      snap={snap}
      blocked={blocked}
      metaImageSrc={metaImageSrc}
      faviconSrc={faviconSrc}
      hostIconSrc={hostIconSrc}
      className={props.className}
      style={props.style}
    />
  )
}
