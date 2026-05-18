import React from 'react'
import type { WebpageViewMode } from '@/lib/markdown/frontmatter'
import {
  resolveMarkdownWorkspaceInitialPaneVisibility,
  type MarkdownWorkspacePaneVisibility,
} from './types'

type UseInitialWorkspacePaneVisibilityArgs = {
  activeDocumentKey?: string
  modelAssetFormat?: 'glb' | 'gltf' | null
  webpageUrl?: string | null
  webpageView?: WebpageViewMode | null
  workspaceEditorOverlayOpen: boolean
  setSplitPaneVisibility: React.Dispatch<React.SetStateAction<MarkdownWorkspacePaneVisibility>>
}

export function useInitialWorkspacePaneVisibility(args: UseInitialWorkspacePaneVisibilityArgs) {
  const appliedPresetKeyRef = React.useRef('')
  const previousWebpageViewRef = React.useRef<WebpageViewMode | ''>('')
  React.useEffect(() => {
    if (!args.workspaceEditorOverlayOpen) {
      appliedPresetKeyRef.current = ''
      previousWebpageViewRef.current = ''
      return
    }
    const webpageView = args.webpageView || ''
    const presetKey = [
      args.activeDocumentKey,
      args.modelAssetFormat || '',
      args.webpageUrl || '',
    ].join('\n')
    if (appliedPresetKeyRef.current !== presetKey) {
      appliedPresetKeyRef.current = presetKey
      previousWebpageViewRef.current = webpageView
      const nextVisibility = resolveMarkdownWorkspaceInitialPaneVisibility({
        modelAssetFormat: args.modelAssetFormat,
        webpageView: args.webpageView || null,
      })
      args.setSplitPaneVisibility(prev => (
        prev.json === nextVisibility.json &&
        prev.markdown === nextVisibility.markdown &&
        prev.viewer === nextVisibility.viewer &&
        prev.html === nextVisibility.html
          ? prev
          : nextVisibility
      ))
      return
    }
    if (previousWebpageViewRef.current === webpageView) return
    previousWebpageViewRef.current = webpageView
    if (webpageView !== 'html') {
      args.setSplitPaneVisibility(prev => (prev.html ? { ...prev, html: false } : prev))
      return
    }
    args.setSplitPaneVisibility(prev => (prev.viewer && prev.html ? prev : { ...prev, viewer: true, html: true }))
  }, [
    args.activeDocumentKey,
    args.modelAssetFormat,
    args.setSplitPaneVisibility,
    args.webpageUrl,
    args.webpageView,
    args.workspaceEditorOverlayOpen,
  ])
}
