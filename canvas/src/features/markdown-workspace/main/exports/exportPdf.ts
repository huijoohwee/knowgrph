import { printElementToPdf } from '@/lib/print/printElementToPdf'
import type { PrintOrientation } from '@/lib/print/printElementToPdf'
import type { UiToastInput } from '@/hooks/store/types'
import { getMarkdownIt } from '@/features/markdown/markdownIt'
import { splitSlides } from '@/features/markdown/ui/markdownPreviewSlides'
import { UI_COPY } from '@/lib/config-copy/uiCopy'
import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'

const PDF_EXPORT_DEBUG_TOAST_ID = 'export-pdf-debug'

function buildPrintableMarkdownArticle(markdownText: string): HTMLElement | null {
  const text = String(markdownText || '')
  if (!text.trim()) return null
  try {
    const root = document.createElement('section')
    root.setAttribute('data-testid', 'markdown-preview-root')
    const article = document.createElement('article')
    article.innerHTML = getMarkdownIt().render(text)
    root.appendChild(article)
    return article
  } catch {
    return null
  }
}

function buildPrintablePresentationDeck(markdownText: string): HTMLElement | null {
  const text = String(markdownText || '')
  if (!text.trim()) return null
  try {
    const { slides } = splitSlides(text)
    if (!slides.length) return null
    const root = document.createElement('section')
    root.setAttribute('data-testid', 'markdown-preview-root')
    const deck = document.createElement('section')
    deck.setAttribute('data-testid', 'markdown-presentation-print-deck')
    for (let i = 0; i < slides.length; i += 1) {
      const slide = slides[i]
      const slideEl = document.createElement('article')
      slideEl.innerHTML = getMarkdownIt().render(String(slide.text || ''))
      if (i < slides.length - 1) {
        slideEl.setAttribute('data-kg-hr', '1')
      }
      deck.appendChild(slideEl)
    }
    root.appendChild(deck)
    return deck
  } catch {
    return null
  }
}

async function buildViewerFidelityTarget(markdownText: string): Promise<HTMLElement | null> {
  const text = String(markdownText || '')
  if (!text.trim()) return null
  const host = document.createElement('div')
  host.setAttribute('data-testid', 'markdown-pdf-render-host')
  host.style.position = 'fixed'
  host.style.left = '-100000px'
  host.style.top = '0'
  host.style.width = '1120px'
  host.style.height = '1px'
  host.style.opacity = '0'
  host.style.pointerEvents = 'none'
  host.style.overflow = 'hidden'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: text,
        activeDocumentPath: '__pdf_export__',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: '',
        uiPanelMonospaceTextClass: '',
        previewOverlayScope: 'container',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        viewMode: 'viewer',
        showSidebar: false,
      }),
    )
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const waitForMermaidReady = async (maxMs: number): Promise<void> => {
      const start = Date.now()
      while (Date.now() - start < maxMs) {
        const pending = host.querySelector('[data-kg-mermaid-visibility-gate="pending"]')
        if (!pending) return
        await new Promise<void>(resolve => setTimeout(() => resolve(), 80))
      }
    }
    await waitForMermaidReady(1600)
    await new Promise<void>(resolve => setTimeout(() => resolve(), 120))
    const previewRoot = host.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null
    const article = (previewRoot?.querySelector('article') as HTMLElement | null) || previewRoot
    return article ? (article.cloneNode(true) as HTMLElement) : null
  } catch {
    return null
  } finally {
    try {
      root.unmount()
    } catch {
      void 0
    }
    try {
      host.remove()
    } catch {
      void 0
    }
  }
}

export async function exportViewerPdf(args: {
  exportBaseName: string
  viewerEl: HTMLElement | null
  viewerRefCurrent: HTMLElement | null
  pushUiToast: (toast: UiToastInput) => void
  orientation?: PrintOrientation
  markdownText?: string
}): Promise<void> {
  const root = args.viewerEl || args.viewerRefCurrent
  if (!root) {
    args.pushUiToast({
      id: 'export-pdf-missing-view',
      kind: 'warning',
      message: UI_COPY.markdownWorkspaceExportPdfMissingSurfaceWarning,
    })
    return
  }
  const previewRoot = (root.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null) || root
  const articleTarget = previewRoot.querySelector('article') as HTMLElement | null
  const markdownFallbackTarget = buildPrintableMarkdownArticle(String(args.markdownText || ''))
  const presentationDeckTarget = buildPrintablePresentationDeck(String(args.markdownText || ''))
  const viewerFidelityTarget = await buildViewerFidelityTarget(String(args.markdownText || ''))
  const presentationSurface =
    root.matches?.('[data-testid="markdown-presentation-root"]')
    || root.querySelector?.('[data-testid="markdown-presentation-root"]')
  const target = presentationSurface
    ? (viewerFidelityTarget || presentationDeckTarget || articleTarget || markdownFallbackTarget || previewRoot)
    : (articleTarget || markdownFallbackTarget || previewRoot)
  let targetPath = 'preview-root'
  if (target === viewerFidelityTarget) targetPath = 'viewer-fidelity'
  else if (target === presentationDeckTarget) targetPath = 'presentation-deck'
  else if (target === articleTarget) targetPath = 'viewer-article'
  else if (target === markdownFallbackTarget) targetPath = 'markdown-fallback'
  const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)
  if (isDev) {
    args.pushUiToast({
      id: PDF_EXPORT_DEBUG_TOAST_ID,
      kind: 'neutral',
      message: UI_COPY.markdownWorkspaceExportPdfDebugTargetMessage(targetPath),
      ttlMs: 1800,
      log: false,
    })
  }
  await printElementToPdf(target, { title: args.exportBaseName, orientation: args.orientation })
}
