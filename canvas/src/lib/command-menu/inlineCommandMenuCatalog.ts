export type InlineCommandMenuKind = 'slash' | 'variable'

export type InlineSlashCommandId =
  | 'heading'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet-list'
  | 'numbered-list'
  | 'quote'
  | 'code-block'
  | 'image'
  | 'video'
  | 'checklist'
  | 'divider'

export type InlineVariableCommandId =
  | 'browse-variable'
  | 'insert-reference'
  | 'new-variable'
  | 'inline-declaration'
  | 'insert-image'
  | 'insert-video'
  | 'image-reference'
  | 'video-reference'
  | 'edit-variable'
  | 'fallback-reference'
  | 'delete-variable'

export type InlineCommandMenuActionSpec<Id extends string = string> = {
  id: Id
  kind: InlineCommandMenuKind
  label: string
  group: string
  description: string
  keywords: readonly string[]
  danger?: boolean
}

export type ParsedInlineVariableCommandQuery = {
  mode: 'ref' | 'create' | 'fallback'
  key: string
  value: string
  fallback: string
}

export type InlineMediaKind = 'image' | 'video'

export type InlineMediaCommandCandidate = {
  id: string
  kind: InlineMediaKind
  url: string
  thumbnailUrl?: string
  label: string
  sourceKey?: string
  description: string
  keywords: string[]
}

export const INLINE_VARIABLE_KEY_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/

export const INLINE_MEDIA_COMMAND_ENTRY_LABELS = [
  'Image insertion',
  'Video insertion',
  'Image reference',
  'Video reference',
] as const

export const INLINE_MEDIA_VARIABLE_KEY_BY_ACTION_ID = {
  'image-reference': 'imageUrl',
  'video-reference': 'videoUrl',
} as const satisfies Partial<Record<InlineVariableCommandId, string>>

export const INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID = {
  'insert-image': 'image',
  'insert-video': 'video',
} as const satisfies Partial<Record<InlineVariableCommandId, 'image' | 'video'>>

export const INLINE_SLASH_COMMAND_ACTIONS: readonly InlineCommandMenuActionSpec<InlineSlashCommandId>[] = [
  {
    id: 'heading',
    kind: 'slash',
    label: 'Heading',
    group: 'Turn into',
    description: 'Convert this block to a heading',
    keywords: ['h2', 'title'],
  },
  {
    id: 'h1',
    kind: 'slash',
    label: 'H1',
    group: 'Headings',
    description: 'Turn current line into a level 1 heading',
    keywords: ['heading', 'title'],
  },
  {
    id: 'h2',
    kind: 'slash',
    label: 'H2',
    group: 'Headings',
    description: 'Turn current line into a level 2 heading',
    keywords: ['heading', 'title'],
  },
  {
    id: 'h3',
    kind: 'slash',
    label: 'H3',
    group: 'Headings',
    description: 'Turn current line into a level 3 heading',
    keywords: ['heading', 'title'],
  },
  {
    id: 'bullet-list',
    kind: 'slash',
    label: 'Bulleted list',
    group: 'Turn into',
    description: 'Turn current line into a bullet',
    keywords: ['list', 'ul'],
  },
  {
    id: 'numbered-list',
    kind: 'slash',
    label: 'Numbered list',
    group: 'Turn into',
    description: 'Turn current line into a numbered item',
    keywords: ['list', 'ol'],
  },
  {
    id: 'quote',
    kind: 'slash',
    label: 'Quote',
    group: 'Turn into',
    description: 'Turn current line into a quote',
    keywords: ['blockquote'],
  },
  {
    id: 'code-block',
    kind: 'slash',
    label: 'Code block',
    group: 'Insert',
    description: 'Wrap selection or current text in a fenced code block',
    keywords: ['fence', 'pre'],
  },
  {
    id: 'image',
    kind: 'slash',
    label: 'Image',
    group: 'Insert media',
    description: 'Insert an image embed placeholder',
    keywords: ['media', 'picture', 'imageUrl', 'asset'],
  },
  {
    id: 'video',
    kind: 'slash',
    label: 'Video',
    group: 'Insert media',
    description: 'Insert a video embed placeholder',
    keywords: ['media', 'clip', 'videoUrl', 'asset'],
  },
  {
    id: 'checklist',
    kind: 'slash',
    label: 'Checklist',
    group: 'Insert',
    description: 'Turn current line into a task item',
    keywords: ['task', 'todo'],
  },
  {
    id: 'divider',
    kind: 'slash',
    label: 'Divider',
    group: 'Insert',
    description: 'Insert a horizontal divider',
    keywords: ['hr', 'separator', 'rule'],
  },
] as const

export const INLINE_VARIABLE_COMMAND_ACTIONS: readonly InlineCommandMenuActionSpec<InlineVariableCommandId>[] = [
  {
    id: 'browse-variable',
    kind: 'variable',
    label: 'Browse variables',
    group: 'Actions',
    description: 'Reference an existing variable',
    keywords: ['reference', 'insert'],
  },
  {
    id: 'insert-reference',
    kind: 'variable',
    label: 'Insert reference',
    group: 'Actions',
    description: 'Type key to insert {{key}}',
    keywords: ['variable', 'reference'],
  },
  {
    id: 'new-variable',
    kind: 'variable',
    label: 'New variable',
    group: 'Actions',
    description: 'Create frontmatter variable',
    keywords: ['create', 'frontmatter'],
  },
  {
    id: 'inline-declaration',
    kind: 'variable',
    label: 'Inline declaration',
    group: 'Actions',
    description: 'Type key:value to insert {{key:value}}',
    keywords: ['create', 'define'],
  },
  {
    id: 'insert-image',
    kind: 'variable',
    label: 'Image',
    group: 'Insert media',
    description: 'Open image insertion from @ commands',
    keywords: ['image', 'media', 'insert', 'imageUrl', 'asset'],
  },
  {
    id: 'insert-video',
    kind: 'variable',
    label: 'Video',
    group: 'Insert media',
    description: 'Open video insertion from @ commands',
    keywords: ['video', 'media', 'insert', 'videoUrl', 'clip'],
  },
  {
    id: 'image-reference',
    kind: 'variable',
    label: 'Image reference',
    group: 'Media',
    description: 'Insert {{imageUrl}} for image-backed cards',
    keywords: ['image', 'imageUrl', 'media', 'asset'],
  },
  {
    id: 'video-reference',
    kind: 'variable',
    label: 'Video reference',
    group: 'Media',
    description: 'Insert {{videoUrl}} for video-backed cards',
    keywords: ['video', 'videoUrl', 'media', 'clip'],
  },
  {
    id: 'edit-variable',
    kind: 'variable',
    label: 'Edit key',
    group: 'Actions',
    description: 'Update a frontmatter variable',
    keywords: ['update', 'frontmatter'],
  },
  {
    id: 'fallback-reference',
    kind: 'variable',
    label: 'Fallback reference',
    group: 'Actions',
    description: 'Reference a variable with fallback text',
    keywords: ['fallback', 'default'],
  },
  {
    id: 'delete-variable',
    kind: 'variable',
    label: 'Delete variable',
    group: 'Actions',
    description: 'Remove frontmatter variable',
    keywords: ['remove'],
    danger: true,
  },
] as const

export function parseInlineVariableCommandQuery(query: string): ParsedInlineVariableCommandQuery {
  const raw = String(query || '').trim()
  const createIndex = raw.indexOf(':')
  if (createIndex > 0) {
    return {
      mode: 'create',
      key: raw.slice(0, createIndex).trim(),
      value: raw.slice(createIndex + 1).trim(),
      fallback: '',
    }
  }
  const fallbackIndex = raw.indexOf('|')
  if (fallbackIndex > 0) {
    return {
      mode: 'fallback',
      key: raw.slice(0, fallbackIndex).trim(),
      value: '',
      fallback: raw.slice(fallbackIndex + 1).trim(),
    }
  }
  return { mode: 'ref', key: raw, value: '', fallback: '' }
}

export function isInlineVariableKey(value: string): boolean {
  return INLINE_VARIABLE_KEY_PATTERN.test(String(value || '').trim())
}

const INLINE_MEDIA_URL_SOURCE_PATTERN = String.raw`(?:https?:\/\/|\/)[^\s"'<>),\]}]+`
const INLINE_MEDIA_URL_PATTERN = new RegExp(INLINE_MEDIA_URL_SOURCE_PATTERN, 'gi')
const INLINE_MEDIA_KEY_VALUE_PATTERN = new RegExp(String.raw`^\s*["']?([A-Za-z0-9_.-]{1,96})["']?\s*[:=]\s*["']?(${INLINE_MEDIA_URL_SOURCE_PATTERN})`, 'i')
const INLINE_IMAGE_KEY_PATTERN = /(image|img|thumbnail|poster|cover|still|artwork)/i
const INLINE_VIDEO_KEY_PATTERN = /(video|clip|movie|trailer|watch|playback|stream)/i
const INLINE_IMAGE_URL_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i
const INLINE_VIDEO_URL_PATTERN = /\.(?:m3u8|m4v|mov|mp4|mpeg|mpg|ogg|ogv|webm)(?:[?#].*)?$/i

function inferInlineMediaKind(key: string | undefined, url: string): InlineMediaKind | null {
  const sourceKey = String(key || '')
  if (INLINE_IMAGE_KEY_PATTERN.test(sourceKey)) return 'image'
  if (INLINE_VIDEO_KEY_PATTERN.test(sourceKey)) return 'video'
  let parsed: URL | null = null
  try {
    parsed = new URL(url)
  } catch {
    parsed = null
  }
  const host = parsed?.hostname.toLowerCase() || ''
  if (INLINE_IMAGE_URL_PATTERN.test(url) || host.includes('ytimg') || host.includes('image') || host.startsWith('img.')) return 'image'
  if (INLINE_VIDEO_URL_PATTERN.test(url) || host.includes('youtube.') || host === 'youtu.be' || host.includes('vimeo.')) return 'video'
  return null
}

function buildInlineMediaCandidateLabel(kind: InlineMediaKind, sourceKey: string | undefined, url: string): string {
  const key = String(sourceKey || '').trim()
  if (key) return `${kind === 'image' ? 'Image' : 'Video'}: ${key}`
  try {
    const parsed = new URL(url)
    const pathName = parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname
    return `${kind === 'image' ? 'Image' : 'Video'}: ${pathName}`
  } catch {
    return kind === 'image' ? 'Image URL' : 'Video URL'
  }
}

function readYoutubeVideoId(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || ''
    if (host.includes('youtube.')) return parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).at(-1) || ''
  } catch {
    return ''
  }
  return ''
}

function resolveInlineMediaThumbnailUrl(kind: InlineMediaKind, url: string): string | undefined {
  if (kind === 'image') return url
  const youtubeVideoId = readYoutubeVideoId(url)
  if (youtubeVideoId) return `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`
  return undefined
}

function normalizeInlineMediaUrl(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[.,;:]+$/g, '')
}

export function collectInlineMediaCommandCandidates(args: {
  sourceLines?: string[]
  draftText?: string
  limit?: number
}): InlineMediaCommandCandidate[] {
  const textParts = [
    Array.isArray(args.sourceLines) ? args.sourceLines.join('\n') : '',
    String(args.draftText || ''),
  ].filter(Boolean)
  const seen = new Set<string>()
  const candidates: InlineMediaCommandCandidate[] = []
  const limit = Number.isFinite(args.limit) && Number(args.limit) > 0 ? Number(args.limit) : 12
  for (const text of textParts) {
    const lines = String(text || '').split(/\r?\n/)
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex] || ''
      const keyValueMatch = INLINE_MEDIA_KEY_VALUE_PATTERN.exec(line)
      const sourceKey = keyValueMatch?.[1]
      const urls = new Set<string>()
      if (keyValueMatch?.[2]) urls.add(normalizeInlineMediaUrl(keyValueMatch[2]))
      for (const match of line.matchAll(INLINE_MEDIA_URL_PATTERN)) {
        urls.add(normalizeInlineMediaUrl(match[0]))
      }
      for (const url of urls) {
        if (!url) continue
        const kind = inferInlineMediaKind(sourceKey, url)
        if (!kind) continue
        const dedupeKey = `${kind}:${url}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        const label = buildInlineMediaCandidateLabel(kind, sourceKey, url)
        candidates.push({
          id: `media-${kind}-${lineIndex}-${candidates.length}`,
          kind,
          url,
          thumbnailUrl: resolveInlineMediaThumbnailUrl(kind, url),
          label,
          sourceKey,
          description: url,
          keywords: [kind, sourceKey, url].filter(Boolean) as string[],
        })
        if (candidates.length >= limit) return candidates
      }
    }
  }
  return candidates
}

export function buildInlineMediaEmbed(args: {
  kind: InlineMediaKind
  url?: string
  thumbnailUrl?: string
  selectedText?: string
  sourceKey?: string
}): string {
  const selected = String(args.selectedText || '').trim()
  const url = String(args.url || '').trim()
  if (args.kind === 'image') {
    const sourceKey = String(args.sourceKey || '').trim()
    const alt = (selected || (sourceKey ? sourceKey.replace(/Url$/i, '') : 'Image alt'))
      .replace(/[[\]\n\r]/g, ' ')
      .trim() || 'Image alt'
    return `![${alt}](${url || 'image-url'})`
  }
  const poster = String(args.thumbnailUrl || '').trim()
  const posterAttr = poster ? ` poster="${poster.replace(/"/g, '&quot;')}"` : ''
  return `<video src="${url || selected || 'video-url'}"${posterAttr} controls></video>`
}

export function getInlineCommandMenuCatalog() {
  return {
    slash: INLINE_SLASH_COMMAND_ACTIONS,
    variable: INLINE_VARIABLE_COMMAND_ACTIONS,
  } as const
}
