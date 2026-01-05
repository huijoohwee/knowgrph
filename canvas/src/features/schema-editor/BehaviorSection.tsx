import React from 'react'
import Subsection from '@/features/schema-editor/ui/Subsection'
import type { GraphSchema, GraphBehavior } from '@/lib/graph/schema'

type BehaviorSectionProps = {
  schema: GraphSchema
  uiPanelKeyValueInputClass: string
  uiPanelKeyValueTextSizeClass: string
  uniqueNodeTypes: string[]
  setBehavior: (patch: Partial<GraphBehavior>) => void
}

export default function BehaviorSection({
  schema,
  uiPanelKeyValueInputClass,
  uiPanelKeyValueTextSizeClass,
  uniqueNodeTypes,
  setBehavior,
}: BehaviorSectionProps) {
  return (
    <div className="space-y-3">
      <div className={`${uiPanelKeyValueTextSizeClass} font-semibold text-gray-700`}>Behavior</div>
      <Subsection title="Behavior">
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={schema.behavior.allowNodeDrag}
              onChange={e => setBehavior({ allowNodeDrag: e.target.checked })}
            />
            Node Drag
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={schema.behavior.allowEdgeCreation}
              onChange={e => setBehavior({ allowEdgeCreation: e.target.checked })}
            />
            Edge Creation
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={schema.behavior.hover?.enabled !== false}
              onChange={e =>
                setBehavior({
                  hover: { ...(schema.behavior.hover || {}), enabled: e.target.checked },
                })
              }
            />
            Hover Tooltips
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={schema.behavior.expansion?.enabled !== false}
              onChange={e =>
                setBehavior({
                  expansion: { ...(schema.behavior.expansion || {}), enabled: e.target.checked },
                })
              }
            />
            Neighbor Expansion
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span>Drag Constraint</span>
          <select
            value={schema.behavior.dragConstraint ?? 'free'}
            onChange={e => {
              const v: GraphBehavior['dragConstraint'] =
                e.target.value === 'axis-x' || e.target.value === 'axis-y' || e.target.value === 'none'
                  ? e.target.value
                  : 'free'
              setBehavior({ dragConstraint: v })
            }}
            className="px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="free">Free</option>
            <option value="axis-x">Axis-X</option>
            <option value="axis-y">Axis-Y</option>
            <option value="none">None</option>
          </select>
          <label className="flex items-center gap-1 ml-4">
            <input
              type="checkbox"
              checked={!!schema.behavior.snapGrid?.enabled}
              onChange={e =>
                setBehavior({
                  snapGrid: {
                    enabled: e.target.checked,
                    size: schema.behavior.snapGrid?.size ?? 10,
                  },
                })
              }
            />
            Snap Grid
          </label>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={schema.behavior.snapGrid?.size ?? 10}
            onChange={e =>
              setBehavior({
                snapGrid: {
                  enabled: schema.behavior.snapGrid?.enabled ?? false,
                  size: parseInt(e.target.value || '10', 10),
                },
              })
            }
            className={uiPanelKeyValueInputClass}
          />
          <label className="flex items-center gap-1 ml-4 text-xs">
            <input
              type="checkbox"
              checked={!!schema.behavior.preventDuplicatesGlobal}
              onChange={e => setBehavior({ preventDuplicatesGlobal: e.target.checked })}
            />
            Prevent Duplicates
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={!!schema.behavior.preventSelfLoopsGlobal}
              onChange={e => setBehavior({ preventSelfLoopsGlobal: e.target.checked })}
            />
            Prevent Self-Loops
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span>Select Mode</span>
            <select
              value={schema.behavior.selectMode ?? 'single'}
              onChange={e => {
                const raw = e.target.value
                const v: GraphBehavior['selectMode'] = raw === 'multi' || raw === 'lasso' ? raw : 'single'
                setBehavior({ selectMode: v })
              }}
              className="px-2 py-1 text-xs border border-gray-300 rounded"
            >
              <option value="single">Single</option>
              <option value="multi">Multi</option>
              <option value="lasso">Lasso</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>Create Mode</span>
            <select
              value={schema.behavior.createMode ?? 'shift-drag'}
              onChange={e => {
                const raw = e.target.value
                const v: GraphBehavior['createMode'] =
                  raw === 'click-source-target' || raw === 'panel-only' ? raw : 'shift-drag'
                setBehavior({ createMode: v })
              }}
              className="px-2 py-1 text-xs border border-gray-300 rounded"
            >
              <option value="shift-drag">Shift-drag</option>
              <option value="click-source-target">Click source/target</option>
              <option value="panel-only">Panel only</option>
            </select>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span>Default Node Type</span>
          <select
            value={schema.behavior.defaultNodeType ?? ''}
            onChange={e => setBehavior({ defaultNodeType: e.target.value || undefined })}
            className="px-2 py-1 text-xs border border-gray-300 rounded"
          >
            <option value="">(none)</option>
            {uniqueNodeTypes.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </Subsection>
    </div>
  )
}

