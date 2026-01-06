import type { JSONValue } from '@/lib/graph/types'
import { isJsonValue } from '@/lib/graph/jsonValue'

export function parseHtmlToMarkdown(html: string): string {
  const raw = String(html || '')
  if (looksLikeRssOrAtom(raw)) {
    const rssMarkdown = parseRssOrAtomToMarkdown(raw)
    if (rssMarkdown.trim()) {
      return rssMarkdown.trim()
    }
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'text/html')
  const root = pickPrimaryContentRoot(doc)
  return traverseNode(root).trim()
}

export function extractJsonLd(html: string): JSONValue[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  return Array.from(scripts)
    .map(s => {
      try {
        const parsed = JSON.parse(s.textContent || '{}') as unknown
        return isJsonValue(parsed) ? parsed : null
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function traverseNode(node: Node, options: { isPre?: boolean; isTable?: boolean } = {}): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || ''
    return options.isPre ? text : text.replace(/\s+/g, ' ')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const el = node as HTMLElement
  const tagName = el.tagName.toLowerCase()

  if (tagName === 'script' || tagName === 'style' || tagName === 'noscript' || tagName === 'svg') {
    return ''
  }

  const isPre = options.isPre || tagName === 'pre'
  const isTable = options.isTable || tagName === 'table'

  let content = ''
  el.childNodes.forEach(child => {
    content += traverseNode(child, { isPre, isTable })
  })

  switch (tagName) {
    case 'h1':
      return `# ${content.trim()}\n\n`
    case 'h2':
      return `## ${content.trim()}\n\n`
    case 'h3':
      return `### ${content.trim()}\n\n`
    case 'h4':
      return `#### ${content.trim()}\n\n`
    case 'h5':
      return `##### ${content.trim()}\n\n`
    case 'h6':
      return `###### ${content.trim()}\n\n`
    case 'p':
      return `${content.trim()}\n\n`
    case 'ul':
    case 'ol':
      return `${content}\n`
    case 'li':
      return `* ${content.trim()}\n`
    case 'a': {
      const href = el.getAttribute('href')
      return href ? `[${content.trim()}](${href})` : content
    }
    case 'strong':
    case 'b':
      return `**${content.trim()}**`
    case 'em':
    case 'i':
      return `*${content.trim()}*`
    case 'br':
      return '\n'
    case 'hr':
      return '\n---\n\n'
    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'header':
    case 'footer':
    case 'nav':
    case 'aside':
      return `${content}\n`
    case 'details':
      return `<details>\n${content}\n</details>\n`
    case 'summary':
      return `<summary>${content.trim()}</summary>\n`
    case 'pre':
      return `\n\`\`\`\n${content}\n\`\`\`\n\n`
    case 'code':
      if (options.isPre) return content
      return `\`${content.trim()}\``
    case 'blockquote':
      return `> ${content.trim()}\n\n`
    case 'img': {
      const src = pickImageSrc(el)
      const alt = el.getAttribute('alt') || ''
      return src ? `![${alt}](${src})` : ''
    }
    case 'iframe':
    case 'video':
      return `\n${el.outerHTML}\n\n`
    case 'table':
      return `\n${content}\n`
    case 'tr':
      return `| ${content.trim()} |\n`
    case 'td':
    case 'th':
      return `${content.trim()} | `
    case 'dl':
      return `${content}\n`
    case 'dt':
      return `**${content.trim()}**\n`
    case 'dd':
      return `: ${content.trim()}\n`
    default:
      return content
  }
}

function looksLikeRssOrAtom(html: string): boolean {
  const text = String(html || '').slice(0, 4000).toLowerCase()
  if (!text.trim()) return false
  if (text.includes('<rss') || text.includes('<rdf') || text.includes('<feed')) return true
  return false
}

function pickPrimaryContentRoot(doc: Document): HTMLElement {
  const main = doc.querySelector('main')
  if (main) return main as HTMLElement
  const article = doc.querySelector('article')
  if (article) return article as HTMLElement
  return doc.body
}

function pickImageSrc(el: HTMLElement): string {
  const src = String(el.getAttribute('src') || '').trim()
  if (src) return src
  const dataSrc = String(el.getAttribute('data-src') || el.getAttribute('data-original') || '').trim()
  if (dataSrc) return dataSrc
  const srcSet = String(el.getAttribute('srcset') || '').trim()
  if (!srcSet) return ''
  const first = srcSet.split(',')[0] || ''
  const url = first.trim().split(/\s+/)[0] || ''
  return url.trim()
}

function htmlFragmentToMarkdown(fragment: string): string {
  const raw = String(fragment || '').trim()
  if (!raw) return ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'text/html')
  return traverseNode(doc.body).trim()
}

function parseRssOrAtomToMarkdown(xmlText: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'application/xml')
    const root = doc.documentElement
    if (!root) return ''
    const rootName = root.nodeName.toLowerCase()
    if (rootName === 'rss' || rootName === 'rdf' || rootName === 'rdf:rdf') {
      return parseRssDocumentToMarkdown(doc)
    }
    if (rootName === 'feed') {
      return parseAtomFeedToMarkdown(doc)
    }
    return ''
  } catch {
    return ''
  }
}

function getTextContent(parent: ParentNode | null, selector: string): string {
  if (!parent) return ''
  const el = parent.querySelector(selector)
  if (!el) return ''
  return (el.textContent || '').trim()
}

function parseRssDocumentToMarkdown(doc: Document): string {
  const parts: string[] = []
  const channel = doc.querySelector('channel') || doc.documentElement
  const channelTitle = getTextContent(channel, 'title')
  const channelDescription = getTextContent(channel, 'description')

  if (channelTitle) {
    parts.push(`# ${channelTitle}\n`)
  }
  if (channelDescription) {
    parts.push(`${channelDescription}\n`)
  }

  const items = channel ? Array.from(channel.querySelectorAll('item')) : []
  for (const item of items) {
    const title = getTextContent(item, 'title')
    const link = getTextContent(item, 'link')
    const pubDate = getTextContent(item, 'pubDate')
    const guid = getTextContent(item, 'guid')
    const description = getTextContent(item, 'description')
    const contentEncoded =
      getTextContent(item, 'content\\:encoded') || getTextContent(item, 'encoded')

    const heading = title || link || guid || ''
    if (heading) {
      parts.push(`\n## ${heading}\n`)
    }

    if (link) {
      const label = title || link
      parts.push(`[${label}](${link})\n`)
    } else if (guid) {
      parts.push(guid + '\n')
    }

    if (pubDate) {
      parts.push(`\n${pubDate}\n`)
    }

    const bodySource = contentEncoded || description
    if (bodySource) {
      const bodyMd = htmlFragmentToMarkdown(bodySource)
      if (bodyMd.trim()) {
        parts.push('\n' + bodyMd + '\n')
      }
    }

    parts.push('\n---\n')
  }

  return parts.join('\n')
}

function parseAtomFeedToMarkdown(doc: Document): string {
  const parts: string[] = []
  const feed = doc.documentElement
  const feedTitle = getTextContent(feed, 'title')
  const feedSubtitle = getTextContent(feed, 'subtitle')

  if (feedTitle) {
    parts.push(`# ${feedTitle}\n`)
  }
  if (feedSubtitle) {
    parts.push(`${feedSubtitle}\n`)
  }

  const entries = Array.from(feed.querySelectorAll('entry'))
  for (const entry of entries) {
    const title = getTextContent(entry, 'title')
    const summary = getTextContent(entry, 'summary')
    const content = getTextContent(entry, 'content')
    let link = ''
    const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link[href]')
    if (linkEl) {
      link = String(linkEl.getAttribute('href') || '').trim()
    }
    const updated = getTextContent(entry, 'updated') || getTextContent(entry, 'published')

    const heading = title || link || ''
    if (heading) {
      parts.push(`\n## ${heading}\n`)
    }

    if (link) {
      const label = title || link
      parts.push(`[${label}](${link})\n`)
    }

    if (updated) {
      parts.push(`\n${updated}\n`)
    }

    const bodySource = content || summary
    if (bodySource) {
      const bodyMd = htmlFragmentToMarkdown(bodySource)
      if (bodyMd.trim()) {
        parts.push('\n' + bodyMd + '\n')
      }
    }

    parts.push('\n---\n')
  }

  return parts.join('\n')
}
