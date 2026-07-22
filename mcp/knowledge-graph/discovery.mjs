import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import {
  compareStableStrings,
  KnowledgeGraphError,
  normalizeRelativePath,
  sha256,
  throwIfAborted,
} from "./contract.mjs";

const DEFAULT_EXCLUDED_SEGMENTS = new Set([
  ".git",
  ".hg",
  ".svn",
  ".knowgrph",
  ".next",
  ".nuxt",
  ".venv",
  "__pycache__",
  "bower_components",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor",
]);

const TEXT_EXTENSIONS = new Set([
  ".bash", ".cjs", ".conf", ".css", ".dockerfile", ".env", ".htm", ".html", ".ini",
  ".js", ".json", ".jsonc", ".jsonld", ".jsx", ".md", ".markdown", ".mdx", ".mjs",
  ".py", ".sh", ".sql", ".tf", ".tfvars", ".toml", ".ts", ".tsx", ".txt", ".yaml",
  ".yml", ".zsh",
]);

const normalizePattern = (value) => String(value || "").trim().replaceAll("\\", "/").replace(/^\.\//, "");

function globPatternToRegExp(patternRaw) {
  let pattern = normalizePattern(patternRaw);
  const directoryOnly = pattern.endsWith("/");
  if (directoryOnly) pattern = pattern.slice(0, -1);
  const anchored = pattern.startsWith("/");
  if (anchored) pattern = pattern.slice(1);
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else source += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  }
  const prefix = anchored ? "^" : pattern.includes("/") ? "^(?:.*?/)?" : "^(?:.*?/)?";
  return new RegExp(`${prefix}${source}${directoryOnly ? "(?:/.*)?" : ""}$`);
}

function buildOrderedIgnoreRules(lines) {
  const rules = [];
  for (const raw of lines) {
    const trimmed = String(raw || "").trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const negated = trimmed.startsWith("!");
    const pattern = negated ? trimmed.slice(1) : trimmed;
    if (!pattern) continue;
    rules.push({ negated, regex: globPatternToRegExp(pattern) });
  }
  return rules;
}

function matchesOrderedRules(relativePath, rules) {
  let ignored = false;
  for (const rule of rules) if (rule.regex.test(relativePath)) ignored = !rule.negated;
  return ignored;
}

function matchesAny(relativePath, patterns) {
  return patterns.some((pattern) => globPatternToRegExp(pattern).test(relativePath));
}

function isDefaultExcluded(relativePath) {
  return relativePath.split("/").some((segment) => DEFAULT_EXCLUDED_SEGMENTS.has(segment));
}

async function readRootGitignore(rootPath) {
  try {
    const opened = await readStableSourceFile(path.join(rootPath, ".gitignore"), rootPath, 1_000_000, ".gitignore");
    return opened.bytes ? buildOrderedIgnoreRules(opened.bytes.toString("utf8").split(/\r?\n/)) : [];
  } catch {
    return [];
  }
}

function extensionFor(relativePath) {
  const base = path.posix.basename(relativePath).toLowerCase();
  if (base === "dockerfile") return ".dockerfile";
  return path.posix.extname(base);
}

export function inferKnowledgeSourceKind(relativePath) {
  const extension = extensionFor(relativePath);
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extension)) return "typescript";
  if (extension === ".py") return "python";
  if (extension === ".sql") return "sql";
  if ([".md", ".markdown", ".mdx"].includes(extension)) return "markdown";
  if ([".json", ".jsonc", ".jsonld"].includes(extension)) return "json-config";
  if ([".yaml", ".yml", ".toml", ".tf", ".tfvars", ".ini", ".conf", ".env", ".dockerfile"].includes(extension)) return "structural-config";
  if (extension === ".pdf") return "pdf";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  return "unsupported";
}

function looksBinary(bytes) {
  const limit = Math.min(bytes.length, 8192);
  for (let index = 0; index < limit; index += 1) if (bytes[index] === 0) return true;
  return false;
}

function pathIsInside(candidatePath, rootPath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

const sameFileIdentity = (left, right) => left.dev === right.dev && left.ino === right.ino;

async function readStableSourceFile(absolutePath, rootPath, maxFileBytes, relativePath) {
  let handle;
  try {
    const noFollow = Number(fsConstants.O_NOFOLLOW || 0);
    handle = await fs.open(absolutePath, fsConstants.O_RDONLY | noFollow);
    const openedStat = await handle.stat();
    if (!openedStat.isFile()) throw new KnowledgeGraphError("source_not_regular_file", `Source is not a regular file: ${relativePath}`);
    const realPath = await fs.realpath(absolutePath);
    const pathStat = await fs.stat(realPath);
    if (!pathIsInside(realPath, rootPath) || !sameFileIdentity(openedStat, pathStat)) {
      throw new KnowledgeGraphError("source_path_unstable", `Source path changed or escaped during discovery: ${relativePath}`);
    }
    if (openedStat.size > maxFileBytes) return { stat: openedStat, bytes: null };
    const bytes = Buffer.alloc(openedStat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const chunk = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!chunk.bytesRead) break;
      offset += chunk.bytesRead;
    }
    const extra = Buffer.alloc(1);
    const extraRead = await handle.read(extra, 0, 1, openedStat.size);
    const closedStat = await handle.stat();
    if (offset !== bytes.length || extraRead.bytesRead || !sameFileIdentity(openedStat, closedStat)
      || openedStat.size !== closedStat.size || openedStat.mtimeMs !== closedStat.mtimeMs) {
      throw new KnowledgeGraphError("source_changed_during_read", `Source changed while it was being read: ${relativePath}`);
    }
    return { stat: openedStat, bytes };
  } catch (error) {
    if (error instanceof KnowledgeGraphError) throw error;
    throw new KnowledgeGraphError("source_read_failed", `Could not safely read source: ${relativePath}`, {
      sourcePath: relativePath,
      causeCode: String(error?.code || "read_failed"),
    });
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function resolveRealDirectory(rootPathRaw) {
  if (!String(rootPathRaw || "").trim()) throw new KnowledgeGraphError("root_path_required", "rootPath is required.");
  const resolved = path.resolve(String(rootPathRaw));
  let real;
  try {
    real = await fs.realpath(resolved);
  } catch {
    throw new KnowledgeGraphError("root_not_found", `Knowledge graph root does not exist: ${resolved}`);
  }
  const stat = await fs.stat(real);
  if (!stat.isDirectory()) throw new KnowledgeGraphError("root_not_directory", `Knowledge graph root is not a directory: ${resolved}`);
  return real;
}

export async function isPathWithinAllowedRoots(candidatePath, allowedRoots) {
  const candidate = path.resolve(candidatePath);
  for (const rootRaw of allowedRoots || []) {
    const root = await resolveRealDirectory(rootRaw);
    const relative = path.relative(root, candidate);
    if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return true;
  }
  return false;
}

export async function discoverKnowledgeSources(args) {
  const rootPath = await resolveRealDirectory(args.rootPath);
  const maxFiles = Math.max(1, Math.min(100_000, Number(args.maxFiles || 10_000)));
  const maxFileBytes = Math.max(1, Math.min(100_000_000, Number(args.maxFileBytes || 2_000_000)));
  const maxTotalBytes = Math.max(1, Math.min(2_000_000_000, Number(args.maxTotalBytes || 200_000_000)));
  const include = Array.isArray(args.include) ? args.include.map(normalizePattern).filter(Boolean) : [];
  const exclude = Array.isArray(args.exclude) ? args.exclude.map(normalizePattern).filter(Boolean) : [];
  const exactExcludedPaths = new Set((args.exactExcludedPaths || []).map(normalizePattern).filter(Boolean));
  const gitignoreRules = args.respectGitignore === false ? [] : await readRootGitignore(rootPath);
  const sources = [];
  const diagnostics = [];
  let seenFileCount = 0;
  let seenTotalBytes = 0;

  async function walk(directoryPath, directoryRelative = "") {
    throwIfAborted(args.abortSignal);
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    entries.sort((left, right) => compareStableStrings(left.name, right.name));
    for (const entry of entries) {
      throwIfAborted(args.abortSignal);
      const relativePath = normalizeRelativePath(directoryRelative ? `${directoryRelative}/${entry.name}` : entry.name);
      if (exactExcludedPaths.has(relativePath) || isDefaultExcluded(relativePath) || matchesOrderedRules(relativePath, gitignoreRules) || matchesAny(relativePath, exclude)) continue;
      const absolutePath = path.join(directoryPath, entry.name);
      if (entry.isSymbolicLink()) {
        diagnostics.push({ code: "symlink_skipped", sourcePath: relativePath, message: `Skipped symbolic link ${relativePath}.` });
        continue;
      }
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (include.length && !matchesAny(relativePath, include)) continue;
      seenFileCount += 1;
      if (seenFileCount > maxFiles) {
        throw new KnowledgeGraphError("max_files_exceeded", `File count exceeds configured maximum ${maxFiles}.`, { maxFiles });
      }
      const opened = await readStableSourceFile(absolutePath, rootPath, maxFileBytes, relativePath);
      const stat = opened.stat;
      seenTotalBytes += stat.size;
      if (seenTotalBytes > maxTotalBytes) {
        throw new KnowledgeGraphError("max_total_bytes_exceeded", `Discovered files exceed configured total byte maximum ${maxTotalBytes}.`, { maxTotalBytes });
      }
      const kind = inferKnowledgeSourceKind(relativePath);
      if (!opened.bytes) {
        const diagnostic = { code: "file_too_large", sourcePath: relativePath, message: `Skipped ${relativePath}; ${stat.size} bytes exceeds ${maxFileBytes}.` };
        diagnostics.push(diagnostic);
        sources.push({ relativePath, absolutePath, byteSize: stat.size, contentHash: sha256(`skipped\0${relativePath}\0${stat.size}`), kind, status: "skipped", diagnostics: [diagnostic] });
        continue;
      }
      const bytes = opened.bytes;
      const contentHash = sha256(bytes);
      const binary = looksBinary(bytes);
      const isPdf = kind === "pdf";
      if (binary && !isPdf) {
        const diagnostic = { code: "binary_unsupported", sourcePath: relativePath, message: `Recorded binary file ${relativePath} without content extraction.` };
        diagnostics.push(diagnostic);
        sources.push({ relativePath, absolutePath, byteSize: bytes.length, contentHash, kind: "unsupported", status: "unsupported", diagnostics: [diagnostic] });
        continue;
      }
      sources.push({
        relativePath,
        absolutePath,
        byteSize: bytes.length,
        contentHash,
        kind,
        status: kind === "unsupported" ? "unsupported" : "ready",
        ...(isPdf ? { bytes } : { text: bytes.toString("utf8") }),
        diagnostics: kind === "unsupported"
          ? [{ code: "parser_unsupported", sourcePath: relativePath, message: `No structural parser is registered for ${relativePath}.` }]
          : [],
      });
    }
  }

  await walk(rootPath);
  sources.sort((left, right) => compareStableStrings(left.relativePath, right.relativePath));
  return { rootPath, sources, diagnostics: [...diagnostics].sort((left, right) => compareStableStrings(`${left.sourcePath}:${left.code}`, `${right.sourcePath}:${right.code}`)) };
}
