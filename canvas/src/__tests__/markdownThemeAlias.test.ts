import { normalizeThemeStyle } from '@/features/markdown/ui/markdownSlideVisuals'

export function testMarkdownSlideThemeNeversinkAliasesToAcademic() {
  const theme = normalizeThemeStyle('neversink')
  if (theme !== 'academic') {
    throw new Error('Expected neversink to alias to academic')
  }
}
