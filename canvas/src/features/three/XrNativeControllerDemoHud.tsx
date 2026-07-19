import React from 'react'
import { RotateCcw, Rocket } from 'lucide-react'
import {
  developAndRunXrNativeControllerDemo,
  readXrNativeControllerDemo,
  resetSharedXrNativeControllerDemo,
  selectXrNativeControllerDemoMode,
  subscribeXrNativeControllerDemo,
  type XrNativeControllerDemoMode,
  type XrNativeControllerDemoObjective,
} from './xrNativeControllerDemoRuntime'

const OBJECTIVE_COPY: Record<XrNativeControllerDemoObjective, string> = {
  'find-key': 'Find the key to unlock the treasure!',
  'unlock-treasure': 'Key found — return to the treasure chest!',
  complete: 'Treasure unlocked!',
}

function chooseController(mode: XrNativeControllerDemoMode): void {
  const phase = readXrNativeControllerDemo().phase
  selectXrNativeControllerDemoMode(mode)
  if (phase === 'off') developAndRunXrNativeControllerDemo()
}

export function XrNativeControllerDemoHud() {
  const runtime = React.useSyncExternalStore(
    subscribeXrNativeControllerDemo,
    readXrNativeControllerDemo,
    readXrNativeControllerDemo,
  )
  return (
    <section
      className="pointer-events-none absolute inset-0 z-[95] overflow-hidden"
      aria-label="Physics playground controls"
      data-kg-xr-playground-hud="1"
      data-kg-xr-playground-phase={runtime.phase}
      data-kg-xr-playground-mode={runtime.mode}
      data-kg-xr-playground-objective={runtime.objective}
      data-kg-xr-playground-key-collected={runtime.keyCollected ? '1' : '0'}
      data-kg-xr-playground-treasure-open={runtime.chestUnlocked ? '1' : '0'}
    >
      <span className="sr-only">Physics runtime {runtime.phase} with {runtime.mode} selected.</span>
      <output
        aria-live="polite"
        className={`absolute left-1/2 top-5 -translate-x-1/2 rounded-full border px-4 py-2 text-center text-sm font-bold shadow-lg backdrop-blur-sm transition-all ${runtime.objective === 'find-key' ? 'translate-y-[-12px] opacity-0' : runtime.objective === 'complete' ? 'border-amber-200 bg-amber-300/95 text-amber-950' : 'border-sky-100 bg-sky-600/92 text-white'}`}
        data-kg-xr-playground-objective-copy="1"
      >
        {OBJECTIVE_COPY[runtime.objective]}
      </output>
      <nav
        className="pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 flex w-max max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2"
        aria-label="Playground controls"
      >
        {runtime.objective === 'complete' ? (
          <button
            type="button"
            onClick={resetSharedXrNativeControllerDemo}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-amber-100 bg-amber-300/95 px-4 py-2 text-sm font-semibold text-amber-950 shadow-lg transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            data-kg-xr-playground-replay="1"
          >
            <RotateCcw className="size-4" aria-hidden />
            Replay
          </button>
        ) : null}
        <button
          type="button"
          aria-pressed={runtime.mode === 'ball'}
          onClick={() => chooseController('ball')}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/75 bg-sky-500/95 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-pressed:ring-[3px] aria-pressed:ring-yellow-300"
          data-kg-xr-playground-select="ball"
        >
          <span
            aria-hidden
            className="size-4 rounded-full border border-white/80"
            style={{ background: 'conic-gradient(#ef476f, #ffd166, #54d17a, #3a86ff, #7b61c9, #ef476f)' }}
          />
          Beach Ball
        </button>
        <button
          type="button"
          aria-pressed={runtime.mode === 'rocket'}
          onClick={() => chooseController('rocket')}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/75 bg-sky-500/95 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-pressed:ring-[3px] aria-pressed:ring-yellow-300"
          data-kg-xr-playground-select="rocket"
        >
          <Rocket className="size-4" aria-hidden />
          Rocket
        </button>
      </nav>
      <p className="sr-only">
        Move with W A S D, arrow keys, or a gamepad left stick. Space jumps or thrusts. Shift enables turbo or stabilization. Press R to reset.
      </p>
    </section>
  )
}
