import React from 'react'

export type PreviewGalleryItem = {
  id: string
  label: string
}

type PreviewGalleryProps = {
  items: PreviewGalleryItem[]
  activeId: string | null
  onSelect: (id: string) => void
  onReorder: (nextIds: string[]) => void
}

const moveBefore = (ids: string[], fromId: string, toId: string): string[] => {
  if (fromId === toId) return ids
  const fromIdx = ids.indexOf(fromId)
  const toIdx = ids.indexOf(toId)
  if (fromIdx < 0 || toIdx < 0) return ids
  const next = ids.slice()
  next.splice(fromIdx, 1)
  const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx
  next.splice(insertIdx, 0, fromId)
  return next
}

export default function PreviewGallery({ items, activeId, onSelect, onReorder }: PreviewGalleryProps) {
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [dragOverId, setDragOverId] = React.useState<string | null>(null)

  const ids = React.useMemo(() => items.map(i => i.id), [items])

  return (
    <div className="p-2">
      <div className="text-xs font-medium text-gray-700 mb-2">Slides</div>
      <div className="space-y-1">
        {items.map((it, idx) => {
          const isActive = activeId === it.id
          const isDragOver = dragOverId === it.id
          return (
            <div
              key={it.id}
              className={[
                'rounded border px-2 py-2 select-none',
                isActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50',
                isDragOver ? 'ring-1 ring-blue-400' : '',
              ].filter(Boolean).join(' ')}
              draggable
              onClick={() => onSelect(it.id)}
              onDragStart={(e) => {
                setDraggingId(it.id)
                setDragOverId(it.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', it.id)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOverId(it.id)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = e.dataTransfer.getData('text/plain') || ''
                if (!from) return
                const nextIds = moveBefore(ids, from, it.id)
                onReorder(nextIds)
                setDraggingId(null)
                setDragOverId(null)
              }}
              onDragEnd={() => {
                setDraggingId(null)
                setDragOverId(null)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDragOverId(null)
                }
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-gray-900 truncate">{it.label}</div>
                  <div className="text-[11px] text-gray-500">#{idx + 1}</div>
                </div>
                {draggingId === it.id ? <div className="text-[11px] text-gray-500">Moving</div> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

