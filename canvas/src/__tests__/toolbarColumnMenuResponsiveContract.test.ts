import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testToolbarColumnMenusUseSharedListOwner() {
  const toolbarStylesText = readUtf8('src/features/toolbar/ui/toolbarStyles.ts')
  const widgetPaletteText = readUtf8('src/features/toolbar/WidgetPalette.tsx')
  const widgetActionsText = readUtf8('src/components/StoryboardWidget/WidgetEditorActionsToolbar.tsx')

  if (!toolbarStylesText.includes("uiToolbarColumnMenuListClassName = 'm-0 p-0 list-none flex flex-col gap-1'")) throw new Error('expected toolbar column menu list owner to centralize menu reset and gap classes')
  if (!widgetPaletteText.includes('uiToolbarColumnMenuListClassName') || !widgetActionsText.includes('uiToolbarColumnMenuListClassName')) throw new Error('expected WidgetPalette and Storyboard Widget media selector to consume the shared toolbar column menu owner')
  if (widgetPaletteText.includes('m-0 p-0 list-none flex flex-col gap-1') || widgetActionsText.includes('m-0 p-0 list-none flex flex-col gap-1')) throw new Error('expected toolbar column menu consumers to stay free of repeated local list classes')
}
