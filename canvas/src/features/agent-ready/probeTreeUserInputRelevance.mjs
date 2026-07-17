export const PROBE_TREE_MULTI_SELECT_LIMITS = Object.freeze({ min: 2, max: 4 });

const PROBE_TREE_CONTEXT_MARKERS = Object.freeze([
  "Authored request",
  "Selected continuation question",
  "Selected continuation answer",
  "Probe lineage context",
  "Selected Widget title",
  "Selected Widget id",
  "Invocation route",
  "Agentic OS directives",
]);

const PROBE_TREE_CONTEXT_STOP_WORDS = new Set([
  "about", "across", "active", "agent", "agentic", "against", "also", "and", "answer", "assess", "author", "authored", "body", "bounded", "branch", "branches",
  "canvas", "card", "cards", "care", "change", "changes", "command", "confirm", "confirms", "context", "continuation", "contract", "cost", "depth", "editable", "economics", "for", "from", "frontmatter", "gate", "generate", "generated",
  "before", "call", "candidate", "connect", "directive", "directives", "do", "each", "fallback", "generation", "generic", "guidance", "harness", "into", "invocation", "keep", "knowgrph", "label", "local", "log", "make", "media", "next", "node", "not", "output", "panel", "probe", "proof", "provider", "publish", "question", "questions",
  "id", "os", "ready", "request", "require", "requires", "response", "rich", "route", "run", "runtime", "scope", "selected", "separate", "separately", "sme-care-agent", "smes", "stop", "storyboard", "structured", "summary", "text", "the", "this", "title", "token", "tree", "unchanged", "unless",
  "what", "when", "where", "which", "who", "why", "using", "visibly", "widget", "with", "workspace", "would", "zero-cost",
]);

const PROBE_TREE_RUNTIME_META_WORDS = new Set([
  "branch", "branches", "canvas", "card", "cards", "cloudflare", "completion", "fallback", "frontmatter", "invocation", "media", "mcp", "panel", "prod", "prompt", "provider", "rich", "route", "run", "runtime", "storyboard", "token", "tree", "widget",
]);

const GENERIC_RESPONSE_CONTENT_PATTERN = /^(?:current (?:primary )?source for|verified system-of-record fact for|accountable reviewer confirmation for|which authoritative evidence confirms the current facts)/i;
const GENERIC_CLARIFICATION_QUESTION_PATTERN = /^(?:which (?:scope|priority|constraint) choice should clarify\b|which relationship between\b.+\bshould the next answer establish\b|which (?:evidence|decision) basis should resolve\b|which deliverable should resolve\b|what should the next clarification resolve about\b)/i;
const GENERIC_CLARIFICATION_CHOICE_PATTERN = /^(?:define the exact boundary|identify adjacent concerns|set what is outside|set the immediate priority|identify the next sequence|define when to defer|identify mandatory constraints|define acceptable tradeoffs|set unresolved limits|compare current evidence for|resolve the dependency between|choose the decision order for|use current evidence for|set a decision threshold for|choose a deliverable for|current authoritative evidence for|corroborating evidence for|known evidence gaps for|most conservative basis for|balanced basis for|most current basis for|comparison for|evidence ledger for|recommendation for)\b/i;
const PROBE_TREE_GENERATED_QUESTION_SCAFFOLD_PATTERN = /^(?:which requested items should guide the next branch)\s*:\s*/i;
const PROBE_TREE_TERMINAL_GENERATION_PATTERN = /^(?:please\s+)?(?:build|compose|create|draft|generate|prepare|produce|render|write)\b/i;

export const cleanProbeTreeResponseText = (value, maxLength = 320) => (
  String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength)
);

export const isProbeTreeTerminalGenerationRequest = value => (
  PROBE_TREE_TERMINAL_GENERATION_PATTERN.test(cleanProbeTreeResponseText(value, 8_000))
);

export const safeProbeTreeResponseId = (value, fallback) => {
  const normalized = cleanProbeTreeResponseText(value, 160).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

export function normalizeProbeTreeSelectionOptions(value) {
  const candidates = Array.isArray(value) ? value : [];
  const seen = new Set();
  const options = [];
  for (const candidate of candidates) {
    const record = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : null;
    const label = cleanProbeTreeResponseText(record?.label || record?.text || candidate, 160);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    options.push({
      id: cleanProbeTreeResponseText(record?.id, 80) || `option-${options.length + 1}-${safeProbeTreeResponseId(label, String(options.length + 1)).slice(0, 48)}`,
      label,
    });
    if (options.length >= PROBE_TREE_MULTI_SELECT_LIMITS.max) break;
  }
  return options.length >= PROBE_TREE_MULTI_SELECT_LIMITS.min ? options : [];
}

export function normalizeProbeTreeContextAnchors(value) {
  const candidates = Array.isArray(value) ? value : [];
  const seen = new Set();
  const anchors = [];
  for (const candidate of candidates) {
    const anchor = cleanProbeTreeResponseText(candidate, 240);
    const key = anchor.toLowerCase();
    if (!anchor || seen.has(key)) continue;
    seen.add(key);
    anchors.push(anchor);
    if (anchors.length >= 6) break;
  }
  return anchors.length >= 2 ? anchors : [];
}

const readContextMarker = (contextText, marker) => {
  const normalized = cleanProbeTreeResponseText(contextText, 12_000);
  const lower = normalized.toLowerCase();
  const markerToken = `${marker.toLowerCase()}:`;
  const startIndex = lower.indexOf(markerToken);
  if (startIndex < 0) return "";
  const valueStart = startIndex + markerToken.length;
  const endIndexes = PROBE_TREE_CONTEXT_MARKERS
    .filter(candidate => candidate !== marker)
    .map(candidate => lower.indexOf(`${candidate.toLowerCase()}:`, valueStart))
    .filter(index => index >= 0);
  const valueEnd = endIndexes.length > 0 ? Math.min(...endIndexes) : normalized.length;
  return cleanProbeTreeResponseText(normalized.slice(valueStart, valueEnd), 8_000);
};

export function extractProbeTreeUserInputText(contextText) {
  const continuationQuestion = readContextMarker(contextText, "Selected continuation question");
  const continuationAnswer = readContextMarker(contextText, "Selected continuation answer");
  if (continuationAnswer) return normalizeProbeTreeContinuationAnswer(continuationAnswer);
  if (continuationQuestion) return normalizeProbeTreeContinuationQuestion(continuationQuestion);
  return readContextMarker(contextText, "Authored request") || cleanProbeTreeResponseText(contextText, 8_000);
}

export function extractProbeTreeClarificationContextText(contextText) {
  const continuationQuestion = readContextMarker(contextText, "Selected continuation question");
  const lineageContext = readContextMarker(contextText, "Probe lineage context");
  return [continuationQuestion, lineageContext].filter(Boolean).join(" | ");
}

const extractProbeTreeGroundingText = contextText => {
  const userInput = extractProbeTreeUserInputText(contextText);
  const clarificationContext = extractProbeTreeClarificationContextText(contextText);
  return [userInput, clarificationContext].filter(Boolean).join(" | ");
};

const normalizeProbeTreeContinuationQuestion = value => cleanProbeTreeResponseText(value, 8_000)
  .replace(PROBE_TREE_GENERATED_QUESTION_SCAFFOLD_PATTERN, "")
  .replace(/[?]+$/g, "")
  .trim();

const readProbeTreeContinuationSelections = value => {
  const normalized = cleanProbeTreeResponseText(value, 8_000);
  const numberedSelections = [...normalized.matchAll(
    /(?:^|\s)\d+\.\s*(.+?)(?=(?:\s+\d+\.\s*)|(?:\s+Other(?:\s*:|$))|$)/gi,
  )].map(match => cleanProbeTreeResponseText(match[1], 240)).filter(Boolean);
  const otherSelection = cleanProbeTreeResponseText(
    normalized.match(/(?:^|\s)Other\s*:\s*(.+)$/i)?.[1],
    240,
  );
  const seen = new Set();
  return [...numberedSelections, otherSelection].filter(selection => {
    const key = selection.toLowerCase();
    if (!selection || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeProbeTreeContinuationAnswer = value => {
  const normalized = cleanProbeTreeResponseText(value, 8_000);
  const selections = readProbeTreeContinuationSelections(normalized);
  return selections.length > 0 ? selections.join(", ") : normalized;
};

const escapeProbeTreePattern = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildProbeTreeKeywordPattern = keyword => keyword.split("-")
  .map(escapeProbeTreePattern)
  .join("(?:-|\\s)+");

export function collectProbeTreeContextKeywords(value, maxCount = 8) {
  const seen = new Set();
  const words = String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/(^|\s)[/#@][a-z0-9_.-]+/g, " ")
    .replace(/\b(?:response\.)?structuredcontent\b/g, " ")
    .match(/[a-z][a-z0-9]*(?:-[a-z0-9]+)*/g) || [];
  const out = [];
  for (const word of words) {
    const compoundStopWord = word.includes("-") && word.split("-").every(part => PROBE_TREE_CONTEXT_STOP_WORDS.has(part));
    if (word.length < 3 || PROBE_TREE_CONTEXT_STOP_WORDS.has(word) || compoundStopWord || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= Math.max(1, Math.min(128, Number(maxCount) || 8))) break;
  }
  return out;
}

export function areProbeTreeCardsMutuallyDistinct(cards) {
  const candidates = Array.isArray(cards) ? cards : [];
  const seenQuestions = new Set();
  const acceptedOptionSets = [];
  for (const candidate of candidates) {
    const question = cleanProbeTreeResponseText(candidate?.question || candidate?.text).toLowerCase();
    const optionSet = new Set(normalizeProbeTreeSelectionOptions(candidate?.selectionOptions).map(option => option.label.toLowerCase()));
    if (!question || optionSet.size < PROBE_TREE_MULTI_SELECT_LIMITS.min || seenQuestions.has(question)) return false;
    for (const accepted of acceptedOptionSets) {
      if ([...optionSet].some(label => accepted.has(label))) return false;
    }
    seenQuestions.add(question);
    acceptedOptionSets.push(optionSet);
  }
  return true;
}

const matchedContextKeywords = (contextKeywords, value) => {
  const text = String(value || "").toLowerCase();
  return contextKeywords.filter(keyword => new RegExp(`(^|[^a-z0-9-])${buildProbeTreeKeywordPattern(keyword)}([^a-z0-9-]|$)`, "i").test(text));
};

const normalizeProbeTreeComparableText = value => cleanProbeTreeResponseText(value, 8_000)
  .toLowerCase()
  .replace(/(^|\s)[/#@][a-z0-9_.-]+(?=\s|$)/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const isProbeTreeSourceQueryRestatement = ({ userInput, question, selectionOptions }) => {
  const comparableInput = normalizeProbeTreeComparableText(userInput);
  const comparableQuestion = normalizeProbeTreeComparableText(question);
  if (!comparableInput || !comparableQuestion) return true;
  if (comparableInput === comparableQuestion) return true;

  const inputKeywords = collectProbeTreeContextKeywords(userInput, 96)
    .filter(keyword => !PROBE_TREE_RUNTIME_META_WORDS.has(keyword));
  const matchedKeywords = matchedContextKeywords(inputKeywords, question);
  const copiedOptions = normalizeProbeTreeSelectionOptions(selectionOptions)
    .every(option => comparableInput.includes(normalizeProbeTreeComparableText(option.label)));
  return inputKeywords.length >= 3
    && matchedKeywords.length / inputKeywords.length >= 0.75
    && copiedOptions;
};

export function areProbeTreeContinuationChoicesSuggested({ contextText, question, selectionOptions } = {}) {
  const continuationQuestion = readContextMarker(contextText, "Selected continuation question");
  const continuationAnswer = readContextMarker(contextText, "Selected continuation answer");
  if (!continuationQuestion && !continuationAnswer) return true;
  const options = normalizeProbeTreeSelectionOptions(selectionOptions);
  if (options.length < PROBE_TREE_MULTI_SELECT_LIMITS.min) return false;
  const quotedFocus = cleanProbeTreeResponseText(String(question || "").match(/"([^"]+)"/)?.[1], 480);
  const focus = cleanProbeTreeResponseText(quotedFocus || normalizeProbeTreeContinuationAnswer(continuationAnswer), 8_000).toLowerCase();
  if (!focus) return true;
  return !options.every(option => focus.includes(option.label.toLowerCase()));
}

export function isProbeTreeCardUserInputRelevant({ contextText, question, selectionOptions, contextAnchors } = {}) {
  const userInput = extractProbeTreeUserInputText(contextText);
  const continuationAnswer = readContextMarker(contextText, "Selected continuation answer");
  const groundingInput = extractProbeTreeGroundingText(contextText);
  const normalizedInput = cleanProbeTreeResponseText(groundingInput, 12_000).toLowerCase();
  const anchors = normalizeProbeTreeContextAnchors(contextAnchors);
  const options = normalizeProbeTreeSelectionOptions(selectionOptions);
  if (
    !normalizedInput
    || (continuationAnswer && isProbeTreeTerminalGenerationRequest(userInput))
    || anchors.length < 2
    || options.length < 2
    || isProbeTreeSourceQueryRestatement({ userInput, question, selectionOptions: options })
    || GENERIC_RESPONSE_CONTENT_PATTERN.test(String(question || "").trim())
    || GENERIC_CLARIFICATION_QUESTION_PATTERN.test(String(question || "").trim())
    || options.some(option => GENERIC_CLARIFICATION_CHOICE_PATTERN.test(option.label))
    || !areProbeTreeContinuationChoicesSuggested({ contextText, question, selectionOptions: options })
  ) return false;
  if (anchors.some(anchor => !normalizedInput.includes(anchor.toLowerCase()))) return false;
  const contextKeywords = collectProbeTreeContextKeywords(groundingInput, 96).filter(keyword => !PROBE_TREE_RUNTIME_META_WORDS.has(keyword));
  if (contextKeywords.length < 2) return false;
  const questionMatches = new Set(matchedContextKeywords(contextKeywords, question));
  if (continuationAnswer) {
    const primaryKeywords = collectProbeTreeContextKeywords(userInput, 96).filter(keyword => !PROBE_TREE_RUNTIME_META_WORDS.has(keyword));
    const requiredPrimaryMatches = Math.min(2, primaryKeywords.length);
    const primaryMatches = new Set(matchedContextKeywords(primaryKeywords, question));
    if (requiredPrimaryMatches < 1 || primaryMatches.size < requiredPrimaryMatches) return false;
    return true;
  }
  return questionMatches.size >= 2;
}
