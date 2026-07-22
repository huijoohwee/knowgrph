import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

import {
  AGENTIC_CANVAS_OS_DOCS_KIND_FILES,
  AGENTIC_CANVAS_OS_LIVE_AGENT_PROOF_FILE,
  AGENTIC_CANVAS_OS_PROGRESSIVE_AGENTS_FILE,
} from "./agentic-canvas-os-docs-contract.mjs";
import {
  buildAgenticCanvasOsDocsInvokePayload,
  resolveAgentLiveProviderProofRevisionFromGitHub,
} from "./agentic-canvas-os-docs-core.mjs";

const REQUIRED_DOC_FILE_NAMES = Object.freeze([
  "FACTS.md",
  ...Object.values(AGENTIC_CANVAS_OS_DOCS_KIND_FILES),
  AGENTIC_CANVAS_OS_LIVE_AGENT_PROOF_FILE,
  AGENTIC_CANVAS_OS_PROGRESSIVE_AGENTS_FILE,
]);

const normalizeText = (value) => String(value || "").trim();
const execFileAsync = promisify(execFile);
const SOURCE_REVISION_PATTERN = /^[0-9a-f]{40}$/;

export const resolveAgenticCanvasOsDocsRevision = async ({ absoluteDocsRoot, env = process.env }) => {
  const configuredRevision = normalizeText(env.KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_REVISION);
  if (configuredRevision) {
    if (!SOURCE_REVISION_PATTERN.test(configuredRevision)) {
      throw new Error("KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_REVISION must be an exact 40-character SHA");
    }
  }
  const repositoryRoot = path.resolve(absoluteDocsRoot, "..");
  const docsPathspec = path.relative(repositoryRoot, absoluteDocsRoot) || ".";
  const { stdout: dirtyOutput } = await execFileAsync("git", ["-C", repositoryRoot, "status", "--porcelain", "--", docsPathspec]);
  if (normalizeText(dirtyOutput)) {
    throw new Error("Agentic Canvas OS docs checkout has uncommitted content and cannot provide an exact source revision");
  }
  const { stdout } = await execFileAsync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"]);
  const revision = normalizeText(stdout);
  if (!SOURCE_REVISION_PATTERN.test(revision)) {
    throw new Error("Agentic Canvas OS docs checkout did not resolve to an exact Git SHA");
  }
  if (configuredRevision && configuredRevision !== revision) {
    throw new Error(`KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_REVISION ${configuredRevision} does not match docs checkout HEAD ${revision}`);
  }
  return revision;
};

export const resolveAgenticCanvasOsLiveProofRevision = async ({
  absoluteDocsRoot,
  sourceRevision,
  env = process.env,
}) => {
  const configuredRevision = normalizeText(env.KNOWGRPH_AGENTIC_CANVAS_OS_LIVE_PROOF_REVISION);
  if (configuredRevision) {
    if (!SOURCE_REVISION_PATTERN.test(configuredRevision)) {
      throw new Error("KNOWGRPH_AGENTIC_CANVAS_OS_LIVE_PROOF_REVISION must be an exact 40-character SHA");
    }
    return configuredRevision;
  }
  const repositoryRoot = path.resolve(absoluteDocsRoot, "..");
  const proofPath = path.relative(repositoryRoot, path.join(absoluteDocsRoot, AGENTIC_CANVAS_OS_LIVE_AGENT_PROOF_FILE));
  const { stdout: shallowOutput } = await execFileAsync("git", [
    "-C", repositoryRoot, "rev-parse", "--is-shallow-repository",
  ]);
  const isShallowRepository = normalizeText(shallowOutput) === "true";
  let localRevision = "";
  if (!isShallowRepository) {
    const { stdout } = await execFileAsync("git", [
      "-C", repositoryRoot, "log", "--follow", "--diff-filter=A", "--format=%H", "--", proofPath,
    ]);
    localRevision = normalizeText(stdout).split(/\r?\n/).filter(Boolean).at(-1) || "";
  }
  if (SOURCE_REVISION_PATTERN.test(localRevision)) return localRevision;
  const revision = await resolveAgentLiveProviderProofRevisionFromGitHub({
    sourceRevision,
    token: env.KNOWGRPH_GITHUB_TOKEN,
  });
  if (!SOURCE_REVISION_PATTERN.test(revision)) {
    throw new Error("Agentic Canvas OS live proof did not resolve to an exact introduction SHA from local or remote history");
  }
  return revision;
};

export const resolveAgenticCanvasOsDocsRoot = ({
  rootDir = process.cwd(),
  env = process.env,
} = {}) => {
  const explicitRoot = normalizeText(env.KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT);
  if (explicitRoot) {
    const resolved = path.resolve(explicitRoot);
    if (!existsSync(path.join(resolved, "FACTS.md"))) {
      throw new Error(`KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT is not a readable Agentic Canvas OS docs root: ${resolved}`);
    }
    return resolved;
  }
  const findMarkerBackedAncestorRoot = (startDir) => {
    let cursor = path.resolve(startDir);
    while (true) {
      const candidate = path.join(cursor, "agentic-canvas-os", "docs");
      if (existsSync(path.join(candidate, "FACTS.md"))) return candidate;
      const parent = path.dirname(cursor);
      if (parent === cursor) return "";
      cursor = parent;
    }
  };
  const ancestorRoot = findMarkerBackedAncestorRoot(rootDir);
  if (ancestorRoot) return ancestorRoot;
  try {
    const gitCommonDir = normalizeText(execFileSync(
      "git",
      ["-C", path.resolve(rootDir), "rev-parse", "--path-format=absolute", "--git-common-dir"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ));
    const canonicalRepositoryRoot = path.basename(gitCommonDir) === ".git"
      ? path.dirname(gitCommonDir)
      : gitCommonDir;
    const canonicalRoot = findMarkerBackedAncestorRoot(canonicalRepositoryRoot);
    if (canonicalRoot) return canonicalRoot;
  } catch {
    // Non-Git callers still receive the marker-backed resolution error below.
  }
  throw new Error(`Could not resolve agentic-canvas-os/docs from ${path.resolve(rootDir)}`);
};

export async function runAgenticCanvasOsDocsInvokeTool(args = {}, {
  rootDir = process.cwd(),
  env = process.env,
} = {}) {
  const absoluteDocsRoot = resolveAgenticCanvasOsDocsRoot({ rootDir, env });
  const sourceRevision = await resolveAgenticCanvasOsDocsRevision({ absoluteDocsRoot, env });
  const liveAgentProviderProofRevision = await resolveAgenticCanvasOsLiveProofRevision({
    absoluteDocsRoot,
    sourceRevision,
    env,
  });
  const docsContentByFileName = {};
  const missing = [];

  for (const fileName of REQUIRED_DOC_FILE_NAMES) {
    try {
      docsContentByFileName[fileName] = await fs.readFile(path.join(absoluteDocsRoot, fileName), "utf8");
    } catch {
      missing.push(fileName);
      docsContentByFileName[fileName] = "";
    }
  }

  const payload = buildAgenticCanvasOsDocsInvokePayload({
    docsContentByFileName,
    token: args.token,
    query: args.query,
    includeContent: args.includeContent === true,
    limit: args.limit,
    absoluteDocsRoot,
    sourceRevision,
    liveAgentProviderProofRevision,
  });

  if (missing.length) {
    return {
      ...payload,
      ok: false,
      error: {
        code: "docs_root_unreadable",
        message: `Missing required Agentic Canvas OS docs files: ${missing.join(", ")}`,
      },
    };
  }

  return payload;
}
