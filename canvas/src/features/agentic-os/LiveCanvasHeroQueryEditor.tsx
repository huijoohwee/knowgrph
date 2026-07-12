import React from "react";
import {
  buildFloatingPanelChatComposerDisplayText,
  buildFloatingPanelChatComposerOverlayParts,
  FloatingPanelChatComposerMediaOverlay,
  resolveFloatingPanelChatComposerRawText,
  TEXTAREA_INVOCATION_PROJECTED_LAYOUT_CLASS_NAME,
} from "@/lib/ui/textareaInvocationProjection";

export function LiveCanvasHeroQueryEditor(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  const overlay = React.useMemo(
    () => buildFloatingPanelChatComposerOverlayParts(props.value),
    [props.value],
  );
  const displayValue = React.useMemo(
    () => buildFloatingPanelChatComposerDisplayText(props.value),
    [props.value],
  );
  return (
    <section className="relative mt-2 min-h-16 overflow-hidden rounded-xl border border-[color:var(--kg-border)] bg-[color-mix(in_srgb,var(--kg-code-bg)_88%,transparent)]">
      <FloatingPanelChatComposerMediaOverlay
        input={props.value}
        uiPanelTextFontClass="font-mono text-xs leading-5 text-[var(--kg-code-text)]"
        overlayChromeClassName="px-3 py-2.5"
        projectedLayoutClassName={`${TEXTAREA_INVOCATION_PROJECTED_LAYOUT_CLASS_NAME} leading-5`}
      />
      <textarea
        id="knowgrph-live-canvas-hero-query"
        className={`relative z-0 min-h-16 w-full resize-none bg-transparent px-3 py-2.5 font-mono text-xs leading-5 text-[var(--kg-code-text)] outline-none md:resize-y ${overlay.hasOverlay ? `${TEXTAREA_INVOCATION_PROJECTED_LAYOUT_CLASS_NAME} text-transparent` : ""}`}
        value={displayValue}
        spellCheck={false}
        aria-label="Agentic Video Canvas"
        onChange={(event) =>
          props.onChange(
            resolveFloatingPanelChatComposerRawText(
              event.currentTarget.value,
              props.value,
            ),
          )
        }
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        data-kg-live-canvas-hero-query="true"
        data-kg-chat-input-overlay-active={overlay.hasOverlay ? "1" : undefined}
        data-kg-chat-input-media-overlay-active={
          overlay.hasMedia ? "1" : undefined
        }
      />
    </section>
  );
}
