const captureVideoFrameAsDataUrl = (video: HTMLVideoElement): string | null => {
  try {
    if (!video.videoWidth || !video.videoHeight) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

const replaceVideoWithFrameImage = (src: Element, dst: Element): void => {
  const srcVideos = src.querySelectorAll('video')
  const dstVideos = dst.querySelectorAll('video')
  const len = Math.min(srcVideos.length, dstVideos.length)
  for (let i = 0; i < len; i += 1) {
    const sv = srcVideos[i] as HTMLVideoElement
    const dv = dstVideos[i] as HTMLVideoElement
    const frameUrl = captureVideoFrameAsDataUrl(sv)
    if (!frameUrl) continue
    const img = document.createElement('img')
    img.src = frameUrl
    img.style.width = '100%'
    img.style.maxWidth = '100%'
    img.style.height = 'auto'
    img.style.display = 'block'
    const poster = sv.poster
    if (poster) img.alt = poster
    try {
      dv.replaceWith(img)
    } catch {
      void 0
    }
  }
}

const YOUTUBE_ID_RE = /(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]+)/i
const PROXY_URL_RE = /^\/__(?:media|webpage)_proxy\?url=(.+)$/i

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

const createYouTubeThumbnailImg = (videoId: string): HTMLImageElement => {
  const img = document.createElement('img')
  img.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  img.alt = `YouTube: ${videoId}`
  img.style.width = '100%'
  img.style.maxWidth = '100%'
  img.style.height = 'auto'
  img.style.display = 'block'
  img.style.objectFit = 'contain'
  return img
}

const collectYouTubeIdsFromElement = (el: Element): Set<string> => {
  const ids = new Set<string>()
  const addIfYouTube = (url: string) => {
    const id = extractYouTubeVideoId(url)
    if (id) ids.add(id)
  }
  try {
    const allAttrs = el.querySelectorAll('[src],[data-src],[href]')
    for (let i = 0; i < allAttrs.length; i += 1) {
      const node = allAttrs[i]
      addIfYouTube(String(node.getAttribute('src') || ''))
      addIfYouTube(String(node.getAttribute('data-src') || ''))
      addIfYouTube(String(node.getAttribute('href') || ''))
    }
  } catch {
    void 0
  }
  try {
    const html = el.innerHTML || ''
    const matches = html.matchAll(/(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]+)/gi)
    for (const m of matches) {
      if (m[1]) ids.add(m[1])
    }
  } catch {
    void 0
  }
  return ids
}

const replaceYouTubeContainersInClone = (clone: Element, ytIds: Set<string>): void => {
  if (ytIds.size === 0) return
  for (const ytId of ytIds) {
    const embedPattern = `youtube.com/embed/${ytId}`
    const shortPattern = `youtu.be/${ytId}`
    const proxyPattern = encodeURIComponent(`youtu.be/${ytId}`)

    const iframes = clone.querySelectorAll('iframe')
    for (let i = 0; i < iframes.length; i += 1) {
      const iframe = iframes[i] as HTMLIFrameElement
      const src = String(iframe.getAttribute('src') || '').trim()
      if (src.includes(embedPattern) || src.includes(shortPattern) || src.includes(proxyPattern)) {
        try {
          iframe.replaceWith(createYouTubeThumbnailImg(ytId))
        } catch {
          void 0
        }
      }
    }

    const imgs = clone.querySelectorAll('img')
    for (let i = 0; i < imgs.length; i += 1) {
      const img = imgs[i] as HTMLImageElement
      const src = String(img.getAttribute('src') || '').trim()
      if (src.includes(shortPattern) || src.includes(proxyPattern) || src.includes(embedPattern)) {
        try {
          img.replaceWith(createYouTubeThumbnailImg(ytId))
        } catch {
          void 0
        }
      }
    }

    const anchors = clone.querySelectorAll('a')
    for (let i = 0; i < anchors.length; i += 1) {
      const a = anchors[i] as HTMLAnchorElement
      const href = String(a.getAttribute('href') || '').trim()
      if (href.includes(shortPattern) || href.includes(embedPattern)) {
        const container = a.closest('section,div,figure,p') || a.parentElement
        if (container && container !== clone) {
          const hasIframe = container.querySelector('iframe')
          const hasImg = container.querySelector('img')
          if (!hasIframe && !hasImg) {
            try {
              a.replaceWith(createYouTubeThumbnailImg(ytId))
            } catch {
              void 0
            }
          }
        }
      }
    }
  }
}

const ensureMediaAttrs = (src: Element, dst: Element): void => {
  const srcAll = src.querySelectorAll('img,video,source')
  const dstAll = dst.querySelectorAll('img,video,source')
  const len = Math.min(srcAll.length, dstAll.length)
  for (let i = 0; i < len; i += 1) {
    const s = srcAll[i] as Element
    const d = dstAll[i] as Element
    const tag = String(s.tagName || '').toLowerCase()
    if (tag === 'img') {
      const si = s as HTMLImageElement
      const di = d as HTMLImageElement
      const url = String(si.currentSrc || si.src || di.getAttribute('src') || '').trim()
      if (url) {
        try {
          di.setAttribute('src', url)
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
      continue
    }
    if (tag === 'video' || tag === 'source') {
      const url = String((s as HTMLMediaElement).currentSrc || (s as HTMLMediaElement).src || d.getAttribute('src') || '').trim()
      if (url) {
        try {
          d.setAttribute('src', url)
        } catch {
          void 0
        }
      }
    }
  }
}

const makeMediaEager = (el: Element): void => {
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

export async function printElementToPdf(el: HTMLElement, args?: { title?: string }): Promise<void> {
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

    const root = document.createElement('div')
    root.id = printRootId
    root.style.position = 'fixed'
    root.style.inset = '0'
    root.style.zIndex = '2147483647'
    root.style.background = 'white'
    root.style.overflow = 'auto'
    root.style.padding = '14mm'

    const ytIds = collectYouTubeIdsFromElement(el)

    const clone = el.cloneNode(true) as HTMLElement
    try {
      ensureMediaAttrs(el, clone)
    } catch {
      void 0
    }
    try {
      replaceVideoWithFrameImage(el, clone)
    } catch {
      void 0
    }
    try {
      replaceYouTubeContainersInClone(clone, ytIds)
    } catch {
      void 0
    }
    try {
      makeMediaEager(clone)
    } catch {
      void 0
    }
    root.appendChild(clone)
    document.body.appendChild(root)

    await waitForImagesToLoad(root, 5_000)

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body > *:not(#${printRootId}) { display: none !important; }
        #${printRootId} { position: static !important; inset: auto !important; overflow: visible !important; padding: 0 !important; }
        @page { margin: 14mm; }
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
