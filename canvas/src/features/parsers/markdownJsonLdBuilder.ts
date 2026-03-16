import { slugify } from './markdownJsonLdUtils'
import { inferMediaKindFromResourceUrl, prefersIframeFromLinkContext } from '@/lib/graph/mediaUrlKind'
import { buildBilibiliEmbedUrl, buildTwitterEmbedUrl, buildVimeoEmbedUrl, buildYouTubeEmbedUrl } from 'grph-shared/rich-media/providers'

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
        const embed =
          buildYouTubeEmbedUrl(url, { noCookie: true, includeOrigin: false }) ||
          buildTwitterEmbedUrl(url) ||
          buildVimeoEmbedUrl(url) ||
          buildBilibiliEmbedUrl(url)
        if (!embed) return null
        return {
          media_kind: 'iframe',
          iframe_url: embed,
          media_url: embed,
          media: embed,
          media_interactive: true,
          'visual:shape': 'rect',
        }
      })()
      const inlineLinkMediaProps = (() => {
        const raw = String(url || '').trim()
        if (!raw) return null
        const kind = inferMediaKindFromResourceUrl(raw)
        if (kind === 'image' || kind === 'svg') {
          return {
            media_kind: kind,
            media_url: raw,
            media: raw,
            image: raw,
            'visual:shape': 'rect',
          }
        }
        if (kind === 'video') {
          return {
            media_kind: 'video',
            media_url: raw,
            media: raw,
            video: raw,
            media_interactive: true,
            'visual:shape': 'rect',
          }
        }
        if (kind === 'iframe') {
          return {
            media_kind: 'iframe',
            iframe_url: raw,
            media_url: raw,
            media: raw,
            media_interactive: true,
            'visual:shape': 'rect',
          }
        }
        return null
      })()
      const genericWebpageMediaProps = (() => {
        if (!prefersIframeFromLinkContext({ label, url, preferMedia: opts?.preferMedia === true })) return null
        const raw = String(url || '').trim()
        if (!/^https?:\/\//i.test(raw) && !/^\/__repo_file\//i.test(raw)) return null
        if (inlineLinkMediaProps) return null
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
        properties: { url, label, ...(mediaProps || inlineLinkMediaProps || genericWebpageMediaProps || {}) },
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
