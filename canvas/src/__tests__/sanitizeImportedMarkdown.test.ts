import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'

export const testSanitizeImportedMarkdownRemovesBase64FenceLines = () => {
  const input = ['# Doc', '', '```', 'iVBORw0KGgo' + 'A'.repeat(400), '```', ''].join('\n')
  const out = sanitizeImportedMarkdownText(input)
  if (!out.changed) throw new Error('expected changed')
  if (!out.text.includes('<omitted>')) throw new Error('expected <omitted>')
}

export const testSanitizeImportedMarkdownRemovesDataImageBase64 = () => {
  const input = '![x](data:image/png;base64,' + 'A'.repeat(2048) + ')'
  const out = sanitizeImportedMarkdownText(input)
  if (!out.changed) throw new Error('expected changed')
  if (!out.text.includes('data:,')) throw new Error('expected data:,')
}

export const testSanitizeImportedMarkdownAllowsSmallSvgDataImageBase64 = () => {
  const input = '![x](data:image/svg+xml;base64,' + 'A'.repeat(50) + ')'
  const out = sanitizeImportedMarkdownText(input)
  if (out.changed) throw new Error('expected unchanged for small svg data uri')
  if (!out.text.includes('data:image/svg+xml;base64,')) throw new Error('expected svg data uri preserved')
}

export const testSanitizeImportedMarkdownFixesBrokenImageSyntax = () => {
  const input = '! [Google](data:image/svg+xml;base64,' + 'A'.repeat(64) + ')'
  const out = sanitizeImportedMarkdownText(input)
  if (!out.text.startsWith('![Google](')) throw new Error(`expected fixed image syntax, got: ${out.text.slice(0, 40)}`)
}

export const testSanitizeImportedMarkdownRemovesImageInsideLinkLabelWhenTextExists = () => {
  const input =
    '[Astro 5.17 ![ri/arrow-right-line](data:image/svg+xml;base64,' +
    'A'.repeat(64) +
    ')](https://astro.build/blog/astro-5170/)'
  const out = sanitizeImportedMarkdownText(input)
  if (!out.text.includes('[Astro 5.17](https://astro.build/blog/astro-5170/)')) {
    throw new Error(`expected simplified link label, got: ${out.text}`)
  }
  if (out.text.includes('data:image/svg+xml;base64,')) throw new Error('expected image removed from link label')
}

export const testSanitizeImportedMarkdownDropsDecorativeInlineSvgHtml = () => {
  const input = [
    '<svg width="0.89em" height="1em" aria-hidden="true" data-icon="ri/eye-line">',
    '  <use href="#x"></use>',
    '</svg>',
  ].join('\n')
  const out = sanitizeImportedMarkdownText(input)
  if (!out.changed) throw new Error('expected changed')
  if (out.text.includes('<svg')) throw new Error('expected decorative svg html to be dropped')
}

export const testSanitizeImportedMarkdownConvertsLabeledInlineSvgHtmlToImage = () => {
  const input = [
    '<svg aria-label="Google" viewBox="0 0 10 10" width="10" height="10">',
    '  <circle cx="5" cy="5" r="4"></circle>',
    '</svg>',
  ].join('\n')
  const out = sanitizeImportedMarkdownText(input)
  if (!out.text.startsWith('![Google](data:image/svg+xml;base64,')) {
    throw new Error(`expected svg to convert to markdown image, got: ${out.text.slice(0, 80)}`)
  }
}

export const testSanitizeImportedMarkdownNormalizesMultilineSvgDataUri = () => {
  const input = '![Google](data:image/svg+xml;base64,\n' + 'A'.repeat(50) + '\n)'
  const out = sanitizeImportedMarkdownText(input)
  if (!out.text.includes('![Google](data:image/svg+xml;base64,')) throw new Error('expected svg data uri preserved')
  if (/\n/.test(out.text)) throw new Error('expected normalized to single-line markdown')
}

export const testSanitizeImportedMarkdownCapsLargeMultilineSvgDataUri = () => {
  const input = '![Google](data:image/svg+xml;base64,\n' + 'A'.repeat(50_000) + '\n)'
  const out = sanitizeImportedMarkdownText(input)
  if (!out.changed) throw new Error('expected changed')
  const m = out.text.match(/!\[Google\]\(data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)\)/)
  if (!m) throw new Error(`expected capped to svg base64 placeholder, got: ${out.text.slice(0, 120)}`)
  if ((m[1] || '').length > 100) throw new Error('expected svg base64 payload to be capped to <= 100 chars')
}

export const testSanitizeImportedMarkdownCapsLargeInlineSvgHtmlConversion = () => {
  const big = 'A'.repeat(9000)
  const input = ['<svg aria-label="Big" viewBox="0 0 10 10" width="10" height="10">', `<text>${big}</text>`, '</svg>'].join('\n')
  const out = sanitizeImportedMarkdownText(input)
  if (!out.changed) throw new Error('expected changed')
  const m = out.text.match(/!\[Big\]\(data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)\)/)
  if (!m) throw new Error(`expected capped svg base64 placeholder, got: ${out.text.slice(0, 120)}`)
  if ((m[1] || '').length > 100) throw new Error('expected svg base64 payload to be capped to <= 100 chars')
}

export const testSanitizeImportedMarkdownDropsGenericLargeInlineSvgHtmlConversion = () => {
  const big = 'A'.repeat(9000)
  const input = ['<svg aria-label="插图" viewBox="0 0 10 10" width="10" height="10">', `<text>${big}</text>`, '</svg>'].join('\n')
  const out = sanitizeImportedMarkdownText(input)
  if (!out.changed) throw new Error('expected changed')
  if (/data:image\/svg\+xml/i.test(out.text) || /!\[插图\]/.test(out.text)) {
    throw new Error(`expected generic omitted svg placeholder to be dropped, got: ${out.text.slice(0, 120)}`)
  }
}

export const testSanitizeImportedMarkdownAppendsSourceLinkForOmittedSvg = () => {
  const input = '![Google](data:image/svg+xml;base64,' + 'A'.repeat(50_000) + ')'
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: 'https://astro.build/' })
  if (!out.changed) throw new Error('expected changed')
  if (!/\(\[source\]\(https:\/\/astro\.build\/\)\)/.test(out.text)) {
    throw new Error(`expected source link appended, got: ${out.text.slice(0, 200)}`)
  }
}

export const testSanitizeImportedMarkdownStripsHeadingPermalinkArtifacts = () => {
  const url = 'https://www.citriniresearch.com/p/2028gic'
  const input = `# **Preface**![](data:image/svg+xml;base64,${'A'.repeat(2000)}) (${url})`
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: url })
  if (!out.changed) throw new Error('expected changed')
  if (/data:image\/svg\+xml;base64,/i.test(out.text)) throw new Error('expected svg data uri removed from heading')
  if (new RegExp(`\\(${url.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\)`).test(out.text)) {
    throw new Error(`expected permalink url removed from heading, got: ${out.text}`)
  }
  if (!out.text.startsWith('# **Preface**')) throw new Error(`expected heading preserved, got: ${out.text}`)
}

export const testSanitizeImportedMarkdownNormalizesSubstackHeadingTree = () => {
  const url = 'https://example.com/post'
  const input = [
    '# THE 2028 GLOBAL INTELLIGENCE CRISIS',
    '',
    '### A Thought Exercise in Financial History, from the Future',
    '',
    '# **Preface**',
    '',
    '# **Macro Memo**',
    '',
    '## **The Consequences of Abundant Intelligence**',
    '',
  ].join('\n')
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: url })
  if (!out.changed) throw new Error('expected changed')
  if (!out.text.includes('# THE 2028 GLOBAL INTELLIGENCE CRISIS')) throw new Error('expected title preserved as H1')
  if (!out.text.includes('### A Thought Exercise in Financial History, from the Future')) throw new Error('expected subtitle preserved')
  if (!out.text.includes('## **Preface**')) throw new Error(`expected Preface demoted to H2, got: ${out.text}`)
  if (!out.text.includes('## **Macro Memo**')) throw new Error(`expected Macro Memo demoted to H2, got: ${out.text}`)
  if (!out.text.includes('### **The Consequences of Abundant Intelligence**')) {
    throw new Error(`expected Consequences demoted to H3, got: ${out.text}`)
  }
}

export const testSanitizeImportedMarkdownNormalizesAtxHeadingWeirdSpaces = () => {
  const nbsp = '\u00A0'
  const input = [`#${nbsp}**Macro Memo**`, '', `##${nbsp}**The Consequences**`, ''].join('\n')
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: 'https://example.com' })
  if (!out.changed) throw new Error('expected changed')
  if (!out.text.includes('# **Macro Memo**')) throw new Error(`expected nbsp heading to be normalized, got: ${out.text}`)
  if (!out.text.includes('## **The Consequences**')) throw new Error(`expected nbsp heading to be normalized, got: ${out.text}`)
}

export const testSanitizeImportedMarkdownConvertsStandaloneImageAutolinkToMarkdownImage = () => {
  const input = ['<https://example.com/a.jpeg>', '', '<https://example.com/not-an-image>', ''].join('\n')
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: 'https://example.com' })
  if (!out.changed) throw new Error('expected changed')
  if (!out.text.includes('![](https://example.com/a.jpeg)')) throw new Error(`expected autolink jpeg to be converted, got: ${out.text}`)
  if (!out.text.includes('<https://example.com/not-an-image>')) throw new Error('expected non-image autolink to remain')
}

export const testSanitizeImportedMarkdownConvertsStandaloneHtmlHeadingToAtx = () => {
  const input = ['<h2><strong>Macro Memo</strong></h2>', '', '<h3> The Consequences </h3>', ''].join('\n')
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: 'https://example.com' })
  if (!out.changed) throw new Error('expected changed')
  if (!out.text.includes('## **Macro Memo**')) throw new Error(`expected h2 to become markdown heading, got: ${out.text}`)
  if (!out.text.includes('### The Consequences')) throw new Error(`expected h3 to become markdown heading, got: ${out.text}`)
}

export const testSanitizeImportedMarkdownConvertsStandaloneHtmlTableToMarkdownTable = () => {
  const input = [
    '<table node="[object Object]" class="w-full">',
    '  <thead>',
    '    <tr><th node="[object Object]">Name</th><th>Value</th></tr>',
    '  </thead>',
    '  <tbody>',
    '    <tr><td>Alpha</td><td>One</td></tr>',
    '    <tr><td>Beta</td><td>Two</td></tr>',
    '  </tbody>',
    '</table>',
    '',
  ].join('\n')
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: 'https://example.com' })
  if (!out.changed) throw new Error('expected changed')
  if (/<table\b/i.test(out.text)) throw new Error(`expected raw table html removed, got: ${out.text}`)
  if (/\[object Object\]/.test(out.text)) throw new Error(`expected leaked object attrs removed, got: ${out.text}`)
  if (!out.text.includes('| Name | Value |')) throw new Error(`expected markdown table header, got: ${out.text}`)
  if (!out.text.includes('| Alpha | One |')) throw new Error(`expected first markdown table row, got: ${out.text}`)
  if (!out.text.includes('| Beta | Two |')) throw new Error(`expected second markdown table row, got: ${out.text}`)
}

export const testSanitizeImportedMarkdownConvertsInteractiveHtmlDivBlockToPlainText = () => {
  const input = [
    '<div role="button" tabindex="0" aria-disabled="false" class="mx-auto mt-3 flex w-full items-center justify-between gap-3 rounded-xl bg-secondary-button px-4 py-3 transition-colors cursor-pointer hover:bg-active" style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;gap:12px">',
    '  <div class="flex flex-col" style="display:flex;flex-direction:column">',
    '    <div class="text-sm font-medium text-secondary">Web report</div>',
    '    <div class="text-xs text-secondary">View / share web report</div>',
    '  </div>',
    '  <div class="flex items-center gap-2 text-xs text-secondary" style="display:flex;flex-direction:row;align-items:center;gap:8px">Click to view</div>',
    '</div>',
    '',
  ].join('\n')
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: 'https://example.com' })
  if (!out.changed) throw new Error('expected changed')
  if (/<div\b/i.test(out.text)) throw new Error(`expected raw div html removed, got: ${out.text}`)
  if (!out.text.includes('Web report')) throw new Error(`expected title text preserved, got: ${out.text}`)
  if (!out.text.includes('View / share web report')) throw new Error(`expected detail text preserved, got: ${out.text}`)
  if (!out.text.includes('Click to view')) throw new Error(`expected CTA text preserved, got: ${out.text}`)
}

export const testSanitizeImportedMarkdownDropsEmptyMediaAndJavascriptLinks = () => {
  const input = [
    '[赣州市文化馆](javascript:void\\(0\\);)******![]()在小说阅读器读本章去阅读![]()',
    '',
    '[safe](https://example.com)',
    '',
  ].join('\n')
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: 'https://mp.weixin.qq.com/s/test' })
  if (!out.changed) throw new Error('expected changed')
  if (/javascript:/i.test(out.text)) throw new Error(`expected javascript link href removed, got: ${out.text}`)
  if (/!\[[^\]]*\]\(\s*\)/.test(out.text)) throw new Error(`expected empty image markers removed, got: ${out.text}`)
  if (!out.text.includes('赣州市文化馆')) throw new Error(`expected link label text preserved, got: ${out.text}`)
  if (!out.text.includes('[safe](https://example.com)')) throw new Error(`expected safe link preserved, got: ${out.text}`)
}
