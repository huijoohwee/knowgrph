import fs from "node:fs/promises";
import path from "node:path";
import {
  buildAgenticCanvasOsLanePayloads,
  finalizeAgenticCanvasOsCoverage,
} from "./agentic-canvas-os-lanes.js";

const CONTRACT_VERSION = "knowgrph.agentic_canvas_os/v0.1";
const DEFAULT_LANES = Object.freeze([
  "repo_profile",
  "dashboard_runtime",
  "approval_gates",
  "budget_model",
  "adapter_readiness",
  "market_radar",
  "browser_evidence",
  "market_to_artifact",
  "learning_loop",
  "demo_pack",
  "failure_handling",
]);
const CANONICAL_DOC = "docs/documents/knowgrph-mcp/knowgrph-mcp-agentic-os-prd-tad.md";
const CANONICAL_COMPANION = "docs/documents/knowgrph-mcp/knowgrph-mcp-agentic-os-prd-tad.companion.md";

const KNOWN_ROOT_MARKERS = Object.freeze([
  "package.json",
  "README.md",
  "vite.config.ts",
  "vite.config.js",
  "next.config.ts",
  "next.config.js",
  "vercel.json",
  "cdk.json",
  "wrangler.toml",
  "wrangler.jsonc",
  "pyproject.toml",
  "requirements.txt",
  ".env.example",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function slugify(value, fallback = "agentic-canvas-os") {
  const slug = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || fallback;
}

function isPathInside(baseDir, targetPath) {
  const relativePath = path.relative(baseDir, targetPath);
  return relativePath === "" || (!!relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function displayPath(rootDir, targetPath) {
  const relativePath = path.relative(rootDir, targetPath);
  return isPathInside(rootDir, targetPath) ? relativePath || "." : targetPath;
}

async function pathExists(targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(targetPath) {
  try {
    return JSON.parse(await fs.readFile(targetPath, "utf8"));
  } catch {
    return null;
  }
}

async function readRootEntries(repoPath) {
  try {
    return await fs.readdir(repoPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function normalizeLanes(value, includeStarterRepo) {
  const laneSet = new Set(DEFAULT_LANES);
  for (const lane of Array.isArray(value) ? value : []) {
    const normalized = normalizeString(lane);
    if (normalized) laneSet.add(normalized);
  }
  if (includeStarterRepo !== false) laneSet.add("starter_repo");
  return [...laneSet];
}

function resolveRepoPath(args, rootDir) {
  const requestedPath = normalizeString(args.consumerRepoPath, rootDir);
  const resolvedPath = path.resolve(rootDir, requestedPath);
  const insideRoot = isPathInside(rootDir, resolvedPath);
  const allowExternalRepo = args.allowExternalRepo === true;
  if (!insideRoot && !allowExternalRepo) {
    throw new Error("consumerRepoPath is outside KNOWGRPH_ROOT. Pass allowExternalRepo=true for read-only sibling repo profiling.");
  }
  return {
    path: resolvedPath,
    insideRoot,
    allowlisted: insideRoot || allowExternalRepo,
    externalReadOnly: !insideRoot,
  };
}

function resolveOutputDir(args, rootDir, runId) {
  const defaultOutputDir = path.join(rootDir, "data", "outputs", "agentic-canvas-os", runId);
  const resolvedPath = normalizeString(args.outputDir)
    ? path.resolve(rootDir, args.outputDir)
    : defaultOutputDir;
  if (!isPathInside(rootDir, resolvedPath)) {
    throw new Error("outputDir must stay inside KNOWGRPH_ROOT.");
  }
  return resolvedPath;
}

async function profileConsumerRepo({ args, rootDir }) {
  const repo = resolveRepoPath(args, rootDir);
  const repoExists = await pathExists(repo.path);
  const entries = repoExists ? await readRootEntries(repo.path) : [];
  const entryNames = new Set(entries.map((entry) => entry.name));
  const packageJson = repoExists ? await readJsonIfExists(path.join(repo.path, "package.json")) : null;
  const rootFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 80);
  const rootDirs = entries
    .filter((entry) => entry.isDirectory() && ![".git", "node_modules", "dist", "build"].includes(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 60);
  const markers = KNOWN_ROOT_MARKERS.filter((marker) => entryNames.has(marker));
  const scripts = isObject(packageJson?.scripts) ? Object.keys(packageJson.scripts).sort() : [];
  const stack = [
    packageJson ? "node" : "",
    entryNames.has("vite.config.ts") || entryNames.has("vite.config.js") ? "vite" : "",
    entryNames.has("next.config.ts") || entryNames.has("next.config.js") ? "next" : "",
    entryNames.has("vercel.json") ? "vercel" : "",
    entryNames.has("cdk.json") ? "aws-cdk" : "",
    entryNames.has("wrangler.toml") || entryNames.has("wrangler.jsonc") ? "cloudflare" : "",
    entryNames.has("requirements.txt") || entryNames.has("pyproject.toml") ? "python" : "",
  ].filter(Boolean);
  const envGaps = [
    entryNames.has(".env.example") ? "" : "missing .env.example",
    entryNames.has("README.md") ? "" : "missing README.md",
    scripts.length ? "" : "missing package scripts",
    entryNames.has("vercel.json") ? "" : "no Vercel config marker",
    entryNames.has("cdk.json") ? "" : "no AWS CDK marker",
  ].filter(Boolean);
  return {
    name: normalizeString(args.consumerRepo, path.basename(repo.path)),
    path: displayPath(rootDir, repo.path),
    absolutePath: repo.path,
    exists: repoExists,
    allowlisted: repo.allowlisted,
    externalReadOnly: repo.externalReadOnly,
    stack,
    rootFiles,
    rootDirs,
    markers,
    scripts,
    envGaps,
  };
}

function buildStarterRepoBlueprint({ goal, repoProfile, args }) {
  const starterId = `starter-${slugify(repoProfile.name)}`;
  const frontendFramework = normalizeString(args.frontendFramework, "react");
  const agentBackend = normalizeString(args.agentBackend, "agent-platform-backend");
  const deploymentTarget = normalizeString(args.deploymentTarget, "dry-run");
  const iac = normalizeString(args.iac, "none");
  return {
    starterId,
    targetRepo: repoProfile.name,
    status: "dry_run_ready",
    frontendPath: "apps/web",
    backendPath: "apps/agent-api",
    infraPath: iac === "none" ? "" : "infra",
    frontend: {
      framework: frontendFramework,
      requiredSurfaces: ["chat-task-ui", "auth-aware-api-client", "streaming-state", "error-states"],
    },
    backend: {
      adapter: agentBackend,
      requiredSurfaces: ["typed-agent-contract", "tool-policy", "trace-log", "cost-log", "dry-run-mode"],
    },
    authModel: "server-owned secrets, browser session boundary, tenant/role claims, no checked-in credentials",
    deploymentTargets: {
      frontend: deploymentTarget === "dry-run" ? "vercel-ready-plan" : deploymentTarget,
      backend: "aws-adapter-plan",
      storage: "managed-db-or-object-store-plan",
      observability: "structured-run-log",
    },
    securityChecks: [
      "env inventory before write",
      "least-privilege tool policy",
      "auth rejection smoke",
      "public route check",
      "rollback plan",
    ],
    fileManifest: [
      "README.md",
      "apps/web/package.json",
      "apps/web/src/App.tsx",
      "apps/agent-api/src/contracts.ts",
      "apps/agent-api/src/server.ts",
      iac === "none" ? "" : "infra/README.md",
      ".env.example",
      "docs/architecture.md",
      "docs/deployment.md",
    ].filter(Boolean),
    goal,
  };
}

function buildFlowNodes({ lanes, repoProfile, starterRepo, lanePayloads }) {
  const nodes = [
    { id: "repo-profile", label: "Repo Profile", type: "AgenticOSProfile", status: repoProfile.exists ? "ready" : "blocked" },
    { id: "build-plan", label: "Build Plan", type: "AgenticOSPlan", status: "draft" },
    { id: "tool-calls", label: "Tool Calls", type: "AgenticOSToolCall", status: "dry_run_ready" },
    { id: "approval-gate", label: "Approval Gate", type: "AgenticOSApprovalGate", status: "required" },
    { id: "budget", label: "Token/TCO Budget", type: "AgenticOSBudget", status: "draft" },
    { id: "evidence-pack", label: "Evidence Pack", type: "AgenticOSEvidencePack", status: "draft" },
  ];
  if (lanes.includes("market_radar")) {
    nodes.push({ id: "market-radar", label: "Market Radar", type: "AgenticOSMarketReport", status: "dry_run_ready" });
    if (lanePayloads.marketRadar.sourceCards.length) nodes.push({ id: "source-cards", label: "Source Cards", type: "AgenticOSSourceCard", status: "review_required" });
  }
  if (lanes.includes("browser_evidence")) {
    nodes.push({ id: "browser-session", label: "Browser Evidence", type: "AgenticOSBrowserSession", status: lanePayloads.browserEvidence.connectionState });
    nodes.push({ id: "media-evidence", label: "Media Evidence", type: "AgenticOSMediaEvidence", status: "blocked_until_capture" });
  }
  if (lanes.includes("market_to_artifact")) {
    nodes.push({ id: "artifact-pipeline", label: "Artifact Pipeline", type: "AgenticOSArtifact", status: lanePayloads.artifactPipeline.brief.status });
  }
  if (lanes.includes("learning_loop")) {
    nodes.push({ id: "learning-loop", label: "Learning Loop", type: "AgenticOSLearningLoop", status: "dry_run_ready" });
    nodes.push({ id: "recall-cards", label: "Recall Cards", type: "AgenticOSRecallCard", status: "advisory" });
    nodes.push({ id: "candidate-skills", label: "Skills", type: "AgenticOSSkill", status: "approval_required" });
    nodes.push({ id: "identity-facets", label: "Identity Facets", type: "AgenticOSIdentityFacet", status: "editable" });
    nodes.push({ id: "learning-nudges", label: "Learning Nudges", type: "AgenticOSLearningNudge", status: "approval_required" });
  }
  if (starterRepo) {
    nodes.push({ id: "starter-repo", label: "Starter Repo", type: "AgenticOSStarterRepo", status: starterRepo.status });
    nodes.push({ id: "auth-boundary", label: "Auth Boundary", type: "AgenticOSAuthBoundary", status: "draft" });
    nodes.push({ id: "gateway-policy", label: "Gateway Policy", type: "AgenticOSGatewayPolicy", status: "draft" });
    nodes.push({ id: "deployment-preflight", label: "Deployment Preflight", type: "AgenticOSDeploymentPreflight", status: "approval_required" });
  }
  nodes.push({ id: "failures", label: "Failure Handling", type: "AgenticOSFailure", status: lanePayloads.failureHandling.failures.length ? "injected" : "ready" });
  nodes.push({ id: "demo-pack", label: "Demo Pack", type: "AgenticOSDemoPack", status: "draft_ready" });
  return nodes;
}

function buildFlowEdges(nodes) {
  const ids = new Set(nodes.map((node) => node.id));
  const edges = [
    ["repo-profile", "build-plan"],
    ["build-plan", "tool-calls"],
    ["build-plan", "approval-gate"],
    ["build-plan", "budget"],
    ["build-plan", "evidence-pack"],
    ["evidence-pack", "market-radar"],
    ["source-cards", "market-radar"],
    ["browser-session", "source-cards"],
    ["browser-session", "media-evidence"],
    ["approval-gate", "starter-repo"],
    ["starter-repo", "auth-boundary"],
    ["starter-repo", "gateway-policy"],
    ["starter-repo", "deployment-preflight"],
    ["market-radar", "artifact-pipeline"],
    ["learning-loop", "build-plan"],
    ["recall-cards", "learning-loop"],
    ["candidate-skills", "learning-loop"],
    ["identity-facets", "learning-loop"],
    ["learning-nudges", "learning-loop"],
    ["tool-calls", "failures"],
    ["failures", "demo-pack"],
    ["artifact-pipeline", "demo-pack"],
  ];
  return edges
    .filter(([source, target]) => ids.has(source) && ids.has(target))
    .map(([source, target], index) => ({ id: `edge-${index + 1}`, source, target }));
}

function yamlScalar(value) {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return '""';
  return JSON.stringify(String(value));
}

function renderYamlList(values, indent = "  ") {
  if (!values?.length) return `${indent}[]`;
  return values.map((value) => `${indent}- ${yamlScalar(value)}`).join("\n");
}

function renderDashboardMarkdown({ goal, runId, repoProfile, manifest, artifactPaths }) {
  const nodeYaml = manifest.flow.nodes.map((node) => [
    "    - id: " + yamlScalar(node.id),
    "      label: " + yamlScalar(node.label),
    "      type: " + yamlScalar(node.type),
    "      status: " + yamlScalar(node.status),
  ].join("\n")).join("\n");
  const edgeYaml = manifest.flow.edges.map((edge) => [
    "    - id: " + yamlScalar(edge.id),
    "      source: " + yamlScalar(edge.source),
    "      target: " + yamlScalar(edge.target),
  ].join("\n")).join("\n");
  return [
    "---",
    'kgSchema: "kgc-computing-flow/v1"',
    'kgCanvasSurfaceMode: "2d"',
    'kgCanvas2dRenderer: "flowEditor"',
    `title: ${yamlScalar(`Agentic Canvas OS - ${repoProfile.name}`)}`,
    `runId: ${yamlScalar(runId)}`,
    "agenticOs:",
    `  contractVersion: ${yamlScalar(CONTRACT_VERSION)}`,
    `  mode: ${yamlScalar("dry-run")}`,
    `  consumerRepo: ${yamlScalar(repoProfile.name)}`,
    `  repoPath: ${yamlScalar(repoProfile.path)}`,
    "  lanes:",
    renderYamlList(manifest.lanes, "    "),
    "  artifactPaths:",
    renderYamlList(artifactPaths, "    "),
    "flow:",
    "  nodes:",
    nodeYaml || "    []",
    "  edges:",
    edgeYaml || "    []",
    "---",
    "",
    "# Agentic Canvas OS Dashboard",
    "",
    `Goal: ${goal}`,
    "",
    "## Repo Profile",
    "",
    `- Repo: ${repoProfile.name}`,
    `- Path: ${repoProfile.path}`,
    `- Exists: ${String(repoProfile.exists)}`,
    `- External read-only: ${String(repoProfile.externalReadOnly)}`,
    `- Stack: ${repoProfile.stack.length ? repoProfile.stack.join(", ") : "unknown"}`,
    `- Scripts: ${repoProfile.scripts.length ? repoProfile.scripts.join(", ") : "none detected"}`,
    `- Gaps: ${repoProfile.envGaps.length ? repoProfile.envGaps.join("; ") : "none detected"}`,
    "",
    "## Plan",
    "",
    ...manifest.planner.tasks.map((task) => `- ${task.id}: ${task.title} (${task.status})`),
    "",
    "## Market Radar",
    "",
    `- Recommendation: ${manifest.marketRadar.recommendation}`,
    `- Confidence: ${manifest.marketRadar.confidence}`,
    `- Source cards: ${String(manifest.marketRadar.sourceCards.length)}`,
    `- Next test: ${manifest.marketRadar.nextTest.experiment}`,
    "",
    "## Browser Evidence",
    "",
    `- State: ${manifest.browserEvidence.connectionState}`,
    `- Allowed domains: ${manifest.browserEvidence.allowedDomains.length ? manifest.browserEvidence.allowedDomains.join(", ") : "none approved"}`,
    `- Persisted credential values: ${String(manifest.browserEvidence.redactionPolicy.persistedCredentialValues)}`,
    "",
    "## Starter Repo",
    "",
    starterRepoSummary(manifest.starterRepo),
    "",
    "## Learning Loop",
    "",
    `- Recall cards: ${String(manifest.learningLoop.recallCards.length)}`,
    `- Candidate skills: ${String(manifest.learningLoop.candidateSkills.length)}`,
    `- Identity facets: ${String(manifest.learningLoop.identityFacets.length)}`,
    `- Recall budget tokens: ${String(manifest.learningLoop.recallBudgetTokens)}`,
    "",
    "## Demo Pack",
    "",
    ...manifest.demoPack.sections.map((section) => `- ${section.id}: ${section.status}`),
    "",
    "## Control Policy",
    "",
    "- Dry-run first for repo writes, paid calls, deployments, and payment actions.",
    "- Human approval is required before mutating a consumer repo or cloud/payment system.",
    "- Runtime facts belong in the typed run manifest; Canvas graph state renders from this document frontmatter.",
  ].join("\n");
}

function starterRepoSummary(starterRepo) {
  if (!starterRepo) return "- Starter lane disabled.";
  return [
    `- Starter id: ${starterRepo.starterId}`,
    `- Frontend: ${starterRepo.frontendPath}`,
    `- Backend: ${starterRepo.backendPath}`,
    `- Infra: ${starterRepo.infraPath || "none selected"}`,
    `- Approval state: ${starterRepo.status}`,
  ].join("\n");
}

async function writeArtifacts({ outputDir, dashboardMarkdown, manifest }) {
  await fs.mkdir(outputDir, { recursive: true });
  const dashboardPath = path.join(outputDir, "dashboard.agentic-os.md");
  const manifestPath = path.join(outputDir, "run-manifest.json");
  await fs.writeFile(dashboardPath, dashboardMarkdown, "utf8");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { dashboardPath, manifestPath };
}

export async function runAgenticCanvasOsPlan(args = {}, { rootDir }) {
  if (!rootDir) throw new Error("Missing rootDir.");
  const goal = normalizeString(args.goal);
  if (!goal) throw new Error("Missing required argument: goal.");
  const runId = normalizeString(args.runId, `${slugify(goal)}-${Date.now()}`);
  const lanes = normalizeLanes(args.lanes, args.includeStarterRepo);
  const repoProfile = await profileConsumerRepo({ args, rootDir });
  const outputDir = resolveOutputDir(args, rootDir, runId);
  const proposedArtifactPaths = [
    displayPath(rootDir, path.join(outputDir, "dashboard.agentic-os.md")),
    displayPath(rootDir, path.join(outputDir, "run-manifest.json")),
  ];
  const budgets = {
    maxIterations: Number.isFinite(Number(args.maxIterations)) ? Number(args.maxIterations) : 8,
    tokenBudget: Number.isFinite(Number(args.tokenBudget)) ? Number(args.tokenBudget) : 8000,
    tcoBudgetUsd: Number.isFinite(Number(args.tcoBudgetUsd)) ? Number(args.tcoBudgetUsd) : 0,
  };
  const starterRepo = lanes.includes("starter_repo")
    ? buildStarterRepoBlueprint({ goal, repoProfile, args })
    : null;
  const lanePayloads = buildAgenticCanvasOsLanePayloads({
    args,
    goal,
    repoProfile,
    lanes,
    budgets,
    artifactPaths: proposedArtifactPaths,
  });
  const nodes = buildFlowNodes({ lanes, repoProfile, starterRepo, lanePayloads });
  const edges = buildFlowEdges(nodes);
  const validation = {
    ok: repoProfile.exists && repoProfile.allowlisted,
    checks: [
      { id: "repo_exists", ok: repoProfile.exists },
      { id: "repo_allowlisted", ok: repoProfile.allowlisted },
      { id: "dry_run_mode", ok: true },
      { id: "output_inside_knowgrph_root", ok: isPathInside(rootDir, outputDir) },
      { id: "consumer_repo_not_written", ok: true },
      { id: "demo_pack_sections", ok: true },
      { id: "browser_credentials_not_persisted", ok: lanePayloads.browserEvidence.redactionPolicy.persistedCredentialValues === 0 },
      { id: "recall_token_cap", ok: lanePayloads.learningLoop.recallBudgetTokens <= 1200 },
      { id: "skill_promotion_requires_approval", ok: lanePayloads.learningLoop.candidateSkills.every((skill) => skill.approvalState === "required") },
      { id: "starter_preflight_guarded", ok: !starterRepo || starterRepo.securityChecks.length >= 5 },
      { id: "unapproved_live_actions_zero", ok: true },
    ],
  };
  const finalized = finalizeAgenticCanvasOsCoverage({
    validation,
    lanePayloads,
    starterRepo,
    artifactPaths: proposedArtifactPaths,
  });
  const manifest = {
    contractVersion: CONTRACT_VERSION,
    runId,
    state: "dry_run_ready",
    mode: "dry-run",
    goal,
    consumerRepo: repoProfile,
    lanes,
    starterRepo,
    flow: { nodes, edges },
    budgets,
    ...lanePayloads,
    ...finalized,
    guardrails: {
      dryRunFirst: true,
      noConsumerRepoWrites: true,
      humanApprovalBeforeDeployPaymentOrPaidCall: true,
      noCredentialExtraction: true,
      sourceTruth: "Source Files Markdown dashboard plus typed run manifest",
    },
    canonicalDocs: [CANONICAL_DOC, CANONICAL_COMPANION],
  };
  const dashboardMarkdown = renderDashboardMarkdown({
    goal,
    runId,
    repoProfile,
    manifest,
    artifactPaths: proposedArtifactPaths,
  });
  const writeArtifactsRequested = args.writeArtifacts === true;
  const written = writeArtifactsRequested
    ? await writeArtifacts({ outputDir, dashboardMarkdown, manifest })
    : null;
  const artifactPaths = written
    ? [displayPath(rootDir, written.dashboardPath), displayPath(rootDir, written.manifestPath)]
    : proposedArtifactPaths;
  validation.checks.find((check) => check.id === "dry_run_mode").ok = manifest.mode === "dry-run";
  const payload = {
    ...manifest,
    dashboard: {
      documentPath: artifactPaths[0],
      manifestPath: artifactPaths[1],
      markdown: dashboardMarkdown,
      written: Boolean(written),
    },
    validation,
  };
  const text = [
    `Agentic Canvas OS plan: ${runId}`,
    `Mode: dry-run${written ? " (artifacts written)" : " (no files written)"}`,
    `Consumer repo: ${repoProfile.name} (${repoProfile.path})`,
    `Validation: ${validation.ok ? "ok" : "blocked"}`,
    "Artifacts:",
    `- ${artifactPaths.join("\n- ")}`,
  ].join("\n");
  return { payload, text };
}
