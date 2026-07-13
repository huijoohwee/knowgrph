import {
  AGENTIC_CANVAS_OS_DOCS_KIND_FILES,
  AGENTIC_CANVAS_OS_DOCS_SOURCE_ROOT_URL,
  AGENTIC_CANVAS_OS_DOCS_WORKSPACE_ROOT,
  dictionaryFileForAgenticCanvasOsToken,
  kindForAgenticCanvasOsToken,
} from "./agentic-canvas-os-docs-contract.mjs";

const FRONTMATTER_BOUNDARY = "---";
const MAX_SNIPPET_CHARS = 2400;

const normalizeText = (value) => String(value || "").trim();

const parseQuotedYamlScalar = (value) => {
  const text = normalizeText(value);
  if (!text) return "";
  if (
    (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
};
const extractFrontmatter = (markdown) => {
  const lines = String(markdown || "").split(/\r?\n/);
  if (lines[0] !== FRONTMATTER_BOUNDARY) return "";
  const endIndex = lines.findIndex((line, index) => index > 0 && line === FRONTMATTER_BOUNDARY);
  return endIndex > 0 ? lines.slice(1, endIndex).join("\n") : "";
};

const parseDictionaryEntriesFromFrontmatter = (frontmatter) => {
  const entries = [];
  const lines = String(frontmatter || "").split(/\r?\n/);
  let inEntries = false;
  for (const line of lines) {
    if (/^dictionary_entries:\s*$/.test(line)) {
      inEntries = true;
      continue;
    }
    if (inEntries && /^[a-zA-Z0-9_-]+:\s*/.test(line)) break;
    const match = inEntries ? line.match(/^\s{2}-\s+(.+?)\s*$/) : null;
    if (!match) continue;
    const token = parseQuotedYamlScalar(match[1]);
    if (token) entries.push(token);
  }
  return entries;
};

const parseDirectResolutionFromFrontmatter = (frontmatter) => {
  const out = new Map();
  const lines = String(frontmatter || "").split(/\r?\n/);
  let inDirectResolution = false;
  for (const line of lines) {
    if (/^direct_resolution:\s*$/.test(line)) {
      inDirectResolution = true;
      continue;
    }
    if (inDirectResolution && /^[a-zA-Z0-9_-]+:\s*/.test(line)) break;
    const match = inDirectResolution ? line.match(/^\s{2}(.+?):\s+(.+?)\s*$/) : null;
    if (!match) continue;
    const token = parseQuotedYamlScalar(match[1]);
    const sourcePath = parseQuotedYamlScalar(match[2]);
    if (token && sourcePath) out.set(token, sourcePath);
  }
  return out;
};

const sourceUrlForPath = (sourcePath) => {
  const [fileName, fragment = ""] = normalizeText(sourcePath).split("#");
  if (!fileName) return AGENTIC_CANVAS_OS_DOCS_SOURCE_ROOT_URL;
  return `${AGENTIC_CANVAS_OS_DOCS_SOURCE_ROOT_URL}/${fileName}${fragment ? `#${fragment}` : ""}`;
};

const labelForToken = (token) => (
  normalizeText(token)
    .replace(/^[/#@]+/, "")
    .replace(/[:.]/g, " ")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ") || normalizeText(token)
);

const rowSummaryForToken = (token, markdown) => {
  const escaped = normalizeText(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rowPattern = new RegExp(`^\\|\\s+\`${escaped}\`\\s+\\|\\s+(.+?)\\s+\\|`, "m");
  const rowMatch = String(markdown || "").match(rowPattern);
  if (rowMatch) return rowMatch[1].replace(/\s+/g, " ").trim();
  return "";
};

const snippetForToken = (token, markdown) => {
  const escaped = normalizeText(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rowPattern = new RegExp(`^\\|\\s+\`${escaped}\`\\s+\\|.*$`, "m");
  const rowMatch = String(markdown || "").match(rowPattern);
  if (rowMatch?.[0]) return rowMatch[0].slice(0, MAX_SNIPPET_CHARS);
  const headingPattern = new RegExp(`^#{2,4}\\s+${escaped}\\s*$`, "m");
  const headingMatch = headingPattern.exec(String(markdown || ""));
  if (!headingMatch) return "";
  const start = headingMatch.index;
  const remainder = String(markdown || "").slice(start + headingMatch[0].length);
  const nextHeading = remainder.search(/\n#{2,4}\s+/);
  const section = nextHeading >= 0
    ? String(markdown || "").slice(start, start + headingMatch[0].length + nextHeading)
    : String(markdown || "").slice(start);
  return section.slice(0, MAX_SNIPPET_CHARS);
};

export const buildAgenticCanvasOsDocsCatalog = (docsContentByFileName) => {
  const factsFrontmatter = extractFrontmatter(docsContentByFileName["FACTS.md"] || "");
  const directResolution = parseDirectResolutionFromFrontmatter(factsFrontmatter);
  const catalog = new Map();

  for (const [kind, fileName] of Object.entries(AGENTIC_CANVAS_OS_DOCS_KIND_FILES)) {
    const markdown = docsContentByFileName[fileName] || "";
    const entries = parseDictionaryEntriesFromFrontmatter(extractFrontmatter(markdown));
    for (const token of entries) {
      const sourcePath = directResolution.get(token) || `${fileName}#${token}`;
      const summary = rowSummaryForToken(token, markdown);
      catalog.set(token, {
        token,
        kind,
        label: labelForToken(token),
        summary,
        sourcePath,
        sourceUrl: sourceUrlForPath(sourcePath),
      });
    }
  }

  for (const [token, sourcePath] of directResolution.entries()) {
    if (catalog.has(token)) continue;
    const fileName = dictionaryFileForAgenticCanvasOsToken(token);
    if (!fileName) continue;
    catalog.set(token, {
      token,
      kind: kindForAgenticCanvasOsToken(token),
      label: labelForToken(token),
      summary: rowSummaryForToken(token, docsContentByFileName[fileName] || ""),
      sourcePath,
      sourceUrl: sourceUrlForPath(sourcePath),
    });
  }

  return [...catalog.values()].sort((left, right) => left.token.localeCompare(right.token));
};

export const buildAgenticCanvasOsDocsInvokePayload = ({
  docsContentByFileName = {},
  token = "",
  query = "",
  includeContent = false,
  limit = 120,
  absoluteDocsRoot = "",
} = {}) => {
  const catalog = buildAgenticCanvasOsDocsCatalog(docsContentByFileName);
  const counts = catalog.reduce((acc, entry) => {
    acc[entry.kind] = (acc[entry.kind] || 0) + 1;
    return acc;
  }, {});
  const normalizedToken = normalizeText(token);
  const normalizedQuery = normalizeText(query).toLowerCase();
  const sigilQuery = ["/", "#", "@"].includes(normalizedQuery) ? normalizedQuery : "";
  const boundedLimit = Math.max(1, Math.min(500, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 120));
  const matchesQuery = (entry) => sigilQuery
    ? entry.token.startsWith(sigilQuery)
    : !normalizedQuery || [
      entry.token,
      entry.kind,
      entry.label,
      entry.summary,
      entry.sourcePath,
    ].some((value) => normalizeText(value).toLowerCase().includes(normalizedQuery));

  const invocation = normalizedToken
    ? catalog.find((entry) => entry.token === normalizedToken) || null
    : null;
  const fallbackInvocation = !invocation && normalizedToken
    ? (() => {
        const kind = kindForAgenticCanvasOsToken(normalizedToken);
        const fileName = dictionaryFileForAgenticCanvasOsToken(normalizedToken);
        if (!kind || !fileName) return null;
        const sourcePath = `${fileName}#${normalizedToken}`;
        return {
          token: normalizedToken,
          kind,
          label: labelForToken(normalizedToken),
          summary: "",
          sourcePath,
          sourceUrl: sourceUrlForPath(sourcePath),
        };
      })()
    : null;
  const effectiveInvocation = invocation || fallbackInvocation;
  const resolvedInvocation = invocation && includeContent
    ? {
        ...invocation,
        content: snippetForToken(
          invocation.token,
          docsContentByFileName[dictionaryFileForAgenticCanvasOsToken(invocation.token)] || "",
        ),
      }
    : effectiveInvocation;
  const filteredCatalog = normalizedToken
    ? []
    : catalog.filter(matchesQuery);
  const limitedCatalog = filteredCatalog.slice(0, boundedLimit);

  return {
    ok: !normalizedToken || Boolean(effectiveInvocation),
    docsRoot: AGENTIC_CANVAS_OS_DOCS_WORKSPACE_ROOT,
    sourceRootUrl: AGENTIC_CANVAS_OS_DOCS_SOURCE_ROOT_URL,
    ...(absoluteDocsRoot ? { absoluteDocsRoot } : {}),
    ...(normalizedToken ? { token: normalizedToken } : {}),
    invocation: resolvedInvocation,
    catalog: limitedCatalog,
    counts,
    truncated: filteredCatalog.length > limitedCatalog.length,
    ...(!normalizedToken || effectiveInvocation
      ? {}
      : {
          error: {
            code: "unknown_invocation_token",
            message: `Unknown Agentic Canvas OS docs invocation token: ${normalizedToken}`,
          },
        }),
  };
};

export const buildAgenticCanvasOsDocsStaticResolutionPayload = (args = {}) => (
  buildAgenticCanvasOsDocsInvokePayload({
    ...args,
    docsContentByFileName: {
      "FACTS.md": "",
      "DICTIONARY-COMMAND.md": "",
      "DICTIONARY-SEMANTIC.md": "",
      "DICTIONARY-BINDING.md": "",
    },
  })
);

export const buildAgenticCanvasOsDocsDynamicResolutionPayload = async (args = {}) => {
  const fetchDoc = async (fileName) => {
    try {
      const url = `https://raw.githubusercontent.com/huijoohwee/agentic-canvas-os/main/docs/${fileName}`;
      const res = await fetch(url, {
        cf: { cacheTtl: 300, cacheEverything: true }
      });
      if (!res.ok) return "";
      return await res.text();
    } catch {
      return "";
    }
  };

  const [facts, command, semantic, binding] = await Promise.all([
    fetchDoc("FACTS.md"),
    fetchDoc("DICTIONARY-COMMAND.md"),
    fetchDoc("DICTIONARY-SEMANTIC.md"),
    fetchDoc("DICTIONARY-BINDING.md"),
  ]);

  return buildAgenticCanvasOsDocsInvokePayload({
    ...args,
    docsContentByFileName: {
      "FACTS.md": facts,
      "DICTIONARY-COMMAND.md": command,
      "DICTIONARY-SEMANTIC.md": semantic,
      "DICTIONARY-BINDING.md": binding,
    },
  });
};
