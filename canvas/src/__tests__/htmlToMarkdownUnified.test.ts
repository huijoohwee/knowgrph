import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'

export async function testHtmlToMarkdownUnifiedConvertsBasicHtml() {
  const res = await convertHtmlToMarkdownUnified({
    html: [
      '<h1>Hello</h1>',
      '<p>World</p>',
      '<a href="/docs">Docs</a>',
      '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>',
      '<iframe src="https://example.com/embed"></iframe>',
      '<details open><summary>More</summary><p>Details body</p></details>',
    ].join(''),
    baseUrl: 'https://example.com/',
  })
  if (res.ok !== true) throw new Error(`expected ok, got error: ${(res as { error?: unknown }).error || ''}`)
  const md = res.markdown
  if (!md.includes('# Hello')) throw new Error('expected heading')
  if (!md.toLowerCase().includes('world')) throw new Error('expected paragraph')
  if (!md.includes('(https://example.com/docs)')) throw new Error('expected resolved link')
  if (md.includes('<svg')) throw new Error('expected svg to be stripped')
  if (md.includes('<iframe')) throw new Error('expected iframe to be converted to markdown')
  if (!md.includes('https://example.com/embed')) throw new Error('expected iframe src preserved')
  if (!md.includes('Details body')) throw new Error('expected details body preserved')
}

export async function testHtmlToMarkdownUnifiedHeadOnlyRendersHeadSection() {
  const res = await convertHtmlToMarkdownUnified({
    html: [
      '<title>How to build your seed round pitch deck</title>',
      '<base href="https://www.ycombinator.com/" />',
      '<meta name="description" content="YC Startup Library" />',
      '<link rel="canonical" href="/library/2u-how-to-build-your-seed-round-pitch-deck" />',
    ].join('\n'),
    includeHeadSection: true,
  })
  if (res.ok !== true) throw new Error(`expected ok, got error: ${(res as { error?: unknown }).error || ''}`)
  const md = res.markdown
  if (!md.includes('## HTML Head')) throw new Error('expected head section')
  if (!md.includes('How to build your seed round pitch deck')) throw new Error('expected title in head section')
  if (!md.includes('https://www.ycombinator.com/library/2u-how-to-build-your-seed-round-pitch-deck')) {
    throw new Error('expected canonical resolved via base')
  }
}

export async function testHtmlToMarkdownUnifiedPreservesPreCodeIndentation() {
  const res = await convertHtmlToMarkdownUnified({
    html: ['<pre><code># print(&quot;Exception when calling api: %s\\n&quot; % e)', '        pass', '</code></pre>'].join('\n'),
  })
  if (res.ok !== true) throw new Error(`expected ok, got error: ${(res as { error?: unknown }).error || ''}`)
  const md = res.markdown
  if (!md.includes('```')) throw new Error('expected fenced code block')
  if (!md.includes('# print("Exception when calling api: %s\\n" % e)')) {
    throw new Error(`expected code line preserved, got:\n${md}`)
  }
  if (!md.includes('\n        pass\n')) throw new Error('expected indentation preserved')
}

export async function testHtmlToMarkdownUnifiedPreservesChineseText() {
  const s = '通过 ChatGPT 免费套餐和 Go 套餐免费试用 Codex；其他所有套餐的用户可限时享受双倍速率额度。'
  const res = await convertHtmlToMarkdownUnified({
    html: `<p>${s}</p>`,
  })
  if (res.ok !== true) throw new Error(`expected ok, got error: ${(res as { error?: unknown }).error || ''}`)
  const md = res.markdown
  if (!md.includes(s)) throw new Error('expected chinese text preserved')
}

export async function testHtmlToMarkdownUnifiedUsesBaseTagForLinkResolution() {
  const base = 'https://api.byteplus.com/api-sdk/view?serviceCode=ecs'
  const res = await convertHtmlToMarkdownUnified({
    html: [
      `<head><base href="${base}" /></head>`,
      '<a href="#print">Anchor</a>',
      '<a href="/api-sdk/view?serviceCode=ecs">Abs</a>',
    ].join('\n'),
  })
  if (res.ok !== true) throw new Error(`expected ok, got error: ${(res as { error?: unknown }).error || ''}`)
  const md = res.markdown
  if (!md.includes(`(${base}#print)`)) {
    throw new Error('expected anchor resolved against base href')
  }
  if (!md.includes('(https://api.byteplus.com/api-sdk/view?serviceCode=ecs)')) {
    throw new Error('expected absolute-path link resolved against base href origin')
  }
}

export async function testHtmlToMarkdownUnifiedPreservesNoscriptContent() {
  const res = await convertHtmlToMarkdownUnified({
    html: ['<noscript>', '<h2>Fallback</h2>', '<p>Rendered without JS</p>', '</noscript>'].join('\n'),
  })
  if (res.ok !== true) throw new Error(`expected ok, got error: ${(res as { error?: unknown }).error || ''}`)
  const md = res.markdown
  if (!md.includes('Fallback')) throw new Error('expected noscript heading preserved')
  if (!md.includes('Rendered without JS')) throw new Error('expected noscript paragraph preserved')
}

export async function testHtmlToMarkdownUnifiedParsesFullHtmlDocument() {
  const html =
    '<!doctype html><html><head><title>Test Page</title></head><body><h1>Source Faithful Heading</h1><p>First section</p></body></html>'
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://grapesjs.com/pricing',
    fidelityLevel: 4,
    includeHeadSection: true,
  })
  if (res.ok !== true) throw new Error(`expected ok, got error: ${(res as { error?: unknown }).error || ''}`)
  if (!res.markdown.includes('# Source Faithful Heading')) throw new Error('expected h1 conversion from full document html')
}

export async function testHtmlToMarkdownUnifiedRemovesHeadingPermalinkSvgAnchor() {
  const url = 'https://www.citriniresearch.com/p/2028gic'
  const html = [
    '<h1>',
    '<strong>Preface</strong>',
    `<a class="headerlink" href="${url}" aria-label="Permalink">`,
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="24"></svg>',
    '</a>',
    '</h1>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: url,
    fidelityLevel: 4,
    includeImages: true,
    includeHeadSection: false,
    maxInputChars: 200_000,
  })
  if (res.ok !== true) throw new Error(`expected ok, got error: ${(res as { error?: unknown }).error || ''}`)
  const md = res.markdown
  if (!md.includes('# **Preface**')) throw new Error(`expected heading text preserved, got: ${md.slice(0, 200)}`)
  if (/data:image\/svg\+xml;base64,/i.test(md)) throw new Error('expected heading permalink svg to be removed')
  if (new RegExp(`\\(${url.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\)`).test(md)) {
    throw new Error(`expected heading permalink link to be removed, got:\n${md}`)
  }
}

export async function testHtmlToMarkdownUnifiedRemovesHeadingHashAnchorIconOnly() {
  const html = [
    '<h2 id="preface">',
    'Preface',
    '<a href="#preface" class="hash-link" title="Direct link to heading">',
    '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" aria-hidden="true"></svg>',
    '</a>',
    '</h2>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://example.invalid/',
    fidelityLevel: 4,
    includeImages: true,
    includeHeadSection: false,
    maxInputChars: 200_000,
  })
  if (res.ok !== true) throw new Error(`expected ok, got error: ${(res as { error?: unknown }).error || ''}`)
  const md = res.markdown
  if (!md.includes('## Preface')) throw new Error(`expected heading text preserved, got: ${md.slice(0, 200)}`)
  if (/data:image\/svg\+xml;base64,/i.test(md)) throw new Error('expected heading hash icon to be removed')
  if (/\(#preface\)/.test(md)) throw new Error('expected heading hash link to be removed')
}
