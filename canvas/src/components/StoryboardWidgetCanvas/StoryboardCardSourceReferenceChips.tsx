import React from 'react'

import type { StoryboardCardSourceReference } from '@/components/StoryboardCanvas/storyboardCardConnectedSources'
import {
  UI_INLINE_CHIP_LABEL_15CH_CLASSNAME,
  UI_INLINE_CHIP_SHELL_15CH_CLASSNAME,
  UI_TEXT_TRUNCATE_CHIP,
} from '@/lib/ui/textLayout'

export function StoryboardCardSourceReferenceChips(props: {
  references: readonly StoryboardCardSourceReference[]
  onActivate?: (reference: StoryboardCardSourceReference) => void
}) {
  if (props.references.length === 0) return null
  return (
    <ul
      aria-label="Connected source cards"
      className="m-0 flex shrink-0 list-none items-center gap-1 p-0"
      data-kg-storyboard-card-source-references="1"
    >
      {props.references.map(reference => (
        <li key={reference.nodeId} className="shrink-0 list-none">
          <button
            type="button"
            aria-label={`Source ${reference.label}`}
            className={`inline-flex max-w-[8.75rem] cursor-pointer items-center gap-0.5 rounded-full border border-[color:var(--kg-border)] bg-[color:var(--kg-input-bg)] px-1.5 py-0.5 font-semibold text-[8px] text-[color:var(--kg-text-secondary)] hover:text-[color:var(--kg-text-primary)] ${UI_INLINE_CHIP_SHELL_15CH_CLASSNAME}`}
            data-kg-storyboard-card-source-reference-chip="1"
            data-kg-storyboard-card-source-node-id={reference.nodeId}
            data-kg-storyboard-card-source-target-fields={reference.targetFieldIds.join(',')}
            title={`Connected source: ${reference.label}`}
            onPointerDown={event => event.stopPropagation()}
            onMouseDown={event => event.stopPropagation()}
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
              props.onActivate?.(reference)
            }}
          >
            <span aria-hidden="true">←</span>
            <span className={`${UI_TEXT_TRUNCATE_CHIP} ${UI_INLINE_CHIP_LABEL_15CH_CLASSNAME}`}>
              {reference.label}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
