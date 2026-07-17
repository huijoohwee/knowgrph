import type React from 'react'

export function VideoSequenceTimeAxisControls({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return (
    <section
      className="timeline-video-sequence-time-axis-controls"
      aria-label="Timeline time-axis controls"
      data-kg-video-sequence-time-axis-controls="1"
      onPointerDown={event => event.stopPropagation()}
    >
      {children}
    </section>
  )
}
