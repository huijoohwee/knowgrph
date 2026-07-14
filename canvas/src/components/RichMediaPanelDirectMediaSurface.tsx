import { SharedWebpageSurface } from '@/components/SharedWebpageSurface'
import ZoomPanViewport from '@/features/panels/views/preview-panel/ui/ZoomPanViewport'
import { CardMediaHoverPreview, useCardMediaHoverPreview } from '@/lib/cards/CardMediaHoverPreview'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import { LS_KEYS } from '@/lib/config'
import { shouldUseDirectRichMediaPanelSrcDocSandbox } from '@/lib/render/richMediaPanelSrcDoc'
import { resolveIframeSandbox } from 'grph-shared/rich-media/iframe'
import type { RichMediaPanelProps } from './RichMediaPanel.types'
import type { RichMediaPanelModel } from './useRichMediaPanelModel'
import { MediaDownloadOverlay } from '@/lib/ui/MediaKindOverlay'

export function RichMediaPanelDirectMediaSurface(args: {
  model: RichMediaPanelModel
  props: RichMediaPanelProps
}) {
  const { model, props } = args
  const hoverPreview = useCardMediaHoverPreview<HTMLElement>()
  const hoverPreviewUrl = model.mediaSrc || model.openUrl || model.rawUrl
  const directVideoControls = model.kind === 'video' && (props.videoControls !== false || model.contentInteractive)
  const directVideoPassivePlayback = model.kind === 'video' && !directVideoControls
  if (model.kind === 'image' || model.kind === 'svg' || model.kind === 'video') {
    return (
      <section
        ref={hoverPreview.anchorRef}
        {...hoverPreview.anchorProps}
        className="group relative h-full w-full overflow-hidden"
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
          disablePan
          lockViewportAtFitScale
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
              renderMode={props.renderMode}
              url={model.mediaSrc}
              title={model.title}
              {...model.directMediaPreviewCardProps}
              interactive={model.contentInteractive}
              fit="contain"
              videoControls={directVideoControls}
              videoMuted={directVideoPassivePlayback ? true : undefined}
              videoAutoPlay={directVideoPassivePlayback ? true : undefined}
              videoLoop={directVideoPassivePlayback ? true : undefined}
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
        {model.mediaSrc ? (
          <MediaDownloadOverlay
            href={model.mediaSrc}
            kind={model.kind === 'svg' ? 'image' : model.kind}
            appearance="hover"
            className="bottom-auto top-1"
          />
        ) : null}
        <CardMediaHoverPreview
          anchorRef={hoverPreview.anchorRef}
          kind={model.kind}
          open={hoverPreview.show}
          title={model.title}
          tooltipId={hoverPreview.tooltipId}
          url={hoverPreviewUrl}
          onClose={hoverPreview.close}
        />
      </section>
    )
  }
  if (model.kind === 'audio') {
    return (
      <section ref={hoverPreview.anchorRef} {...hoverPreview.anchorProps} className="group relative h-full w-full overflow-hidden">
        <CardMediaPreview
          kind={model.kind}
          url={model.mediaSrc}
          title={model.title}
          {...model.directMediaPreviewCardProps}
          fit="contain"
          onMediaElement={model.handleDirectMediaElement}
          onReady={() => model.setReady(true)}
          onError={() => {
            if (!model.fallbackToRawSrc()) model.setReady(true)
          }}
          mediaStyle={model.buildDirectMediaStyle('flex', 'rgba(15, 23, 42, 0.06)')}
        />
        {model.mediaSrc ? (
          <MediaDownloadOverlay href={model.mediaSrc} kind="audio" appearance="hover" className="bottom-auto top-1" />
        ) : null}
        <CardMediaHoverPreview
          anchorRef={hoverPreview.anchorRef}
          kind="audio"
          open={hoverPreview.show}
          title={model.title}
          tooltipId={hoverPreview.tooltipId}
          url={hoverPreviewUrl}
          onClose={hoverPreview.close}
        />
      </section>
    )
  }
  return null
}
