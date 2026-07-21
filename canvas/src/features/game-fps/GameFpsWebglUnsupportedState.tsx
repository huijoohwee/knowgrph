export function GameFpsWebglUnsupportedState() {
  return (
    <p
      className="absolute inset-0 grid place-items-center bg-slate-950 px-6 text-center text-sm font-semibold text-rose-100"
      data-kg-game-fps-error="webgl-unsupported"
      role="alert"
    >
      Game FPS requires WebGL, but this browser could not create a local WebGL context.
    </p>
  )
}
