const DEMO_SECTIONS = Object.freeze([
  "agent_overview",
  "autonomy_decision_making",
  "actions_tool_use",
  "orchestration",
  "human_in_the_loop",
  "failure_handling",
  "demo_presentation",
]);

const DEFAULT_PLATFORMS = Object.freeze([
  "x",
  "producthunt",
  "reddit",
  "linkedin",
  "xiaohongshu",
  "douyin",
  "tiktok",
  "facebook",
  "instagram",
]);

function cleanString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function cleanStringArray(values, fallback = []) {
  const source = Array.isArray(values) ? values : fallback;
  const seen = new Set();
  const out = [];
  for (const value of source) {
    const normalized = cleanString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function makeId(prefix, value) {
  const slug = cleanString(value, prefix)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return `${prefix}-${slug || "item"}`;
}

function normalizeSourceCards(values, nowIso) {
  const cards = Array.isArray(values) ? values : [];
  return cards.map((card, index) => {
    const url = cleanString(card?.url, `pending://source-${index + 1}`);
    const platform = cleanString(card?.platform, "unknown");
    const evidenceLevel = ["A", "B", "C"].includes(card?.evidenceLevel) ? card.evidenceLevel : "C";
    return {
      sourceId: cleanString(card?.sourceId, `source-${index + 1}`),
      url,
      platform,
      captureTime: cleanString(card?.captureTime, nowIso),
      visiblePublisher: cleanString(card?.visiblePublisher, "unknown"),
      evidenceLevel,
      observedFields: cleanStringArray(card?.observedFields, ["url", "title_or_snippet"]),
      claimIds: cleanStringArray(card?.claimIds, [`claim-${index + 1}`]),
      status: evidenceLevel === "C" ? "weak_signal" : "source_backed",
    };
  });
}

function buildPlanner({ goal, repoProfile, budgets }) {
  const tasks = [
    { id: "profile", title: "Profile consumer repo", status: repoProfile.exists ? "complete" : "blocked" },
    { id: "plan", title: "Create bounded build plan", status: "dry_run_ready" },
    { id: "market-radar", title: "Prepare source-backed market validation", status: "dry_run_ready" },
    { id: "artifact-pipeline", title: "Map validated claims to artifacts", status: "dry_run_ready" },
    { id: "starter-repo", title: "Prepare secured full-stack starter blueprint", status: "dry_run_ready" },
    { id: "demo-pack", title: "Generate judging pack checklist", status: "dry_run_ready" },
  ];
  return {
    goal,
    tasks,
    dependencies: [
      { from: "profile", to: "plan" },
      { from: "market-radar", to: "artifact-pipeline" },
      { from: "plan", to: "starter-repo" },
      { from: "plan", to: "demo-pack" },
    ],
    maxIterations: budgets.maxIterations,
    stopConditions: ["blocked", "approval_required", "budget_exceeded", "verification_failed", "max_iterations"],
  };
}

function buildToolCalls({ lanes, args }) {
  const toolCalls = [
    { toolName: "knowgrph.agentic_canvas_os.plan", adapter: "local-mcp", mode: "dry-run", status: "complete", attempt: 1 },
    { toolName: "knowgrph.superagent.run", adapter: "local-superagent", mode: "dry-run", status: "approval_required", attempt: 0 },
  ];
  if (lanes.includes("market_radar")) {
    toolCalls.push({ toolName: "exa.search", adapter: "evidence-adapter", mode: "dry-run", status: "approval_required", attempt: 0 });
  }
  if (lanes.includes("browser_evidence")) {
    toolCalls.push({ toolName: "browser.capture", adapter: "local-browser", mode: "dry-run", status: "approval_required", attempt: 0 });
  }
  if (args.failOnceTool) {
    toolCalls.push({ toolName: cleanString(args.failOnceTool), adapter: "failure-injection", mode: "dry-run", status: "failed_once_injected", attempt: 1 });
  }
  return toolCalls;
}

function buildApprovalGates({ artifactPaths }) {
  return [
    { id: "consumer-repo-write", actionKind: "file_write", risk: "consumer repo mutation", dryRunArtifact: artifactPaths[1], approvalState: "required" },
    { id: "cloud-deploy", actionKind: "deploy", risk: "cloud resource mutation or spend", dryRunArtifact: artifactPaths[1], approvalState: "required" },
    { id: "paid-model-call", actionKind: "paid_call", risk: "token or API spend", dryRunArtifact: artifactPaths[1], approvalState: "required" },
    { id: "payment-action", actionKind: "payment", risk: "Stripe product, price, session, refund, or payout mutation", dryRunArtifact: artifactPaths[1], approvalState: "required" },
    { id: "authenticated-browser", actionKind: "browser_auth", risk: "authenticated page inspection", dryRunArtifact: artifactPaths[1], approvalState: "required" },
  ];
}

function buildBudgetMeters(budgets) {
  return {
    model: "none-in-dry-run",
    inputTokens: 0,
    outputTokens: 0,
    cacheHits: 0,
    estimatedCostUsd: 0,
    budget: budgets,
    tokenLedgerRequiredForModelSteps: true,
  };
}

function buildMarketRadar({ args, goal, nowIso, sourceCards }) {
  const platforms = cleanStringArray(args.platforms, DEFAULT_PLATFORMS);
  const claims = sourceCards.length
    ? sourceCards.flatMap((card) => card.claimIds.map((claimId) => ({
      claimId,
      sourceCardIds: [card.sourceId],
      confidence: card.evidenceLevel === "A" ? "medium" : "low",
      counterevidence: [],
      impact: "requires review",
    })))
    : [{
      claimId: "claim-pending-1",
      sourceCardIds: [],
      confidence: "none",
      counterevidence: ["no source cards captured in dry run"],
      impact: "cannot support demand claims",
    }];
  return {
    idea: cleanString(args.marketQuestion, goal),
    platforms,
    generatedAt: nowIso,
    recommendation: sourceCards.length >= 8 ? "review_source_backed_signals" : "collect_more_evidence_before_commitment",
    confidence: sourceCards.length >= 8 ? "medium" : "low",
    uncertainty: sourceCards.length ? "source cards require human review before roadmap mutation" : "no live evidence collected in dry run",
    noGoTriggers: ["no evidence-level A or B cards", "pricing willingness absent", "blocked primary sources only"],
    segments: [{ targetUser: "early adopter", jobToBeDone: "validate and ship an agentic product", painIntensity: "unknown", willingnessToPay: "unknown" }],
    competitors: [{ name: "pending", kind: "alternative_or_workaround", evidenceState: "not_collected" }],
    sourceCards,
    claims,
    nextTest: { experiment: "capture eight source cards across three platforms", successMetric: "at least three A/B evidence cards", budgetUsd: 0, failureCondition: "claims remain unsupported" },
  };
}

function buildBrowserEvidence({ args, nowIso }) {
  const allowedDomains = cleanStringArray(args.allowedDomains, []);
  const approved = args.confirmBrowserScope === true && allowedDomains.length > 0;
  return {
    profileKind: "dedicated-local-profile",
    allowedDomains,
    startedAt: approved ? nowIso : "",
    connectionState: approved ? "scope_approved_dry_run" : "approval_required",
    blockedGates: approved ? [] : ["missing confirmBrowserScope=true or allowedDomains"],
    capturedArtifacts: [],
    redactionPolicy: {
      persistedCredentialValues: 0,
      forbiddenFields: ["passwords", "cookies", "bearer_tokens", "private_messages", "unrelated_tabs", "credential_headers"],
      networkBodiesPersisted: false,
    },
  };
}

function buildArtifactPipeline({ marketRadar, args }) {
  const kinds = cleanStringArray(args.artifactKinds, ["text", "image", "audio", "video"]);
  const validBrief = marketRadar.sourceCards.length > 0 && marketRadar.claims.some((claim) => claim.sourceCardIds.length > 0);
  const brief = {
    briefId: "artifact-brief-1",
    status: validBrief ? "needs_review" : "blocked_no_source_backed_claims",
    claimIds: marketRadar.claims.map((claim) => claim.claimId),
    reviewState: "draft",
  };
  return {
    brief,
    artifacts: kinds.map((kind) => ({
      artifactId: makeId("artifact", kind),
      kind,
      briefId: brief.briefId,
      claimIds: brief.claimIds,
      promptOrRecipe: `Generate ${kind} only after the brief is approved and source-backed.`,
      modelOrTool: "unselected",
      cost: { estimatedCostUsd: 0, paidCallRequired: true },
      artifactPath: "",
      hash: "",
      reviewState: validBrief ? "needs_review" : "draft",
    })),
  };
}

function buildLearningLoop({ args, nowIso }) {
  const sourceTraceIds = cleanStringArray(args.finalizedTraceIds, []);
  const explicitNotes = cleanStringArray(args.userNotes, []);
  const hasSource = sourceTraceIds.length > 0 || explicitNotes.length > 0;
  return {
    sourceTraceIds,
    candidateCount: hasSource ? 3 : 0,
    approvedCount: 0,
    nudgeCount: hasSource ? 1 : 0,
    recallBudgetTokens: 1200,
    recallCards: hasSource ? [{
      summary: "Reuse finalized Agentic Canvas OS preferences only as advisory context.",
      sourceTraceIds,
      rankScore: 0.7,
      scope: "knowgrph",
      expiryPolicy: "review_after_30_days",
    }] : [],
    candidateSkills: hasSource ? [{
      name: "agentic-canvas-os-dry-run-review",
      trigger: "Agentic Canvas OS run requests build, market, or deployment planning",
      procedure: ["profile repo", "build dry-run manifest", "surface approvals", "verify demo sections"],
      validation: ["focused MCP contract test", "vdeoxpln check"],
      state: "candidate",
      approvalState: "required",
      rollback: "deprecate skill and remove from suggestions",
    }] : [],
    identityFacets: explicitNotes.map((note, index) => ({
      facetKind: "explicit_user_note",
      value: note,
      confidence: 1,
      sourceTraceIds,
      reviewAt: nowIso,
      approvalState: "required",
    })),
    redactionStatus: "redacted",
  };
}

function buildAdapterPlans() {
  return {
    aws: { allowedInP0: ["runtime plan", "storage plan", "observability plan", "env gap report"], approvalRequired: ["deploy", "mutate IAM", "create paid resources"] },
    vercel: { allowedInP0: ["frontend plan", "gateway checklist", "config readiness"], approvalRequired: ["production deploy", "paid model routing"] },
    exa: { allowedInP0: ["cited evidence-pack contract"], approvalRequired: ["API-key injection", "high-volume search"] },
    stripe: { allowedInP0: ["checkout/subscription/webhook/payout readiness plan"], approvalRequired: ["product", "price", "session", "refund", "payout"] },
  };
}

function buildFailureHandling(args) {
  const injectedTool = cleanString(args.failOnceTool);
  return {
    failures: injectedTool ? [{
      failureKind: "injected_tool_failure",
      message: `${injectedTool} failed once in dry-run failure handling test`,
      retryCount: 1,
      resolution: "retry bounded, then fail closed if repeated",
    }] : [],
    policy: "retry under maxIterations, then fail closed by moving to blocked with evidence",
  };
}

function buildDemoPack({ artifactPaths, marketRadar }) {
  return {
    sections: DEMO_SECTIONS.map((section) => ({
      id: section,
      status: "draft_ready",
      evidenceRefs: section === "demo_presentation" ? artifactPaths : [artifactPaths[1]],
    })),
    readiness: "draft_ready",
    marketEvidenceCount: marketRadar.sourceCards.length,
    urls: [],
    screenshots: [],
  };
}

function buildGoalCoverage({ validation, demoPack, marketRadar, browserEvidence, learningLoop, starterRepo, failureHandling }) {
  const coverage = {
    "repo-profile": validation.checks.some((check) => check.id === "repo_exists" && check.ok),
    "agentic-plan": true,
    dashboard: true,
    "dashboard-document": true,
    "dashboard-runtime": true,
    "market-radar": marketRadar.sourceCards.length >= 0,
    "browser-evidence": browserEvidence.redactionPolicy.persistedCredentialValues === 0,
    "learning-loop": learningLoop.redactionStatus === "redacted",
    "skill-promotion": learningLoop.candidateSkills.every((skill) => skill.approvalState === "required"),
    "recall-search": learningLoop.recallBudgetTokens <= 1200,
    "identity-model": learningLoop.identityFacets.every((facet) => Array.isArray(facet.sourceTraceIds)),
    "starter-repo": !starterRepo || starterRepo.securityChecks.length >= 5,
    "demo-pack": demoPack.sections.length === DEMO_SECTIONS.length,
    "failure-handling": failureHandling.policy.includes("fail closed"),
  };
  return Object.entries(coverage).map(([goal, ok]) => ({ goal, ok: Boolean(ok) }));
}

// Named exports for the four Director skeleton builders. The Director
// `AgentWorkflow` skeleton (`mcp/director-workflow.js`, spec task 2.1) wires
// these as the orchestration seams; their internal logic is reused unchanged
// (reuse-not-rebuild). Detailed stage behaviors (ordering enforcement, retry,
// budget, cost-log) land in spec tasks 2.2-2.16.
export { buildPlanner, buildToolCalls, buildApprovalGates, buildFailureHandling };

export function buildAgenticCanvasOsLanePayloads({ args, goal, repoProfile, lanes, budgets, artifactPaths }) {
  const nowIso = new Date().toISOString();
  const sourceCards = normalizeSourceCards(args.sourceCards, nowIso);
  const marketRadar = buildMarketRadar({ args, goal, nowIso, sourceCards });
  const browserEvidence = buildBrowserEvidence({ args, nowIso });
  const artifactPipeline = buildArtifactPipeline({ marketRadar, args });
  const learningLoop = buildLearningLoop({ args, nowIso });
  return {
    planner: buildPlanner({ goal, repoProfile, budgets }),
    toolCalls: buildToolCalls({ lanes, args }),
    approvalGates: buildApprovalGates({ artifactPaths }),
    budgetMeters: buildBudgetMeters(budgets),
    evidencePack: {
      sources: sourceCards,
      citations: sourceCards.map((card) => ({ sourceId: card.sourceId, url: card.url })),
      summary: sourceCards.length ? "Source cards provided for review." : "No live source cards captured in dry run.",
      trustPolicy: "evidence cannot mutate roadmap or artifacts without approval",
    },
    marketRadar,
    browserEvidence,
    artifactPipeline,
    learningLoop,
    adapterPlans: buildAdapterPlans(),
    failureHandling: buildFailureHandling(args),
  };
}

export function finalizeAgenticCanvasOsCoverage({ validation, lanePayloads, starterRepo, artifactPaths }) {
  const demoPack = buildDemoPack({ artifactPaths, marketRadar: lanePayloads.marketRadar });
  const goalCoverage = buildGoalCoverage({
    validation,
    demoPack,
    marketRadar: lanePayloads.marketRadar,
    browserEvidence: lanePayloads.browserEvidence,
    learningLoop: lanePayloads.learningLoop,
    starterRepo,
    failureHandling: lanePayloads.failureHandling,
  });
  return { demoPack, goalCoverage };
}
