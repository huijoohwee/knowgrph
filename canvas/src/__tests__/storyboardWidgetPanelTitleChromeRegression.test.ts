import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readSource(...segments: string[]): string {
  return readFileSync(resolve(process.cwd(), 'src', ...segments), 'utf8')
}

export function testStoryboardCardAndRichMediaPanelReuseOneHeaderTitleContract() {
  const panelChrome = readSource('components', 'StoryboardWidget', 'StoryboardWidgetPanelChrome.tsx')
  const storyboardCard = readSource('components', 'StoryboardWidgetCanvas', 'StoryboardCardOverlayLayer2d.tsx')
  const richMediaApi = readSource('components', 'RichMediaPanel.types.ts')
  const richMediaShell = readSource('components', 'RichMediaPanelShell.tsx')

  if (!panelChrome.includes('export const STORYBOARD_WIDGET_PANEL_TITLE_CLASS_NAME =')) {
    throw new Error('expected Storyboard Widget chrome to own the shared Card and Rich Media header title typography')
  }
  if (!panelChrome.includes('className={cn(STORYBOARD_WIDGET_PANEL_TITLE_CLASS_NAME, minimized ? microLabelClass : \'\')}')) {
    throw new Error('expected the semantic default panel heading to consume the shared title typography')
  }
  for (const usage of [
    'displayClassName={STORYBOARD_WIDGET_PANEL_TITLE_CLASS_NAME}',
    'editorClassName={STORYBOARD_WIDGET_PANEL_TITLE_CLASS_NAME}',
  ]) {
    if (!storyboardCard.includes(usage)) {
      throw new Error(`expected editable Storyboard Card titles to consume the shared panel title typography: ${usage}`)
    }
  }
  if (panelChrome.includes('richMediaTitleStyle')) {
    throw new Error('expected panel headers to remove the stale Rich Media-only title typography variant')
  }
  if (richMediaShell.includes('showValidate=') || richMediaShell.includes('onValidate=')) {
    throw new Error('expected Rich Media headers to match Card headers without a renderer-local validate branch')
  }
  if (richMediaApi.includes('onHeaderValidate')) {
    throw new Error('expected Rich Media Panel to remove the stale validate header API instead of mapping it to selection or z-order behavior')
  }
}
