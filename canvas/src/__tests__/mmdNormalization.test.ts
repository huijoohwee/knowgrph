import { containsFrontmatterMermaid, normalizeMermaidMmdToMarkdown } from 'grph-shared/markdown/mermaidInput'

export function testNormalizeMermaidMmdToMarkdownWrapsPlainMermaid() {
  const name = 'demo.mmd'
  const raw = 'graph TB\nA-->B\n'
  const normalized = normalizeMermaidMmdToMarkdown(name, raw)
  if (!normalized.startsWith('```mermaid\n')) {
    throw new Error('Expected .mmd to be wrapped in mermaid fence')
  }
  if (!normalized.includes('graph TB')) {
    throw new Error('Expected original mermaid content to be preserved')
  }
  if (!normalized.trimEnd().endsWith('```')) {
    throw new Error('Expected mermaid fence to close')
  }
}

export function testNormalizeMermaidMmdToMarkdownKeepsFencedMarkdown() {
  const name = 'demo.mmd'
  const raw = '```mermaid\ngraph TB\nA-->B\n```\n'
  const normalized = normalizeMermaidMmdToMarkdown(name, raw)
  if (normalized !== raw) {
    throw new Error('Expected fenced markdown to remain unchanged')
  }
}

export function testContainsFrontmatterMermaidDetectsLF() {
  const text = ['---', 'title: Demo', 'mermaid: true', '---', '', '# Hello'].join('\n')
  if (!containsFrontmatterMermaid(text)) {
    throw new Error('Expected LF frontmatter mermaid to be detected')
  }
}

export function testContainsFrontmatterMermaidDetectsCRLF() {
  const text = ['---', 'title: Demo', 'mermaid: true', '---', '', '# Hello'].join('\r\n')
  if (!containsFrontmatterMermaid(text)) {
    throw new Error('Expected CRLF frontmatter mermaid to be detected')
  }
}
