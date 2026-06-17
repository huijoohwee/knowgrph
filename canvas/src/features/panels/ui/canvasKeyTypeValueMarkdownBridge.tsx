import React from 'react'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'

export const renderKeyTypeValueMarkdownSigilBridgeNode = (
  node: React.ReactNode,
  useMarkdownSigilBridge = true,
): React.ReactNode => {
  if (!useMarkdownSigilBridge) return node
  return typeof node === 'string' ? renderMarkdownSigilInlineText(node) : node
}
