import React from 'react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { FieldKeyIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import { GRAPH_FIELD_TYPES, type GraphFieldType } from '@/features/graph-fields/graphFields'

export type NewFieldFormProps = {
  newFieldKey: string
  setNewFieldKey: (value: string) => void
  newFieldScope: 'node' | 'edge'
  setNewFieldScope: (value: 'node' | 'edge') => void
  newFieldType: GraphFieldType
  setNewFieldType: (value: GraphFieldType) => void
  createNewField: () => void
  setNewFieldOpen: (open: boolean) => void
  graphDataPresent: boolean
  uiPanelKeyValueTextSizeClass: string
  iconSizeClass: string
  uiIconStrokeWidth: number
}

export function NewFieldForm({
  newFieldKey,
  setNewFieldKey,
  newFieldScope,
  setNewFieldScope,
  newFieldType,
  setNewFieldType,
  createNewField,
  setNewFieldOpen,
  graphDataPresent,
  uiPanelKeyValueTextSizeClass,
  iconSizeClass,
  uiIconStrokeWidth,
}: NewFieldFormProps) {
  return (
    <div className="border-b border-gray-200 bg-white p-2">
      <form
        onSubmit={e => {
          e.preventDefault()
          createNewField()
        }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>{UI_LABELS.name}</div>
            <div className="mt-1 flex items-center gap-2 rounded border border-gray-300 bg-white px-2">
              <FieldKeyIcon
                className={`${iconSizeClass} text-gray-500`}
                strokeWidth={uiIconStrokeWidth}
              />
              <input
                value={newFieldKey}
                onChange={e => setNewFieldKey(e.target.value)}
                placeholder={UI_COPY.fieldNamePlaceholder}
                className="h-8 w-full bg-transparent text-xs outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>{UI_LABELS.scope}</div>
            <div className="mt-1">
              <select
                value={newFieldScope}
                onChange={e =>
                  setNewFieldScope(e.target.value === 'edge' ? 'edge' : 'node')
                }
                className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs"
              >
                <option value="node">Node</option>
                <option value="edge">Edge</option>
              </select>
            </div>
          </div>
          <div className="flex-1">
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>{UI_LABELS.type}</div>
            <div className="mt-1">
              <select
                value={newFieldType}
                onChange={e => setNewFieldType(e.target.value as GraphFieldType)}
                className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs"
              >
                {GRAPH_FIELD_TYPES.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className={`${uiPanelKeyValueTextSizeClass} rounded border border-gray-200 bg-white px-2 py-1 text-gray-700`}
            onClick={() => setNewFieldOpen(false)}
          >
            {UI_LABELS.cancel}
          </button>
          <button
            type="submit"
            className={`${uiPanelKeyValueTextSizeClass} rounded border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700 disabled:opacity-50`}
            disabled={!graphDataPresent}
          >
            {UI_LABELS.create}
          </button>
        </div>
      </form>
    </div>
  )
}
