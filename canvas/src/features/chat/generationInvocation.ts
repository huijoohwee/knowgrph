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
export type GenerationThinkingType = "enabled" | "disabled" | "auto";
export type GenerationTokenCap = "low" | "medium" | "high";

export const AGENTIC_VIDEO_ROUTE_TOKEN = "/video-agent" as const;
export const VIDEO_GENERATION_DEMO_SCRIPT_BINDING_TOKEN = "@video-generation-demo-script" as const;
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
export const GENERATION_THINKING_INVOCATIONS = [
  {
    thinkingType: "enabled",
    token: "#thinking.type.enabled",
    label: "Enabled",
    summary: "Default preset thinking mode.",
  },
  {
    thinkingType: "disabled",
    token: "#thinking.type.disabled",
    label: "Disabled",
    summary: "Disable provider thinking when supported.",
  },
  {
    thinkingType: "auto",
    token: "#thinking.type.auto",
    label: "Auto",
    summary: "Let the provider select thinking behavior.",
  },
] as const;
export const GENERATION_TOKEN_CAP_INVOCATIONS = [
  {
    tokenCap: "low",
    token: "#token-cap.low",
    label: "Low",
    reasoningEffort: "low",
    maxCompletionTokens: 4096,
    summary: "4,096 completion tokens with low reasoning effort.",
  },
  {
    tokenCap: "medium",
    token: "#token-cap.medium",
    label: "Medium (Default)",
    reasoningEffort: "medium",
    maxCompletionTokens: 16384,
    summary: "16,384 completion tokens with medium reasoning effort.",
  },
  {
    tokenCap: "high",
    token: "#token-cap.high",
    label: "High",
    reasoningEffort: "high",
    maxCompletionTokens: 32768,
    summary: "32,768 completion tokens with high reasoning effort.",
  },
] as const;

export type GenerationInvocation = {
  provider: GenerationProvider;
  specification: GenerationSpecification;
  kinds: GenerationKind[];
  thinkingType: GenerationThinkingType;
  tokenCap: GenerationTokenCap;
  reasoningEffort: "low" | "medium" | "high";
  maxCompletionTokens: number;
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
const thinkingByToken = new Map<string, GenerationThinkingType>(
  GENERATION_THINKING_INVOCATIONS.map(
    (item) => [item.token, item.thinkingType] as const,
  ),
);
const tokenCapByToken = new Map<string, typeof GENERATION_TOKEN_CAP_INVOCATIONS[number]>(
  GENERATION_TOKEN_CAP_INVOCATIONS.map((item) => [item.token, item] as const),
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
  const thinkingType =
    tokens.map((token) => thinkingByToken.get(token)).find(Boolean) ||
    "enabled";
  const tokenCapProfile =
    tokens.map((token) => tokenCapByToken.get(token)).find(Boolean) ||
    GENERATION_TOKEN_CAP_INVOCATIONS[1];
  const grammarTokens = new Set<string>([
    AGENTIC_VIDEO_ROUTE_TOKEN,
    ...GENERATION_PROVIDER_INVOCATIONS.map((item) => item.token),
    ...GENERATION_SPECIFICATION_INVOCATIONS.map((item) => item.token),
    ...GENERATION_KIND_INVOCATIONS.map((item) => item.token),
    ...GENERATION_THINKING_INVOCATIONS.map((item) => item.token),
    ...GENERATION_TOKEN_CAP_INVOCATIONS.map((item) => item.token),
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
  return {
    provider,
    specification,
    kinds,
    thinkingType,
    tokenCap: tokenCapProfile.tokenCap,
    reasoningEffort: tokenCapProfile.reasoningEffort,
    maxCompletionTokens: tokenCapProfile.maxCompletionTokens,
    prompt,
  };
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

export const setGenerationThinkingType = (
  raw: string,
  thinkingType: GenerationThinkingType,
) =>
  replaceTokens(
    raw,
    GENERATION_THINKING_INVOCATIONS.map((item) => item.token),
    [`#thinking.type.${thinkingType}`],
  );

export const setGenerationTokenCap = (
  raw: string,
  tokenCap: GenerationTokenCap,
) =>
  replaceTokens(
    raw,
    GENERATION_TOKEN_CAP_INVOCATIONS.map((item) => item.token),
    [`#token-cap.${tokenCap}`],
  );

export function buildGenerationInvocationSystemPrompt(raw: unknown): string {
  const invocation = parseGenerationInvocation(raw);
  if (!invocation) return "";
  return [
    "Generation invocation contract:",
    `- Provider: ${invocation.provider}. Specification: #spec.${invocation.specification}. Outputs: ${invocation.kinds.map((kind) => `@${kind}`).join(", ")}.`,
    `- Thinking: #thinking.type.${invocation.thinkingType}. Token cap: #token-cap.${invocation.tokenCap} (${invocation.maxCompletionTokens} completion tokens, ${invocation.reasoningEffort} reasoning effort).`,
    "- The structured text artifact must include Character, Scene, Dialogue, Visual asset, Audio, Timing, Metadata, and Prompt sheets.",
    "- Preserve real provider-returned text, image, audio, and video artifacts; never invent a URL or relabel a media kind.",
    "- For a multilingual video request, preserve Chinese, Cantonese, and English audio variants with synchronized Chinese/English bilingual subtitles.",
    "- Project persisted artifacts through Cards, Widgets, Rich Media Panels, and BottomPanel Timeline video/FBF/audio lanes.",
  ].join("\n");
}
