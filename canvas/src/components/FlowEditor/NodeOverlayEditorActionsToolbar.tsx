import React from 'react'

import { AnchoredPopover } from '@/components/ui/AnchoredPopover'
import IconButton from '@/components/IconButton'
import { emitSidePanelOpen } from '@/features/canvas/utils'
import { emitMainPanelOpen } from '@/features/panels/utils/useMainPanelRect'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import {
  getRichMediaPanelMediaSelectorOptions,
  getRichMediaPanelViewTitle,
  RICH_MEDIA_PANEL_MEDIA_SELECTOR_LABEL,
  type RichMediaPanelTab,
} from '@/lib/render/richMediaSsot'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { Copy, Eraser, ExternalLink, GitMerge, HelpCircle, Images, Link, PanelRightOpen, Play, Share2, SplitSquareVertical, Trash2 } from 'lucide-react'
import { ImportUrlPrompt } from '@/features/toolbar/ImportUrlPrompt'
import { unwrapUserProvidedText } from '@/lib/url'

export const NodeOverlayEditorActionsToolbar = React.memo(function NodeOverlayEditorActionsToolbar(args: {
  visible: boolean
  iconSizeClass: string
  iconStrokeWidth: number
  active: boolean
  enableHandlesDisabled: boolean
  convertToLoopDisabled: boolean
  duplicateDisabled: boolean
  richMediaViewToggle?: {
    visible: boolean
    isKtvRows: boolean
    onToggle: () => void
  }
  richMediaMediaSelector?: {
    visible: boolean
    selectedMode: RichMediaPanelTab
    onSelect: (next: RichMediaPanelTab) => void
  }
  richMediaAspectToggle?: {
    visible: boolean
    selected: '16:9' | '9:16' | null
    onToggle: () => void
  }
  richMediaTextModeToggle?: {
    visible: boolean
    freezeConnectedOutput: boolean
    onToggle: () => void
  }
  openExternalAction?: {
    visible: boolean
    label?: string
    onOpen: () => void
  }
  actionVisibility?: Partial<{
    run: boolean
    updateKvEntry: boolean
    openInSidepane: boolean
    enableHandles: boolean
    convertToLoop: boolean
    duplicate: boolean
    clearOutput: boolean
    help: boolean
    remove: boolean
  }>
  importUrlAction?: {
    visible: boolean
    initialUrl?: string
    onConfirm: (url: string) => void
  }
  onRun: () => void
  onDuplicate: () => void
  onClearOutput: () => void
  onHelp: () => void
  onRemove: () => void
  onEnableHandlesForAllInputs: () => void
  onConvertToLoopNode: () => void
  onUpdateKvEntry?: () => void
}) {
  const {
    visible,
    iconSizeClass,
    iconStrokeWidth,
    active,
    enableHandlesDisabled,
    convertToLoopDisabled,
    duplicateDisabled,
    richMediaViewToggle,
    richMediaMediaSelector,
    richMediaAspectToggle,
    richMediaTextModeToggle,
    openExternalAction,
    onRun,
    onDuplicate,
    onClearOutput,
    onHelp,
    onRemove,
    onEnableHandlesForAllInputs,
    onConvertToLoopNode,
    onUpdateKvEntry,
  } = args
  const actionVisibility = args.actionVisibility || {}
  const showRunAction = actionVisibility.run !== false
  const showUpdateKvEntryAction = actionVisibility.updateKvEntry !== false
  const showOpenInSidepaneAction = actionVisibility.openInSidepane !== false
  const showEnableHandlesAction = actionVisibility.enableHandles !== false
  const showConvertToLoopAction = actionVisibility.convertToLoop !== false
  const showDuplicateAction = actionVisibility.duplicate !== false
  const showClearOutputAction = actionVisibility.clearOutput !== false
  const showHelpAction = actionVisibility.help !== false
  const showRemoveAction = actionVisibility.remove !== false
  const mediaSelectorButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const [mediaSelectorOpen, setMediaSelectorOpen] = React.useState(false)
  const importUrlButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const [importUrlOpen, setImportUrlOpen] = React.useState(false)
  const [importUrlDraft, setImportUrlDraft] = React.useState('')
  const mediaSelectorOptions = React.useMemo(() => getRichMediaPanelMediaSelectorOptions(), [])
  const mediaSelectorSelectedLabel = React.useMemo(() => {
    const selected = mediaSelectorOptions.find(option => option.value === richMediaMediaSelector?.selectedMode)
    return selected?.label || 'Auto-switch (Default)'
  }, [mediaSelectorOptions, richMediaMediaSelector?.selectedMode])

  React.useEffect(() => {
    if (richMediaMediaSelector?.visible) return
    setMediaSelectorOpen(false)
  }, [richMediaMediaSelector?.visible])

  React.useEffect(() => {
    if (!args.importUrlAction?.visible) {
      setImportUrlOpen(false)
      return
    }
    if (importUrlOpen) return
    const initial = String(args.importUrlAction?.initialUrl || '').trim()
    if (initial && initial !== importUrlDraft) setImportUrlDraft(initial)
  }, [args.importUrlAction?.initialUrl, args.importUrlAction?.visible, importUrlDraft, importUrlOpen])

  if (!visible) return null
  return (
    <>
      <nav
        className="Island App-toolbar App-toolbar--compact pointer-events-auto w-fit shadow-lg"
        aria-label={UI_LABELS.flowWidgetActions}
        onPointerDownCapture={e => {
          try {
            e.stopPropagation()
          } catch {
            void 0
          }
        }}
      >
        {showRunAction ? (
          <IconButton
            title={UI_COPY.flowWidgetRun}
            tooltipContent={UI_COPY.flowWidgetRun}
            showTooltip
            onClick={onRun}
            className="App-toolbar__btn"
          >
            <Play className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {args.importUrlAction?.visible ? (
          <IconButton
            ref={importUrlButtonRef}
            title="Import URL"
            tooltipContent="Import URL"
            showTooltip
            onClick={() => setImportUrlOpen(prev => !prev)}
            className={cn(
              'App-toolbar__btn',
              importUrlOpen ? UI_THEME_TOKENS.icon.active : '',
            )}
            data-kg-import-url="1"
          >
            <Link className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {richMediaMediaSelector?.visible ? (
          <IconButton
            ref={mediaSelectorButtonRef}
            title={`${RICH_MEDIA_PANEL_MEDIA_SELECTOR_LABEL}: ${mediaSelectorSelectedLabel}`}
            tooltipContent={`${RICH_MEDIA_PANEL_MEDIA_SELECTOR_LABEL}: ${mediaSelectorSelectedLabel}`}
            showTooltip
            onClick={() => setMediaSelectorOpen(prev => !prev)}
            className={cn(
              'App-toolbar__btn text-[11px]',
              mediaSelectorOpen ? UI_THEME_TOKENS.icon.active : '',
            )}
            data-kg-rich-media-media-selector="1"
          >
            <Images className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {richMediaAspectToggle?.visible ? (
          <IconButton
            title={`Rich Media aspect toggle (${richMediaAspectToggle.selected || '16:9'})`}
            tooltipContent={`Rich Media aspect toggle (${richMediaAspectToggle.selected || '16:9'})`}
            showTooltip
            onClick={richMediaAspectToggle.onToggle}
            className={cn(
              'App-toolbar__btn px-1.5 min-w-[36px]',
              richMediaAspectToggle.selected ? UI_THEME_TOKENS.icon.active : '',
            )}
            data-kg-rich-media-aspect-toggle="1"
          >
            <span className="text-[10px] font-semibold leading-none" aria-hidden={true}>
              {richMediaAspectToggle.selected || '16:9'}
            </span>
          </IconButton>
        ) : null}

        {richMediaTextModeToggle?.visible ? (
          <IconButton
            title={richMediaTextModeToggle.freezeConnectedOutput ? 'View connected output' : 'Edit output'}
            tooltipContent={richMediaTextModeToggle.freezeConnectedOutput ? 'View connected output' : 'Edit output'}
            showTooltip
            onClick={richMediaTextModeToggle.onToggle}
            className={cn(
              'App-toolbar__btn px-1.5 min-w-[40px] text-[10px] font-semibold',
              richMediaTextModeToggle.freezeConnectedOutput ? UI_THEME_TOKENS.icon.active : '',
            )}
            data-kg-rich-media-text-mode-toggle="1"
          >
            <span aria-hidden={true}>
              {richMediaTextModeToggle.freezeConnectedOutput ? 'View' : 'Edit'}
            </span>
          </IconButton>
        ) : null}

        {openExternalAction?.visible ? (
          <IconButton
            title={openExternalAction.label || 'Open source'}
            tooltipContent={openExternalAction.label || 'Open source'}
            showTooltip
            onClick={openExternalAction.onOpen}
            className="App-toolbar__btn"
            data-kg-rich-media-open-source="1"
          >
            <ExternalLink className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {richMediaViewToggle?.visible ? (
          <IconButton
            title={getRichMediaPanelViewTitle(richMediaViewToggle.isKtvRows)}
            tooltipContent={richMediaViewToggle.isKtvRows ? UI_COPY.flowWidgetRichMediaPanelView : UI_COPY.flowWidgetRichMediaKtvRows}
            showTooltip
            onClick={richMediaViewToggle.onToggle}
            className={cn('App-toolbar__btn text-[11px]', richMediaViewToggle.isKtvRows ? UI_THEME_TOKENS.icon.active : '')}
          >
            <SplitSquareVertical className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {showUpdateKvEntryAction ? (
          <IconButton
            title={UI_LABELS.applyToNode}
            tooltipContent="Update KV entry"
            showTooltip
            onClick={onUpdateKvEntry || (() => {
              emitMainPanelOpen({
                tab: 'workflowManager' as const,
                workflowManagerTab: 'mapping' as const,
              })
            })}
            className="App-toolbar__btn"
          >
            <PanelRightOpen className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {showOpenInSidepaneAction ? (
          <IconButton
            title={UI_LABELS.openInSidepane}
            tooltipContent={UI_COPY.flowWidgetOpenInSidepane}
            showTooltip
            onClick={() => emitSidePanelOpen({ tab: 'node', open: true })}
            className="App-toolbar__btn"
          >
            <PanelRightOpen className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {showEnableHandlesAction && !enableHandlesDisabled ? (
          <IconButton
            title={UI_LABELS.enableHandlesForAllInputs}
            tooltipContent={UI_COPY.flowWidgetEnableHandles}
            showTooltip
            onClick={onEnableHandlesForAllInputs}
            className="App-toolbar__btn"
          >
            <Share2 className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {showConvertToLoopAction && !convertToLoopDisabled ? (
          <IconButton
            title={UI_LABELS.convertToLoopNode}
            tooltipContent={UI_COPY.flowWidgetConvertToLoop}
            showTooltip
            onClick={onConvertToLoopNode}
            className="App-toolbar__btn"
          >
            <GitMerge className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {showDuplicateAction && !duplicateDisabled ? (
          <IconButton
            title={UI_LABELS.duplicate}
            tooltipContent={UI_COPY.flowWidgetDuplicate}
            showTooltip
            onClick={onDuplicate}
            className="App-toolbar__btn"
          >
            <Copy className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {showClearOutputAction ? (
          <IconButton
            title={UI_LABELS.clearOutput}
            tooltipContent={UI_COPY.flowWidgetClearOutput}
            showTooltip
            onClick={onClearOutput}
            className="App-toolbar__btn"
          >
            <Eraser className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {showHelpAction ? (
          <IconButton
            title={UI_LABELS.help}
            tooltipContent={UI_COPY.flowWidgetHelp}
            showTooltip
            onClick={onHelp}
            className="App-toolbar__btn"
          >
            <HelpCircle className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {showRemoveAction ? (
          <IconButton
            title={UI_LABELS.removeNode}
            tooltipContent={UI_COPY.flowWidgetRemoveNode}
            showTooltip
            onClick={onRemove}
            className={cn('App-toolbar__btn', 'text-red-700 dark:text-red-400')}
          >
            <Trash2 className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}
      </nav>

      <AnchoredPopover
        open={Boolean(richMediaMediaSelector?.visible && mediaSelectorOpen)}
        anchorEl={mediaSelectorButtonRef.current}
        ariaLabel={RICH_MEDIA_PANEL_MEDIA_SELECTOR_LABEL}
        placement="bottom-start"
        minWidthPx={220}
        maxWidthPx={280}
        maxHeightPx={280}
        onClose={() => setMediaSelectorOpen(false)}
      >
        <section className={`${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border} border rounded p-2 shadow-sm`}>
          <menu className="m-0 p-0 list-none flex flex-col gap-1" aria-label={RICH_MEDIA_PANEL_MEDIA_SELECTOR_LABEL}>
            {mediaSelectorOptions.map(option => {
              const selected = option.value === richMediaMediaSelector?.selectedMode
              return (
                <li key={option.value} className="list-none">
                  <button
                    type="button"
                    className={cn(
                      'w-full rounded px-2 py-1.5 text-left text-xs',
                      selected ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200' : 'hover:bg-black/5 dark:hover:bg-white/5',
                    )}
                    aria-pressed={selected}
                    onClick={() => {
                      richMediaMediaSelector?.onSelect(option.value)
                      setMediaSelectorOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              )
            })}
          </menu>
        </section>
      </AnchoredPopover>

      <AnchoredPopover
        open={Boolean(args.importUrlAction?.visible && importUrlOpen)}
        anchorEl={importUrlButtonRef.current}
        ariaLabel="Import URL"
        placement="bottom-start"
        minWidthPx={360}
        maxWidthPx={520}
        maxHeightPx={260}
        onClose={() => setImportUrlOpen(false)}
      >
        <section className={`${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border} border rounded p-2 shadow-sm`}>
          <ImportUrlPrompt
            urlDraft={importUrlDraft}
            onChange={setImportUrlDraft}
            autoFocus
            confirmLabel="Set"
            onCancel={() => setImportUrlOpen(false)}
            onConfirm={(nextUrlRaw) => {
              const cleaned = unwrapUserProvidedText(nextUrlRaw) || nextUrlRaw
              const next = String(cleaned || '').trim()
              if (!next) return
              args.importUrlAction?.onConfirm(next)
              setImportUrlOpen(false)
            }}
          />
        </section>
      </AnchoredPopover>
    </>
  )
})
