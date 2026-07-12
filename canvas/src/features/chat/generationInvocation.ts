import {
  CHAT_PROVIDER_BYTEPLUS,
  CHAT_PROVIDER_OPENAI,
  type ChatProviderId,
} from "@/lib/chatEndpoint";
import { splitInvocationTokenSegments } from "@/lib/markdown/invocationTokens";

export type GenerationProvider = Extract<
  ChatProviderId,
  "byteplus-modelark" | "openai"
>;
export type GenerationSpecification = "low" | "medium" | "high";
export type GenerationKind = "text" | "image" | "audio" | "video";

export const AGENTIC_VIDEO_ROUTE_TOKEN = "/video-agent" as const;
export const GENERATION_PROVIDER_INVOCATIONS = [
  {
    provider: CHAT_PROVIDER_BYTEPLUS,
    token: "@provider.byteplus",
    label: "BytePlus ModelArk",
    summary: "Default generation provider.",
  },
  {
    provider: CHAT_PROVIDER_OPENAI,
    token: "@provider.openai",
    label: "OpenAI",
    summary: "OpenAI generation provider.",
  },
] as const;
export const GENERATION_SPECIFICATION_INVOCATIONS = [
  {
    specification: "low",
    token: "#spec.low",
    label: "Low",
    summary: "Default, cost-bounded specification.",
  },
  {
    specification: "medium",
    token: "#spec.medium",
    label: "Medium",
    summary: "Balanced specification.",
  },
  {
    specification: "high",
    token: "#spec.high",
    label: "High",
    summary: "Highest configured specification.",
  },
] as const;
export const GENERATION_KIND_INVOCATIONS = [
  { kind: "text", token: "@text", label: "Text", summary: "Generate text." },
  {
    kind: "image",
    token: "@image",
    label: "Image",
    summary: "Generate an image.",
  },
  {
    kind: "audio",
    token: "@audio",
    label: "Audio",
    summary: "Generate audio.",
  },
  {
    kind: "video",
    token: "@video",
    label: "Video",
    summary: "Generate video.",
  },
] as const;

export type GenerationInvocation = {
  provider: GenerationProvider;
  specification: GenerationSpecification;
  kinds: GenerationKind[];
  prompt: string;
};
const providerByToken = new Map<string, GenerationProvider>(
  GENERATION_PROVIDER_INVOCATIONS.map(
    (item) => [item.token, item.provider] as const,
  ),
);
const specificationByToken = new Map<string, GenerationSpecification>(
  GENERATION_SPECIFICATION_INVOCATIONS.map(
    (item) => [item.token, item.specification] as const,
  ),
);
const kindByToken = new Map<string, GenerationKind>(
  GENERATION_KIND_INVOCATIONS.map((item) => [item.token, item.kind] as const),
);

export function parseGenerationInvocation(
  raw: unknown,
): GenerationInvocation | null {
  const text = String(raw || "");
  const tokens = splitInvocationTokenSegments(text)
    .filter((part) => part.kind === "token")
    .map((part) => part.value.toLowerCase());
  if (!tokens.includes(AGENTIC_VIDEO_ROUTE_TOKEN)) return null;
  const kinds = Array.from(
    new Set(
      tokens
        .map((token) => kindByToken.get(token))
        .filter((value): value is GenerationKind => Boolean(value)),
    ),
  );
  if (!kinds.length) return null;
  const provider =
    tokens
      .map((token) => providerByToken.get(token))
      .find(Boolean) || CHAT_PROVIDER_BYTEPLUS;
  const specification =
    tokens
      .map((token) =>
        specificationByToken.get(token as `#spec.${GenerationSpecification}`),
      )
      .find(Boolean) || "low";
  const grammarTokens = new Set<string>([
    AGENTIC_VIDEO_ROUTE_TOKEN,
    ...GENERATION_PROVIDER_INVOCATIONS.map((item) => item.token),
    ...GENERATION_SPECIFICATION_INVOCATIONS.map((item) => item.token),
    ...GENERATION_KIND_INVOCATIONS.map((item) => item.token),
  ]);
  const prompt = splitInvocationTokenSegments(text)
    .map((part) =>
      part.kind === "token" && grammarTokens.has(part.value.toLowerCase())
        ? ""
        : part.value,
    )
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return { provider, specification, kinds, prompt };
}

function replaceTokens(
  raw: string,
  removed: readonly string[],
  additions: readonly string[],
): string {
  const retained = splitInvocationTokenSegments(raw)
    .map((part) =>
      part.kind === "token" && removed.includes(part.value.toLowerCase())
        ? ""
        : part.value,
    )
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const route = retained.match(/^\/video-agent\b/i)?.[0];
  return route
    ? [route, ...additions, retained.slice(route.length).trim()]
        .filter(Boolean)
        .join(" ")
    : [retained, ...additions].filter(Boolean).join(" ");
}
export const setGenerationProvider = (
  raw: string,
  provider: GenerationProvider,
) =>
  replaceTokens(
    raw,
    GENERATION_PROVIDER_INVOCATIONS.map((item) => item.token),
    [
      GENERATION_PROVIDER_INVOCATIONS.find((item) => item.provider === provider)
        ?.token || GENERATION_PROVIDER_INVOCATIONS[0].token,
    ],
  );
export const setGenerationSpecification = (
  raw: string,
  specification: GenerationSpecification,
) =>
  replaceTokens(
    raw,
    GENERATION_SPECIFICATION_INVOCATIONS.map((item) => item.token),
    [`#spec.${specification}`],
  );
export const setGenerationKinds = (
  raw: string,
  kinds: readonly GenerationKind[],
) =>
  replaceTokens(
    raw,
    GENERATION_KIND_INVOCATIONS.map((item) => item.token),
    GENERATION_KIND_INVOCATIONS.filter((item) => kinds.includes(item.kind)).map(
      (item) => item.token,
    ),
  );

export function buildGenerationInvocationSystemPrompt(raw: unknown): string {
  const invocation = parseGenerationInvocation(raw);
  if (!invocation) return "";
  return [
    "Generation invocation contract:",
    `- Provider: ${invocation.provider}. Specification: #spec.${invocation.specification}. Outputs: ${invocation.kinds.map((kind) => `@${kind}`).join(", ")}.`,
    "- Preserve real provider-returned text, image, audio, and video artifacts; never invent a URL or relabel a media kind.",
    "- For a multilingual video request, preserve Chinese, Cantonese, and English audio variants with synchronized Chinese/English bilingual subtitles.",
    "- Project persisted artifacts through Cards, Widgets, Rich Media Panels, and BottomPanel Timeline video/FBF/audio lanes.",
  ].join("\n");
}
