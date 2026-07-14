import React from 'react'
import RichMediaPanel from '@/components/RichMediaPanel'
import { MediaCatalogRichMediaPreview } from '@/features/command-menu/MediaCatalogRichMediaPreview'
import type { UploadedMediaPanelItem } from '@/lib/storage/uploadedMediaPanelItems'

const SMOKE_MARKDOWN_PREVIEW = [
  '## Rich Media Smoke',
  '',
  '| Surface | Status |',
  '| --- | --- |',
  '| Markdown | Ready |',
  '',
  '> Browser smoke preview',
].join('\n')

const SMOKE_EDITABLE_TEXT = [
  'Editable Rich Media',
  '',
  'Click to edit this runtime smoke panel.',
].join('\n')

const SMOKE_INLINE_SRCDOC = [
  '<!doctype html>',
  '<html>',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<style>',
  'body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a}',
  'main{display:grid;place-items:center;min-height:220px;padding:24px}',
  'section{display:grid;gap:8px;max-width:320px;padding:20px;border:1px solid #cbd5e1;border-radius:16px;background:#ffffff}',
  'h1{font-size:1.125rem;margin:0}',
  'p{margin:0;font-size:0.95rem;line-height:1.5}',
  '</style>',
  '</head>',
  '<body>',
  '<main>',
  '<section data-kg-smoke-inline-srcdoc="1">',
  '<h1>Inline SrcDoc Smoke</h1>',
  '<p>Runtime iframe rendering is active.</p>',
  '</section>',
  '</main>',
  '</body>',
  '</html>',
].join('')

const SMOKE_VIDEO_SRCDOC = [
  '<!doctype html>',
  '<html>',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<style>',
  'body{margin:0;font-family:Inter,system-ui,sans-serif;background:#020617;color:#e2e8f0}',
  'main{display:grid;place-items:center;min-height:220px;padding:24px}',
  'article{display:grid;gap:10px;max-width:360px;padding:20px;border:1px solid rgba(148,163,184,.28);border-radius:18px;background:linear-gradient(135deg,#0f172a,#1e293b)}',
  'h1{font-size:1.05rem;margin:0}',
  'p{margin:0;font-size:0.92rem;line-height:1.5}',
  '</style>',
  '</head>',
  '<body>',
  '<main>',
  '<article data-kg-smoke-video-srcdoc="1">',
  '<h1>Video HTML Fallback</h1>',
  '<p>Inline video preview fallback is rendering through the shared webpage surface.</p>',
  '</article>',
  '</main>',
  '</body>',
  '</html>',
].join('')

const SMOKE_AUDIO_DATA_URL =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

const SMOKE_CATALOG_MEDIA: Record<'image' | 'video', UploadedMediaPanelItem> = {
  image: { id: 'smoke-image', name: 'Floating media image.png', kind: 'image', localUrl: '', linkUrl: '/demo/placeholder.svg?catalog-preview-timing=1', contentType: 'image/svg+xml', sizeBytes: 0, status: 'local', storage: null, error: null },
  video: { id: 'smoke-video', name: 'Floating media video.mp4', kind: 'video', localUrl: '', linkUrl: '/demo/media-preview-metadata-ready.mp4', contentType: 'video/mp4', sizeBytes: 1092, status: 'local', storage: null, error: null },
}

const smokePanelStyle: React.CSSProperties = {
  height: 280,
  width: '100%',
}

const smokePanelCardClassName =
  'relative isolate overflow-hidden rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] p-4'

export function RichMediaBrowserSmokePage() {
  const [editableText, setEditableText] = React.useState(SMOKE_EDITABLE_TEXT)
  const [catalogPreviewKind, setCatalogPreviewKind] = React.useState<'image' | 'video' | null>(null)
  const [flowPanelState, setFlowPanelState] = React.useState({
    dragCount: 0,
    offsetX: 0,
    offsetY: 0,
    resizeCount: 0,
    width: 320,
    height: 220,
  })

  const editablePanel = React.useMemo(() => ({
    activeTab: 'text' as const,
    freezeConnectedOutput: true,
    hasAudio: false,
    hasImage: false,
    hasPoi: false,
    hasText: true,
    hasVideo: false,
    text: editableText,
    connectedText: editableText,
  }), [editableText])

  const previewPanel = React.useMemo(() => ({
    activeTab: 'text' as const,
    freezeConnectedOutput: true,
    hasAudio: false,
    hasImage: false,
    hasPoi: false,
    hasText: true,
    hasVideo: false,
    text: SMOKE_MARKDOWN_PREVIEW,
    connectedText: SMOKE_MARKDOWN_PREVIEW,
  }), [])

  const handleFlowResizeStart = React.useCallback(() => {
    setFlowPanelState(previous => ({ ...previous, resizeCount: previous.resizeCount + 1 }))
  }, [])

  const handleFlowResize = React.useCallback((args: { dx: number; dy: number }) => {
    setFlowPanelState(previous => ({
      ...previous,
      width: Math.max(240, previous.width + args.dx),
      height: Math.max(180, previous.height + args.dy),
    }))
  }, [])

  const handleFlowDragStart = React.useCallback(() => {
    setFlowPanelState(previous => ({ ...previous, dragCount: previous.dragCount + 1 }))
  }, [])

  const handleFlowDrag = React.useCallback((args: { dx: number; dy: number }) => {
    setFlowPanelState(previous => ({
      ...previous,
      offsetX: previous.offsetX + args.dx,
      offsetY: previous.offsetY + args.dy,
    }))
  }, [])

  return (
    <main
      data-kg-rich-media-smoke-page="1"
      className="min-h-screen bg-[var(--kg-canvas-bg)] px-6 py-8 text-[var(--kg-text)]"
      aria-label="Rich media browser smoke"
    >
      <header className="mx-auto flex w-full max-w-7xl flex-col gap-3">
        <h1 className="text-2xl font-semibold">Rich Media Browser Smoke</h1>
        <p className="max-w-3xl text-sm text-[var(--kg-text-secondary)]">
          Dev-only runtime harness for verifying rich media text, iframe, overlay, direct-media, and storyboard-widget chrome interactions.
        </p>
      </header>

      <section
        className="mx-auto mt-6 grid w-full max-w-7xl gap-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
        aria-label="Rich media smoke surfaces"
      >
        <article className={smokePanelCardClassName} data-kg-smoke-panel="text-preview">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">Text Preview</h2>
          </header>
          <RichMediaPanel title="Markdown Preview" url="" panel={previewPanel} style={smokePanelStyle} />
        </article>

        <article className={smokePanelCardClassName} data-kg-smoke-panel="text-edit">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">Text Edit</h2>
          </header>
          <RichMediaPanel
            title="Editable Text Panel"
            url=""
            panel={editablePanel}
            style={smokePanelStyle}
            onPanelChange={next => {
              if (typeof next.text !== 'string') return
              setEditableText(next.text)
            }}
          />
        </article>

        <article className={smokePanelCardClassName} data-kg-smoke-panel="iframe-srcdoc">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">Inline SrcDoc Iframe</h2>
          </header>
          <RichMediaPanel title="Inline SrcDoc Preview" url="" srcDoc={SMOKE_INLINE_SRCDOC} style={smokePanelStyle} />
        </article>

        <article className={smokePanelCardClassName} data-kg-smoke-panel="iframe-snapshot">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">Snapshot Iframe</h2>
          </header>
          <RichMediaPanel
            title="Snapshot Iframe Preview"
            url="https://www.reddit.com/r/reactjs/"
            style={smokePanelStyle}
          />
        </article>

        <article className={smokePanelCardClassName} data-kg-smoke-panel="iframe-open-overlay">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">Click To Open Overlay</h2>
          </header>
          <RichMediaPanel
            title="Click To Open Overlay"
            url="/demo/placeholder.svg"
            openUrl="https://example.com/rich-media-open"
            interactive={false}
            style={smokePanelStyle}
          />
        </article>

        <article className={smokePanelCardClassName} data-kg-smoke-panel="image-zoom">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">Image Zoom Pan</h2>
          </header>
          <RichMediaPanel
            title="Image Zoom Panel"
            url="/demo/placeholder.svg"
            kind="image"
            style={smokePanelStyle}
          />
        </article>

        <article className={smokePanelCardClassName} data-kg-smoke-panel="image-threejs-raster">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">PNG To Three.js</h2>
          </header>
          <RichMediaPanel
            title="PNG Three.js Panel"
            url="/apple-touch-icon.png"
            kind="image"
            renderMode="threejs"
            style={smokePanelStyle}
          />
        </article>

        <article className={smokePanelCardClassName} data-kg-smoke-panel="image-threejs-svg">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">SVG To Three.js</h2>
          </header>
          <RichMediaPanel
            title="SVG Three.js Panel"
            url="/demo/placeholder.svg"
            kind="svg"
            renderMode="threejs"
            style={smokePanelStyle}
          />
        </article>

        <article className={smokePanelCardClassName} data-kg-smoke-panel="video-inline">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">Video HTML Fallback</h2>
          </header>
          <RichMediaPanel
            title="Video Inline Preview"
            url="https://example.com/fallback-video.mp4"
            kind="video"
            srcDoc={SMOKE_VIDEO_SRCDOC}
            style={smokePanelStyle}
          />
        </article>

        <article className={smokePanelCardClassName} data-kg-smoke-panel="audio">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">Audio</h2>
          </header>
          <RichMediaPanel
            title="Audio Panel"
            url={SMOKE_AUDIO_DATA_URL}
            kind="audio"
            style={smokePanelStyle}
          />
        </article>

        <article className={smokePanelCardClassName} data-kg-smoke-panel="floating-media-preview">
          <header className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">FloatingPanel Media Preview</h2>
            <menu className="m-0 flex list-none gap-2 p-0" aria-label="Floating media preview actions">
              <li><button type="button" data-kg-smoke-open-image-preview="1" onClick={() => setCatalogPreviewKind('image')}>Image</button></li>
              <li><button type="button" data-kg-smoke-open-video-preview="1" onClick={() => setCatalogPreviewKind('video')}>Video</button></li>
            </menu>
          </header>
          <section className="h-[22rem] min-h-0 overflow-hidden">
            {catalogPreviewKind ? (
              <MediaCatalogRichMediaPreview
                item={SMOKE_CATALOG_MEDIA[catalogPreviewKind]}
                items={Object.values(SMOKE_CATALOG_MEDIA)}
                onClose={() => setCatalogPreviewKind(null)}
                onNavigate={item => setCatalogPreviewKind(item.kind === 'video' ? 'video' : 'image')}
              />
            ) : null}
          </section>
        </article>

        <article className={smokePanelCardClassName} data-kg-smoke-panel="storyboard-widget">
          <header className="mb-3">
            <h2 className="text-sm font-semibold">Storyboard Widget Chrome</h2>
          </header>
          <section
            aria-label="Storyboard widget panel stage"
            className="relative overflow-hidden rounded-2xl border border-dashed border-[var(--kg-border)] bg-[var(--kg-canvas-bg)]/40"
            style={{ height: 320 }}
          >
            <section
              className="absolute left-6 top-6"
              style={{
                height: flowPanelState.height,
                transform: `translate(${flowPanelState.offsetX}px, ${flowPanelState.offsetY}px)`,
                width: flowPanelState.width,
              }}
            >
              <RichMediaPanel
                title="Storyboard Widget Rich Media"
                url="/demo/placeholder.svg"
                kind="image"
                panelChrome="storyboardWidget"
                storyboardWidgetInteractionMode
                resizable
                style={{ height: '100%', width: '100%' }}
                onResizeStart={handleFlowResizeStart}
                onResize={handleFlowResize}
                onHeaderDragStart={handleFlowDragStart}
                onHeaderDrag={handleFlowDrag}
              />
            </section>
          </section>
        </article>
      </section>

      <aside className="mx-auto mt-6 w-full max-w-7xl rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] p-4" aria-label="Rich media smoke diagnostics">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <dt className="font-semibold">Editable Text</dt>
          <dd data-kg-smoke-edit-value="1" className="text-[var(--kg-text-secondary)]">{editableText}</dd>
          <dt className="font-semibold">Flow Drag Count</dt>
          <dd data-kg-smoke-flow-drag-count="1" className="text-[var(--kg-text-secondary)]">{flowPanelState.dragCount}</dd>
          <dt className="font-semibold">Flow Resize Count</dt>
          <dd data-kg-smoke-flow-resize-count="1" className="text-[var(--kg-text-secondary)]">{flowPanelState.resizeCount}</dd>
          <dt className="font-semibold">Flow Size</dt>
          <dd data-kg-smoke-flow-size="1" className="text-[var(--kg-text-secondary)]">{`${flowPanelState.width}x${flowPanelState.height}`}</dd>
        </dl>
      </aside>
    </main>
  )
}
