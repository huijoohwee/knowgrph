import { TEXTAREA_INVOCATION_PROJECTED_LAYOUT_CLASS_NAME } from "@/lib/ui/textareaInvocationProjection";
import { TextareaInvocationEditor } from "@/lib/ui/TextareaInvocationEditor";

export function LiveCanvasHeroQueryEditor(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="relative mt-2 min-h-16 overflow-hidden rounded-xl border border-[color:var(--kg-border)] bg-[color-mix(in_srgb,var(--kg-code-bg)_88%,transparent)]">
      <TextareaInvocationEditor
        value={props.value}
        onChange={props.onChange}
        id="knowgrph-live-canvas-hero-query"
        ariaLabel="Agentic Video Canvas"
        overlayTextClassName="font-mono text-xs leading-5 text-[var(--kg-code-text)]"
        overlayChromeClassName="px-3 py-2.5"
        projectedLayoutClassName={`${TEXTAREA_INVOCATION_PROJECTED_LAYOUT_CLASS_NAME} leading-5`}
        className="relative z-0 min-h-16 w-full resize-none border-0 bg-transparent px-3 py-2.5 font-mono text-xs leading-5 text-[var(--kg-code-text)] outline-none md:resize-y"
        submitOnModEnter
        dataAttributes={{ 'data-kg-live-canvas-hero-query': 'true' }}
      />
    </section>
  );
}
