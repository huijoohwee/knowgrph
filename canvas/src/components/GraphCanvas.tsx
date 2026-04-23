import React from 'react'
import GraphCanvasRoot from '@/components/GraphCanvasRoot'
import { CANVAS_INTERACTIVE_CLASS } from '@/lib/canvas/surface'

const WHEEL_LISTENER_OPTS: AddEventListenerOptions = { passive: false, capture: true }

export default function GraphCanvas(props: React.ComponentProps<typeof GraphCanvasRoot>) {
  React.useEffect(() => {
    if (props.active === false) return
    const onWheel = (event: WheelEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest(`.${CANVAS_INTERACTIVE_CLASS}`)) return
      event.preventDefault()
    }
    window.addEventListener('wheel', onWheel, WHEEL_LISTENER_OPTS)
    return () => {
      try {
        window.removeEventListener('wheel', onWheel, WHEEL_LISTENER_OPTS)
      } catch {
        void 0
      }
    }
  }, [props.active])
  return <GraphCanvasRoot {...props} />
}
