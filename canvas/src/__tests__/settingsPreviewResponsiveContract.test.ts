import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testSettingsPreviewRowsUseSharedResponsiveOwner() {
  const settingsUiText = readUtf8('src/features/settings/ui.tsx')
  const localRowLiteral = 'flex w-full min-w-0 items-center gap-2'

  if (!settingsUiText.includes(`SETTINGS_PREVIEW_INLINE_ROW_CLASS_NAME = '${localRowLiteral}'`)) {
    throw new Error('expected Settings preview inline rows to define one shared responsive row owner')
  }
  const ownerReferences = settingsUiText.match(/SETTINGS_PREVIEW_INLINE_ROW_CLASS_NAME/g) || []
  if (ownerReferences.length < 8) {
    throw new Error('expected all Settings preview inline rows to consume the shared row owner')
  }
  if (settingsUiText.split(localRowLiteral).length !== 2) {
    throw new Error('expected Settings preview inline rows to keep the local row literal only in the shared owner')
  }
}
