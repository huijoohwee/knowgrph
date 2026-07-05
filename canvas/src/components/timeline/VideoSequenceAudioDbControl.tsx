import React from 'react'

const AUDIO_DB_MIN = -24
const AUDIO_DB_MAX = 12
const AUDIO_DB_STEP = 1

function clampAudioDb(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(AUDIO_DB_MAX, Math.max(AUDIO_DB_MIN, Math.round(value / AUDIO_DB_STEP) * AUDIO_DB_STEP))
}

function resolveAudioDbFromClientY(clientY: number, rect: DOMRect): number {
  const ratio = rect.height > 0 ? Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)) : 0
  return clampAudioDb(AUDIO_DB_MAX - ratio * (AUDIO_DB_MAX - AUDIO_DB_MIN))
}

function resolveAudioDbControlTopPercent(dbValue: number): number {
  return ((AUDIO_DB_MAX - clampAudioDb(dbValue)) / (AUDIO_DB_MAX - AUDIO_DB_MIN)) * 100
}

export function VideoSequenceAudioDbControl({ label, rowKey }: { label: string; rowKey: string }) {
  const [dbValueByRowKey, setDbValueByRowKey] = React.useState<Record<string, number>>({})
  const dbValue = dbValueByRowKey[rowKey] ?? 0
  const dbLabel = `${dbValue > 0 ? '+' : ''}${dbValue} dB`
  const controlRef = React.useRef<HTMLButtonElement | null>(null)

  const updateDbValue = React.useCallback((nextValue: number) => {
    setDbValueByRowKey(current => ({
      ...current,
      [rowKey]: clampAudioDb(nextValue),
    }))
  }, [rowKey])

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = (event.currentTarget.closest('[data-kg-gantt-timeline-track-span="1"]') || event.currentTarget).getBoundingClientRect()
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    updateDbValue(resolveAudioDbFromClientY(event.clientY, rect))
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return
      updateDbValue(resolveAudioDbFromClientY(moveEvent.clientY, rect))
    }
    const handlePointerEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== event.pointerId) return
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerEnd, { passive: true })
    window.addEventListener('pointercancel', handlePointerEnd, { passive: true })
  }, [updateDbValue])

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault()
      event.stopPropagation()
      updateDbValue(dbValue + AUDIO_DB_STEP)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault()
      event.stopPropagation()
      updateDbValue(dbValue - AUDIO_DB_STEP)
    } else if (event.key === 'Home') {
      event.preventDefault()
      event.stopPropagation()
      updateDbValue(AUDIO_DB_MIN)
    } else if (event.key === 'End') {
      event.preventDefault()
      event.stopPropagation()
      updateDbValue(AUDIO_DB_MAX)
    }
  }, [dbValue, updateDbValue])

  return (
    <button
      ref={controlRef}
      type="button"
      role="slider"
      className="timeline-video-sequence-audio-db-control"
      aria-label={`${label} audio gain`}
      aria-valuemin={AUDIO_DB_MIN}
      aria-valuemax={AUDIO_DB_MAX}
      aria-valuenow={dbValue}
      aria-valuetext={dbLabel}
      data-kg-video-sequence-audio-db-control="1"
      data-kg-video-sequence-audio-db-value={dbValue}
      style={{ '--kg-video-sequence-audio-db-top': `${resolveAudioDbControlTopPercent(dbValue)}%` } as React.CSSProperties}
      title={dbLabel}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    >
      <span className="timeline-video-sequence-audio-db-line" aria-hidden="true" />
      <span className="timeline-video-sequence-audio-db-handle" aria-hidden="true" />
      <span className="timeline-video-sequence-audio-db-value">{dbLabel}</span>
    </button>
  )
}
