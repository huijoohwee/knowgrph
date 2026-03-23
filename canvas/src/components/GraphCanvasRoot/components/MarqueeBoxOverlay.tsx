export function MarqueeBoxOverlay(props: {
  marqueeBox: null | { left: number; top: number; width: number; height: number }
}) {
  const { marqueeBox } = props
  if (!marqueeBox) return null

  return (
    <section
      aria-hidden={true}
      className="absolute pointer-events-none border border-[var(--kg-canvas-node-selected)] bg-[color-mix(in_srgb,var(--kg-canvas-node-selected)_15%,transparent)]"
      style={{ left: marqueeBox.left, top: marqueeBox.top, width: marqueeBox.width, height: marqueeBox.height }}
    />
  )
}

