import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSvgSurfaceZoomRuntime } from '@/components/GraphCanvas/hooks/useSvgSurfaceZoomRuntime'
import { useMermaidGitGraphDocument } from '@/features/gitgraph/useMermaidGitGraphDocument'
import { useGraphStore } from '@/hooks/useGraphStore'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import type { MermaidGitGraphCommand } from '@/lib/mermaid/mermaidGitGraphEdit'
import { postprocessMermaidSvg, renderPlainMermaidSvgCached } from '@/lib/mermaid/mermaidSvg'
import { normalizeMermaidCodeForRuntime } from 'grph-shared/markdown/mermaidInput'

type MermaidGitGraphCanvasProps = {
  active?: boolean
}

type RenderState = {
  svg: string
  error: string | null
}

const readGitGraphCommandSelectionLabel = (command: MermaidGitGraphCommand | null | undefined): string => {
  if (!command) return ''
  return command.commitId || command.tag || command.target || command.label || ''
}

const normalizeGitGraphComparableLabel = (value: string | null | undefined): string => {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

const readGitGraphCommandSelectionLabelCandidates = (
  command: MermaidGitGraphCommand | null | undefined,
): string[] => {
  if (!command) return []
  const labels: string[] = []
  const seen = new Set<string>()
  const push = (value: string | null | undefined) => {
    const label = String(value || '').replace(/\s+/g, ' ').trim()
    const normalized = normalizeGitGraphComparableLabel(label)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    labels.push(label)
  }
  push(command.commitId)
  push(command.tag)
  push(command.target)
  push(command.label)
  return labels
}

const findGitGraphCommandForExactLabel = (
  commands: ReadonlyArray<MermaidGitGraphCommand>,
  label: string | null | undefined,
): MermaidGitGraphCommand | null => {
  const normalized = normalizeGitGraphComparableLabel(label)
  if (!normalized) return null
  return commands.find(command => {
    return readGitGraphCommandSelectionLabelCandidates(command).some(value => {
      return normalizeGitGraphComparableLabel(value) === normalized
    })
  }) || null
}

const readGitGraphSvgElementChain = (args: {
  target: Element
  candidate: Element
  svgEl: SVGSVGElement
}): Element[] => {
  const chain: Element[] = []
  const seen = new Set<Element>()
  const push = (element: Element | null | undefined) => {
    if (!element || seen.has(element)) return
    seen.add(element)
    chain.push(element)
  }
  push(args.target)
  push(args.candidate)
  let current: Element | null = args.target.parentElement
  while (current && current !== args.svgEl) {
    push(current)
    current = current.parentElement
  }
  return chain
}

const readGitGraphSvgElementLabelCandidates = (args: {
  target: Element
  candidate: Element
  svgEl: SVGSVGElement
}): string[] => {
  const labels: string[] = []
  const seen = new Set<string>()
  const push = (value: unknown) => {
    const label = String(value || '').replace(/\s+/g, ' ').trim()
    if (!label || label.length > 120) return
    const normalized = label.toLowerCase()
    if (seen.has(normalized)) return
    seen.add(normalized)
    labels.push(label)
  }
  for (const element of readGitGraphSvgElementChain(args)) {
    push(element.getAttribute('aria-label'))
    push(element.getAttribute('data-id'))
    push(element.getAttribute('id'))
    push(element.textContent)
    element.classList.forEach(token => push(token))
  }
  return labels
}

const elementHasGitGraphSelectionClassToken = (
  element: Element,
  normalizedLabels: ReadonlySet<string>,
): boolean => {
  let matched = false
  element.classList.forEach(token => {
    if (normalizedLabels.has(normalizeGitGraphComparableLabel(token))) {
      matched = true
    }
  })
  return matched
}

const readGitGraphElementExactTextLabel = (element: Element): string => {
  if (!element.matches('text, tspan')) return ''
  return String(element.textContent || '').replace(/\s+/g, ' ').trim()
}

const findGitGraphSvgElementByExactLabels = (args: {
  svgEl: SVGSVGElement
  labels: ReadonlyArray<string>
  preferredSelectors: ReadonlyArray<string>
}): Element | null => {
  const normalizedLabels = new Set(args.labels.map(normalizeGitGraphComparableLabel).filter(Boolean))
  if (normalizedLabels.size === 0) return null
  const contentEl = args.svgEl.querySelector('[data-kg-svg-zoom-content="1"]') || args.svgEl
  const candidates = Array.from(contentEl.querySelectorAll('circle, text, tspan, path, rect, g')).filter(element => {
    if (element.closest('[data-kg-svg-viewport-hitbox="1"]')) return false
    return (
      elementHasGitGraphSelectionClassToken(element, normalizedLabels) ||
      normalizedLabels.has(normalizeGitGraphComparableLabel(readGitGraphElementExactTextLabel(element)))
    )
  })
  for (const selector of args.preferredSelectors) {
    const match = candidates.find(element => element.matches(selector))
    if (match) return match
  }
  return candidates[0] || null
}

const readGitGraphSvgElementPeersByExactLabel = (args: {
  svgEl: SVGSVGElement
  label: string
}): Element[] => {
  const commandLabel = normalizeGitGraphComparableLabel(args.label)
  if (!commandLabel) return []
  const normalizedLabels = new Set([commandLabel])
  const contentEl = args.svgEl.querySelector('[data-kg-svg-zoom-content="1"]') || args.svgEl
  return Array.from(contentEl.querySelectorAll('circle, text, tspan, path, rect, g')).filter(element => {
    if (element.closest('[data-kg-svg-viewport-hitbox="1"]')) return false
    if (elementHasGitGraphSelectionClassToken(element, normalizedLabels)) return true
    return normalizeGitGraphComparableLabel(readGitGraphElementExactTextLabel(element)) === commandLabel
  })
}

export default function MermaidGitGraphCanvas({ active = true }: MermaidGitGraphCanvasProps) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const svgHostRef = React.useRef<HTMLElement | null>(null)
  const autoOpenedFloatingPanelRef = React.useRef(false)
  const [state, setState] = React.useState<RenderState>({ svg: '', error: null })
  const { code, gitGraphModel, graphData, graphDataRevision, themeMode } = useMermaidGitGraphDocument()
  const {
    floatingPanelOpen,
    setFloatingPanelOpen,
    setFloatingPanelView,
    setGitGraphSelectedCommandLineIndex,
    gitGraphSelectedCommandLineIndex,
  } = useGraphStore(
    useShallow(store => ({
      floatingPanelOpen: store.floatingPanelOpen,
      setFloatingPanelOpen: store.setFloatingPanelOpen,
      setFloatingPanelView: store.setFloatingPanelView,
      setGitGraphSelectedCommandLineIndex: store.setGitGraphSelectedCommandLineIndex,
      gitGraphSelectedCommandLineIndex: store.gitGraphSelectedCommandLineIndex,
    })),
  )
  const selectedCommandLabel = React.useMemo(() => {
    if (gitGraphSelectedCommandLineIndex == null) return ''
    const command = gitGraphModel.commands.find(item => item.lineIndex === gitGraphSelectedCommandLineIndex)
    return readGitGraphCommandSelectionLabel(command)
  }, [gitGraphModel.commands, gitGraphSelectedCommandLineIndex])
  const resolveGitGraphSvgElementLabel = React.useCallback((args: {
    svgEl: SVGSVGElement
    target: Element
    candidate: Element
  }): string => {
    for (const label of readGitGraphSvgElementLabelCandidates(args)) {
      const command = findGitGraphCommandForExactLabel(gitGraphModel.commands, label)
      if (command) return readGitGraphCommandSelectionLabel(command)
    }
    return ''
  }, [gitGraphModel.commands])
  const resolveGitGraphSelectedSvgElementByLabel = React.useCallback((args: {
    svgEl: SVGSVGElement
    label: string
  }): Element | null => {
    const command = findGitGraphCommandForExactLabel(gitGraphModel.commands, args.label)
    const labels = command ? readGitGraphCommandSelectionLabelCandidates(command) : [args.label]
    const preferredSelectors = command?.kind === 'commit' || command?.kind === 'cherry-pick'
      ? ['circle', 'path', 'text', 'tspan', 'g']
      : ['text', 'tspan', 'g', 'path', 'circle']
    return findGitGraphSvgElementByExactLabels({
      svgEl: args.svgEl,
      labels,
      preferredSelectors,
    })
  }, [gitGraphModel.commands])
  const readGitGraphSelectedSvgElementPeers = React.useCallback((args: {
    svgEl: SVGSVGElement
    selectedElement: Element
    label: string
  }): Element[] => {
    const command = findGitGraphCommandForExactLabel(gitGraphModel.commands, args.label)
    const labels = command ? readGitGraphCommandSelectionLabelCandidates(command) : [args.label]
    return labels.flatMap(label => readGitGraphSvgElementPeersByExactLabel({
      svgEl: args.svgEl,
      label,
    }))
  }, [gitGraphModel.commands])
  const handleSelectedElementLabelChange = React.useCallback((label: string) => {
    const command = findGitGraphCommandForExactLabel(gitGraphModel.commands, label)
    if (command) {
      setFloatingPanelView('gitGraph')
      setFloatingPanelOpen(true)
    }
    setGitGraphSelectedCommandLineIndex(command?.lineIndex ?? null)
  }, [
    gitGraphModel.commands,
    setFloatingPanelOpen,
    setFloatingPanelView,
    setGitGraphSelectedCommandLineIndex,
  ])
  const { selectedElementLabel } = useSvgSurfaceZoomRuntime({
    active: active && !!state.svg && !state.error,
    rootRef,
    svgHostRef,
    svgMarkup: state.svg,
    rendererId: 'gitGraph',
    graphData,
    graphDataRevision,
    selectedElementLabel: selectedCommandLabel,
    readSelectedElementLabel: resolveGitGraphSvgElementLabel,
    resolveSelectedElementByLabel: resolveGitGraphSelectedSvgElementByLabel,
    readSelectedElementPeers: readGitGraphSelectedSvgElementPeers,
    onSelectedElementLabelChange: handleSelectedElementLabelChange,
  })

  React.useEffect(() => {
    if (gitGraphSelectedCommandLineIndex == null) return
    if (gitGraphModel.commands.some(command => command.lineIndex === gitGraphSelectedCommandLineIndex)) return
    setGitGraphSelectedCommandLineIndex(null)
  }, [gitGraphModel.commands, gitGraphSelectedCommandLineIndex, setGitGraphSelectedCommandLineIndex])

  React.useEffect(() => {
    if (!active || !code || autoOpenedFloatingPanelRef.current) return
    autoOpenedFloatingPanelRef.current = true
    if (floatingPanelOpen) return
    setFloatingPanelView('gitGraph')
    setFloatingPanelOpen(true)
  }, [active, code, floatingPanelOpen, setFloatingPanelOpen, setFloatingPanelView])

  React.useEffect(() => {
    let cancelled = false
    if (!active) return () => {
      cancelled = true
    }
    if (!code) {
      setState({ svg: '', error: null })
      return () => {
        cancelled = true
      }
    }
    void (async () => {
      try {
        const normalized = normalizeMermaidCodeForRuntime(code)
        const out = await renderPlainMermaidSvgCached({
          code: normalized,
          theme: themeMode === 'dark' ? 'dark' : 'light',
        })
        if (cancelled) return
        const processed = postprocessMermaidSvg(out.svg)
        if (processed.error) {
          setState({ svg: '', error: processed.error })
          return
        }
        setState({ svg: processed.svg, error: null })
      } catch (error) {
        if (cancelled) return
        setState({ svg: '', error: error instanceof Error ? error.message : String(error) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [active, code, themeMode])

  return (
    <section
      ref={rootRef}
      className={`${CANVAS_SURFACE_CLASS} ${CANVAS_INTERACTIVE_CLASS} bg-[var(--kg-canvas-bg)] text-[var(--kg-text-primary)]`}
      aria-label="Mermaid GitGraph canvas"
      data-kg-gitgraph-canvas="1"
      data-kg-gitgraph-interactive="1"
      data-kg-gitgraph-selected-label={selectedElementLabel || undefined}
      data-kg-gitgraph-selected-line={gitGraphSelectedCommandLineIndex ?? undefined}
    >
      <style>
        {`
          [data-kg-gitgraph-canvas="1"] svg {
            display: block;
            width: 100%;
            height: 100%;
            max-width: none;
            overflow: hidden;
            touch-action: none;
          }
          [data-kg-gitgraph-canvas="1"] .commit-label,
          [data-kg-gitgraph-canvas="1"] .branch-label {
            letter-spacing: 0;
          }
          [data-kg-gitgraph-canvas="1"] [data-kg-svg-dimmed="1"] {
            opacity: 0.22;
          }
        `}
      </style>
      {state.error ? (
        <section className="flex h-full w-full items-center justify-center px-6 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </section>
      ) : state.svg ? (
        <section
          ref={svgHostRef}
          className="absolute inset-0 h-full w-full overflow-hidden"
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      ) : (
        <section className="flex h-full w-full items-center justify-center px-6 text-sm text-[var(--kg-text-secondary)]">
          No GitGraph Mermaid frontmatter.
        </section>
      )}
    </section>
  )
}
