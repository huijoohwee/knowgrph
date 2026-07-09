import fs from "node:fs/promises";
import path from "node:path";

import {
  AGENTIC_CANVAS_OS_DOCS_KIND_FILES,
} from "./agentic-canvas-os-docs-contract.mjs";
import { buildAgenticCanvasOsDocsInvokePayload } from "./agentic-canvas-os-docs-core.mjs";

const REQUIRED_DOC_FILE_NAMES = Object.freeze([
  "FACTS.md",
  ...Object.values(AGENTIC_CANVAS_OS_DOCS_KIND_FILES),
]);

const normalizeText = (value) => String(value || "").trim();

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
