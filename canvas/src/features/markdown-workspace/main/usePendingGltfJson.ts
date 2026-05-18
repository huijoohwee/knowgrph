import React from 'react'
import type { GlbAssetDocument } from '@/lib/assets/glbAssetDocument'
import { loadModelAssetRenderPayload } from '@/lib/assets/modelAssetPayload'

type PendingGltfJson = {
  key: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  text: string
}

const EMPTY_PENDING_GLTF_JSON: PendingGltfJson = { key: '', status: 'idle', text: '' }

export function usePendingGltfJson(args: {
  activeDocumentKey: string
  jsonPaneVisible: boolean
  modelAsset: GlbAssetDocument | null
}): { pendingGltfJsonKey: string; pendingGltfJson: PendingGltfJson } {
  const pendingGltfJsonKey = React.useMemo(() => {
    if (!args.jsonPaneVisible) return ''
    if (args.modelAsset?.format !== 'gltf') return ''
    if (args.modelAsset.dataUrl) return ''
    const pendingPath = String(args.modelAsset.pendingLocalImportPath || '').trim()
    if (!pendingPath) return ''
    return [args.activeDocumentKey, pendingPath, args.modelAsset.byteLength || 0].join('\n')
  }, [args.activeDocumentKey, args.jsonPaneVisible, args.modelAsset])
  const [pendingGltfJson, setPendingGltfJson] = React.useState<PendingGltfJson>(EMPTY_PENDING_GLTF_JSON)
  React.useEffect(() => {
    if (!pendingGltfJsonKey || args.modelAsset?.format !== 'gltf') {
      setPendingGltfJson(prev => (
        prev.key === '' && prev.status === 'idle' && prev.text === ''
          ? prev
          : EMPTY_PENDING_GLTF_JSON
      ))
      return
    }
    let cancelled = false
    setPendingGltfJson(prev => (
      prev.key === pendingGltfJsonKey && prev.status === 'ready' && prev.text
        ? prev
        : { key: pendingGltfJsonKey, status: 'loading', text: '' }
    ))
    void loadModelAssetRenderPayload(args.modelAsset)
      .then(payload => {
        if (cancelled) return
        setPendingGltfJson({
          key: pendingGltfJsonKey,
          status: 'ready',
          text: typeof payload.loaderInput === 'string' ? payload.loaderInput : '',
        })
      })
      .catch(() => {
        if (cancelled) return
        setPendingGltfJson({ key: pendingGltfJsonKey, status: 'error', text: '' })
      })
    return () => {
      cancelled = true
    }
  }, [args.modelAsset, pendingGltfJsonKey])
  return { pendingGltfJsonKey, pendingGltfJson }
}
