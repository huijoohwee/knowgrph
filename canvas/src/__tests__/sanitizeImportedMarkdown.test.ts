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

export const testSanitizeImportedMarkdownConvertsArticleLayoutSectionToMarkdown = () => {
  const mediaA = '/__webpage_asset_path/jYcEgFfQU8HKybU_Ss9Dbw/640?wx_fmt=png&from=appmsg'
  const mediaB = '/__webpage_asset_path/jYcEgFfQU8HKybU_Ss9Dbw/640?wx_fmt=jpeg&from=appmsg'
  const input = [
    '<section style="text-align:center;justify-content:center;display:flex;flex-flow:row nowrap;" powered-by="xiumi.us"><section><section><img class="rich_pages wxw-img" data-src="' +
      mediaA +
      '" src="data:image/svg+xml,%3Csvg width=\'1px\' height=\'1px\' viewBox=\'0 0 1 1\'%3E%3C/svg%3E"/></section><section><p><strong>作品赏析</strong></p><p>赣州是客家先民中原南迁的第一站。</p></section><section><img alt="长卷局部" data-src="' +
      mediaB +
      '" src="' +
      mediaB +
      '"/></section></section></section>',
    '',
  ].join('\n')
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: 'https://mp.weixin.qq.com/s/jYcEgFfQU8HKybU_Ss9Dbw' })
  if (!out.changed) throw new Error('expected changed')
  if (/<section\b|<img\b/i.test(out.text)) throw new Error(`expected raw layout html removed, got: ${out.text}`)
  if (out.text.split(/\r?\n/g).some(line => line.length > 1000)) throw new Error(`expected no long raw html lines, got: ${out.text}`)
  if (!out.text.includes(`![](${mediaA})`)) throw new Error(`expected first layout image preserved as markdown, got: ${out.text}`)
  if (!out.text.includes(`![长卷局部](${mediaB})`)) throw new Error(`expected second layout image preserved as markdown, got: ${out.text}`)
  if (!out.text.includes('## 作品赏析')) throw new Error(`expected strong section caption promoted to heading, got: ${out.text}`)
  if (!out.text.includes('赣州是客家先民中原南迁的第一站。')) throw new Error(`expected body text preserved, got: ${out.text}`)
}

export const testSanitizeImportedMarkdownFinetunesArticleMarkdownStructure = () => {
  const input = [
    '---',
    'kgWebpageUrl: "https://example.com/article"',
    '---',
    '',
    '![](https://example.com/lead.png)',
    '',
    '**一幅讴歌客家先民的**',
    '',
    '**壮丽画卷**',
    '',
    '正文段落。![](https://example.com/inline.png)',
    '',
    '****![音符](https://example.com/music.gif)****',
    '',
    '****※****',
    '0;特别声明：文本****。****',
    '****\\',
    '****',
    '[相关阅读](https://example.com/next)\\',
    '',
    '往',
    '',
    '期',
    '',
    '推',
    '',
    '荐',
    '',
  ].join('\n')
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: 'https://example.com/article' })
  if (!out.changed) throw new Error('expected changed')
  if (!out.text.includes('# 一幅讴歌客家先民的 壮丽画卷')) throw new Error(`expected leading bold title as H1, got: ${out.text}`)
  if (/正文段落。!\[\]/.test(out.text)) throw new Error(`expected inline image split from prose, got: ${out.text}`)
  if (!out.text.includes('正文段落。\n\n![](https://example.com/inline.png)')) throw new Error(`expected prose before image, got: ${out.text}`)
  if (/\*{2,}!\[音符\]/.test(out.text)) throw new Error(`expected bold shell removed from standalone image, got: ${out.text}`)
  if (!out.text.includes('![音符](https://example.com/music.gif)')) throw new Error(`expected shell-wrapped image preserved, got: ${out.text}`)
  if (/0;特别声明|\*{4,}|※/.test(out.text)) throw new Error(`expected decoration residue removed, got: ${out.text}`)
  if (!out.text.includes('特别声明：文本。')) throw new Error(`expected declaration text preserved after cleanup, got: ${out.text}`)
  if (!out.text.includes('[相关阅读](https://example.com/next)\n')) throw new Error(`expected trailing link break removed, got: ${out.text}`)
  if (!out.text.includes('## 往期推荐')) throw new Error(`expected vertical heading run normalized, got: ${out.text}`)
}

export const testSanitizeImportedMarkdownConvertsInteractiveHtmlDivBlockToPlainText = () => {
  const input = [
    '<section role="button" tabindex="0" aria-disabled="false" class="mx-auto mt-3 flex w-full items-center justify-between gap-3 rounded-xl bg-secondary-button px-4 py-3 transition-colors cursor-pointer hover:bg-active" style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;gap:12px">',
    '  <section class="flex flex-col" style="display:flex;flex-direction:column">',
    '    <section class="text-sm font-medium text-secondary">Web report</section>',
    '    <section class="text-xs text-secondary">View / share web report</section>',
    '  </section>',
    '  <section class="flex items-center gap-2 text-xs text-secondary" style="display:flex;flex-direction:row;align-items:center;gap:8px">Click to view</section>',
    '</section>',
    '',
  ].join('\n')
  const out = sanitizeImportedMarkdownText(input, { sourceUrl: 'https://example.com' })
  if (!out.changed) throw new Error('expected changed')
  if (/<section\b/i.test(out.text)) throw new Error(`expected raw semantic wrapper html removed, got: ${out.text}`)
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
