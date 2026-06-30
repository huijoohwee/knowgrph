import { SharedWebpageSurface } from '@/components/SharedWebpageSurface'
import ZoomPanViewport from '@/features/panels/views/preview-panel/ui/ZoomPanViewport'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import { LS_KEYS } from '@/lib/config'
import { shouldUseDirectRichMediaPanelSrcDocSandbox } from '@/lib/render/richMediaPanelSrcDoc'
import { resolveIframeSandbox } from 'grph-shared/rich-media/iframe'
import type { RichMediaPanelProps } from './RichMediaPanel.types'
import type { RichMediaPanelModel } from './useRichMediaPanelModel'

export function RichMediaPanelDirectMediaSurface(args: {
  model: RichMediaPanelModel
  props: RichMediaPanelProps
}) {
  const { model, props } = args
  if (model.panelIsLoading || model.isEmptyPanel || model.showPanelInlineTextEditor || model.showPanelMarkdownPreview || model.kind === 'iframe') {
    return null
  }
  if (model.kind === 'image' || model.kind === 'svg' || model.kind === 'video') {
    return (
      <section
        className="relative h-full w-full overflow-hidden"
        data-kg-rich-media-zoom-pan-viewport="1"
        style={{ background: 'transparent', pointerEvents: 'auto' }}
      >
        {model.directVideoFallbackSrcDoc && !model.directVideoUsesInlinePreview ? (
          <section
            aria-hidden="true"
            data-kg-rich-media-video-srcdoc-fallback="1"
            className="absolute inset-0 overflow-hidden"
            style={{
              borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <SharedWebpageSurface
              renderMode="iframe"
              webpageUrl={model.openUrl || model.rawUrl}
              title={`${model.title} HTML preview`}
              iframeSrc="about:blank"
              iframeSrcDoc={model.directVideoFallbackSrcDoc}
              iframeRef={model.directVideoFallbackFrameRef}
              iframeAllow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              iframeSandbox={shouldUseDirectRichMediaPanelSrcDocSandbox(model.directVideoFallbackSrcDoc) ? resolveIframeSandbox('direct') : undefined}
              iframeScrolling="no"
              iframeReferrerPolicy="no-referrer"
              style={{
                background: 'transparent',
                border: 0,
                display: 'block',
                height: '100%',
                pointerEvents: 'none',
                width: '100%',
              }}
              onLoad={() => {
                model.setReady(true)
                model.scheduleInlineSrcDocTimelineFrameBurst()
              }}
            />
          </section>
        ) : null}
        <ZoomPanViewport
          open={Boolean(model.mediaSrc) || model.directVideoUsesInlinePreview}
          storageKey={LS_KEYS.previewZoomPanMedia}
          getContentSize={() => model.directMediaZoomContentSize}
          fitOnOpen
          fitKey={`${model.kind}:${model.mediaSrc}:${props.videoPoster || ''}`}
          frameAspectRatio={model.directMediaZoomContentSize.w / Math.max(1, model.directMediaZoomContentSize.h)}
          framePaddingPx={0}
          wheelZoomBehavior="active"
          showControls={false}
          showZoomIndicator={false}
          frameClassName="bg-transparent"
          contentFillsFrame
          transparentBackground
          frameSelectionProps={model.directMediaPreviewSelectionProps}
        >
          {model.directVideoUsesInlinePreview ? (
            <SharedWebpageSurface
              renderMode="iframe"
              webpageUrl={model.openUrl || model.rawUrl}
              title={`${model.title} HTML preview`}
              iframeSrc="about:blank"
              iframeSrcDoc={model.directVideoFallbackSrcDoc}
              iframeRef={model.directVideoFallbackFrameRef}
              iframeAllow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              iframeSandbox={shouldUseDirectRichMediaPanelSrcDocSandbox(model.directVideoFallbackSrcDoc) ? resolveIframeSandbox('direct') : undefined}
              iframeLoading="eager"
              iframeScrolling="no"
              iframeReferrerPolicy="no-referrer"
              iframeSelectableSurfaceDataAttr
              className="block h-full w-full select-none border-0"
              style={{ background: 'transparent', pointerEvents: props.videoControls === true ? 'auto' : 'none' }}
              onLoad={() => {
                model.setReady(true)
                model.scheduleInlineSrcDocTimelineFrameBurst()
              }}
            />
          ) : (
            <CardMediaPreview
              kind={model.kind === 'svg' ? 'svg' : model.kind}
              url={model.mediaSrc}
              title={model.title}
              {...model.directMediaPreviewCardProps}
              fit="contain"
              videoControls={model.kind === 'video' ? props.videoControls === true : false}
              videoMuted={model.kind === 'video' ? props.videoControls !== true : undefined}
              videoAutoPlay={model.kind === 'video' ? props.videoControls !== true : undefined}
              videoLoop={model.kind === 'video' ? props.videoControls !== true : undefined}
              videoPoster={model.kind === 'video' ? props.videoPoster : undefined}
              mediaThumbnailDataAttr
              onMediaElement={model.handleDirectMediaElement}
              onVideoElement={model.kind === 'video' ? model.handleDirectVideoElement : undefined}
              onReady={() => model.setReady(true)}
              onError={() => {
                if (!model.fallbackToRawSrc()) model.setReady(true)
              }}
              mediaStyle={model.buildDirectMediaStyle(
                'block',
                model.kind === 'video' ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.06)',
              )}
            />
          )}
        </ZoomPanViewport>
      </section>
    )
  }
  if (model.kind === 'audio') {
    return (
      <CardMediaPreview
        kind={model.kind}
        url={model.mediaSrc}
        title={model.title}
        interactive={model.contentInteractive}
        fit="contain"
        onMediaElement={model.handleDirectMediaElement}
        onReady={() => model.setReady(true)}
        onError={() => {
          if (!model.fallbackToRawSrc()) model.setReady(true)
        }}
        mediaStyle={model.buildDirectMediaStyle('flex', 'rgba(15, 23, 42, 0.06)')}
      />
    )
  }
  return (
    <CardMediaPreview
      kind={model.kind === 'svg' ? 'svg' : 'image'}
      url={model.mediaSrc}
      title={model.title}
      interactive={false}
      fit="contain"
      mediaThumbnailDataAttr
      onReady={() => model.setReady(true)}
      onError={() => {
        if (!model.fallbackToRawSrc()) model.setReady(true)
      }}
      mediaStyle={model.buildDirectMediaStyle('block', 'rgba(15, 23, 42, 0.06)')}
    />
  )
}
