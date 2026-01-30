import { normalizeThemeStyle } from 'curagrph/features/markdown/ui/markdownSlideVisuals.ts'

export function testMarkdownSlideThemeNeversinkAliasesToAcademic() {
  const theme = normalizeThemeStyle('neversink')
  if (theme !== 'academic') {
    throw new Error('Expected neversink to alias to academic')
  }
}

