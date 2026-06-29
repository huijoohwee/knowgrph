import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testRichMediaPanelInlineSrcDocIframeLoadsEagerly() {
  const iframeSurfaceText = readFileSync(resolve(process.cwd(), 'src', 'components', 'RichMediaPanelIframeSurface.tsx'), 'utf8')
  const inlineSrcDocBranch = iframeSurfaceText.slice(
    iframeSurfaceText.indexOf('if (model.effectiveInlineSrcDoc)'),
    iframeSurfaceText.indexOf('if (model.iframeEmbed?.direct)'),
  )
  if (!inlineSrcDocBranch.includes('iframeSrcDoc={model.normalizedInlineSrcDoc}')) {
    throw new Error('expected inline Rich Media outputSrcDoc panels to render normalized srcdoc through the iframe surface')
  }
  if (!inlineSrcDocBranch.includes('iframeLoading="eager"')) {
    throw new Error('expected inline Rich Media outputSrcDoc iframes to load eagerly inside transformed canvas overlays')
  }
}
