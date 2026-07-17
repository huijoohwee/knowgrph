import React from 'react'
import { Clapperboard, MapPin, Video } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { PanelSelect, PanelTextInput } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import {
  STRYBLDR_CAMERA_MAX_FOCAL_LENGTH_MM,
  STRYBLDR_CAMERA_MIN_FOCAL_LENGTH_MM,
  readStrybldrCameraSettings,
} from './strybldrCamera'
import {
  publishCameraFramingRuntime,
  readCameraFramingRuntime,
  subscribeCameraFramingRuntime,
} from './cameraFramingRuntime'
import {
  XR_MOTION_REFERENCE_CAMERA_RIGS,
  type XrMotionReferenceCameraRig,
} from '@/features/three/xrMotionReferenceModel'
import {
  readXrMotionReferenceRuntime,
  setXrMotionReferenceCameraMark,
  setXrMotionReferenceCameraRig,
  setXrMotionReferenceCastMarkArmed,
  subscribeXrMotionReferenceRuntime,
  toggleXrMotionReferenceCastMarkArmed,
} from '@/features/three/xrMotionReferenceRuntime'
import { readBoundXrSelectedActorId, selectBoundXrActor } from '@/features/three/xrSelectedActorBinding'
import { XrCameraMovePresetControl } from './XrCameraMovePresetControl'

const RIG_LABELS: Readonly<Record<XrMotionReferenceCameraRig, string>> = {
  dolly: 'Dolly',
  steadicam: 'Steadicam',
  handheld: 'Handheld',
  crane: 'Crane',
  drone: 'Drone',
  'car-mount': 'Car-mount',
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function XrShootCameraSection() {
  const { xrActive, pushUiToast, selectedNodeId, timelinePlaying } = useGraphStore(useShallow(state => ({
    xrActive: state.canvasRenderMode === '3d' && state.canvas3dMode === 'xr',
    pushUiToast: state.pushUiToast,
    selectedNodeId: state.selectedNodeId,
    timelinePlaying: state.timelineTransportPlaying,
  })))
  const runtime = React.useSyncExternalStore(
    subscribeXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
  )
  const selectedActorId = React.useMemo(() => readBoundXrSelectedActorId(), [runtime, selectedNodeId])
  const selectedTrack = runtime.plan.cast.find(track => track.actorId === selectedActorId)
    || runtime.plan.cast[0]
    || null
  const cameraPlaybackActive = xrActive && timelinePlaying && runtime.plan.camera.length > 0
  const framing = React.useSyncExternalStore(
    subscribeCameraFramingRuntime,
    readCameraFramingRuntime,
    readCameraFramingRuntime,
  )

  React.useEffect(() => {
    if (!xrActive) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target)) return
      if (event.key.toLowerCase() === 'm' && selectedTrack) {
        event.preventDefault()
        toggleXrMotionReferenceCastMarkArmed()
      } else if (event.key === 'Escape' && runtime.castMarkArmed) {
        setXrMotionReferenceCastMarkArmed(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [runtime.castMarkArmed, selectedTrack, xrActive])

  const publishActorFraming = React.useCallback((settingsValue: unknown) => {
    if (!selectedTrack || cameraPlaybackActive) return
    publishCameraFramingRuntime({
      anchorId: selectedTrack.actorId,
      settings: readStrybldrCameraSettings(settingsValue),
      source: 'panel',
    })
  }, [cameraPlaybackActive, selectedTrack])

  const autoFrameMedium = React.useCallback(() => {
    if (!selectedTrack) return
    const current = readCameraFramingRuntime()
    publishActorFraming({ ...current.settings, shot: 'medium' })
    pushUiToast({
      id: 'xr:shoot:medium-shot',
      kind: 'success',
      message: `MS framed ${selectedTrack.label} at ${current.settings.focalLengthMm}mm.`,
    })
  }, [publishActorFraming, pushUiToast, selectedTrack])

  const dropCameraMark = React.useCallback(() => {
    if (!selectedTrack) return
    const current = readCameraFramingRuntime()
    setXrMotionReferenceCameraMark({
      timeSeconds: runtime.playheadSeconds,
      anchorId: selectedTrack.actorId,
      rig: runtime.selectedCameraRig,
      settings: { ...current.settings },
    })
    pushUiToast({
      id: 'xr:shoot:camera-mark',
      kind: 'success',
      message: `Camera mark ${readXrMotionReferenceRuntime().plan.camera.length} dropped at ${runtime.playheadSeconds.toFixed(2)}s.`,
    })
  }, [pushUiToast, runtime.playheadSeconds, runtime.selectedCameraRig, selectedTrack])

  if (!xrActive) return null

  return (
    <section
      className={cn('mb-2 grid gap-2 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.headerBg)}
      aria-label="XR SHOOT"
      data-kg-xr-shoot-panel="1"
      data-kg-xr-shoot-mark-armed={runtime.castMarkArmed ? '1' : '0'}
    >
      <header className="flex items-start justify-between gap-2">
        <section className="flex min-w-0 items-center gap-2">
          <Clapperboard className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
          <section>
            <h3 className="text-xs font-black tracking-[0.16em]">SHOOT</h3>
            <p className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Cast marks, lens, rig, camera track.</p>
          </section>
        </section>
        <output className={cn('text-right text-[10px]', UI_THEME_TOKENS.text.tertiary)}>
          {runtime.playheadSeconds.toFixed(2)}s<br />{runtime.plan.camera.length} camera marks
        </output>
      </header>

      <label className="grid gap-1 text-[10px]">
        <span className={UI_THEME_TOKENS.text.tertiary}>Actor</span>
        <PanelSelect
          aria-label="SHOOT actor"
          value={selectedTrack?.actorId || ''}
          disabled={!selectedTrack}
          onChange={event => selectBoundXrActor(event.target.value)}
          data-kg-xr-shoot-actor="1"
        >
          {runtime.plan.cast.length
            ? runtime.plan.cast.map(track => <option key={track.actorId} value={track.actorId}>{track.label}</option>)
            : <option value="">No cast</option>}
        </PanelSelect>
      </label>

      <button
        type="button"
        className={cn('App-toolbar__btn flex w-full items-center justify-center gap-2', runtime.castMarkArmed ? UI_THEME_TOKENS.button.activeBg : '')}
        aria-pressed={runtime.castMarkArmed}
        disabled={!selectedTrack}
        onClick={() => toggleXrMotionReferenceCastMarkArmed()}
        data-kg-xr-shoot-cast-mark="1"
      >
        <MapPin className="size-3.5" aria-hidden />
        <kbd className="rounded border px-1 text-[9px]">M</kbd>
        {runtime.castMarkArmed ? 'Click the XR floor' : 'Place cast marks'}
      </button>
      <p className={cn('m-0 text-[10px]', runtime.castMarkArmed ? 'text-emerald-600 dark:text-emerald-300' : UI_THEME_TOKENS.text.tertiary)} aria-live="polite">
        {selectedTrack
          ? `${selectedTrack.label} · ${selectedTrack.marks.length} numbered mark${selectedTrack.marks.length === 1 ? '' : 's'}${runtime.castMarkArmed ? ' · placement armed; Esc cancels' : ''}`
          : 'Add a mobile subject or open a graph with cast nodes.'}
      </p>

      <section className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <label className="grid gap-1 text-[10px]">
          <span className={UI_THEME_TOKENS.text.tertiary}>Rig</span>
          <PanelSelect
            aria-label="SHOOT camera rig"
            value={runtime.selectedCameraRig}
            onChange={event => setXrMotionReferenceCameraRig(event.target.value as XrMotionReferenceCameraRig)}
            data-kg-xr-shoot-rig="1"
          >
            {XR_MOTION_REFERENCE_CAMERA_RIGS.map(rig => <option key={rig} value={rig}>{RIG_LABELS[rig]}</option>)}
          </PanelSelect>
        </label>
        <label className="grid gap-1 text-[10px]">
          <span className={UI_THEME_TOKENS.text.tertiary}>Lens mm</span>
          <PanelTextInput
            type="number"
            min={STRYBLDR_CAMERA_MIN_FOCAL_LENGTH_MM}
            max={STRYBLDR_CAMERA_MAX_FOCAL_LENGTH_MM}
            step={1}
            value={framing.settings.focalLengthMm}
            disabled={cameraPlaybackActive}
            onChange={event => publishActorFraming({ ...readCameraFramingRuntime().settings, focalLengthMm: Number(event.target.value) })}
            data-kg-xr-shoot-lens="1"
          />
        </label>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <button type="button" className="App-toolbar__btn font-bold" disabled={!selectedTrack || cameraPlaybackActive} onClick={autoFrameMedium} data-kg-xr-shoot-medium-shot="1">
          MS · Medium shot
        </button>
        <button type="button" className="App-toolbar__btn flex items-center justify-center gap-1 font-bold" disabled={!selectedTrack || cameraPlaybackActive} onClick={dropCameraMark} data-kg-xr-shoot-camera-mark="1">
          <Video className="size-3.5" aria-hidden />
          Drop camera mark
        </button>
      </section>

      <XrCameraMovePresetControl
        anchorId={selectedTrack?.actorId || ''}
        anchorLabel={selectedTrack?.label || ''}
        disabled={!selectedTrack || cameraPlaybackActive}
      />
    </section>
  )
}
