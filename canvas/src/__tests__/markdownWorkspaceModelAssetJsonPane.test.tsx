import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MarkdownWorkspaceMain } from '@/features/markdown-workspace/main/MarkdownWorkspaceMain'
import { clearPendingGlbAsset, setPendingGlbAsset } from '@/lib/assets/glbAssetRuntime'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

function pendingGltfStub(args: { path: string; name: string; bytes: number }): string {
  return [
    '---',
    'kgAssetType: "model"',
    'kgAssetFormat: "gltf"',
    `kgAssetName: "${args.name}"`,
    'kgAssetSource: "local"',
    'kgAssetMimeType: "model/gltf+json"',
    'kgAssetPendingLocalImport: true',
    `kgAssetPendingLocalPath: "${args.path}"`,
    `kgAssetBytes: ${args.bytes}`,
    'kgCanvasSurfaceMode: "3d"',
    'kgCanvasRenderMode: "3d"',
    'kgCanvas3dMode: "xr"',
    '---',
    '',
    '<!--kg:pending-local-import-->',
    `# ${args.name}`,
    '',
  ].join('\n')
}

export async function testMarkdownWorkspacePendingGltfJsonPaneLoadsOriginalJson() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  const pendingPath = '/large-scene.gltf'
  try {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: 'actual_pending_gltf_scene' }],
    })
    const file = new File([new Blob([gltf], { type: 'model/gltf+json' })], 'large-scene.gltf', { type: 'model/gltf+json' })
    setPendingGlbAsset(pendingPath, file, 'large-scene.gltf', 'gltf')

    useGraphStore.getState().resetAll()
    useGraphStore.getState().setWorkspaceViewMode('editor')

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    const editorRef = { current: null as MonacoTextEditorHandle | null }
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MarkdownWorkspaceMain
          themeMode="light"
          uiPanelTextFontClass="font-sans"
          uiPanelMonospaceTextClass="font-mono text-xs"
          explorerOpen={true}
          setExplorerOpen={() => {}}
          layoutMode="editor"
          setLayoutMode={() => {}}
          markdownWordWrap={true}
          setMarkdownWordWrap={() => {}}
          markdownTextHighlight={false}
          setMarkdownTextHighlight={() => {}}
          onToggleFullscreen={() => {}}
          presentationApiRef={{ current: null } as never}
          isMarkdown={true}
          activeText={pendingGltfStub({ path: pendingPath, name: 'large-scene.gltf', bytes: gltf.length })}
          setActiveText={() => {}}
          activeDocumentKey={pendingPath}
          highlightedLineRange={{ start: null, end: null }}
          revealLineInEditor={() => {}}
          showInViewer={() => {}}
          showInPresentation={() => {}}
          showInGallery={() => {}}
          editorUri="file:///large-scene.gltf"
          editorLanguage="markdown"
          editorRef={editorRef}
          onEditorCaretLine={() => {}}
        />,
      )
      await tick()
    })

    let jsonText = ''
    for (let i = 0; i < 20; i += 1) {
      await act(async () => {
        await tick()
      })
      const jsonEditor = dom.window.document.querySelector('textarea[aria-label="JSON Editor Text"]') as HTMLTextAreaElement | null
      jsonText = String(jsonEditor?.value || '')
      if (jsonText.includes('actual_pending_gltf_scene')) break
    }
    if (!jsonText.includes('actual_pending_gltf_scene')) {
      throw new Error(`expected pending GLTF JSON pane to show original GLTF JSON, got ${jsonText.slice(0, 180)}`)
    }
    if (jsonText.includes('kgAssetPendingLocalImport')) {
      throw new Error('expected pending GLTF JSON pane to avoid stopping at the lightweight manifest metadata')
    }
    await act(async () => {
      root.unmount()
    })
  } finally {
    clearPendingGlbAsset(pendingPath)
    useGraphStore.getState().resetAll()
    restore()
  }
}
