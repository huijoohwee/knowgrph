import React from 'react'
import { useDragResize } from '@/features/hooks/useDragResize'
import { UI_LABELS } from '@/lib/config'
import Tooltip from './Tooltip'

interface CollapsiblePanelProps {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  heightRatio: number
  setHeightRatio: (r: number) => void
  header: React.ReactNode
  children: React.ReactNode
}

export default function CollapsiblePanel({ collapsed, setCollapsed, heightRatio, setHeightRatio, header, children }: CollapsiblePanelProps) {
  const headerRef = React.useRef<HTMLDivElement | null>(null)
  const [collapsedHeaderPx, setCollapsedHeaderPx] = React.useState<number>(40)
  const dragRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const measure = () => {
      if (timer) return
      timer = setTimeout(() => {
        const el = headerRef.current
        if (el) {
          const h = Math.max(24, Math.floor(el.getBoundingClientRect().height))
          setCollapsedHeaderPx(h)
        }
        timer = null
      }, 100)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      if (timer) clearTimeout(timer)
    }
  }, [])

  React.useEffect(() => {
    const root = document.documentElement
    const vh = window.innerHeight
    const h = collapsed ? collapsedHeaderPx : Math.round(heightRatio * vh)
    root.style.setProperty('--bottom-panel-height-px', `${h}px`)
  }, [collapsed, collapsedHeaderPx, heightRatio])

  useDragResize({ collapsed, ratio: heightRatio, setRatio: setHeightRatio, handleRef: dragRef })

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 transition-all duration-200 flex flex-col z-10`}
      style={{ height: collapsed ? `${collapsedHeaderPx}px` : `${Math.round(heightRatio * 100)}vh` }}
      data-setcollapsed={typeof setCollapsed === 'function' ? '1' : '0'}
    >
      {!collapsed && (
        <Tooltip content={UI_LABELS.dragToResize}>
          <button
            type="button"
            ref={dragRef}
            className="h-4 w-full cursor-row-resize bg-transparent select-none pointer-events-auto touch-none"
            title={UI_LABELS.dragToResize}
            aria-label="Resize panel"
          />
        </Tooltip>
      )}
      <div className="ModalContainer h-full flex flex-col rounded-none shadow-none p-0 border-t border-gray-200 border-x-0 border-b-0">
        <div ref={headerRef}>{header}</div>
        {!collapsed && children}
      </div>
    </div>
  )
}
