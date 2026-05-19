import React from 'react'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { hashSignatureParts } from '@/lib/hash/signature'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'

export type CanvasAppliedMarkdownDocument = {
  name: string | null
  sourceUrl: string | null
  text: string
  semanticKey: string
}

export type CanvasAppliedMarkdownDocumentInput = {
  name?: string | null
  sourceUrl?: string | null
  text?: string | null
  applyViewPreset?: boolean
}

export function buildCanvasAppliedMarkdownDocumentSemanticKey(args: {
  name?: unknown
  sourceUrl?: unknown
  text?: unknown
}): string {
  const name = String(args.name || '').trim()
  const sourceUrl = String(args.sourceUrl || '').trim()
  const text = String(args.text || '')
  const textHash = text ? hashStringToHexCached(`canvas-applied-markdown:${name || sourceUrl || 'document'}`, text) : ''
  const graphSemanticKey = hashSignatureParts([name, sourceUrl, text.length, textHash])
  return buildScopedGraphSemanticKey('canvas-applied-markdown-document', { graphSemanticKey })
}

export function useCanvasAppliedMarkdownDocument(args: CanvasAppliedMarkdownDocumentInput): CanvasAppliedMarkdownDocument {
  const next = React.useMemo<CanvasAppliedMarkdownDocument>(() => {
    const name = typeof args.name === 'string' && args.name.trim() ? args.name : null
    const sourceUrl = typeof args.sourceUrl === 'string' && args.sourceUrl.trim() ? args.sourceUrl : null
    const text = String(args.text || '')
    return {
      name,
      sourceUrl,
      text,
      semanticKey: buildCanvasAppliedMarkdownDocumentSemanticKey({ name, sourceUrl, text }),
    }
  }, [args.name, args.sourceUrl, args.text])
  const latestAppliedRef = React.useRef<CanvasAppliedMarkdownDocument>({
    name: null,
    sourceUrl: null,
    text: '',
    semanticKey: '',
  })
  if (args.applyViewPreset !== false) {
    latestAppliedRef.current = next
    return next
  }
  return latestAppliedRef.current
}
