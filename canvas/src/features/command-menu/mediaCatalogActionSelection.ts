import type React from 'react'
import { INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID, INLINE_UPLOAD_MEDIA_VARIABLE_ACTION_ID } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { insertMediaIntoActiveCardInlineTextEditor } from '@/lib/cards/cardInlineTextExternalCommands'
import { MEDIA_GENERATE_MEDIA_ACTION_ID, MEDIA_IMPORT_URL_ACTION_ID, type MediaPanelActionSpec } from './mediaCatalogTypes'

export function selectMediaCatalogAction(args: {
  action: MediaPanelActionSpec
  setGenerateLightboxOpen: React.Dispatch<React.SetStateAction<boolean>>
  setImportUrlPromptOpen: React.Dispatch<React.SetStateAction<boolean>>
  setMermaidFocus: (value: unknown) => void
  uploadInputRef: React.RefObject<HTMLInputElement | null>
}) {
  if (args.action.id === INLINE_UPLOAD_MEDIA_VARIABLE_ACTION_ID) {
    args.uploadInputRef.current?.click()
    return
  }
  if (args.action.id === MEDIA_IMPORT_URL_ACTION_ID) {
    args.setImportUrlPromptOpen(true)
    return
  }
  if (args.action.id === MEDIA_GENERATE_MEDIA_ACTION_ID) {
    args.setGenerateLightboxOpen(true)
    return
  }
  const mediaKind = INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID[args.action.id as keyof typeof INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID]
  if (!mediaKind) return
  const inserted = insertMediaIntoActiveCardInlineTextEditor({
    kind: mediaKind,
    url: '',
    label: args.action.label,
    sourceKey: args.action.id,
  })
  if (inserted) return
  args.setMermaidFocus(null)
}
