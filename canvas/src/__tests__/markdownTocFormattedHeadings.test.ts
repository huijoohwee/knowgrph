import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { buildTocTree } from '@/features/markdown/ui/markdownSectionUtils'

export function testMarkdownTocIncludesFormattedHeadingText() {
  const markdown = ['# **Preface**', '', '## A', '', '### B', '', '## C', ''].join('\n')
  const tokens = lexMarkdown(markdown).tokens
  const toc = buildTocTree(tokens)
  if (toc.length !== 1) throw new Error(`expected 1 root toc item, got ${toc.length}`)
  const root = toc[0]!
  if (root.text !== 'Preface') throw new Error(`expected root heading text "Preface", got "${root.text}"`)
  if (root.depth !== 1) throw new Error(`expected depth 1, got ${root.depth}`)
  if (root.children.length !== 2) throw new Error(`expected 2 h2 children, got ${root.children.length}`)
  if (root.children[0]?.text !== 'A') throw new Error('expected first child "A"')
  if (root.children[0]?.children[0]?.text !== 'B') throw new Error('expected A to have child "B"')
  if (root.children[1]?.text !== 'C') throw new Error('expected second child "C"')
}

export function testMarkdownTocIncludesHeadingsWithUnicodeSpacesAfterHashes() {
  const nbsp = '\u00A0'
  const markdown = [`# Title`, '', `##${nbsp}**Macro Memo**`, '', `###${nbsp}**The Consequences of Abundant Intelligence**`, ''].join('\n')
  const tokens = lexMarkdown(markdown).tokens
  const toc = buildTocTree(tokens)
  if (toc.length !== 1) throw new Error(`expected 1 root toc item, got ${toc.length}`)
  const root = toc[0]!
  if (root.children.length < 1) throw new Error('expected Macro Memo to appear in TOC')
  if (!root.children.some(c => c.text === 'Macro Memo')) {
    throw new Error(`expected Macro Memo in TOC, got: ${root.children.map(c => c.text).join(', ')}`)
  }
  const macro = root.children.find(c => c.text === 'Macro Memo')!
  if (!macro.children.some(c => c.text === 'The Consequences of Abundant Intelligence')) {
    throw new Error('expected Consequences to appear under Macro Memo')
  }
}

export function testMarkdownTocIncludesHeadingsWithUnicodeLeadingWhitespace() {
  const nbsp = '\u00A0'
  const markdown = [`# Title`, '', `${nbsp}## **Macro Memo**`, '', `${nbsp}### **The Consequences of Abundant Intelligence**`, ''].join('\n')
  const tokens = lexMarkdown(markdown).tokens
  const toc = buildTocTree(tokens)
  if (toc.length !== 1) throw new Error(`expected 1 root toc item, got ${toc.length}`)
  const root = toc[0]!
  if (!root.children.some(c => c.text === 'Macro Memo')) throw new Error('expected Macro Memo in TOC')
  const macro = root.children.find(c => c.text === 'Macro Memo')!
  if (!macro.children.some(c => c.text === 'The Consequences of Abundant Intelligence')) throw new Error('expected Consequences in TOC')
}

export function testMarkdownTocIncludesStandaloneHtmlHeadings() {
  const markdown = ['# Title', '', '<h2><strong>Macro Memo</strong></h2>', '', '<h3>The Consequences of Abundant Intelligence</h3>', ''].join('\n')
  const tokens = lexMarkdown(markdown).tokens
  const toc = buildTocTree(tokens)
  if (toc.length !== 1) throw new Error(`expected 1 root toc item, got ${toc.length}`)
  const root = toc[0]!
  if (!root.children.some(c => c.text === 'Macro Memo')) throw new Error('expected Macro Memo from html heading in TOC')
  const macro = root.children.find(c => c.text === 'Macro Memo')!
  if (!macro.children.some(c => c.text === 'The Consequences of Abundant Intelligence')) throw new Error('expected Consequences from html heading in TOC')
}
