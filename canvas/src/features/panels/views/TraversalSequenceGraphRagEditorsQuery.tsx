import React from 'react'
import { Eraser } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import {
  type TraversalSummary,
  type GraphRagTraversalSummary,
} from '@/features/panels/utils/orchestratorTraversal'
import type {
  OrchestratorTraversalEditState,
  OrchestratorTraversalPathEditState,
} from '@/features/panels/views/OrchestratorTraversalSectionModel'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { uiToolbarButtonMutedClassName } from '@/features/toolbar/ui/toolbarStyles'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

const inlineActionButtonClassName = `px-1 py-[1px] border ${UI_THEME_TOKENS.input.border} rounded ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.button.hoverBg}`

interface TraversalQueryExampleEditorProps {
  lastTraversal: GraphRagTraversalSummary
  editState: OrchestratorTraversalEditState
  setLastTraversal: React.Dispatch<React.SetStateAction<TraversalSummary | null>>
}

export function TraversalQueryExampleEditor({
  lastTraversal,
  editState,
  setLastTraversal,
}: TraversalQueryExampleEditorProps) {
  const {
    editingQuery,
    setEditingQuery,
    editingQueryText,
    setEditingQueryText,
    editingExample,
    setEditingExample,
    editingExampleText,
    setEditingExampleText,
  } = editState
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  return (
    <div
      className={[
        'flex flex-col gap-[2px]',
        uiPanelKeyValueTextSizeClass,
        uiPanelTextFontClass,
      ].join(' ')}
    >
      <div className="flex items-center gap-1">
        <span className="font-semibold">{UI_COPY.orchestratorTraversalQueryLabel}</span>
        {editingQuery ? (
          <>
            <PlainTextInputEditor
              value={editingQueryText}
              onChange={setEditingQueryText}
              className="flex-1"
              placeholder={UI_COPY.orchestratorTraversalQueryEnterPlaceholder}
            />
            <button
              type="button"
              className={inlineActionButtonClassName}
              onClick={() => {
                const trimmed = editingQueryText.trim()
                if (!trimmed) return
                setLastTraversal(prev =>
                  prev && prev.mode === 'graphRag'
                    ? ({
                        ...prev,
                        query: trimmed,
                      } as TraversalSummary)
                    : prev,
                )
                setEditingQuery(false)
                setEditingQueryText('')
              }}
            >
              {UI_LABELS.save}
            </button>
            <button
              type="button"
              className={inlineActionButtonClassName}
              onClick={() => {
                setEditingQuery(false)
                setEditingQueryText('')
              }}
            >
              {UI_LABELS.cancel}
            </button>
          </>
        ) : lastTraversal.query ? (
          <>
            <span className={`${uiPanelMonospaceTextClass} break-words flex-1`}>
              {lastTraversal.query}
            </span>
            <button
              type="button"
              className={inlineActionButtonClassName}
              onClick={() => {
                setEditingQuery(true)
                setEditingQueryText(lastTraversal.query || '')
              }}
            >
              {UI_LABELS.edit}
            </button>
            <button
              type="button"
              className={inlineActionButtonClassName}
              onClick={() =>
                setLastTraversal(prev =>
                  prev && prev.mode === 'graphRag'
                    ? ({
                        ...prev,
                        query: null,
                      } as TraversalSummary)
                    : prev,
                )
              }
              aria-label={UI_COPY.orchestratorTraversalClearQueryAriaLabel}
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <PlainTextInputEditor
              value={editingQueryText}
              onChange={setEditingQueryText}
              className="flex-1"
              placeholder={UI_COPY.orchestratorTraversalQueryAddPlaceholder}
            />
            <button
              type="button"
              className={inlineActionButtonClassName}
              onClick={() => {
                const trimmed = editingQueryText.trim()
                if (!trimmed) return
                setLastTraversal(prev =>
                  prev && prev.mode === 'graphRag'
                    ? ({
                        ...prev,
                        query: trimmed,
                      } as TraversalSummary)
                    : prev,
                )
                setEditingQueryText('')
              }}
            >
              {UI_LABELS.add}
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className="font-semibold">{UI_COPY.orchestratorTraversalExampleLabel}</span>
        {editingExample ? (
          <>
            <PlainTextInputEditor
              value={editingExampleText}
              onChange={setEditingExampleText}
              className="flex-1"
              placeholder={UI_COPY.orchestratorTraversalExampleEnterPlaceholder}
            />
            <button
              type="button"
              className={inlineActionButtonClassName}
              onClick={() => {
                const trimmed = editingExampleText.trim()
                if (!trimmed) return
                setLastTraversal(prev =>
                  prev && prev.mode === 'graphRag'
                    ? ({
                        ...prev,
                        example: trimmed,
                      } as TraversalSummary)
                    : prev,
                )
                setEditingExample(false)
                setEditingExampleText('')
              }}
            >
              {UI_LABELS.save}
            </button>
            <button
              type="button"
              className={inlineActionButtonClassName}
              onClick={() => {
                setEditingExample(false)
                setEditingExampleText('')
              }}
            >
              {UI_LABELS.cancel}
            </button>
          </>
        ) : lastTraversal.example ? (
          <>
            <span className={`${uiPanelMonospaceTextClass} break-words flex-1`}>
              {lastTraversal.example}
            </span>
            <button
              type="button"
              className={inlineActionButtonClassName}
              onClick={() => {
                setEditingExample(true)
                setEditingExampleText(lastTraversal.example || '')
              }}
            >
              {UI_LABELS.edit}
            </button>
            <button
              type="button"
              className={inlineActionButtonClassName}
              onClick={() =>
                setLastTraversal(prev =>
                  prev && prev.mode === 'graphRag'
                    ? ({
                        ...prev,
                        example: null,
                      } as TraversalSummary)
                    : prev,
                )
              }
              aria-label={UI_COPY.orchestratorTraversalClearExampleAriaLabel}
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <PlainTextInputEditor
              value={editingExampleText}
              onChange={setEditingExampleText}
              className="flex-1"
              placeholder={UI_COPY.orchestratorTraversalExampleAddPlaceholder}
            />
            <button
              type="button"
              className={inlineActionButtonClassName}
              onClick={() => {
                const trimmed = editingExampleText.trim()
                if (!trimmed) return
                setLastTraversal(prev =>
                  prev && prev.mode === 'graphRag'
                    ? ({
                        ...prev,
                        example: trimmed,
                      } as TraversalSummary)
                    : prev,
                )
                setEditingExampleText('')
              }}
            >
              {UI_LABELS.add}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

interface AddHopInputsProps {
  lastTraversal: TraversalSummary
  editPaths: OrchestratorTraversalPathEditState
  setLastTraversal: React.Dispatch<React.SetStateAction<TraversalSummary | null>>
}

export function AddHopInputs({
  lastTraversal,
  editPaths,
  setLastTraversal,
}: AddHopInputsProps) {
  const {
    newHopText,
    setNewHopText,
    newMultiHopText,
    setNewMultiHopText,
  } = editPaths
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  if (lastTraversal.mode !== 'graphRag') return null
  return (
    <div
      className={[
        'flex flex-col gap-1 mt-1',
        uiPanelKeyValueTextSizeClass,
        uiPanelTextFontClass,
      ].join(' ')}
    >
      <div className="flex items-center gap-1">
        <PlainTextInputEditor
          value={newHopText}
          onChange={setNewHopText}
          placeholder={UI_COPY.orchestratorTraversalAddExampleHopPlaceholder}
          className="flex-1"
        />
        <button
          type="button"
          className={`App-toolbar__btn ${uiToolbarButtonMutedClassName}`}
          onClick={() => {
            const trimmed = newHopText.trim()
            if (!trimmed) return
            setLastTraversal(prev =>
              prev && prev.mode === 'graphRag'
                ? ({
                    ...prev,
                    hops: [...prev.hops, trimmed],
                  } as TraversalSummary)
                : prev,
            )
            setNewHopText('')
          }}
        >
          {UI_COPY.orchestratorTraversalAddHopButtonLabel}
        </button>
      </div>
      <div className="flex items-center gap-1">
        <PlainTextInputEditor
          value={newMultiHopText}
          onChange={setNewMultiHopText}
          placeholder={UI_COPY.orchestratorTraversalAddMultiHopPlaceholder}
          className="flex-1"
        />
        <button
          type="button"
          className={`App-toolbar__btn ${uiToolbarButtonMutedClassName}`}
          onClick={() => {
            const trimmed = newMultiHopText.trim()
            if (!trimmed) return
            setLastTraversal(prev =>
              prev && prev.mode === 'graphRag'
                ? ({
                    ...prev,
                    multiHop: [...prev.multiHop, trimmed],
                  } as TraversalSummary)
                : prev,
            )
            setNewMultiHopText('')
          }}
        >
          {UI_COPY.orchestratorTraversalAddMultiHopButtonLabel}
        </button>
      </div>
    </div>
  )
}
