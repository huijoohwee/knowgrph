import { htmlFallbackToMarkdownAllText } from '@/features/markdown-workspace/workspaceImport/htmlTextFallback'

export function testHtmlFallbackStripsInlineSvgAndKeepsHeadingText() {
  const html = [
    '<div class="flex items-center gap-2 mb-4">',
    '<svg width="21" height="23" view Box="0 0 21 23" fill="none" xmlns="http://www 3.org/2000/svg">',
    '<path d="M0 0" fill="#F86D13"></path>',
    '</svg>',
    '<h 2 class="font-bold text-[16px] leading-[1.06] text-black capitalize m-0">Trending now</h 2>',
    '</div>',
  ].join('')

  const md = htmlFallbackToMarkdownAllText(html)
  if (!md.includes('## Trending now')) throw new Error(`expected heading markdown, got: ${md}`)
  if (md.includes('F86D13')) throw new Error('expected svg stripped')
  if (md.includes('<svg') || md.includes('</svg')) throw new Error('expected no svg tags')
}

