import {
  containsFrontmatterMermaid,
  normalizeMermaidMmdToMarkdown,
  readMermaidDiagramKind,
  splitMermaidDiagrams,
} from 'grph-shared/markdown/mermaidInput'

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

export function testReadMermaidDiagramKindDetectsGitGraph() {
  const code = ['gitGraph:', '  commit id:"root"', '  branch feature'].join('\n')
  if (readMermaidDiagramKind(code) !== 'gitgraph') {
    throw new Error('Expected gitGraph Mermaid kind to be detected')
  }
}

export function testReadMermaidDiagramKindSkipsMermaidConfigHeader() {
  const code = ['---', 'config:', '  theme: default', '---', 'gitGraph', '  commit'].join('\n')
  if (readMermaidDiagramKind(code) !== 'gitgraph') {
    throw new Error('Expected Mermaid config header to be skipped before GitGraph detection')
  }
}

export function testSplitMermaidDiagramsKeepsGitGraphSlicesSeparate() {
  const code = ['flowchart LR', '  A --> B', 'gitGraph', '  commit', '  branch feature'].join('\n')
  const diagrams = splitMermaidDiagrams(code)
  if (diagrams.length !== 2) {
    throw new Error(`Expected two Mermaid diagrams, got ${diagrams.length}`)
  }
  if (diagrams[0]?.kind !== 'flowchart' || diagrams[1]?.kind !== 'gitgraph') {
    throw new Error('Expected Flowchart and GitGraph diagram slices')
  }

  const configured = [
    '---',
    'config:',
    '  flowchart:',
    '    curve: basis',
    '---',
    'gitGraph',
    '  commit id:"root"',
  ].join('\n')
  const configuredDiagrams = splitMermaidDiagrams(configured)
  if (configuredDiagrams.length !== 1 || configuredDiagrams[0]?.kind !== 'gitgraph') {
    throw new Error('Expected Mermaid config header keys to be skipped during diagram splitting')
  }
  if (!configuredDiagrams[0]?.code.startsWith('---')) {
    throw new Error('Expected Mermaid config header to stay attached to its GitGraph slice')
  }
}
