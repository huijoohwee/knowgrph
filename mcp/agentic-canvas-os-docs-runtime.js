import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  AGENTIC_CANVAS_OS_DOCS_KIND_FILES,
} from "./agentic-canvas-os-docs-contract.mjs";
import { buildAgenticCanvasOsDocsInvokePayload } from "./agentic-canvas-os-docs-core.mjs";

const REQUIRED_DOC_FILE_NAMES = Object.freeze([
  "FACTS.md",
  ...Object.values(AGENTIC_CANVAS_OS_DOCS_KIND_FILES),
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
    return configuredRevision;
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
  return revision;
};

export const resolveAgenticCanvasOsDocsRoot = ({
  rootDir = process.cwd(),
  env = process.env,
} = {}) => {
  const explicitRoot = normalizeText(env.KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT);
  if (explicitRoot) return path.resolve(explicitRoot);
  return path.resolve(rootDir, "..", "agentic-canvas-os", "docs");
};

export async function runAgenticCanvasOsDocsInvokeTool(args = {}, {
  rootDir = process.cwd(),
  env = process.env,
} = {}) {
  const absoluteDocsRoot = resolveAgenticCanvasOsDocsRoot({ rootDir, env });
  const sourceRevision = await resolveAgenticCanvasOsDocsRevision({ absoluteDocsRoot, env });
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
