import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getMarkdownIt } from '@/features/markdown/markdownIt'

export function testMarkdownSuperscriptUsesRepoNativePlugin() {
  const html = getMarkdownIt().renderInline('E=mc^2^ and H~2~O')
  if (!html.includes('mc<sup>2</sup>')) {
    throw new Error(`expected repo-native Markdown superscript rendering, got ${JSON.stringify(html)}`)
  }
  if (!html.includes('H<sub>2</sub>O')) {
    throw new Error(`expected existing Markdown subscript rendering to remain active, got ${JSON.stringify(html)}`)
  }

  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  if (packageJson.dependencies?.['markdown-it-sup'] || packageJson.devDependencies?.['markdown-it-sup']) {
    throw new Error('expected Markdown superscript support to avoid the external markdown-it-sup dependency')
  }

  const markdownItSource = readFileSync(resolve(process.cwd(), 'src', 'features', 'markdown', 'markdownIt.ts'), 'utf8')
  if (markdownItSource.includes('markdown-it-sup')) {
    throw new Error('expected Markdown superscript support to use the in-repo plugin instead of markdown-it-sup')
  }
}

export function testMarkdownSuperscriptKeepsAmbiguousCaretsLiteral() {
  const md = getMarkdownIt()
  const examples = ['x^two words^', 'x^^', String.raw`x\^2^`]
  for (const example of examples) {
    const html = md.renderInline(example)
    if (html.includes('<sup>')) {
      throw new Error(`expected ambiguous superscript marker to stay literal for ${JSON.stringify(example)}, got ${JSON.stringify(html)}`)
    }
  }
}
