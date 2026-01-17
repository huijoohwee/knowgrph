import React from 'react'
import ZoomPanViewport from '@/features/panels/views/preview-panel/ui/ZoomPanViewport'
import { SlideFrame } from './SlideFrame'
import { PresentationNotes } from './PresentationNotes'
import type { TokenWithLines } from './markdownPreviewLex'
import { LS_KEYS, type LsStorageKey } from '@/lib/config'

type MarkdownPresentationViewportProps = {
  isOpen: boolean
  storageKey?: LsStorageKey
  baseSlideSize: { w: number; h: number }
  slideFramePaddingPx?: number
  baseFrameClass: string
  slideClass: string
  slideStyle: React.CSSProperties
  slideTransitionStyle: React.CSSProperties
  onDoubleClick: (e: React.MouseEvent) => void
  children: React.ReactNode
  showSpeakerNotes?: boolean
  notesTokens?: TokenWithLines[] | null
  activeDocumentPath?: string
  uiPanelTextFontClass?: string
  uiPanelMonospaceTextClass?: string
  mermaidFrontmatterConfig?: Record<string, unknown> | null
  rootThemeMode?: 'light' | 'dark'
  previewOverlayScope?: 'viewport' | 'container'
  previewOverlayPortalTarget?: HTMLElement | null
  disablePan?: boolean
  showControls?: boolean
  autoScaleTo100?: boolean
}

export function MarkdownPresentationViewport(props: MarkdownPresentationViewportProps) {
  const {
    isOpen,
    storageKey = LS_KEYS.previewZoomPanSlides,
    baseSlideSize,
    slideFramePaddingPx,
    baseFrameClass,
    slideClass,
    slideStyle,
    slideTransitionStyle,
    onDoubleClick,
    children,
    showSpeakerNotes,
    notesTokens,
    activeDocumentPath,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    mermaidFrontmatterConfig,
    rootThemeMode,
    previewOverlayScope,
    previewOverlayPortalTarget,
    disablePan = false,
    showControls = false,
    autoScaleTo100,
  } = props

  return (
    <>
      <ZoomPanViewport
        open={isOpen}
        storageKey={storageKey}
        getContentSize={() => ({ w: baseSlideSize.w, h: baseSlideSize.h })}
        fitOnOpen
        frameAspectRatio={baseSlideSize.w / baseSlideSize.h}
        showControls={showControls}
        showZoomIndicator={true}
        framePaddingPx={slideFramePaddingPx}
        disablePan={disablePan}
        frameClassName={[baseFrameClass, slideClass].filter(Boolean).join(' ')}
        autoScaleTo100={autoScaleTo100}
      >
        <section
          style={{ width: `${baseSlideSize.w}px`, height: `${baseSlideSize.h}px` }}
          aria-label="Slide Canvas"
        >
          <SlideFrame
            frameClassName="w-full h-full"
            slideStyle={slideStyle}
            slideTransitionStyle={slideTransitionStyle}
            onDoubleClick={onDoubleClick}
          >
            {children}
          </SlideFrame>
        </section>
      </ZoomPanViewport>
      {showSpeakerNotes && notesTokens && notesTokens.length > 0 ? (
        <PresentationNotes
          notesTokens={notesTokens}
          activeDocumentPath={activeDocumentPath || ''}
          uiPanelTextFontClass={uiPanelTextFontClass || ''}
          uiPanelMonospaceTextClass={uiPanelMonospaceTextClass || ''}
          mermaidFrontmatterConfig={mermaidFrontmatterConfig || null}
          rootThemeMode={rootThemeMode || 'light'}
          previewOverlayScope={previewOverlayScope || 'viewport'}
          previewOverlayPortalTarget={previewOverlayPortalTarget || null}
          className="w-full max-h-56 overflow-auto border-t border-gray-200 bg-white"
        />
      ) : null}
    </>
  )
}
