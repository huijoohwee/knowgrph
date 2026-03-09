import { slugify } from './markdownJsonLdUtils'
import { isYouTubeUrl } from '@/lib/url'

export interface BuilderContext {
  gid: string
  docId: string
  sourceUrl?: string
  mkMeta: (startLine: number, endLine: number) => Record<string, unknown>
}

export class MarkdownGraphBuilder {
  private nodeById = new Map<string, Record<string, unknown>>()
  private nodes: Record<string, unknown>[] = []
  private linkNodeIds = new Set<string>()
  private imageNodeIds = new Set<string>()
  private anchorNodeIds = new Set<string>()

  constructor(private ctx: BuilderContext) {}

  getNodes() {
    return this.nodes
  }

  ensureNode(node: Record<string, unknown>): void {
    const id = String(node['@id'] || '')
    if (!id) return
    if (this.nodeById.has(id)) return
    this.nodeById.set(id, node)
    this.nodes.push(node)
  }

  addRel(src: string, key: string, tgt: string): void {
    const node = this.nodeById.get(src)
    if (!node) return
    const cur = node[key]
    if (Array.isArray(cur)) {
      if (!cur.includes(tgt)) {
        cur.push(tgt)
      }
      return
    }
    if (typeof cur === 'string' && cur.trim()) {
      if (cur !== tgt) {
        node[key] = [cur, tgt]
      }
      return
    }
    node[key] = tgt
  }

  setNext(prev: string | null, next: string): void {
    if (!prev) return
    const node = this.nodeById.get(prev)
    if (!node) return
    if ((node as { next?: unknown }).next) return
    ;(node as { next?: unknown }).next = next
  }

  createDocumentNode(title: string, chunkText: string, props: Record<string, unknown>, meta: Record<string, unknown>) {
    this.ensureNode({
      '@id': this.ctx.docId,
      '@type': 'Document',
      labels: ['Document'],
      name: title,
      chunk_text: chunkText,
      properties: props,
      metadata: meta,
    })
  }

  createMermaidNode(
    id: string,
    code: string,
    meta: Record<string, unknown>,
    name?: string,
    opts?: { scope?: 'frontmatter' | 'block' },
  ) {
    const scope: 'frontmatter' | 'block' = opts?.scope === 'frontmatter' ? 'frontmatter' : 'block'
    this.ensureNode({
      '@id': id,
      '@type': 'MermaidDiagram',
      labels: ['MermaidDiagram'],
      name: name || 'Mermaid Diagram',
      chunk_text: code.slice(0, 800),
      properties: {
        code,
        format: 'graph',
        mermaidScope: scope,
        ...(scope === 'frontmatter' ? { isMermaidFrontmatter: true } : {}),
      },
      metadata: meta,
    })
    this.addRel(this.ctx.docId, 'hasMermaid', id)
  }

  createSectionNode(id: string, text: string, props: Record<string, unknown>, meta: Record<string, unknown>, parentId: string) {
    this.ensureNode({
      '@id': id,
      '@type': 'Section',
      labels: ['Section'],
      name: text,
      chunk_text: text,
      properties: props,
      metadata: meta,
    })
    this.addRel(parentId, 'hasSection', id)
  }

  createParagraphNode(id: string, text: string, props: Record<string, unknown>, meta: Record<string, unknown>, parentId: string) {
    this.ensureNode({
      '@id': id,
      '@type': 'Paragraph',
      labels: ['Paragraph'],
      name: props.name as string || 'Paragraph',
      chunk_text: text.slice(0, 800),
      properties: props,
      metadata: meta,
    })
    this.addRel(parentId, 'hasBlock', id)
  }

  createLinkNode(
    url: string,
    label: string | undefined,
    meta: Record<string, unknown>,
    parentId: string,
    opts?: { preferMedia?: boolean },
  ) {
    const linkId = `link:${slugify(url)}`
    if (!this.linkNodeIds.has(linkId)) {
      this.linkNodeIds.add(linkId)
      const mediaProps = (() => {
        try {
          if (isYouTubeUrl(url)) {
            const u = new URL(url)
            const id = (() => {
              const host = u.hostname.toLowerCase()
              if (host === 'youtu.be' || host === 'www.youtu.be') return u.pathname.replace(/^\/+/, '').trim()
              if (host === 'youtube.com' || host.endsWith('.youtube.com')) return String(u.searchParams.get('v') || '').trim()
              return ''
            })()
            if (!id) return null
            const parseStart = (raw: string): number | null => {
              const s = String(raw || '').trim()
              if (!s) return null
              if (/^\d+$/.test(s)) return Number(s)
              const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i)
              if (!m) return null
              const h = m[1] ? Number(m[1]) : 0
              const mm = m[2] ? Number(m[2]) : 0
              const sec = m[3] ? Number(m[3]) : 0
              const out = h * 3600 + mm * 60 + sec
              return out > 0 && Number.isFinite(out) ? out : null
            }
            const t = u.searchParams.get('t') || u.searchParams.get('start') || ''
            const start = parseStart(t)
            const q = start != null && Number.isFinite(start) && start > 0 ? `?start=${start}` : ''
            const embed = `https://www.youtube-nocookie.com/embed/${id}${q}`
            return {
              media_kind: 'iframe',
              iframe_url: embed,
              media_url: embed,
              media: embed,
              media_interactive: true,
              'visual:shape': 'rect',
            }
          }
          const u = new URL(url)
          const host = u.hostname.toLowerCase()
          const isX = host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')
          if (!isX) return null
          const m = u.pathname.match(/\/status\/(\d+)(?:\/|$)/)
          const id = m && m[1] ? m[1] : ''
          if (!id) return null
          const embed = `https://platform.twitter.com/embed/Tweet.html?id=${id}`
          return {
            media_kind: 'iframe',
            iframe_url: embed,
            media_url: embed,
            media: embed,
            media_interactive: true,
            'visual:shape': 'rect',
          }
        } catch {
          return null
        }
      })()
      const genericWebpageMediaProps = (() => {
        if (opts?.preferMedia !== true) return null
        const raw = String(url || '').trim()
        if (!/^https?:\/\//i.test(raw)) return null
        if (/\.(png|jpe?g|gif|webp|svg|mp4|webm|ogg|mp3|wav|m4a|aac|flac|pdf)(\?|#|$)/i.test(raw)) return null
        return {
          media_kind: 'iframe',
          iframe_url: raw,
          media_url: raw,
          media: raw,
          media_interactive: true,
          'visual:shape': 'rect',
        }
      })()
      this.ensureNode({
        '@id': linkId,
        '@type': 'Link',
        labels: ['Link'],
        name: label || url,
        chunk_text: (label || url).slice(0, 800),
        properties: { url, label, ...(mediaProps || genericWebpageMediaProps || {}) },
        metadata: meta,
      })
    }
    this.addRel(parentId, 'linksTo', linkId)
  }

  createImageNode(id: string, type: string, name: string, chunkText: string, props: Record<string, unknown>, meta: Record<string, unknown>, parentId: string) {
    if (!this.imageNodeIds.has(id)) {
      this.imageNodeIds.add(id)
      this.ensureNode({
        '@id': id,
        '@type': type,
        labels: [type],
        name,
        chunk_text: chunkText,
        properties: props,
        metadata: meta,
      })
      this.addRel(parentId, 'embedsImage', id)
    }
  }

  createCodeBlockNode(id: string, name: string, chunkText: string, props: Record<string, unknown>, meta: Record<string, unknown>, parentId: string) {
    this.ensureNode({
      '@id': id,
      '@type': 'CodeBlock',
      labels: ['CodeBlock'],
      name,
      chunk_text: chunkText,
      properties: props,
      metadata: meta,
    })
    this.addRel(parentId, 'hasBlock', id)
  }

  createTableNode(id: string, name: string, chunkText: string, props: Record<string, unknown>, meta: Record<string, unknown>, parentId: string) {
    this.ensureNode({
      '@id': id,
      '@type': 'Table',
      labels: ['Table'],
      name,
      chunk_text: chunkText,
      properties: props,
      metadata: meta,
    })
    this.addRel(parentId, 'hasBlock', id)
  }

  createListNode(id: string, name: string, chunkText: string, props: Record<string, unknown>, meta: Record<string, unknown>, parentId: string) {
    this.ensureNode({
      '@id': id,
      '@type': 'List',
      labels: ['List'],
      name,
      chunk_text: chunkText,
      properties: props,
      metadata: meta,
    })
    this.addRel(parentId, 'hasBlock', id)
  }

  createListItemNode(id: string, name: string, chunkText: string, props: Record<string, unknown>, meta: Record<string, unknown>, parentId: string) {
    this.ensureNode({
      '@id': id,
      '@type': 'ListItem',
      labels: ['ListItem'],
      name,
      chunk_text: chunkText,
      properties: props,
      metadata: meta,
    })
    this.addRel(parentId, 'hasItem', id)
  }

  createAnchorNode(id: string, name: string, props: Record<string, unknown>, meta: Record<string, unknown>) {
    if (this.anchorNodeIds.has(id)) return
    this.anchorNodeIds.add(id)
    this.ensureNode({
      '@id': id,
      '@type': 'Anchor',
      labels: ['Anchor'],
      name,
      chunk_text: name,
      properties: props,
      metadata: meta,
    })
    this.addRel(this.ctx.docId, 'hasAnchor', id)
  }

  createInternalLinkNode(id: string, name: string, props: Record<string, unknown>, meta: Record<string, unknown>) {
    if (!this.linkNodeIds.has(id)) {
      this.linkNodeIds.add(id)
      this.ensureNode({
        '@id': id,
        '@type': 'InternalLink',
        labels: ['InternalLink'],
        name,
        chunk_text: name.slice(0, 800),
        properties: props,
        metadata: meta,
      })
    }
    this.addRel(this.ctx.docId, 'hasInternalLink', id)
  }

  hasAnchor(id: string) {
    return this.anchorNodeIds.has(id)
  }
}
