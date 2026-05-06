const captureVideoFrameAsDataUrl = (video: HTMLVideoElement): string | null => {
  try {
    if (!video.videoWidth || !video.videoHeight) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
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
    `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${ytId}/sddefault.jpg`,
    `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
  ]
  return new Promise<string>((resolve) => {
    let settled = false
    const finish = (url: string) => {
      if (settled) return
      settled = true
      resolve(url)
    }
    for (const url of candidates) {
      const probe = new Image()
      probe.onload = () => finish(url)
      probe.onerror = () => { void 0 }
      probe.src = url
    }
    setTimeout(() => finish(candidates[candidates.length - 1]), 4_000)
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

const replaceYouTubeIframes = async (clone: Element): Promise<void> => {
  const iframes = clone.querySelectorAll('iframe')
  const tasks: Promise<void>[] = []
  for (let i = 0; i < iframes.length; i += 1) {
    const iframe = iframes[i] as HTMLIFrameElement
    const src = String(iframe.getAttribute('src') || '').trim()
    const ytId = extractYouTubeVideoId(src)
    if (!ytId) continue
    const watchUrl = `https://www.youtube.com/watch?v=${ytId}`
    tasks.push(
      resolveYouTubeThumbnail(ytId).then((thumbUrl) => {
        try {
          const container = iframe.parentElement
          if (container && container !== clone && container.children.length <= 2) {
            container.replaceWith(createVideoEmbedPreview(thumbUrl, `YouTube: ${ytId}`, watchUrl))
          } else {
            iframe.replaceWith(createVideoEmbedPreview(thumbUrl, `YouTube: ${ytId}`, watchUrl))
          }
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
    if (!srcThumb) continue
    const dataUrl = captureImageAsDataUrl(srcThumb)
    if (!dataUrl) continue
    const videoSrc = unwrapProxyUrl(String(cs.getAttribute('data-src') || '').trim())
    const href = /^https?:\/\//i.test(videoSrc) ? videoSrc : ''
    try {
      cs.replaceWith(href ? createVideoEmbedPreview(dataUrl, videoSrc, href) : createImg(dataUrl, videoSrc))
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
    if (!srcThumb) continue
    const dataUrl = captureImageAsDataUrl(srcThumb)
    if (!dataUrl) continue
    const cloneThumb = cs.querySelector('img[data-kg-media-thumbnail="1"]') as HTMLImageElement | null
    if (cloneThumb) {
      try {
        cloneThumb.setAttribute('src', dataUrl)
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

export type PrintOrientation = 'portrait' | 'landscape'

export async function printElementToPdf(el: HTMLElement, args?: { title?: string; orientation?: PrintOrientation }): Promise<void> {
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
    root.style.padding = '14mm'

    const clone = el.cloneNode(true) as HTMLElement

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
      bakeLoadedImages(el, clone)
    } catch {
      void 0
    }
    try {
      bakeWebpageSnapshotThumbnails(el, clone)
    } catch {
      void 0
    }
    try {
      replaceVideosWithFrames(el, clone)
    } catch {
      void 0
    }
    try {
      await replaceYouTubeIframes(clone)
    } catch {
      void 0
    }
    try {
      await replaceYouTubeBrokenImgs(clone)
    } catch {
      void 0
    }
    try {
      await replaceYouTubeWebpageSnapshots(el, clone)
    } catch {
      void 0
    }
    try {
      replaceVideoSnapshots(el, clone)
    } catch {
      void 0
    }
    try {
      stripLazyAttrs(clone)
    } catch {
      void 0
    }
    try {
      wrapImagesWithSourceLinks(clone)
    } catch {
      void 0
    }
    root.appendChild(clone)
    document.body.appendChild(root)

    await waitForImagesToLoad(root, 5_000)

    const isLandscape = args?.orientation === 'landscape'
    const pageSize = isLandscape ? '16in 9in' : '9in 16in'
    const pageMargin = isLandscape
      ? '12mm 18mm 12mm 18mm'
      : '18mm 12mm 18mm 12mm'

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body > *:not(#${printRootId}) { display: none !important; }
        #${printRootId} { position: static !important; inset: auto !important; overflow: visible !important; padding: 0 !important; }
        #${printRootId} section { overflow: visible !important; }
        #${printRootId} svg { max-width: 100% !important; height: auto !important; }
        #${printRootId} [data-kg-mermaid-visibility-gate="pending"] { display: none !important; }
        #${printRootId} [data-kg-hr="1"] { break-after: page; }
        @page { margin: ${pageMargin}; size: ${pageSize}; }
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
