import React from 'react'

import { AnchoredPopover } from '@/components/ui/AnchoredPopover'
import IconButton from '@/components/IconButton'
import { commitActiveCardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { emitFloatingPanelOpen } from '@/features/canvas/utils'
import { emitMainPanelOpen } from '@/features/panels/utils/useMainPanelRect'
import type { WidgetOpenExternalAction } from '@/components/StoryboardWidget/widgetOpenExternalAction'
import { GRAPH_FIELDS_ENTRY_SHORTCUT_NODE_LABEL } from '@/features/panels/views/graph-fields/graphFieldsEntryCommands'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getRichMediaPanelViewTitle } from '@/lib/render/richMediaSsot'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { Copy, Eraser, ExternalLink, GitBranch, GitMerge, HelpCircle, Link, PanelRightOpen, Play, Share2, SplitSquareVertical, Trash2 } from 'lucide-react'
import { ImportUrlPrompt } from '@/features/toolbar/ImportUrlPrompt'
import { unwrapUserProvidedText } from '@/lib/url'

export type WidgetEditorActionsToolbarProps = {
  visible: boolean
  ariaLabel?: string
  navClassName?: string
  navStyle?: React.CSSProperties
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
  openExternalAction?: WidgetOpenExternalAction
  actionVisibility?: Partial<{
    run: boolean
    updateKvEntry: boolean
    openInSidepane: boolean
    enableHandles: boolean
    probeTree: boolean
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
  onEnableHandlesForAllInputs?: () => void
  onProbeTree?: () => void
  onConvertToLoopNode: () => void
  onUpdateKvEntry?: () => void
  onOpenInSidepane?: () => void
  maxWidthPx?: number
}

export const WidgetEditorActionsToolbar = React.memo(function WidgetEditorActionsToolbar(args: WidgetEditorActionsToolbarProps) {
  const {
    visible,
    iconSizeClass,
    iconStrokeWidth,
    active,
    enableHandlesDisabled,
    convertToLoopDisabled,
    duplicateDisabled,
    richMediaViewToggle,
    openExternalAction,
    onRun,
    onDuplicate,
    onClearOutput,
    onHelp,
    onRemove,
    onEnableHandlesForAllInputs,
    onProbeTree,
    onConvertToLoopNode,
    onUpdateKvEntry,
    onOpenInSidepane,
    maxWidthPx,
  } = args
  const actionVisibility = args.actionVisibility || {}
  const showRunAction = actionVisibility.run !== false
  const showUpdateKvEntryAction = actionVisibility.updateKvEntry !== false
  const showOpenInSidepaneAction = actionVisibility.openInSidepane !== false
  const showEnableHandlesAction = actionVisibility.enableHandles !== false
  const showProbeTreeAction = actionVisibility.probeTree !== false
  const showConvertToLoopAction = actionVisibility.convertToLoop !== false
  const showDuplicateAction = actionVisibility.duplicate !== false
  const showClearOutputAction = actionVisibility.clearOutput !== false
  const showHelpAction = actionVisibility.help !== false
  const showRemoveAction = actionVisibility.remove !== false
  const importUrlButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const [importUrlOpen, setImportUrlOpen] = React.useState(false)
  const [importUrlDraft, setImportUrlDraft] = React.useState('')

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
        className={cn(
          'Island App-toolbar App-toolbar--compact App-toolbar--touch-scroll pointer-events-auto w-fit shadow-lg',
          args.navClassName || '',
        )}
        aria-label={args.ariaLabel || UI_LABELS.flowWidgetActions}
        style={{
          ...(typeof maxWidthPx === 'number' && Number.isFinite(maxWidthPx) && maxWidthPx > 0 ? { maxWidth: `${maxWidthPx}px` } : undefined),
          ...(args.navStyle || {}),
        }}
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
            onPointerDown={() => {
              commitActiveCardInlineTextEditor()
            }}
            onClick={onRun}
            className="App-toolbar__btn"
          >
            <Play className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
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

        {openExternalAction?.visible ? (
          <IconButton
            title={openExternalAction.label || 'Open source'}
            tooltipContent={openExternalAction.label || 'Open source'}
            showTooltip
            onClick={openExternalAction.onOpen}
            className="App-toolbar__btn"
          >
            <ExternalLink className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {showUpdateKvEntryAction ? (
          <IconButton
            title={UI_LABELS.updateKvEntry}
            tooltipContent={UI_LABELS.updateKvEntry}
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
            onClick={onOpenInSidepane || (() => {
              emitMainPanelOpen({
                tab: 'workflowManager' as const,
                workflowManagerTab: 'graph' as const,
                workflowManagerEntryLabel: GRAPH_FIELDS_ENTRY_SHORTCUT_NODE_LABEL,
              })
            })}
            className="App-toolbar__btn"
          >
            <PanelRightOpen className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}

        {showEnableHandlesAction && !enableHandlesDisabled && onEnableHandlesForAllInputs ? (
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

        {showProbeTreeAction && onProbeTree ? (
          <IconButton
            title={UI_LABELS.probeTree}
            tooltipContent={UI_COPY.flowWidgetProbeTree}
            showTooltip
            onClick={onProbeTree}
            className="App-toolbar__btn"
          >
            <GitBranch className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
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
            className={cn('App-toolbar__btn', UI_THEME_TOKENS.status.error.split(' ').slice(0, 2).join(' '))}
          >
            <Trash2 className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden={true} />
          </IconButton>
        ) : null}
      </nav>

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
