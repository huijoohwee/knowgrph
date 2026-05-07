import {
  PRESENTATION_BASE_SLIDE_SIZE_PX,
  resolvePrintGeometryMm,
  type PrintOrientation,
} from './printLayoutTokens'

const captureVideoFrameAsDataUrl = (video: HTMLVideoElement): string | null => {
  try {
    if (!video.videoWidth || !video.videoHeight) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    try {
      return canvas.toDataURL('image/png')
    } catch {
      return canvas.toDataURL('image/jpeg', 0.92)
    }
  } catch {
    return null
  }
}

const captureImageAsDataUrl = (img: HTMLImageElement): string | null => {
  try {
    if (!img.complete || !img.naturalWidth || !img.naturalHeight) return null
    const src = String(img.getAttribute('src') || '').trim()
    if (/\.svg(\?|#|$)/i.test(src)) return null
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const px = img.naturalWidth * img.naturalHeight
    if (px > 1_200_000) return canvas.toDataURL('image/jpeg', 0.92)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

const YOUTUBE_ID_RE = /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]+)/i
const PROXY_URL_RE = /^\/__(?:media|webpage|webpage_asset)_proxy\?url=(.+)$/i
const KNOWN_VIDEO_IFRAME_HOST_RE = /(youtube(?:-nocookie)?\.com|youtu\.be|bilibili\.com|tiktok\.com|douyin\.com|vimeo\.com|twitter\.com|x\.com)/i

type ThumbnailFormat = 'svg' | 'png' | 'jpg' | 'other'

const detectThumbnailFormat = (src: string): ThumbnailFormat => {
  const raw = String(src || '').trim().toLowerCase()
  if (!raw) return 'other'
  if (raw.startsWith('data:image/svg+xml') || /\.svg(\?|#|$)/i.test(raw)) return 'svg'
  if (
    raw.startsWith('data:image/png')
    || /\.png(\?|#|$)/i.test(raw)
    || raw.startsWith('data:image/webp')
    || /\.webp(\?|#|$)/i.test(raw)
    || raw.startsWith('data:image/avif')
    || /\.avif(\?|#|$)/i.test(raw)
  ) {
    return 'png'
  }
  if (raw.startsWith('data:image/jpeg') || raw.startsWith('data:image/jpg') || /\.jpe?g(\?|#|$)/i.test(raw)) return 'jpg'
  return 'other'
}

const thumbnailFormatScore = (format: ThumbnailFormat): number => {
  if (format === 'svg') return 3
  if (format === 'png') return 2
  if (format === 'jpg') return 1
  return 0
}

const pickPreferredThumbnailSource = (sources: Array<string | null | undefined>): string | null => {
  let best: { src: string; score: number } | null = null
  const seen = new Set<string>()
  for (let i = 0; i < sources.length; i += 1) {
    const raw = String(sources[i] || '').trim()
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    const score = thumbnailFormatScore(detectThumbnailFormat(raw))
    if (!best || score > best.score) best = { src: raw, score }
  }
  return best?.src || null
}

const probeImageUrl = (url: string, timeoutMs = 1_200): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    const probe = new Image()
    probe.onload = () => finish(true)
    probe.onerror = () => finish(false)
    probe.src = url
    setTimeout(() => finish(false), timeoutMs)
  })

const unwrapProxyUrl = (src: string): string => {
  const m = src.match(PROXY_URL_RE)
  if (!m) return src
  try {
    return decodeURIComponent(m[1])
  } catch {
    return src
  }
}

const extractYouTubeVideoId = (url: string): string | null => {
  const unwrapped = unwrapProxyUrl(String(url || '').trim())
  const m = unwrapped.match(YOUTUBE_ID_RE)
  return m ? m[1] : null
}

const resolveYouTubeThumbnail = (ytId: string): Promise<string> => {
  const candidates = [
    `https://img.youtube.com/vi/${ytId}/maxresdefault.png`,
    `https://img.youtube.com/vi/${ytId}/sddefault.png`,
    `https://img.youtube.com/vi/${ytId}/hqdefault.png`,
    `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${ytId}/sddefault.jpg`,
    `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
  ]
  return new Promise<string>((resolve) => {
    const run = async () => {
      for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i]
        const ok = await probeImageUrl(candidate)
        if (ok) {
          resolve(candidate)
          return
        }
      }
      resolve(candidates[candidates.length - 1])
    }
    void run()
  })
}

const createImg = (src: string, alt: string): HTMLImageElement => {
  const img = document.createElement('img')
  img.src = src
  img.alt = alt
  img.style.width = '100%'
  img.style.maxWidth = '100%'
  img.style.height = 'auto'
  img.style.display = 'block'
  img.style.objectFit = 'contain'
  return img
}

const buildVideoFallbackSvgThumbnail = (href: string): string => {
  const label = inferPlatformLabel(href)
  const host = (() => {
    try {
      const url = new URL(href)
      return url.hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  })()
  const esc = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1020"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <circle cx="640" cy="360" r="86" fill="rgba(255,255,255,0.16)"/>
  <polygon points="622,322 622,398 690,360" fill="#ffffff"/>
  <text x="640" y="500" fill="rgba(255,255,255,0.95)" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="44" text-anchor="middle">${esc(label)}</text>
  <text x="640" y="540" fill="rgba(255,255,255,0.70)" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="24" text-anchor="middle">${esc(host)}</text>
</svg>`.trim()
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const inferPlatformLabel = (url: string): string => {
  const u = String(url || '').trim().toLowerCase()
  if (/youtu\.?be|youtube(?:-nocookie)?\.com/i.test(u)) return 'YouTube'
  if (/bilibili\.com/i.test(u)) return 'Bilibili'
  if (/tiktok\.com/i.test(u)) return 'TikTok'
  if (/douyin\.com/i.test(u)) return 'Douyin'
  if (/vimeo\.com/i.test(u)) return 'Vimeo'
  if (/twitter\.com|x\.com/i.test(u)) return 'X'
  return 'Video'
}

const createVideoEmbedPreview = (thumbSrc: string, alt: string, href: string): HTMLAnchorElement => {
  const a = document.createElement('a')
  a.href = href
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.style.display = 'block'
  a.style.textDecoration = 'none'
  a.style.color = 'inherit'
  a.style.width = '100%'
  a.style.borderRadius = '12px'
  a.style.overflow = 'hidden'
  a.style.border = '1px solid #d1d5db'
  a.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'

  const wrapper = document.createElement('div')
  wrapper.style.position = 'relative'
  wrapper.style.lineHeight = '0'
  wrapper.style.backgroundColor = '#000'

  const img = document.createElement('img')
  img.src = thumbSrc
  img.alt = alt
  img.setAttribute('width', '1280')
  img.setAttribute('height', '720')
  img.style.width = '100%'
  img.style.height = 'auto'
  img.style.display = 'block'

  const gradient = document.createElement('div')
  gradient.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to top,rgba(0,0,0,0.7) 0%,rgba(0,0,0,0) 50%);pointer-events:none'

  const playBtn = document.createElement('div')
  playBtn.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:56px;height:56px;background:rgba(0,0,0,0.65);border-radius:50%;display:flex;align-items:center;justify-content:center;pointer-events:none'
  const playTriangle = document.createElement('div')
  playTriangle.style.cssText = 'width:0;height:0;border-top:11px solid transparent;border-bottom:11px solid transparent;border-left:20px solid #fff;margin-left:4px'
  playBtn.appendChild(playTriangle)

  const label = inferPlatformLabel(href)
  const titleBar = document.createElement('div')
  titleBar.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:10px 12px;display:flex;align-items:center;gap:8px;pointer-events:none'
  const titleText = document.createElement('span')
  titleText.style.cssText = 'color:#fff;font-size:12px;font-family:system-ui,-apple-system,sans-serif;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1'
  titleText.textContent = label
  titleBar.appendChild(titleText)
  const linkHint = document.createElement('span')
  linkHint.style.cssText = 'color:rgba(255,255,255,0.6);font-size:9px;font-family:system-ui,-apple-system,sans-serif;white-space:nowrap;letter-spacing:0.5px'
  linkHint.textContent = 'OPEN \u2192'
  titleBar.appendChild(linkHint)

  wrapper.appendChild(img)
  wrapper.appendChild(gradient)
  wrapper.appendChild(playBtn)
  wrapper.appendChild(titleBar)
  a.appendChild(wrapper)
  return a
}

const wrapImgWithLink = (img: HTMLImageElement, href: string): HTMLAnchorElement => {
  const a = document.createElement('a')
  a.href = href
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.style.display = 'block'
  a.style.textDecoration = 'none'
  a.style.color = 'inherit'
  img.replaceWith(a)
  a.appendChild(img)
  return a
}

const wrapImagesWithSourceLinks = (clone: Element): void => {
  const imgs = clone.querySelectorAll('img')
  for (let i = 0; i < imgs.length; i += 1) {
    const img = imgs[i] as HTMLImageElement
    if (img.closest('a')) continue
    const originalSrc = String(img.getAttribute('data-kg-original-src') || '').trim()
    if (!/^https?:\/\//i.test(originalSrc)) continue
    try {
      wrapImgWithLink(img, originalSrc)
    } catch {
      void 0
    }
  }
}

const annotateSourceImages = (el: Element): void => {
  const imgs = el.querySelectorAll('img')
  for (let i = 0; i < imgs.length; i += 1) {
    const img = imgs[i] as HTMLImageElement
    if (img.hasAttribute('data-kg-original-src')) continue
    const src = String(img.getAttribute('src') || '').trim()
    const originalSrc = unwrapProxyUrl(src)
    if (/^https?:\/\//i.test(originalSrc)) {
      try {
        img.setAttribute('data-kg-original-src', originalSrc)
      } catch {
        void 0
      }
    }
  }
}

const resolvePreferredThumbnailFromImage = (img: HTMLImageElement | null): string | null => {
  if (!img) return null
  const originalSrc = String(img.currentSrc || img.getAttribute('src') || '').trim()
  const originalSourceSrc = String(img.getAttribute('data-kg-original-src') || '').trim()
  const bakedDataUrl = captureImageAsDataUrl(img)
  return pickPreferredThumbnailSource([originalSourceSrc, originalSrc, bakedDataUrl])
}

const bakeLoadedImages = (src: Element, dst: Element): void => {
  const srcImgs = src.querySelectorAll('img')
  const dstImgs = dst.querySelectorAll('img')
  const len = Math.min(srcImgs.length, dstImgs.length)
  for (let i = 0; i < len; i += 1) {
    const si = srcImgs[i] as HTMLImageElement
    const di = dstImgs[i] as HTMLImageElement
    const dataUrl = captureImageAsDataUrl(si)
    if (dataUrl) {
      try {
        di.setAttribute('src', dataUrl)
      } catch {
        void 0
      }
    }
    try {
      di.removeAttribute('loading')
    } catch {
      void 0
    }
    try {
      di.removeAttribute('decoding')
    } catch {
      void 0
    }
  }
}

const replaceVideosWithFrames = (src: Element, dst: Element): void => {
  const srcVideos = src.querySelectorAll('video')
  const dstVideos = dst.querySelectorAll('video')
  const len = Math.min(srcVideos.length, dstVideos.length)
  for (let i = 0; i < len; i += 1) {
    const sv = srcVideos[i] as HTMLVideoElement
    const dv = dstVideos[i] as HTMLVideoElement
    const frameUrl = captureVideoFrameAsDataUrl(sv)
    if (!frameUrl) continue
    const videoSrc = unwrapProxyUrl(String(sv.getAttribute('src') || '').trim())
    const href = /^https?:\/\//i.test(videoSrc) ? videoSrc : ''
    try {
      dv.replaceWith(href ? createVideoEmbedPreview(frameUrl, sv.poster || 'video frame', href) : createImg(frameUrl, sv.poster || 'video frame'))
    } catch {
      void 0
    }
  }
}

const replaceVideoIframes = async (clone: Element): Promise<void> => {
  const iframes = clone.querySelectorAll('iframe')
  const tasks: Promise<void>[] = []
  for (let i = 0; i < iframes.length; i += 1) {
    const iframe = iframes[i] as HTMLIFrameElement
    const src = unwrapProxyUrl(String(iframe.getAttribute('src') || '').trim())
    if (!KNOWN_VIDEO_IFRAME_HOST_RE.test(src)) continue
    const ytId = extractYouTubeVideoId(src)
    const href = ytId ? `https://www.youtube.com/watch?v=${ytId}` : src
    tasks.push(
      (ytId ? resolveYouTubeThumbnail(ytId) : Promise.resolve('')).then((thumbUrl) => {
        try {
          const parent = iframe.parentElement
          const parentThumb = parent
            ? (parent.querySelector('img[data-kg-media-thumbnail="1"], img') as HTMLImageElement | null)
            : null
          const preferredFromParent = resolvePreferredThumbnailFromImage(parentThumb)
          const preferredThumb = pickPreferredThumbnailSource([preferredFromParent, thumbUrl]) || buildVideoFallbackSvgThumbnail(href)
          const container = iframe.parentElement
          if (container && container !== clone && container.children.length <= 2) {
            container.replaceWith(createVideoEmbedPreview(preferredThumb, `${inferPlatformLabel(href)} video`, href))
          } else {
            iframe.replaceWith(createVideoEmbedPreview(preferredThumb, `${inferPlatformLabel(href)} video`, href))
          }
        } catch {
          void 0
        }
      }),
    )
  }
  await Promise.all(tasks)
}

const freezeIframesToStaticThumbnails = async (src: Element, dst: Element): Promise<void> => {
  const srcIframes = src.querySelectorAll('iframe')
  const dstIframes = dst.querySelectorAll('iframe')
  const len = Math.min(srcIframes.length, dstIframes.length)
  const tasks: Promise<void>[] = []
  for (let i = 0; i < len; i += 1) {
    const srcIframe = srcIframes[i] as HTMLIFrameElement
    const dstIframe = dstIframes[i] as HTMLIFrameElement
    tasks.push(
      Promise.resolve().then(async () => {
        const iframeSrc = unwrapProxyUrl(String(srcIframe.getAttribute('src') || '').trim())
        const parentThumb = srcIframe.parentElement
          ? (srcIframe.parentElement.querySelector('img[data-kg-media-thumbnail="1"], img') as HTMLImageElement | null)
          : null
        let preferredThumb = pickPreferredThumbnailSource([resolvePreferredThumbnailFromImage(parentThumb)])
        if (!preferredThumb) {
          const ytId = extractYouTubeVideoId(iframeSrc)
          if (ytId) preferredThumb = await resolveYouTubeThumbnail(ytId)
        }
        if (!preferredThumb) preferredThumb = buildVideoFallbackSvgThumbnail(iframeSrc || 'about:blank')
        const href = /^https?:\/\//i.test(iframeSrc) ? iframeSrc : ''
        const replacement = href
          ? createVideoEmbedPreview(preferredThumb, `${inferPlatformLabel(href)} embed`, href)
          : createImg(preferredThumb, 'embedded content')
        try {
          const iframeClassName = String(dstIframe.getAttribute('class') || '').trim()
          if (iframeClassName) replacement.setAttribute('class', iframeClassName)
        } catch {
          void 0
        }
        try {
          const iframeStyle = String(dstIframe.getAttribute('style') || '').trim()
          if (iframeStyle) replacement.setAttribute('style', iframeStyle)
        } catch {
          void 0
        }
        try {
          dstIframe.replaceWith(replacement)
        } catch {
          void 0
        }
      }),
    )
  }
  await Promise.all(tasks)
}

const replaceYouTubeBrokenImgs = async (clone: Element): Promise<void> => {
  const imgs = clone.querySelectorAll('img')
  const tasks: Promise<void>[] = []
  for (let i = 0; i < imgs.length; i += 1) {
    const img = imgs[i] as HTMLImageElement
    const src = String(img.getAttribute('src') || '').trim()
    const ytId = extractYouTubeVideoId(src)
    if (!ytId) continue
    const watchUrl = `https://www.youtube.com/watch?v=${ytId}`
    tasks.push(
      resolveYouTubeThumbnail(ytId).then((thumbUrl) => {
        try {
          img.replaceWith(createVideoEmbedPreview(thumbUrl, `YouTube: ${ytId}`, watchUrl))
        } catch {
          void 0
        }
      }),
    )
  }
  await Promise.all(tasks)
}

const replaceYouTubeWebpageSnapshots = async (src: Element, clone: Element): Promise<void> => {
  const srcSnapshots = src.querySelectorAll('[data-kg-webpage-snapshot="1"]')
  const cloneSnapshots = clone.querySelectorAll('[data-kg-webpage-snapshot="1"]')
  const len = Math.min(srcSnapshots.length, cloneSnapshots.length)
  const tasks: Promise<void>[] = []
  for (let i = 0; i < len; i += 1) {
    const cs = cloneSnapshots[i] as HTMLElement
    const dataSrc = String(cs.getAttribute('data-src') || '').trim()
    const ytId = extractYouTubeVideoId(dataSrc)
    if (!ytId) continue
    const watchUrl = `https://www.youtube.com/watch?v=${ytId}`
    tasks.push(
      resolveYouTubeThumbnail(ytId).then((thumbUrl) => {
        try {
          cs.replaceWith(createVideoEmbedPreview(thumbUrl, `YouTube: ${ytId}`, watchUrl))
        } catch {
          void 0
        }
      }),
    )
  }
  await Promise.all(tasks)
}

const replaceVideoSnapshots = (src: Element, clone: Element): void => {
  const srcSnapshots = src.querySelectorAll('[data-kg-video-snapshot="1"]')
  const cloneSnapshots = clone.querySelectorAll('[data-kg-video-snapshot="1"]')
  const len = Math.min(srcSnapshots.length, cloneSnapshots.length)
  for (let i = 0; i < len; i += 1) {
    const ss = srcSnapshots[i] as HTMLElement
    const cs = cloneSnapshots[i] as HTMLElement
    const srcThumb = ss.querySelector('img[data-kg-media-thumbnail="1"]') as HTMLImageElement | null
    const videoSrc = unwrapProxyUrl(String(cs.getAttribute('data-src') || '').trim())
    const preferredThumb =
      pickPreferredThumbnailSource([resolvePreferredThumbnailFromImage(srcThumb)])
      || buildVideoFallbackSvgThumbnail(videoSrc)
    const href = /^https?:\/\//i.test(videoSrc) ? videoSrc : ''
    try {
      cs.replaceWith(href ? createVideoEmbedPreview(preferredThumb, videoSrc, href) : createImg(preferredThumb, videoSrc))
    } catch {
      void 0
    }
  }
}

const bakeWebpageSnapshotThumbnails = (src: Element, clone: Element): void => {
  const srcSnapshots = src.querySelectorAll('[data-kg-webpage-snapshot="1"]')
  const cloneSnapshots = clone.querySelectorAll('[data-kg-webpage-snapshot="1"]')
  const len = Math.min(srcSnapshots.length, cloneSnapshots.length)
  for (let i = 0; i < len; i += 1) {
    const ss = srcSnapshots[i] as HTMLElement
    const cs = cloneSnapshots[i] as HTMLElement
    const srcThumb = ss.querySelector('img[data-kg-media-thumbnail="1"]') as HTMLImageElement | null
    const cloneThumb = cs.querySelector('img[data-kg-media-thumbnail="1"]') as HTMLImageElement | null
    if (cloneThumb) {
      const preferredThumb = pickPreferredThumbnailSource([
        resolvePreferredThumbnailFromImage(srcThumb),
        String(cloneThumb.getAttribute('src') || '').trim(),
        String(cloneThumb.currentSrc || '').trim(),
      ])
      if (!preferredThumb) continue
      try {
        cloneThumb.setAttribute('src', preferredThumb)
        cloneThumb.removeAttribute('loading')
        cloneThumb.removeAttribute('decoding')
      } catch {
        void 0
      }
    }
  }
}

const stripLazyAttrs = (el: Element): void => {
  const media = el.querySelectorAll('img,video,iframe')
  for (let i = 0; i < media.length; i += 1) {
    try {
      media[i].removeAttribute('loading')
    } catch {
      void 0
    }
    try {
      media[i].removeAttribute('decoding')
    } catch {
      void 0
    }
  }
}

const markMarkdownDividerPageBreaks = (root: Element): void => {
  const hrs = root.querySelectorAll('hr')
  const hasFollowingContent = (node: Element): boolean => {
    let cursor: Element | null = node
    while (cursor && cursor !== root) {
      if (cursor.nextElementSibling) return true
      cursor = cursor.parentElement
    }
    return false
  }
  for (let i = 0; i < hrs.length; i += 1) {
    const hr = hrs[i] as HTMLElement
    if (!hasFollowingContent(hr)) continue
    try {
      hr.setAttribute('data-kg-hr', '1')
      const next = hr.nextElementSibling as HTMLElement | null
      if (!next || next.getAttribute('data-kg-page-break') !== '1') {
        const marker = document.createElement('div')
        marker.setAttribute('data-kg-page-break', '1')
        hr.insertAdjacentElement('afterend', marker)
      }
    } catch {
      void 0
    }
  }
}

const normalizePresentationDeckForPrint = (root: Element): void => {
  const deck = root.querySelector('[data-testid="markdown-presentation-print-deck"]')
  if (!deck) return
  const sections = Array.from(deck.querySelectorAll(':scope > section')) as HTMLElement[]
  try {
    deck.replaceChildren(...sections)
  } catch {
    void 0
  }
  const isMeaningful = (section: HTMLElement): boolean => {
    const article = section.querySelector(':scope > article') as HTMLElement | null
    const probe = article || section
    if (
      probe.querySelector(
        'img,video,iframe,svg,canvas,table,pre,code,blockquote,h1,h2,h3,h4,h5,h6,p,li,[data-kg-video-snapshot="1"],[data-kg-webpage-snapshot="1"]',
      )
    ) {
      return true
    }
    const text = String(probe.textContent || '').replace(/\u200B/g, '').trim()
    return text.length > 0
  }

  for (let i = sections.length - 1; i >= 0; i -= 1) {
    const section = sections[i]
    if (isMeaningful(section)) break
    try {
      section.remove()
    } catch {
      void 0
    }
  }
}

const forceRenderPendingMermaidGates = (el: HTMLElement): Promise<void> => {
  const pendingGates = el.querySelectorAll('[data-kg-mermaid-visibility-gate="pending"]')
  if (pendingGates.length === 0) return Promise.resolve()
  for (let i = 0; i < pendingGates.length; i += 1) {
    try {
      (pendingGates[i] as HTMLElement).scrollIntoView({ block: 'center', behavior: 'instant' })
    } catch {
      void 0
    }
  }
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 2_000)
  })
}

const waitForImagesToLoad = (root: HTMLElement, timeoutMs: number): Promise<void> => {
  const imgs = root.querySelectorAll('img')
  if (imgs.length === 0) return Promise.resolve()
  const pending = new Set<HTMLImageElement>()
  for (let i = 0; i < imgs.length; i += 1) {
    const img = imgs[i] as HTMLImageElement
    if (img.complete && img.naturalWidth > 0) continue
    pending.add(img)
  }
  if (pending.size === 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const onEach = (img: HTMLImageElement) => {
      pending.delete(img)
      if (pending.size === 0) finish()
    }
    for (const img of pending) {
      img.addEventListener('load', () => onEach(img), { once: true })
      img.addEventListener('error', () => onEach(img), { once: true })
    }
    setTimeout(finish, timeoutMs)
  })
}

const copyScrollableState = (src: HTMLElement, dst: HTMLElement): void => {
  try {
    dst.scrollTop = src.scrollTop
    dst.scrollLeft = src.scrollLeft
  } catch {
    void 0
  }
  const srcNodes = src.querySelectorAll('*')
  const dstNodes = dst.querySelectorAll('*')
  const len = Math.min(srcNodes.length, dstNodes.length)
  for (let i = 0; i < len; i += 1) {
    const srcNode = srcNodes[i] as HTMLElement
    const dstNode = dstNodes[i] as HTMLElement
    try {
      dstNode.scrollTop = srcNode.scrollTop
      dstNode.scrollLeft = srcNode.scrollLeft
    } catch {
      void 0
    }
  }
}

export type { PrintOrientation } from './printLayoutTokens'

export async function printElementToPdf(
  el: HTMLElement,
  args?: {
    title?: string
    orientation?: PrintOrientation
    horizontalInsetScale?: number
    verticalInsetScale?: number
    compactHorizontalContent?: boolean
    centerContent?: boolean
    fidelityMode?: 'balanced' | 'presentation-wysiwyg' | 'presentation-viewer-fidelity'
  },
): Promise<void> {
  try {
    if (typeof window === 'undefined') return
    if (!el) return
    const title = String(args?.title || 'Document')
    const prevTitle = document.title
    const printRootId = 'kg-print-root'
    const styleId = 'kg-print-style'

    const existingRoot = document.getElementById(printRootId)
    if (existingRoot) {
      try {
        existingRoot.remove()
      } catch {
        void 0
      }
    }
    const existingStyle = document.getElementById(styleId)
    if (existingStyle) {
      try {
        existingStyle.remove()
      } catch {
        void 0
      }
    }

    await waitForImagesToLoad(el, 8_000)

    try {
      await forceRenderPendingMermaidGates(el)
    } catch {
      void 0
    }

    const root = document.createElement('div')
    root.id = printRootId
    root.style.position = 'fixed'
    root.style.inset = '0'
    root.style.zIndex = '2147483647'
    root.style.background = 'white'
    root.style.overflow = 'auto'
    const orientation: PrintOrientation = args?.orientation === 'landscape' ? 'landscape' : 'portrait'
    const fidelityMode = args?.fidelityMode || 'balanced'
    const preservePresentationLayout =
      fidelityMode === 'presentation-wysiwyg' || fidelityMode === 'presentation-viewer-fidelity'
    const horizontalInsetScale = Number.isFinite(Number(args?.horizontalInsetScale)) && Number(args?.horizontalInsetScale) > 0
      ? Number(args?.horizontalInsetScale)
      : 1
    const verticalInsetScale = Number.isFinite(Number(args?.verticalInsetScale)) && Number(args?.verticalInsetScale) > 0
      ? Number(args?.verticalInsetScale)
      : 1
    const geometry = resolvePrintGeometryMm({
      orientation,
      horizontalInsetScale,
      verticalInsetScale,
      presentationVerticalInsetSymmetry: preservePresentationLayout,
    })
    const { effectiveInsetsMm: effectiveInsets, pageSizeMm, viewportMm, presentationSlideMm } = geometry
    const formatInsetCss = (insets: { top: number; right: number; bottom: number; left: number }): string =>
      `${insets.top}mm ${insets.right}mm ${insets.bottom}mm ${insets.left}mm`
    const pageMarginForCss = preservePresentationLayout
      ? {
          top: effectiveInsets.pageMarginMm.top + effectiveInsets.rootPaddingMm.top,
          right: effectiveInsets.pageMarginMm.right + effectiveInsets.rootPaddingMm.right,
          bottom: effectiveInsets.pageMarginMm.bottom + effectiveInsets.rootPaddingMm.bottom,
          left: effectiveInsets.pageMarginMm.left + effectiveInsets.rootPaddingMm.left,
        }
      : effectiveInsets.pageMarginMm
    const rootPaddingForCss = preservePresentationLayout
      ? { top: 0, right: 0, bottom: 0, left: 0 }
      : effectiveInsets.rootPaddingMm
    const pageMarginCss = formatInsetCss(pageMarginForCss)
    const rootPaddingCss = formatInsetCss(rootPaddingForCss)
    const pageSizeCss = `${pageSizeMm.widthMm}mm ${pageSizeMm.heightMm}mm`
    const mmToCssPx = (mm: number): number => (mm / 25.4) * 96
    const presentationSlideScale = mmToCssPx(presentationSlideMm.widthMm) / PRESENTATION_BASE_SLIDE_SIZE_PX.width
    // Stable section-height epsilon to avoid trailing blank pages from engine rounding drift.
    const presentationSectionHeightMm = Math.max(0, viewportMm.heightMm - 0.5)
    const compactHorizontalContent = Boolean(args?.compactHorizontalContent)
    const centerContent = Boolean(args?.centerContent)
    const allowMediaMutation = !preservePresentationLayout
    const freezePresentationMedia = preservePresentationLayout
    root.style.padding = rootPaddingCss

    const clone = el.cloneNode(true) as HTMLElement
    try {
      copyScrollableState(el, clone)
    } catch {
      void 0
    }

    try {
      annotateSourceImages(clone)
    } catch {
      void 0
    }
    try {
      stripLazyAttrs(clone)
    } catch {
      void 0
    }
    try {
      if (allowMediaMutation || freezePresentationMedia) bakeLoadedImages(el, clone)
    } catch {
      void 0
    }
    try {
      if (allowMediaMutation || freezePresentationMedia) bakeWebpageSnapshotThumbnails(el, clone)
    } catch {
      void 0
    }
    try {
      if (allowMediaMutation || freezePresentationMedia) replaceVideosWithFrames(el, clone)
    } catch {
      void 0
    }
    try {
      if (allowMediaMutation) await replaceVideoIframes(clone)
    } catch {
      void 0
    }
    try {
      if (freezePresentationMedia) await freezeIframesToStaticThumbnails(el, clone)
    } catch {
      void 0
    }
    try {
      if (allowMediaMutation) await replaceYouTubeBrokenImgs(clone)
    } catch {
      void 0
    }
    try {
      if (allowMediaMutation) await replaceYouTubeWebpageSnapshots(el, clone)
    } catch {
      void 0
    }
    try {
      if (allowMediaMutation) replaceVideoSnapshots(el, clone)
    } catch {
      void 0
    }
    try {
      stripLazyAttrs(clone)
    } catch {
      void 0
    }
    try {
      markMarkdownDividerPageBreaks(clone)
    } catch {
      void 0
    }
    try {
      if (preservePresentationLayout) normalizePresentationDeckForPrint(clone)
    } catch {
      void 0
    }
    try {
      if (!preservePresentationLayout) wrapImagesWithSourceLinks(clone)
    } catch {
      void 0
    }
    root.appendChild(clone)
    document.body.appendChild(root)
    await waitForImagesToLoad(root, 5_000)
    const presentationPaginationCss = preservePresentationLayout
      ? `
        #${printRootId} [data-testid="markdown-presentation-print-deck"] > section {
          margin: 0 !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: hidden !important;
          height: ${presentationSectionHeightMm}mm !important;
          min-height: ${presentationSectionHeightMm}mm !important;
          max-height: ${presentationSectionHeightMm}mm !important;
          width: ${viewportMm.widthMm}mm !important;
          min-width: ${viewportMm.widthMm}mm !important;
          max-width: ${viewportMm.widthMm}mm !important;
        }
        #${printRootId} [data-testid="markdown-presentation-print-deck"] [data-kg-hr="1"],
        #${printRootId} [data-testid="markdown-presentation-print-deck"] [data-kg-page-break="1"] {
          display: none !important;
          break-before: auto !important;
          page-break-before: auto !important;
          break-after: auto !important;
          page-break-after: auto !important;
        }
        #${printRootId} [data-testid="markdown-presentation-print-deck"] > section > article {
          border-color: transparent !important;
          box-shadow: none !important;
          margin: 0 !important;
          width: ${PRESENTATION_BASE_SLIDE_SIZE_PX.width}px !important;
          min-width: ${PRESENTATION_BASE_SLIDE_SIZE_PX.width}px !important;
          max-width: ${PRESENTATION_BASE_SLIDE_SIZE_PX.width}px !important;
          height: ${PRESENTATION_BASE_SLIDE_SIZE_PX.height}px !important;
          min-height: ${PRESENTATION_BASE_SLIDE_SIZE_PX.height}px !important;
          max-height: ${PRESENTATION_BASE_SLIDE_SIZE_PX.height}px !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          zoom: ${presentationSlideScale} !important;
        }
      `
      : ''
    const presentationLandscapeMediaFitCss =
      preservePresentationLayout && orientation === 'landscape'
        ? `
        #${printRootId} [data-testid="markdown-presentation-print-deck"] > section > article [aria-label="Slide Content"] {
          min-height: 0 !important;
          overflow: hidden !important;
        }
        #${printRootId} [data-testid="markdown-presentation-print-deck"] > section > article [aria-label="Slide Content"] figure {
          margin-top: 8px !important;
          margin-bottom: 8px !important;
          max-height: 100% !important;
        }
        #${printRootId} [data-testid="markdown-presentation-print-deck"] > section > article [aria-label="Slide Content"] img,
        #${printRootId} [data-testid="markdown-presentation-print-deck"] > section > article [aria-label="Slide Content"] [data-kg-media-thumbnail="1"] {
          max-height: calc(${presentationSectionHeightMm}mm - 24mm) !important;
          width: auto !important;
          object-fit: contain !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
      `
        : ''

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
        }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body > *:not(#${printRootId}) { display: none !important; }
        #${printRootId} {
          position: static !important;
          inset: auto !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: ${rootPaddingCss} !important;
          box-sizing: border-box !important;
        }
        ${preservePresentationLayout ? '' : `#${printRootId} section { overflow: visible !important; }`}
        ${preservePresentationLayout ? '' : `#${printRootId} svg { max-width: 100% !important; height: auto !important; }`}
        ${
          compactHorizontalContent
            ? `
        #${printRootId} [data-testid="markdown-preview-root"] { width: 100% !important; max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; }
        #${printRootId} article { width: 100% !important; max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; }
        #${printRootId} .mx-auto { margin-left: 0 !important; margin-right: 0 !important; }
      `
            : ''
        }
        ${
          centerContent
            ? `
        #${printRootId} { display: flex !important; justify-content: center !important; align-items: center !important; min-height: 100vh !important; }
        #${printRootId} > * { margin: auto !important; max-width: 100% !important; }
      `
            : ''
        }
        #${printRootId} [data-kg-mermaid-visibility-gate="pending"] { display: none !important; }
        #${printRootId} [data-testid="markdown-presentation-print-deck"] {
          display: block !important;
          width: ${viewportMm.widthMm}mm !important;
          min-width: ${viewportMm.widthMm}mm !important;
          max-width: ${viewportMm.widthMm}mm !important;
          margin: 0 auto !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }
        ${presentationPaginationCss}
        ${presentationLandscapeMediaFitCss}
        ${
          preservePresentationLayout
            ? `
        #${printRootId} [data-testid="markdown-presentation-print-deck"] > section > article [aria-label="Slide Document"] {
          height: 100% !important;
          min-height: 100% !important;
          max-height: 100% !important;
          position: relative !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }
        #${printRootId} [data-testid="markdown-presentation-print-deck"] > section > article img,
        #${printRootId} [data-testid="markdown-presentation-print-deck"] > section > article [data-kg-media-thumbnail="1"] {
          visibility: visible !important;
          opacity: 1 !important;
          display: block !important;
          max-width: 100% !important;
          height: auto !important;
          object-fit: contain !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        #${printRootId} [data-testid="markdown-presentation-print-deck"] [aria-label="Slide Document"] > footer {
          background-color: rgb(255 255 255) !important;
          opacity: 1 !important;
        }
      `
            : ''
        }
        ${
          preservePresentationLayout
            ? ''
            : `
        #${printRootId} [data-kg-hr="1"] { break-after: page; page-break-after: always; }
        #${printRootId} [data-kg-page-break="1"] { display: block !important; height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; break-before: page; page-break-before: always; }
      `
        }
        @page { margin: ${pageMarginCss}; size: ${pageSizeCss}; }
      }
    `
    document.head.appendChild(style)

    const cleanup = () => {
      try {
        document.title = prevTitle
      } catch {
        void 0
      }
      try {
        style.remove()
      } catch {
        void 0
      }
      try {
        root.remove()
      } catch {
        void 0
      }
      try {
        window.removeEventListener('afterprint', cleanup)
      } catch {
        void 0
      }
    }

    try {
      document.title = title
    } catch {
      void 0
    }

    try {
      window.addEventListener('afterprint', cleanup)
    } catch {
      void 0
    }

    try {
      window.focus()
    } catch {
      void 0
    }
    try {
      window.print()
    } catch {
      cleanup()
    }

    setTimeout(() => {
      cleanup()
    }, 30_000)
  } catch {
    void 0
  }
}
