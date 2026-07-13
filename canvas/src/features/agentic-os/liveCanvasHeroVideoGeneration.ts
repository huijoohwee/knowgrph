import type { SourceFile } from "@/hooks/store/types";
import {
  AGENTIC_VIDEO_ROUTE_TOKEN,
  GENERATION_KIND_INVOCATIONS,
  GENERATION_PROVIDER_INVOCATIONS,
  GENERATION_SPECIFICATION_INVOCATIONS,
  VIDEO_GENERATION_DEMO_SCRIPT_BINDING_TOKEN,
} from "@/features/chat/generationInvocation";

type VideoSource = { name: string; workspacePath: string };
const terms = [
  "视频",
  "video",
  "分镜",
  "逐镜",
  "剧本",
  "script",
  "旁白",
  "audio",
  "shot",
];
const sourcePath = (file: SourceFile): string => {
  const path =
    file.source?.kind === "local" ? String(file.source.path || "") : "";
  return path.startsWith("workspace:")
    ? path.slice("workspace:".length)
    : path || `/${file.name}`;
};
export function resolveLiveCanvasHeroVideoSource(
  files: readonly SourceFile[] | null | undefined,
): VideoSource | null {
  return (
    (files || [])
      .filter((file) => file.enabled !== false && /\.md$/i.test(file.name))
      .map((file) => ({
        name: file.name,
        workspacePath: sourcePath(file),
        score: terms.reduce(
          (score, term) =>
            score +
            (`${file.name}\n${String(file.text || "").slice(0, 8000)}`
              .toLowerCase()
              .includes(term)
              ? 1
              : 0),
          0,
        ),
      }))
      .filter((item) => item.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.workspacePath.localeCompare(right.workspacePath),
      )[0] || null
  );
}
export function buildLiveCanvasHeroVideoQuery(
  files?: readonly SourceFile[] | null,
): { query: string; source: VideoSource | null } {
  const source = resolveLiveCanvasHeroVideoSource(files);
  const reference = source
    ? `[${source.name}](workspace:${encodeURI(source.workspacePath)})`
    : "";
  return {
    source,
    query: [
      AGENTIC_VIDEO_ROUTE_TOKEN,
      GENERATION_PROVIDER_INVOCATIONS[0].token,
      ...GENERATION_KIND_INVOCATIONS.map((item) => item.token),
      GENERATION_SPECIFICATION_INVOCATIONS[0].token,
      VIDEO_GENERATION_DEMO_SCRIPT_BINDING_TOKEN,
      reference,
      "Generate an end-to-end agentic video canvas from the referenced script. Produce Chinese, Cantonese, and English audio variants with synchronized Chinese/English bilingual subtitles. Persist typed text, image, audio, and video artifacts for playable Cards, Widgets, Rich Media Panels, and BottomPanel Timeline video/FBF/audio lanes. Stop at approval or a missing provider capability.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
