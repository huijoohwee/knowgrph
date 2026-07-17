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
const PROBE_TREE_GUARD_CLAUSE_PATTERN = /^(?:do not|don't|never|stop|without)\b/i;
const PROBE_TREE_GENERATED_QUESTION_SCAFFOLD_PATTERN = /^(?:which requested items should guide the next branch)\s*:\s*/i;

export const cleanProbeTreeResponseText = (value, maxLength = 320) => (
  String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength)
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

const readProbeTreeKeywordLabel = (contextText, keyword) => {
  const pattern = buildProbeTreeKeywordPattern(keyword);
  const match = String(contextText || "").match(new RegExp(`(?:^|[^a-z0-9-])(${pattern})(?=$|[^a-z0-9-])`, "i"));
  return String(match?.[1] || keyword);
};

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

const splitAuthoredClauses = userInput => (
  String(userInput || "")
    .replace(/(^|\s)[/#@][A-Za-z0-9_.-]+/g, " ")
    .match(/[^.!?\n]+[.!?]?/g) || []
).map(value => cleanProbeTreeResponseText(value, 480)).filter(value => (
  value.length >= 24 && !PROBE_TREE_GUARD_CLAUSE_PATTERN.test(value)
));

const stripLeadingDirectiveVerb = value => String(value || "").replace(
  /^(?:assess|choose|compare|confirm|evaluate|identify|keep|prioritize|prioritise|produce|provide|require|review|select|use)\s+/i,
  "",
);

const splitEnumeratedPhrases = source => {
  const authoredSource = String(source || "");
  const enumeratedSource = /[,;]/.test(authoredSource)
    ? authoredSource
    : authoredSource.replace(/\b(?:and|or)\b(?=\s+(?:an?\s+)?[a-z0-9])/gi, ",");
  const phrases = enumeratedSource
    .replace(/[.!?]+$/g, "")
    .split(/[,;]+/)
    .map((value, index) => cleanProbeTreeResponseText(index === 0 ? stripLeadingDirectiveVerb(value) : value, 160))
    .map(value => value.replace(/^(?:and|or)\s+/i, "").trim())
    .filter(value => value.length >= 3 && collectProbeTreeContextKeywords(value, 4).length > 0);
  return normalizeProbeTreeSelectionOptions(phrases);
};

const extractEnumeratedPhraseGroups = clause => {
  const relationPattern = /\b(?:across|among|between|covering|for|includes?|including|such as|using)\b\s*/ig;
  const relationMatches = [...clause.matchAll(relationPattern)];
  const lastRelation = relationMatches.at(-1);
  const sources = lastRelation
    ? [
        clause.slice(Number(lastRelation.index) + lastRelation[0].length),
        clause.slice(0, Number(lastRelation.index)),
        clause,
      ]
    : [clause];
  const seen = new Set();
  return sources.flatMap(source => {
    const options = splitEnumeratedPhrases(source);
    const key = options.map(option => option.label.toLowerCase()).join("\u0000");
    if (options.length < PROBE_TREE_MULTI_SELECT_LIMITS.min || seen.has(key)) return [];
    seen.add(key);
    return [options];
  });
};

const scoreInputClause = (clause, selectionOptions) => {
  const keywords = collectProbeTreeContextKeywords(clause, 20);
  const runtimeWords = keywords.filter(keyword => PROBE_TREE_RUNTIME_META_WORDS.has(keyword)).length;
  return (keywords.length - runtimeWords) * 3 + selectionOptions.length * 2 - runtimeWords * 4;
};

const buildProbeTreeClarificationSuggestions = (phrase, peerPhrase) => normalizeProbeTreeSelectionOptions(peerPhrase
  ? [
      `Define the scope for ${phrase} relative to ${peerPhrase}`,
      `Set the priority between ${phrase} and ${peerPhrase}`,
      `Identify constraints linking ${phrase} with ${peerPhrase}`,
    ]
  : [
      `Define the scope for ${phrase}`,
      `Set the priority within ${phrase}`,
      `Identify constraints affecting ${phrase}`,
    ]);

const buildProbeTreeFocusAnchors = (phrase, peerPhrase, contextText) => {
  const groundingText = extractProbeTreeGroundingText(contextText);
  const phraseKeywords = collectProbeTreeContextKeywords([phrase, peerPhrase].filter(Boolean).join(" "), 6);
  const groundingKeywords = collectProbeTreeContextKeywords(groundingText, 12);
  const labels = [...phraseKeywords, ...groundingKeywords]
    .map(keyword => readProbeTreeKeywordLabel(groundingText, keyword));
  return normalizeProbeTreeContextAnchors([phrase, peerPhrase, ...labels]);
};

const buildProbeTreeFocusedOptions = ({ phrases, idPrefix, contextText }) => phrases.flatMap((phrase, index) => {
  const peerPhrase = phrases.length > 1 ? phrases[(index + 1) % phrases.length] : "";
  const selectionOptions = buildProbeTreeClarificationSuggestions(phrase, peerPhrase);
  const contextAnchors = buildProbeTreeFocusAnchors(phrase, peerPhrase, contextText);
  if (selectionOptions.length < PROBE_TREE_MULTI_SELECT_LIMITS.min || contextAnchors.length < 2) return [];
  const labels = selectionOptions.map(option => option.label);
  return [{
    id: `${idPrefix}-${index + 1}-${safeProbeTreeResponseId(phrase, String(index + 1)).slice(0, 64)}`,
    text: cleanProbeTreeResponseText(peerPhrase
      ? `What should the next clarification resolve about "${phrase}" in relation to "${peerPhrase}"?`
      : `What should the next clarification resolve about "${phrase}"?`),
    rationale: cleanProbeTreeResponseText(`Suggests bounded clarification directions for the selected child focus: ${phrase}`),
    evidenceNeeded: cleanProbeTreeResponseText(`User selection among suggested directions: ${labels.join("; ")}`),
    selectionOptions,
    contextAnchors,
    score: scoreInputClause(phrase, selectionOptions),
    clauseIndex: index,
    sourceOrder: index,
  }];
}).filter(candidate => candidate.score >= 8).reduce((accepted, candidate) => (
  areProbeTreeCardsMutuallyDistinct([...accepted, candidate]) ? [...accepted, candidate] : accepted
), []).slice(0, 3);

const readProbeTreeContinuationPhrases = contextText => {
  const continuationAnswer = readContextMarker(contextText, "Selected continuation answer");
  if (continuationAnswer) {
    const selected = readProbeTreeContinuationSelections(continuationAnswer);
    if (selected.length > 0) return selected;
    return splitEnumeratedPhrases(normalizeProbeTreeContinuationAnswer(continuationAnswer)).map(option => option.label);
  }
  const continuationQuestion = readContextMarker(contextText, "Selected continuation question");
  if (!continuationQuestion) return [];
  return splitEnumeratedPhrases(normalizeProbeTreeContinuationQuestion(continuationQuestion)).map(option => option.label);
};

export function buildProbeTreeInputDerivedOptions(contextText) {
  const userInput = extractProbeTreeUserInputText(contextText);
  const continuationPhrases = readProbeTreeContinuationPhrases(contextText);
  if (continuationPhrases.length > 0) {
    return buildProbeTreeFocusedOptions({
      phrases: continuationPhrases,
      idPrefix: "input-derived-continuation",
      contextText,
    }).map(({ score: _score, clauseIndex: _clauseIndex, sourceOrder: _sourceOrder, ...candidate }) => candidate);
  }
  const candidates = splitAuthoredClauses(userInput).flatMap((clause, sourceIndex) => {
    return extractEnumeratedPhraseGroups(clause).map((selectionOptions, groupIndex) => {
      const score = scoreInputClause(clause, selectionOptions) - groupIndex;
      const labels = selectionOptions.map(option => option.label);
      const question = `Which requested items should guide the next branch: ${labels.join(", ")}?`;
      return {
        id: `input-derived-${sourceIndex + 1}-${groupIndex + 1}-${safeProbeTreeResponseId(clause, String(sourceIndex + 1)).slice(0, 60)}`,
        text: cleanProbeTreeResponseText(question),
        rationale: cleanProbeTreeResponseText(`Derived only from the authored request: ${clause}`),
        evidenceNeeded: cleanProbeTreeResponseText(`User selection among: ${labels.join("; ")}`),
        selectionOptions,
        contextAnchors: normalizeProbeTreeContextAnchors([clause, ...labels]),
        score,
        clauseIndex: sourceIndex,
        sourceOrder: sourceIndex * 100 + groupIndex,
      };
    }).filter(candidate => candidate.score >= 8);
  });
  const ranked = candidates.sort((left, right) => right.score - left.score || left.sourceOrder - right.sourceOrder);
  const selected = [];
  const selectedClauses = new Set();
  for (const candidate of ranked) {
    if (selectedClauses.has(candidate.clauseIndex)) continue;
    if (!areProbeTreeCardsMutuallyDistinct([...selected, candidate])) continue;
    selected.push(candidate);
    selectedClauses.add(candidate.clauseIndex);
    if (selected.length >= 3) break;
  }
  if (selected.length < 2 && selected[0]) {
    const focused = buildProbeTreeFocusedOptions({
      phrases: selected[0].selectionOptions.map(option => option.label),
      idPrefix: "input-derived-focus",
      contextText,
    });
    if (focused.length >= 2) {
      return focused.map(({ score: _score, clauseIndex: _clauseIndex, sourceOrder: _sourceOrder, ...candidate }) => candidate);
    }
  }
  return selected.map(({ score: _score, clauseIndex: _clauseIndex, sourceOrder: _sourceOrder, ...candidate }) => candidate);
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
  const groundingInput = extractProbeTreeGroundingText(contextText);
  const normalizedInput = cleanProbeTreeResponseText(groundingInput, 12_000).toLowerCase();
  const anchors = normalizeProbeTreeContextAnchors(contextAnchors);
  const options = normalizeProbeTreeSelectionOptions(selectionOptions);
  if (
    !normalizedInput
    || anchors.length < 2
    || options.length < 2
    || GENERIC_RESPONSE_CONTENT_PATTERN.test(String(question || "").trim())
    || !areProbeTreeContinuationChoicesSuggested({ contextText, question, selectionOptions: options })
  ) return false;
  if (anchors.some(anchor => !normalizedInput.includes(anchor.toLowerCase()))) return false;
  const contextKeywords = collectProbeTreeContextKeywords(groundingInput, 96).filter(keyword => !PROBE_TREE_RUNTIME_META_WORDS.has(keyword));
  if (contextKeywords.length < 2) return false;
  const questionMatches = new Set(matchedContextKeywords(contextKeywords, question));
  const optionMatches = new Set(options.flatMap(option => matchedContextKeywords(contextKeywords, option.label)));
  const continuationAnswer = readContextMarker(contextText, "Selected continuation answer");
  if (continuationAnswer) {
    const primaryKeywords = collectProbeTreeContextKeywords(userInput, 96).filter(keyword => !PROBE_TREE_RUNTIME_META_WORDS.has(keyword));
    const requiredPrimaryMatches = Math.min(2, primaryKeywords.length);
    const primaryMatches = new Set([
      ...matchedContextKeywords(primaryKeywords, question),
      ...options.flatMap(option => matchedContextKeywords(primaryKeywords, option.label)),
    ]);
    if (requiredPrimaryMatches < 1 || primaryMatches.size < requiredPrimaryMatches) return false;
    return options.every(option => matchedContextKeywords(primaryKeywords, option.label).length > 0);
  }
  if (questionMatches.size < 2 || optionMatches.size < 2) return false;
  return options.every(option => matchedContextKeywords(contextKeywords, option.label).length > 0);
}

export function readProbeTreeContextKeywordLabels(contextText, maxCount = 8) {
  const userInput = extractProbeTreeUserInputText(contextText);
  return collectProbeTreeContextKeywords(userInput, maxCount).map(keyword => readProbeTreeKeywordLabel(userInput, keyword));
}
