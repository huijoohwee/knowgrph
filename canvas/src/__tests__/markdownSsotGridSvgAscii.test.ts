import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'
import { parseAsciiBoxTable } from '@/features/markdown/ui/codeblock/asciiBoxTable'

export function testParseAsciiBoxTableDetectsUnicodeBoxDrawing() {
  const input = [
    '┌────┬────┐',
    '│ A  │ B  │',
    '├────┼────┤',
    '│ 1  │ 2  │',
    '└────┴────┘',
  ].join('\n')
  const tbl = parseAsciiBoxTable(input)
  if (!tbl) throw new Error('expected table')
  if (!tbl.header) throw new Error('expected header')
  if (tbl.header.join('|') !== 'A|B') throw new Error(`unexpected header: ${tbl.header.join('|')}`)
  if (tbl.rows.length !== 1) throw new Error(`expected 1 data row, got ${tbl.rows.length}`)
  if (tbl.rows[0]?.join('|') !== '1|2') throw new Error(`unexpected row: ${(tbl.rows[0] || []).join('|')}`)
}

export function testParseAsciiBoxTableDetectsPlusPipe() {
  const input = [
    '+---+---+',
    '| A | B |',
    '+---+---+',
    '| 1 | 2 |',
    '+---+---+',
  ].join('\n')
  const tbl = parseAsciiBoxTable(input)
  if (!tbl) throw new Error('expected table')
  if (!tbl.header) throw new Error('expected header')
  if (tbl.header.join('|') !== 'A|B') throw new Error(`unexpected header: ${tbl.header.join('|')}`)
  if (tbl.rows.length !== 1) throw new Error(`expected 1 data row, got ${tbl.rows.length}`)
  if (tbl.rows[0]?.join('|') !== '1|2') throw new Error(`unexpected row: ${(tbl.rows[0] || []).join('|')}`)
}

export async function testHtmlToMarkdownUnifiedConvertsStandaloneSvgToMarkdownImageAtFidelity4() {
  const html = [
    '<div>',
    '<svg viewBox="0 0 10 10" width="10" height="10"><circle cx="5" cy="5" r="4" fill="red"></circle></svg>',
    '</div>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://example.invalid/',
    includeImages: true,
    fidelityLevel: 4,
    maxInputChars: 200_000,
    includeHeadSection: false,
  })
  if (!res.ok) throw new Error(`expected ok, got error=${(res as { error?: unknown }).error}`)
  const m = res.markdown.match(/!\[[^\]]*\]\(data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)\)/i)
  if (!m) throw new Error(`expected svg to convert into markdown image, got: ${res.markdown.slice(0, 160)}`)
  if ((m[1] || '').length > 100) throw new Error('expected svg base64 payload to be capped to <= 100 chars')
  if (res.markdown.includes('<svg')) throw new Error('expected svg html not to be preserved for standalone svg at fidelity4')
}

export async function testHtmlToMarkdownUnifiedConvertsSpriteUseSvgToMarkdownImageWhenSymbolAvailable() {
  const html = [
    '<div>',
    '<svg style="display:none">',
    '<symbol id="logos-node" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="red"></circle></symbol>',
    '</svg>',
    '<svg width="10" height="10" aria-hidden="true" data-icon="logos/node"><use href="#logos-node"></use></svg>',
    '</div>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://example.invalid/',
    includeImages: true,
    fidelityLevel: 4,
    maxInputChars: 200_000,
    includeHeadSection: false,
  })
  if (!res.ok) throw new Error(`expected ok, got error=${(res as { error?: unknown }).error}`)
  const m = res.markdown.match(/!\[[^\]]*\]\(data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)\)/i)
  if (!m) throw new Error(`expected sprite svg to convert into markdown image, got: ${res.markdown.slice(0, 200)}`)
  if ((m[1] || '').length > 100) throw new Error('expected svg base64 payload to be capped to <= 100 chars')
}

export async function testHtmlToMarkdownUnifiedSimplifiesLinkTextWithDecorativeSvgIcon() {
  const html = [
    '<div>',
    '<a href="https://astro.build/blog/astro-5170/">',
    '<span>Astro 5.17</span>',
    '<svg width="0.89em" height="1em" class="w-7 h-auto" aria-hidden="true" data-icon="logos/node">',
    '<path d="M0 0h10v10H0z"></path>',
    '</svg>',
    '</a>',
    '</div>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://example.invalid/',
    includeImages: true,
    fidelityLevel: 4,
    maxInputChars: 200_000,
    includeHeadSection: false,
  })
  if (!res.ok) throw new Error(`expected ok, got error=${(res as { error?: unknown }).error}`)
  if (!/\[Astro 5\.17\]\(https:\/\/astro\.build\/blog\/astro-5170\/\)/.test(res.markdown)) {
    throw new Error(`expected simplified link markdown, got: ${res.markdown.slice(0, 200)}`)
  }
  if (/data:image\/svg\+xml;base64,/i.test(res.markdown)) throw new Error('expected decorative svg icon to be removed from link')
}

export async function testHtmlToMarkdownUnifiedSimplifiesLinkTextWithDecorativeImgIcon() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>'
  const b64 = Buffer.from(svg, 'utf8').toString('base64')
  const html = [
    '<div>',
    '<a href="https://astro.build/blog/astro-5170/">',
    '<span>Astro 5.17</span>',
    `<img src="data:image/svg+xml;base64,${b64}" alt="" aria-hidden="true" class="icon" />`,
    '</a>',
    '</div>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://example.invalid/',
    includeImages: true,
    fidelityLevel: 4,
    maxInputChars: 200_000,
    includeHeadSection: false,
  })
  if (!res.ok) throw new Error(`expected ok, got error=${(res as { error?: unknown }).error}`)
  if (!/\[Astro 5\.17\]\(https:\/\/astro\.build\/blog\/astro-5170\/\)/.test(res.markdown)) {
    throw new Error(`expected simplified link markdown, got: ${res.markdown.slice(0, 200)}`)
  }
  if (/data:image\/svg\+xml;base64,/i.test(res.markdown)) throw new Error('expected decorative img icon to be removed from link')
}

export async function testHtmlToMarkdownUnifiedStripsLinkedCardImageWhenTextPresent() {
  const html = [
    '<div>',
    '<a href="https://astro.build/agencies/bejamas/">',
    '<span>Bejamas</span>',
    '<img src="https://astro.build/__webpage_asset_path/https%3A%2F%2Fastro.build/_astro/bejamas.rFjqlsuX_ZKJaRs.webp" alt="" />',
    '</a>',
    '</div>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://astro.build/',
    includeImages: true,
    fidelityLevel: 4,
    maxInputChars: 200_000,
    includeHeadSection: false,
  })
  if (!res.ok) throw new Error(`expected ok, got error=${(res as { error?: unknown }).error}`)
  if (!/\[Bejamas\]\(https:\/\/astro\.build\/agencies\/bejamas\/\)/.test(res.markdown)) {
    throw new Error(`expected link text only, got: ${res.markdown.slice(0, 220)}`)
  }
  if (/bejamas\.rFjqlsuX_ZKJaRs\.webp/i.test(res.markdown)) throw new Error('expected linked image to be stripped when text is present')
}

export async function testHtmlToMarkdownUnifiedKeepsSvgImageSyntaxWhenAltPresent() {
  const html = [
    '<div>',
    '<svg aria-label="Google" viewBox="0 0 10 10" width="10" height="10"><circle cx="5" cy="5" r="4"></circle></svg>',
    '</div>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://example.invalid/',
    includeImages: true,
    fidelityLevel: 4,
    maxInputChars: 200_000,
    includeHeadSection: false,
  })
  if (!res.ok) throw new Error(`expected ok, got error=${(res as { error?: unknown }).error}`)
  const m = res.markdown.match(/!\[Google\]\(data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)\)/i)
  if (!m) throw new Error(`expected svg image syntax, got: ${res.markdown.slice(0, 200)}`)
  if ((m[1] || '').length > 100) throw new Error('expected svg base64 payload to be capped to <= 100 chars')
  if (/!\s+\[Google\]\(data:image\/svg\+xml;base64,/i.test(res.markdown)) {
    throw new Error(`expected no space after "!" in image syntax, got: ${res.markdown.slice(0, 200)}`)
  }
}

export async function testHtmlToMarkdownUnifiedCapsLargeSvgToShortDataUri() {
  const big = 'A'.repeat(9000)
  const html = [
    '<div>',
    `<svg aria-label="Big" viewBox="0 0 10 10" width="10" height="10"><text>${big}</text></svg>`,
    '</div>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://example.invalid/',
    includeImages: true,
    fidelityLevel: 4,
    maxInputChars: 200_000,
    includeHeadSection: false,
  })
  if (!res.ok) throw new Error(`expected ok, got error=${(res as { error?: unknown }).error}`)
  const m = res.markdown.match(/!\[Big\]\(data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)\)/i)
  if (!m) throw new Error(`expected capped svg placeholder to be emitted as image, got: ${res.markdown.slice(0, 240)}`)
  if ((m[1] || '').length > 100) throw new Error('expected svg base64 payload to be capped to <= 100 chars')
}

export async function testHtmlToMarkdownUnifiedConvertsIconOnlyLinkWithAriaLabelToTextLink() {
  const html = [
    '<div>',
    '<a href="https://astro.build/themes/details/darkrise-astro/" aria-label="View Theme">',
    '<svg width="0.89em" height="1em" aria-hidden="true" data-icon="ri/eye-line"><path d="M0 0h10v10H0z"></path></svg>',
    '</a>',
    '</div>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://astro.build/',
    includeImages: true,
    fidelityLevel: 4,
    maxInputChars: 200_000,
    includeHeadSection: false,
  })
  if (!res.ok) throw new Error(`expected ok, got error=${(res as { error?: unknown }).error}`)
  if (!/\[View Theme\]\(https:\/\/astro\.build\/themes\/details\/darkrise-astro\/\)/.test(res.markdown)) {
    throw new Error(`expected aria-label link to become text markdown link, got: ${res.markdown.slice(0, 240)}`)
  }
  if (/data:image\/svg\+xml;base64,/i.test(res.markdown)) throw new Error('expected decorative icon svg to be dropped from link')
  if (/<svg/i.test(res.markdown)) throw new Error('expected no raw svg html in output')
}

export async function testHtmlToMarkdownUnifiedPreservesGridDivAsHtmlAtFidelity4() {
  const html = [
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">',
    '<div>Left</div>',
    '<div>Right</div>',
    '</div>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://example.invalid/',
    includeImages: true,
    fidelityLevel: 4,
    maxInputChars: 200_000,
    includeHeadSection: false,
  })
  if (!res.ok) throw new Error(`expected ok, got error=${(res as { error?: unknown }).error}`)
  if (!/display\s*:\s*grid/i.test(res.markdown)) throw new Error('expected grid container to remain in raw html')
  if (!res.markdown.includes('grid-template-columns')) throw new Error('expected grid-template-columns preserved')
}

export async function testHtmlToMarkdownUnifiedPreservesLinkedFlexGridAsHtmlAtFidelity4() {
  const html = [
    '<div class="flex flex-wrap gap-4">',
    '<a href="https://example.invalid/a" class="w-48">A</a>',
    '<a href="https://example.invalid/b" class="w-48">B</a>',
    '<a href="https://example.invalid/c" class="w-48">C</a>',
    '<a href="https://example.invalid/d" class="w-48">D</a>',
    '</div>',
  ].join('')
  const res = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://example.invalid/',
    includeImages: true,
    fidelityLevel: 4,
    maxInputChars: 200_000,
    includeHeadSection: false,
  })
  if (!res.ok) throw new Error(`expected ok, got error=${(res as { error?: unknown }).error}`)
  if (/<\s*div\b/i.test(res.markdown) || /<\s*a\b/i.test(res.markdown)) {
    throw new Error(`expected linked flex container not to be preserved as raw html, got: ${res.markdown.slice(0, 240)}`)
  }
  if (!/\[A\]\(https:\/\/example\.invalid\/a\)/.test(res.markdown)) {
    throw new Error(`expected markdown link extraction, got: ${res.markdown.slice(0, 240)}`)
  }
}
