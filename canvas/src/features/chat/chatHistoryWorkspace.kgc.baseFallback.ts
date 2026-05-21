import {
  analyzeKgcRequest,
  sanitizeRequestIntent,
  sanitizeScalar,
} from './chatKgcRequestProfile'
import { toKgcOutputWorkspacePath } from './chatHistoryWorkspace.paths'

type BaseFallbackArgs = {
  timestampMs: number
  fileName: string
  requestText: string
  assistantText?: string
}

const slugify = (raw: string): string => {
  return String(raw || '')
    .replace(/\.[^.]+$/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'kgc'
}

const summariseAssistantSignal = (assistantText: string): string => {
  const text = String(assistantText || '')
    .replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text || text.startsWith('---')) return ''
  return sanitizeScalar(text, 220)
}

const fallbackActor = (subject: string): string => subject || '{{subject}}'
const fallbackProduct = (product: string): string => product || '{{product}}'
const fallbackArtifact = (artifact: string): string => artifact || 'Chat Response'
const fallbackDomain = (domain: string, topics: string[]): string => domain || topics.join(' + ') || '{{domain}}'
const fallbackObjective = (objective: string): string => objective || '{{objective}}'
const fallbackOwner = (owner: string): string => owner || '{{owner}}'
const fallbackStatus = (status: string): string => status || '{{status}}'

const deriveOutputTargetFileName = (fileName: string): string => {
  const derived = toKgcOutputWorkspacePath(`/${String(fileName || '').trim() || 'kgc.md'}`)
  const parts = String(derived || '').split('/').filter(Boolean)
  return String(parts[parts.length - 1] || '').trim() || 'kgc-output.md'
}

const buildNamedTermSummary = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  return profile.namedTerms.join(', ')
}

const buildRequestSummary = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  const product = fallbackProduct(profile.product)
  const subject = fallbackActor(profile.subject)
  const artifact = fallbackArtifact(profile.artifact)
  if (profile.signals.creativeScript) {
    const parts = [
      `${artifact} request`,
      profile.outputFile ? `for ${profile.outputFile}` : '',
      subject !== '{{subject}}' ? `owned by ${subject}` : '',
      profile.signals.trademarkAvoidance ? 'with trademark-safe originality constraints' : '',
    ].filter(Boolean)
    return sanitizeScalar(parts.join(' '), 240)
  }
  const parts = [
    `${artifact} request for ${subject}`,
    product !== '{{product}}' ? `around ${product}` : '',
    profile.signals.mcp ? 'using MCP distribution' : '',
    profile.signals.externalUsers ? 'for external users' : '',
    profile.signals.openClaw ? 'with OpenClaw marketplace delivery' : (profile.signals.marketplace ? 'with marketplace delivery' : ''),
    profile.signals.b2c ? 'including B2C monetization' : '',
    profile.signals.swipe ? 'and Swipe payment flow' : '',
  ].filter(Boolean)
  return sanitizeScalar(parts.join(' '), 240)
}

const buildFlowContextSummary = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  const namedTerms = buildNamedTermSummary(profile)
  const parts = [
    fallbackDomain(profile.domain, profile.topics),
    namedTerms ? `with explicit references to ${namedTerms}` : '',
  ].filter(Boolean)
  return sanitizeScalar(parts.join(' '), 220)
}

const buildObjectiveSummary = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  if (profile.signals.creativeScript) {
    return sanitizeScalar([
      'original script development',
      profile.signals.trademarkAvoidance ? 'trademark-safe inspiration handling' : '',
      profile.outputFile ? `target file ${profile.outputFile}` : '',
    ].filter(Boolean).join('; '), 180)
  }
  const parts = [
    profile.signals.zeroBudget ? 'zero-budget execution' : '',
    profile.signals.bootstrap ? 'bootstrap delivery' : '',
    profile.signals.organicGrowth ? 'organic growth' : '',
    profile.signals.mcp ? 'MCP packaging' : '',
    profile.signals.openClaw ? 'OpenClaw distribution' : (profile.signals.marketplace ? 'marketplace distribution' : ''),
    profile.signals.b2c ? 'B2C monetization' : '',
    profile.signals.swipe ? 'Swipe-ready checkout' : (profile.signals.payments ? 'payment-ready checkout' : ''),
  ].filter(Boolean)
  return sanitizeScalar(parts.join('; '), 180)
}

const buildUseCaseText = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  const surfaces = [
    profile.signals.mcp ? 'MCP delivery' : '',
    profile.signals.externalUsers ? 'external-user access' : '',
    profile.signals.openClaw ? 'OpenClaw and related marketplace surfaces' : (profile.signals.marketplace ? 'marketplace surfaces' : 'the stated delivery surfaces'),
    profile.signals.swipe ? 'checkout completion' : (profile.signals.payments ? 'payment completion' : ''),
  ].filter(Boolean)
  const deliverySurface = profile.signals.openClaw
    ? 'OpenClaw and related marketplace surfaces'
    : (profile.signals.marketplace ? 'marketplace surfaces' : 'reusable delivery surfaces')
  const mcpSurface = profile.signals.mcp ? 'package `{{product}}` as an MCP offer for external users' : 'package `{{product}}` for external delivery'
  return `\`{{subject}}\` needs a reusable pipeline surface for \`{{product}}\` that can ${mcpSurface}, produce \`{{artifact}}\`, preserve the machine-readable KGC contract, and stay relevant across ${surfaces.join(', ') || deliverySurface}. The response should stay request-shaped without rewriting the base graph contract per request.`
}

const buildProblemText = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  if (profile.signals.creativeScript) {
    return `\`{{subject}}\` needs \`{{artifact}}\` that feels distinctive and production-ready without copying named source properties. The response should preserve originality, turn high-level inspiration into a clear brief, and keep brand or franchise references out of the final wording.`
  }
  const pressures = [
    profile.signals.zeroBudget ? 'zero-budget constraints' : '',
    profile.signals.bootstrap ? 'bootstrap execution pressure' : '',
    profile.signals.organicGrowth ? 'organic-growth expectations' : '',
  ].filter(Boolean)
  const requiredCoverage = [
    profile.signals.mcp ? 'delivery packaging' : '',
    profile.signals.externalUsers ? 'external-user access' : '',
    profile.signals.marketplace || profile.signals.openClaw ? 'distribution and discovery' : '',
    profile.signals.b2c || profile.signals.subscriptions || profile.signals.payPerUse || profile.signals.conversion ? 'monetized user actions' : '',
    profile.signals.swipe || profile.signals.payments ? 'payment or checkout transitions' : '',
    profile.signals.rxdb || profile.signals.maplibre ? 'stated implementation boundaries' : '',
  ].filter(Boolean)
  return `\`{{subject}}\` needs \`{{artifact}}\` for \`{{product}}\`${pressures.length ? ` under ${pressures.join(', ')}` : ''}. Generic planning prose is not enough because the response has to make ${requiredCoverage.join(', ') || 'the stated request constraints'} explicit in a form that can guide delivery, monetization, and follow-up implementation decisions.`
}

const buildSolutionText = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  if (profile.signals.creativeScript) {
    return 'Shape the response as one coherent script package with explicit tone, pacing, scene logic, and guardrails. Keep the wording original, keep the handoff reusable, and make the creative direction concrete enough that another pass can refine execution without reinterpreting the brief.'
  }
  const channels = [
    profile.signals.mcp ? '`{{product}}` as an MCP offer' : '',
    profile.signals.openClaw ? 'OpenClaw marketplace distribution' : (profile.signals.marketplace ? 'skills marketplace distribution' : ''),
    profile.signals.swipe ? 'Swipe checkout and payment completion' : '',
    profile.signals.rxdb ? 'RxDB local-first state' : '',
    profile.signals.maplibre ? 'MapLibre spatial presentation' : '',
  ].filter(Boolean)
  return `Recommend a lean response package that turns the request into an actionable offer covering ${channels.join(', ') || 'the stated delivery surfaces'}. Make the deliverable concrete enough for product, growth, monetization, and integration follow-through without drifting into boilerplate or restating the request verbatim.`
}

const buildUserFlowText = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  const conversionMoment = profile.signals.swipe
    ? 'completes the Swipe checkout flow and unlocks the paid entitlement or action'
    : (profile.signals.payments ? 'completes checkout and unlocks the paid entitlement or action' : 'crosses from free exploration into paid activation')
  return `An external user discovers the \`{{product}}\` offer through the MCP or marketplace surface, evaluates the free or low-friction entry point, reaches a monetized action such as premium usage, conversion, or subscription, ${conversionMoment}, and then receives the promised output, capability, or follow-up access.`
}

const buildMonetizationText = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  const modes = [
    profile.signals.subscriptions ? 'subscriptions' : '',
    profile.signals.payPerUse ? 'pay-per-use' : '',
    profile.signals.conversion ? 'conversion-driven actions' : '',
  ].filter(Boolean)
  const namedTerms = buildNamedTermSummary(profile)
  const actionExamples = [
    profile.signals.subscriptions ? 'ongoing workspace access or premium capability tiers' : '',
    profile.signals.payPerUse ? 'one-off artifact generation, export, or execution events' : '',
    profile.signals.conversion ? 'commerce-like actions that turn intent into checkout' : '',
  ].filter(Boolean)
  return `Monetization requirements stay explicit in the request context, comparing ${modes.join(', ') || 'the stated revenue models'} without hardcoding a pricing decision${namedTerms ? ` while keeping ${namedTerms} visible as integration context` : ''}. Recommended monetized user actions should map to ${actionExamples.join('; ') || 'clear workflow states'}, and the response should show where discovery, trial, checkout, entitlement change, and retained usage occur.`
}

const buildIntegrationText = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  const stack = [
    profile.signals.openClaw ? 'OpenClaw can cover marketplace listing and demand capture' : '',
    profile.signals.swipe ? 'Swipe can cover checkout, payment confirmation, and post-payment handoff' : '',
    profile.signals.rxdb ? 'RxDB can cover local-first state, draft persistence, and usage context' : '',
    profile.signals.maplibre ? 'MapLibre can cover spatial presentation where maps add user value' : '',
  ].filter(Boolean)
  return `Integration references should stay descriptive and bounded to ${stack.join(', ') || 'the stated request topics'}. Mention each integration only where it materially changes scope, workflow, data flow, monetization, or fulfillment.`
}

const buildWorkflowText = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  if (profile.signals.creativeScript) {
    return 'S01 captures the creative brief, S02 shapes context around tone, originality constraints, and output format, S03 generates the script package, S04 checks clarity plus trademark-safe distinctiveness, and S05 persists a reusable handoff. In practice the workflow should move from brief -> creative direction -> draft -> guardrail review -> delivery.'
  }
  const marketplaceStep = profile.signals.openClaw
    ? 'package the offer for OpenClaw and related skills marketplace discovery'
    : (profile.signals.marketplace ? 'package the offer for marketplace discovery' : 'package the offer for external discovery')
  return `S01 captures the active request brief for \`{{product}}\`. S02 shapes context around ${marketplaceStep}, user-value framing, and the requested \`{{artifact}}\`. S03 generates the response package. S04 checks that the stated assumptions, transitions, and boundaries are explicit. S05 persists a reusable handoff. In practice the workflow should move from input -> context -> draft -> review -> delivery instead of stopping at generic prose.`
}

const buildDataFlowText = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  if (profile.signals.creativeScript) {
    const fileNote = profile.outputFile ? ` plus output target ${profile.outputFile}` : ''
    return `Request text and workspace context become a bounded creative bundle containing tone, pacing, originality constraints${fileNote}. That bundle becomes \`{{artifact}}\` markdown, validation yields either corrective feedback or approved output, and approved output becomes persisted workspace state with creative intent and safety assumptions intact.`
  }
  const monetizationPayload = profile.signals.swipe
    ? 'pricing assumptions, checkout trigger, Swipe payment state, and post-payment entitlement'
    : 'pricing assumptions, conversion trigger, and post-conversion entitlement'
  const stackPayload = [
    profile.signals.rxdb ? 'RxDB-backed local context' : '',
    profile.signals.maplibre ? 'MapLibre-relevant spatial context' : '',
  ].filter(Boolean)
  return `Request text and workspace context become a bounded strategy bundle containing product positioning, MCP packaging, marketplace assumptions, ${monetizationPayload}${stackPayload.length ? `, and ${stackPayload.join(' plus ')}` : ''}. That bundle becomes \`{{artifact}}\` markdown, validation yields either corrective feedback or approved output, and approved output becomes persisted workspace state with commercialization and integration assumptions intact.`
}

const buildVariableLinkRows = (profile: ReturnType<typeof analyzeKgcRequest>): Array<[string, string, string, string]> => {
  return [
    ['`{{product}}`', fallbackProduct(profile.product), 'title, PRD, user flow', 'keeps the offer name aligned across sections'],
    ['`{{artifact}}`', fallbackArtifact(profile.artifact), 'title, PRD, TAD, open questions', 'keeps the deliverable shape consistent'],
    ['`{{subject}}`', fallbackActor(profile.subject), 'pipeline actors, PRD, ownership language', 'keeps the primary actor consistent'],
    ['`{{domain}}`', fallbackDomain(profile.domain, profile.topics), 'context framing and flow narrative', 'keeps scope bounded to the active request'],
    ['`{{objective}}`', fallbackObjective(profile.objective), 'generation and validation scope', 'keeps the response target explicit'],
    ['`{{owner}}`', fallbackOwner(profile.owner), 'document meta and open-question ownership', 'keeps follow-up accountability explicit'],
    ['`{{status}}`', fallbackStatus(profile.status), 'meta line and lifecycle state', 'keeps document maturity visible'],
    ['`{{runtime.maxRetry}}`', '3', 'runner protocol and retry arc', 'keeps feedback-loop bounds transparent'],
  ]
}

const buildSnapshotRows = (
  profile: ReturnType<typeof analyzeKgcRequest>,
  fileName: string,
): Array<[string, string, string]> => {
  const outputTarget = profile.outputFile || deriveOutputTargetFileName(fileName)
  if (profile.signals.creativeScript) {
    return [
      ['Deliverable', '`{{artifact}}`', 'keeps the requested output format explicit'],
      ['Creative mode', 'original script package', 'keeps the body focused on content creation rather than planning prose'],
      ['Tone source', 'high-level inspiration only', 'keeps atmosphere without copying named properties'],
      ['Distinctiveness guard', profile.signals.trademarkAvoidance ? 'avoid direct trademark or franchise references' : 'keep the draft original', 'keeps the output safely differentiated'],
      ['Output target', outputTarget, 'keeps the handoff destination visible'],
      ['Validation focus', 'clarity, originality, and body/frontmatter linkage', 'keeps persistence requirements aligned with the document contract'],
    ]
  }
  const discoverySurface = profile.signals.openClaw
    ? 'OpenClaw and skills marketplace discovery'
    : (profile.signals.marketplace ? 'skills marketplace discovery' : 'external discovery channels')
  const monetizedActions = [
    profile.signals.subscriptions ? 'subscriptions' : '',
    profile.signals.payPerUse ? 'pay-per-use usage' : '',
    profile.signals.conversion ? 'commerce-like conversion actions' : '',
  ].filter(Boolean).join(', ') || 'the stated revenue actions'
  const stackBoundaries = [
    profile.signals.rxdb ? 'RxDB local-first state' : '',
    profile.signals.maplibre ? 'MapLibre spatial presentation' : '',
  ].filter(Boolean).join(', ') || 'the stated implementation boundaries'
  const checkoutStep = profile.signals.swipe
    ? 'Swipe checkout and payment completion'
    : (profile.signals.payments ? 'checkout completion' : 'the monetized conversion trigger')
  return [
    ['Primary subject', '`{{product}}`', 'keeps the central subject consistent across body and frontmatter'],
    ['Audience or surface', profile.signals.externalUsers ? `external users through ${discoverySurface}` : discoverySurface, 'keeps the addressed surface tied to the request'],
    ['Deliverable', '`{{artifact}}`', 'keeps the stored output aligned with the requested artifact'],
    ['Canonical output path', outputTarget, 'keeps companion output naming aligned with the stored KGC document'],
    ['Operating constraints', buildObjectiveSummary(profile) || fallbackObjective(profile.objective), 'keeps the active objective and constraints visible'],
    ['Action surfaces', monetizedActions, 'keeps user actions tied to the stated request context'],
    ['Transition step', checkoutStep, 'keeps handoff or transition moments explicit when present'],
    ['Implementation boundaries', stackBoundaries, 'keeps implementation references bounded to relevant surfaces'],
  ]
}

const buildOpenQuestions = (args: {
  artifact: string
  topics: string[]
  namedTerms: string[]
  requestedSections: ReturnType<typeof analyzeKgcRequest>['requestedSections']
  signals: ReturnType<typeof analyzeKgcRequest>['signals']
  outputFile: string
  defaultOutputTarget: string
}): Array<{ id: string; question: string; status: string }> => {
  const artifact = args.artifact || 'the deliverable'
  if (args.signals.creativeScript) {
    const creativeQuestions = [
      `Which review criteria determine whether ${artifact} is clear, original, and complete enough to persist?`,
      args.outputFile
        ? `Should the final body optimize for the target handoff file \`${args.outputFile}\` or stay generic across script destinations?`
        : `Should the final body optimize for the companion output file \`${args.defaultOutputTarget}\` or stay generic across creative handoff surfaces?`,
      args.signals.trademarkAvoidance
        ? 'Which tone or atmosphere cues are allowed while still avoiding direct trademark, franchise, or character references?'
        : 'Which tone or atmosphere cues should remain explicit instead of being inferred?',
      'Which sections should stay compact versus cinematic if the script needs another generation pass?',
    ]
    return creativeQuestions.map((question, index) => ({
      id: `OQ-0${index + 1}`,
      question,
      status: index === 0 ? '`#D85A30:blocking`' : 'medium',
    }))
  }
  const questions = [
    `Which acceptance criteria determine whether ${artifact} is complete enough to persist without another validation pass?`,
    args.namedTerms.length
      ? `Which named integrations or surfaces must remain explicit in the final response: ${args.namedTerms.join(', ')}?`
      : args.topics.length
      ? `Which topic constraints must remain explicit in the final response: ${args.topics.join(', ')}?`
      : 'Which context constraints must remain explicit in the final response instead of being inferred?',
    args.requestedSections.integrations
      ? args.signals.swipe
        ? 'Which integrations are required at generation time versus documented later, especially OpenClaw discovery, Swipe checkout, RxDB state, and MapLibre presentation?'
        : 'Which integrations are required at generation time versus documented as later implementation work?'
      : 'Which dependencies belong in the current answer versus a later implementation phase?',
    args.requestedSections.monetization
      ? args.signals.swipe
        ? 'Which user action should trigger Swipe checkout, and what entitlement or fulfillment should follow payment completion?'
        : 'Which monetization or conversion decision points are requirements versus open evaluation items?'
      : 'Which delivery and ownership decisions still need confirmation before downstream automation runs?',
  ]
  return questions.map((question, index) => ({
    id: `OQ-0${index + 1}`,
    question,
    status: index === 0 ? '`#D85A30:blocking`' : 'medium',
  }))
}

const buildDocumentLead = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  const focus = [
    profile.signals.mcp ? 'delivery packaging' : '',
    profile.signals.externalUsers ? 'target users' : '',
    profile.signals.marketplace || profile.signals.openClaw ? 'distribution context' : '',
    profile.signals.subscriptions || profile.signals.payPerUse || profile.signals.conversion ? 'action and monetization logic' : '',
    profile.signals.swipe || profile.signals.payments ? 'checkout transitions' : '',
    profile.signals.rxdb || profile.signals.maplibre ? 'implementation boundaries' : '',
  ].filter(Boolean)
  return `> This document packages \`{{artifact}}\` for \`{{subject}}\` around the active request. Shared terms stay aligned through frontmatter, while the body stays focused on ${focus.join(', ') || 'the active request'} instead of generic template narration.`
}

const buildComputingFlowIntro = (requestSummary: string): string => {
  return `The execution contract below supports the current request: ${requestSummary}. The sections that follow keep product, actor, deliverable, and implementation details scoped to what the request actually asks for.`
}

const buildFlowGraphSummary = (profile: ReturnType<typeof analyzeKgcRequest>, artifact: string, domain: string): string => {
  return `The graph below shows how the request moves from capture to delivery for \`${artifact}\`. Context stays bounded to ${buildFlowContextSummary(profile) || domain}, validation can return targeted correction, and accepted output stays ready for reuse across follow-up work.`
}

const buildPipelineIntro = (subject: string, objectiveSummary: string): string => {
  return `The sequence below shows how the active request becomes a stored deliverable for ${subject}. Each step keeps the work bounded to ${objectiveSummary}.`
}

const buildBody = (args: {
  requestText: string
  assistantText: string
  profile: ReturnType<typeof analyzeKgcRequest>
  fileName: string
}): string => {
  const requestSummary = buildRequestSummary(args.profile) || sanitizeRequestIntent(args.requestText, 260) || 'Current request'
  const assistantSignal = summariseAssistantSignal(args.assistantText)
  const subject = fallbackActor(args.profile.subject)
  const artifact = fallbackArtifact(args.profile.artifact)
  const domain = fallbackDomain(args.profile.domain, args.profile.topics)
  const objectiveSummary = buildObjectiveSummary(args.profile) || fallbackObjective(args.profile.objective)
  const owner = fallbackOwner(args.profile.owner)
  const defaultOutputTarget = deriveOutputTargetFileName(args.fileName)
  const variableLinkRows = buildVariableLinkRows(args.profile)
  const snapshotRows = buildSnapshotRows(args.profile, args.fileName)
  const usePlanningScaffold = Boolean(
    args.profile.requestedSections.useCase ||
    args.profile.requestedSections.problem ||
    args.profile.requestedSections.solution ||
    args.profile.requestedSections.userFlow ||
    args.profile.requestedSections.workflow ||
    args.profile.requestedSections.dataFlow ||
    args.profile.requestedSections.monetization ||
    args.profile.requestedSections.integrations
  )
  const openQuestions = buildOpenQuestions({
    artifact,
    topics: args.profile.topics,
    namedTerms: args.profile.namedTerms,
    requestedSections: args.profile.requestedSections,
    signals: args.profile.signals,
    outputFile: args.profile.outputFile,
    defaultOutputTarget,
  })
  const useCaseBlock = args.profile.requestedSections.useCase
    ? [
      '### Use Case',
      buildUseCaseText(args.profile),
      '',
    ].join('\n')
    : ''
  const solutionBlock = args.profile.requestedSections.solution
    ? [
      '### Solution',
      buildSolutionText(args.profile),
      '',
    ].join('\n')
    : ''
  const userFlowBlock = args.profile.requestedSections.userFlow
    ? [
      '### User Flow',
      buildUserFlowText(args.profile),
      '',
    ].join('\n')
    : ''
  const workflowBlock = args.profile.requestedSections.workflow
    ? [
      '### Work Flow',
      buildWorkflowText(args.profile),
      '',
    ].join('\n')
    : ''
  const dataFlowBlock = args.profile.requestedSections.dataFlow
    ? [
      '### Data Flow',
      buildDataFlowText(args.profile),
      '',
    ].join('\n')
    : ''
  const monetizationBlock = args.profile.requestedSections.monetization
    ? [
      '### Monetization Surface',
      buildMonetizationText(args.profile),
      '',
    ].join('\n')
    : ''
  const integrationsBlock = args.profile.requestedSections.integrations
    ? [
      '### Integration Boundaries',
      buildIntegrationText(args.profile),
      '',
    ].join('\n')
    : ''

  return [
    '# {{product}} · AI Pipeline',
    '',
    '## {{doc_type}}',
    '',
    `\`bg#E1F5EE:version {{version}}\` · \`bg#FAEEDA:status ${fallbackStatus(args.profile.status)}\` · owner \`${owner}\` · {{date}}`,
    '',
    buildDocumentLead(args.profile),
    '',
    '## Computing Flow Definition',
    '',
    '> **Machine source:** YAML frontmatter above the `---` delimiter - self-runnable, graph-complete. [↓ Flow Graph](#flow-graph) [↓ Pipeline](#pipeline) [↓ PRD](#prd--product-requirements) [↓ TAD](#tad--technical-architecture)',
    '',
    buildComputingFlowIntro(requestSummary),
    '',
    '### Variable Link Map',
    '',
    '| Placeholder | Current value | Used in body as | Why it matters |',
    '|---|---|---|---|',
    ...variableLinkRows.map(row => `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} |`),
    '',
    '### Runner Protocol',
    '',
    '| seq | Action | Input | Output | Notes |',
    '|---|---|---|---|---|',
    '| `R01` | ingest | raw file bytes | parsed YAML object | validate `kgc-pipeline/v1` |',
    '| `R02` | resolve | parsed YAML object | resolved variables | unresolved Tier B sentinels remain visible |',
    '| `R03` | build-graph | resolved YAML | graph nodes + edges | keep `pipeline`, `flow`, `mermaid`, and `graph_meta` aligned |',
    '| `R04` | compile-compute | graph | compiled graph | purity guard blocks `fetch`, `document`, `window` |',
    '| `R05` | traverse | compiled graph | executed graph | feedback arc retries remain bounded by `{{runtime.maxRetry}}` |',
    '| `R06` | render | executed graph + body | rendered workspace artifact | `dagre-LR` owns layout |',
    '',
    '### Graph Registry',
    '',
    '| Dimension | Value |',
    '|---|---|',
    '| Nodes | 5 |',
    '| Edges | 5 |',
    '| Phases | 3 |',
    '| Entry node | `@node:n-trigger` |',
    '| Exit node | `@node:n-deliver` |',
    '| Feedback bound | `{{runtime.maxRetry}}` |',
    '',
    '| Phase | Seq | Nodes |',
    '|---|---|---|',
    '| P1 | S01-S02 | `@node:n-trigger` · `@node:n-pack` |',
    '| P2 | S03-S04 | `@node:n-process` · `@node:n-validate` |',
    '| P3 | S05 | `@node:n-deliver` |',
    '',
    '### Document Links',
    '',
    '| Direction | Frontmatter key | Target |',
    '|---|---|---|',
    '| YAML -> body | `links.body_anchor` | `#flow-graph` |',
    '| YAML -> body | `links.yaml_anchor` | `#computing-flow-definition` |',
    `| Cross-document | \`links.self_ref\` | \`${args.fileName}\` |`,
    '| Body -> YAML | frontmatter delimiter | source of truth |',
    '',
    '## Flow Graph',
    '',
    '[↑ Computing Flow Definition](#computing-flow-definition)',
    '',
    '```mermaid',
    '{{mermaid}}',
    '```',
    '',
    buildFlowGraphSummary(args.profile, artifact, domain),
    '',
    '| Frontmatter key | Resolves in body as | Example |',
    '|---|---|---|',
    '| `$schema` | format gate | `kgc-pipeline/v1` |',
    '| `runner` | Runner Protocol table | `R01-R06` |',
    '| `graph_meta` | Graph Registry table | `entry_node` |',
    '| `links` | Document Links table | `self_ref` |',
    '| `mermaid` | diagram block | `{{mermaid}}` |',
    '| `flow.nodes` | node references | `@node:n-process` |',
    '| `flow.edges` | edge references | `@edge:n-validate:correction→n-process:correction` |',
    '| `pipeline` | Pipeline table | `S03` |',
    '| `runtime.*` | runtime references | `{{runtime.maxRetry}}` |',
    '| Tier B keys | request-shaped prose | `{{artifact}}` |',
    '',
    '## Pipeline',
    '',
    '[↑ Computing Flow Definition](#computing-flow-definition)',
    '',
    buildPipelineIntro(subject, objectiveSummary),
    '',
    '### Reading Guide',
    '',
    'Read the table left to right: user action explains what the actor does, system event explains what the pipeline does next, and data columns show what moves across edges. Shared nouns such as `{{product}}`, `{{artifact}}`, and `{{subject}}` come from frontmatter so the prose stays aligned even when request details change.',
    '',
    '| seq | `@node:id` | pipeline step | `bg#E1F5EE:UF` user action | `bg#E6F1FB:WF` system event | `bg#EAF3DE:DF` data in | `bg#EAF3DE:DF` data out | edge | actor | trigger | on fail | kanban | confidence |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    `| \`S01\` | \`@node:n-trigger\` | \`bg#E1F5EE:intent\` | ${subject} submits request scope | capture request intent | — | signal | \`@edge:n-trigger:signal→n-pack:signal\` | \`["${subject}","system"]\` | request | \`@flag:waiting\` | TBD | high |`,
    `| \`S02\` | \`@node:n-pack\` | \`bg#E1F5EE:context\` | — | build bounded context from request and workspace state | signal | context | \`@edge:n-pack:context→n-process:context\` | \`["system"]\` | signal | null | TBD | high |`,
    `| \`S03\` | \`@node:n-process\` | \`bg#FAEEDA:artifacts\` | ${subject} reviews streamed output | generate ${artifact} from context | context + correction | md | \`@edge:n-process:md→n-validate:md\` | \`["${subject}","AI"]\` | context | null | TBD | high |`,
    '| `S04` | `@node:n-validate` | `bg#FAEEDA:review` | validation feedback is surfaced | check format, variables, and confidence constraints | md | valid_md or correction | `@edge:n-validate:correction→n-process:correction` | `["system"]` | md | retry | TBD | high |',
    '| `S05` | `@node:n-deliver` | `bg#EAF3DE:handoff` | accepted artifact becomes workspace state | persist validated markdown and refresh renderer | valid_md | stored | `@edge:n-validate:valid_md→n-deliver:valid_md` | `["system"]` | valid_md | short-circuit | TBD | high |',
    '',
    '### Retry arc — S04 feedback to S03',
    '',
    '| retry | trigger | injected payload | expected outcome | confidence |',
    '|---|---|---|---|---|',
    '| 1 | first validation failure | `@flag:correction` | targeted correction without changing request intent | medium |',
    '| 2 | repeated failure | `@flag:correction` | narrower correction against the failed rule | medium |',
    '| `{{runtime.maxRetry}}` | final failure | `@flag:correction` | stop and surface `@flag:validation-failed` | low |',
    '',
    '## PRD — Product Requirements',
    '',
    '### Request Snapshot',
    '',
    '| Focus | Current reading | Why it matters |',
    '|---|---|---|',
    ...snapshotRows.map(row => `| ${row[0]} | ${row[1]} | ${row[2]} |`),
    '',
    ...(usePlanningScaffold
      ? [
        useCaseBlock.trimEnd(),
        '### Problem',
        '',
        buildProblemText(args.profile),
        '',
        solutionBlock.trimEnd(),
        userFlowBlock.trimEnd(),
        '### Goals',
        '',
        '| id | Goal | maps to | Priority | Status |',
        '|---|---|---|---|---|',
        '| `G-01` | Preserve one universal pipeline contract across request variants | `@node:n-trigger` | `#D85A30:P0` | TBD |',
        '| `G-02` | Shape context from the current request instead of cloning fixture prose | `@node:n-pack` | `#D85A30:P0` | TBD |',
        `| \`G-03\` | Generate \`{{artifact}}\` with request-relevant body content | \`@node:n-process\` | \`#D85A30:P0\` | TBD |`,
        '| `G-04` | Reject unresolved or malformed markdown before persistence | `@node:n-validate` | `#185FA5|bg#E6F1FB:P1` | TBD |',
        '| `G-05` | Persist only the normalized artifact identity and body | `@node:n-deliver` | `#185FA5|bg#E6F1FB:P1` | TBD |',
        '',
        '### Non-Goals',
        '',
        'This base path does not infer missing business decisions, create alternate legacy mappings, or inject project-specific vocabulary when the request does not provide it. Domain-specific choices should be added only when the request or later context makes them explicit.',
        '',
        '### User Stories',
        '',
        '| id | As a... | I want... | So that... | Acceptance criteria |',
        '|---|---|---|---|---|',
        `| \`US-01\` | \`${owner}\` | one request to map into one valid stored artifact | the chat pipeline stays predictable | output starts with frontmatter and contains required body sections |`,
        `| \`US-02\` | \`${owner}\` | the body to reflect ${requestSummary} | the stored document stays relevant to the query | problem and architecture prose mention request-specific scope without fabrication |`,
        '| `US-03` | `reviewer` | failed rule feedback to stay bounded and actionable | retry loops do not drift or freeze | retry arc stops at `{{runtime.maxRetry}}` and surfaces a correction signal |',
        '| `US-04` | `renderer` | frontmatter and body to stay aligned | graph, markdown, and storage stay in sync | section references and node IDs remain consistent across surfaces |',
      ]
      : [
        '### Request Fit',
        '',
        buildProblemText(args.profile),
        '',
        '### Direction',
        '',
        buildSolutionText(args.profile),
        '',
        '### Guardrails',
        '',
        '| Focus | Constraint | Why it matters |',
        '|---|---|---|',
        '| Originality | Keep the draft distinct from named source properties | preserves safety and usefulness |',
        `| Shared terms | Reuse \`{{artifact}}\`, \`{{subject}}\`, and \`{{objective}}\` from frontmatter | keeps body and YAML aligned |`,
        '| Persistence | Store only validated output | keeps retries bounded and artifacts reusable |',
      ]),
    '',
    '## TAD — Technical Architecture',
    '',
    workflowBlock.trimEnd(),
    dataFlowBlock.trimEnd(),
    monetizationBlock.trimEnd(),
    integrationsBlock.trimEnd(),
    assistantSignal
      ? `Recovered partial assistant signal is kept only as context for regeneration: ${assistantSignal}.\n`
      : '',
    '### Compute Inline Mapping Spec',
    '',
    '```yaml',
    'compute: {key: compute, type: function, value: |',
    '  (inputs) => ({',
    '    result: transform(inputs.upstream_handle)',
    '  })',
    '}',
    '```',
    '',
    '| Field | Type | Rule |',
    '|---|---|---|',
    '| `key` | `string` | use `compute` |',
    '| `type` | `string` | use `function` |',
    '| `value` | block scalar | keep the function body pure |',
    '',
    '```js',
    'function parseMappingFn(node) {',
    '  const { type, value } = node.compute;',
    "  if (type !== 'function') return null;",
    '  return new Function(`return (${value.trim()})`)();',
    '}',
    '```',
    '',
    'Validation treats compute blocks as declarative payloads first, then scans them for purity before evaluation. This keeps generation deterministic and avoids hidden runtime side effects.',
    '',
    '### S02 Context Bundle Field Spec',
    '',
    '| Field | Source | Type | Token budget |',
    '|---|---|---|---|',
    '| `selected_scope` | current workspace selection | `object` | — |',
    '| `frontmatter` | active markdown frontmatter | `object` | — |',
    '| `graph_summary` | graph summarizer | `string` | bounded |',
    '| `guideline_digest` | markdown guidelines | `string` | bounded |',
    '| `request_text` | active user request | `string` | bounded |',
    '',
    '### S04 Validation Rules',
    '',
    '| Rule | Check | Pass condition |',
    '|---|---|---|',
    '| `V-01` | sigil HEX format | uppercase 6-digit hex only |',
    '| `V-02` | long quote guard | no quoted span >= 15 words |',
    '| `V-03` | variable linkage | body variables resolve from frontmatter or inline declaration |',
    '| `V-04` | inline arrays | JSON.parse-safe arrays |',
    '| `V-05` | compute purity | no `fetch`, `document`, `window` |',
    '| `V-06` | heading truncation | no heading ends with `...` |',
    '| `V-07` | confidence enum | only `low`, `medium`, `high` |',
    '',
    '### S05 Data Schema',
    '',
    '```sql',
    'CREATE TABLE flow_nodes (',
    '  id          TEXT PRIMARY KEY,',
    '  doc_id      TEXT,',
    "  type        TEXT CHECK (type IN ('input','default','output','custom')),",
    '  label       TEXT,',
    '  handles     JSONB,',
    '  data        JSONB,',
    '  compute_fn  TEXT,',
    '  created_at  TIMESTAMPTZ DEFAULT now()',
    ');',
    '',
    'CREATE TABLE flow_edges (',
    '  id              TEXT PRIMARY KEY,',
    '  doc_id          TEXT,',
    '  source          TEXT REFERENCES flow_nodes(id),',
    '  source_handle   TEXT,',
    '  target          TEXT REFERENCES flow_nodes(id),',
    '  target_handle   TEXT,',
    '  label           TEXT,',
    '  animated        BOOLEAN DEFAULT false,',
    '  created_at      TIMESTAMPTZ DEFAULT now()',
    ');',
    '```',
    '',
    '## Node Reference',
    '',
    '| id | type | phase | actor | handles (target -> source) | applies_rules | db_writes | retry_arc | confidence | kanban |',
    '|---|---|---|---|---|---|---|---|---|---|',
    `| \`@node:n-trigger\` | \`input\` | emit | \`["${subject}","system"]\` | — -> [signal] | \`[]\` | \`flow_nodes\` | — | high | TBD |`,
    '| `@node:n-pack` | `default` | pack | `["system"]` | [signal] -> [context] | `[]` | `flow_nodes` | — | high | TBD |',
    `| \`@node:n-process\` | \`default\` | generate | \`["${subject}","AI"]\` | [context, correction] -> [md] | \`["V-05"]\` | \`flow_nodes\` | source | high | TBD |`,
    '| `@node:n-validate` | `default` | validate | `["system"]` | [md] -> [valid_md, correction] | `["V-01","V-02","V-03","V-04","V-05","V-06","V-07"]` | `flow_nodes` | target | high | TBD |',
    '| `@node:n-deliver` | `output` | deliver | `["system"]` | [valid_md] -> — | `[]` | `["flow_nodes","flow_edges"]` | — | high | TBD |',
    '',
    '| Handle | Direction | Carries | PostgreSQL column |',
    '|---|---|---|---|',
    '| `signal` | trigger -> pack | request signal | — |',
    '| `context` | pack -> process | bounded context | — |',
    '| `md` | process -> validate | generated markdown | — |',
    '| `valid_md` | validate -> deliver | accepted markdown | — |',
    '| `correction` | validate -> process | failed-rule feedback | — |',
    '',
    '## Open Questions',
    '',
    '| id | Question | Owner | Due | Status |',
    '|---|---|---|---|---|',
    ...openQuestions.map(row => `| \`${row.id}\` | ${row.question} | \`${owner}\` | TBD | ${row.status} |`),
    '',
    '## Customization Guide',
    '',
    'Replace Tier B values with domain-specific values only when the request or the author provides them. The stable node and edge contract remains unchanged, so downstream renderers and storage paths keep one universal graph shape.',
    '',
    '### Frontmatter variable map',
    '',
    '| Variable | Base (generic) | Example domain |',
    '|---|---|---|',
    '| `{{product}}` | product name | Planning Canvas |',
    '| `{{domain}}` | operating domain | Research Workflow |',
    '| `{{subject}}` | primary actor | analyst |',
    '| `{{objective}}` | request objective | deliver an implementation brief |',
    '| `{{artifact}}` | requested deliverable | PRD + TAD |',
    '| `{{owner}}` | owning role | platform-ai |',
    '| `{{version}}` | version string | 0.1.0 |',
    '| `{{status}}` | lifecycle label | draft |',
    '',
    '### Extension checklist',
    '',
    '| Step | Action | Target section |',
    '|---|---|---|',
    '| 1 | Resolve Tier B variables when request context is explicit | YAML frontmatter |',
    '| 2 | Keep `pipeline`, `flow`, `mermaid`, and `graph_meta` aligned | frontmatter graph blocks |',
    '| 3 | Add domain validation rules from `V-08` onward if needed | TAD validation rules |',
    '| 4 | Extend open questions after `OQ-04` for domain-specific unknowns | Open Questions |',
    '| 5 | Keep streamed prose request-shaped rather than fixture-shaped | body sections |',
    '',
    '### Syntax quick-reference',
    '',
    '| Convention | Symbol | Meaning | Example |',
    '|---|---|---|---|',
    '| Variable reference | `{{key}}` | resolve from frontmatter | `{{artifact}}` |',
    '| Node reference | `@node:id` | refer to a flow node | `@node:n-process` |',
    '| Edge reference | `@edge:src:h→tgt:h` | refer to a flow edge | `@edge:n-validate:correction→n-process:correction` |',
    '| Background sigil | `bg#HEX:text` | semantic highlight | `bg#E1F5EE:intent` |',
    '| Multi-select array | `["A","B"]` | JSON-safe inline array | `["system"]` |',
  ].filter(Boolean).join('\n')
}

const buildRequiredSectionLabels = (profile: ReturnType<typeof analyzeKgcRequest>): string[] => {
  return [
    profile.requestedSections.useCase ? 'Use Case' : '',
    profile.requestedSections.problem ? 'Problem' : '',
    profile.requestedSections.solution ? 'Solution' : '',
    profile.requestedSections.userFlow ? 'User Flow' : '',
    profile.requestedSections.workflow ? 'Work Flow' : '',
    profile.requestedSections.dataFlow ? 'Data Flow' : '',
    profile.requestedSections.monetization ? 'Monetization Surface' : '',
    profile.requestedSections.integrations ? 'Integration Boundaries' : '',
  ].filter(Boolean)
}

const buildFrontmatterContextSummary = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  return sanitizeScalar([
    profile.signals.mcp ? 'MCP distribution' : '',
    profile.signals.externalUsers ? 'external users' : '',
    profile.signals.openClaw ? 'OpenClaw marketplace' : (profile.signals.marketplace ? 'skills marketplace' : ''),
    profile.signals.subscriptions ? 'subscriptions' : '',
    profile.signals.payPerUse ? 'pay-per-use' : '',
    profile.signals.conversion ? 'conversion actions' : '',
    profile.signals.swipe ? 'Swipe checkout' : (profile.signals.payments ? 'checkout' : ''),
    profile.signals.rxdb ? 'RxDB' : '',
    profile.signals.maplibre ? 'MapLibre' : '',
  ].filter(Boolean).join(' + '), 220)
}

const buildFrontmatterValidationFocus = (profile: ReturnType<typeof analyzeKgcRequest>): string[] => {
  return [
    ...buildRequiredSectionLabels(profile),
    profile.signals.openClaw ? 'OpenClaw discovery path' : '',
    profile.signals.swipe ? 'Swipe payment trigger and fulfillment' : '',
    profile.signals.subscriptions ? 'subscription entitlement logic' : '',
    profile.signals.payPerUse ? 'usage-metered action logic' : '',
    profile.signals.conversion ? 'conversion event framing' : '',
    profile.signals.rxdb ? 'RxDB state assumptions' : '',
    profile.signals.maplibre ? 'MapLibre relevance' : '',
  ].filter(Boolean)
}

const buildFrontmatter = (args: {
  fileName: string
  profile: ReturnType<typeof analyzeKgcRequest>
}): string => {
  const subject = fallbackActor(args.profile.subject)
  const product = fallbackProduct(args.profile.product)
  const artifact = fallbackArtifact(args.profile.artifact)
  const domain = fallbackDomain(args.profile.domain, args.profile.topics)
  const objective = fallbackObjective(args.profile.objective)
  const owner = fallbackOwner(args.profile.owner)
  const status = fallbackStatus(args.profile.status)
  const graphId = `md:${slugify(args.fileName)}-pipeline`
  const title = product === '{{product}}'
    ? '{{product}} · AI Pipeline — Chat Response'
    : `${product} · AI Pipeline — ${artifact}`
  const requestSummary = buildRequestSummary(args.profile)
  const contextSummary = buildFrontmatterContextSummary(args.profile)
  const requiredSections = buildRequiredSectionLabels(args.profile)
  const validationFocus = buildFrontmatterValidationFocus(args.profile)
  return [
    `title: ${JSON.stringify(title)}`,
    `graphId: ${JSON.stringify(graphId)}`,
    `doc_type: ${JSON.stringify(artifact)}`,
    'date: "{{date}}"',
    'ai_model: "model-unknown"',
    'lang: "en-US"',
    '$schema: "kgc-pipeline/v1"',
    'spec:',
    '  format:        kgc-pipeline',
    '  version:       "1.0.0"',
    '  parser:        yaml-frontmatter',
    '  execution:     computing-flow',
    '  topology:      DAG-with-feedback',
    '  ssot_surfaces: [pipeline, flow.nodes, flow.edges, mermaid, runner]',
    'runner:',
    '  entry: R01',
    '  exit:  R06',
    '  steps:',
    '    - seq:    R01',
    '      action: ingest',
    '      input:  "raw file bytes"',
    '      output: "parsed YAML object"',
    '      description: >',
    '        Read file from disk (or network). Split on first pair of --- delimiters.',
    "        Parse the frontmatter block as YAML. Validate $schema == 'kgc-pipeline/v1';",
    '        halt with runner-error if schema mismatch. Expose parsed object as',
    '        __doc for downstream steps.',
    '    - seq:    R02',
    '      action: resolve',
    '      input:  "__doc (parsed YAML object)"',
    '      output: "__doc_resolved (vars substituted)"',
    '      description: >',
    '        Walk every string value in __doc. Replace {{key}} with the scalar value',
    '        at doc[key]. Replace {{key:value}} with value and register key→value.',
    '        Replace {{key|fallback}} with doc[key] if present, else fallback.',
    '        Tier B sentinel keys whose value is also a {{key}} pattern are exempt',
    '        from V-03 — render as visible placeholders. Expose __doc_resolved.',
    '    - seq:    R03',
    '      action: build-graph',
    '      input:  "__doc_resolved"',
    '      output: "graph { nodes[], edges[] }"',
    '      description: >',
    '        Instantiate each entry in flow.nodes[] as a graph node object. Instantiate',
    '        each entry in flow.edges[] as a directed edge. Cross-validate: every',
    '        flow.nodes[*].id.value MUST appear in pipeline[*].node AND in mermaid:',
    '        node IDs. Any mismatch halts with ssot-mismatch error naming the',
    '        divergent ID. Attach phase, actor, handles, applies_rules, db_writes,',
    '        retry_arc, confidence, status, kanban from each flow.nodes entry.',
    '    - seq:    R04',
    '      action: compile-compute',
    '      input:  "graph { nodes[], edges[] }"',
    '      output: "graph { nodes[] (compiled fns), edges[] }"',
    '      description: >',
    '        For each node, call parseMappingFn(node) — see TAD section. Before',
    "        new Function(), scan compute.value body for 'fetch', 'document',",
    "        'window'; any match halts compilation for that node and marks it",
    '        @flag:impure. Compiled function is stored on node as node._fn.',
    '        Async nodes (n-process) are flagged node._async = true.',
    '    - seq:    R05',
    '      action: traverse',
    '      input:  "graph (compiled)"',
    '      output: "graph (executed — handle values populated)"',
    '      description: >',
    '        Execute nodes in pipeline[*].seq order (S01 → S05). For each node,',
    '        assemble inputs map from all upstream edges whose targetHandle matches',
    '        a handle in node.handles.target[]. Call node._fn(inputs). Propagate',
    '        returned handle values to downstream edges. Honor feedback arc e5',
    '        (n-validate:correction → n-process:correction): re-execute n-process',
    '        up to runtime.maxRetry times on correction non-null. After maxRetry,',
    '        set both valid_md and correction to null and surface @flag:validation-failed',
    '        on n-validate. TBD inputs are treated as null; node shows @flag:waiting.',
    '    - seq:    R06',
    '      action: render',
    '      input:  "graph (executed) + mermaid: block + body Markdown"',
    '      output: "rendered Knowledge Graph Canvas"',
    '      description: >',
    '        Resolve {{mermaid}} in body with the mermaid: block scalar. Apply',
    '        canvas settings (auto_layout dagre-LR, snap_to_grid, minimap, controls).',
    '        Render pipeline: as the Pipeline table. Apply parseSigil() to all table',
    '        cells. Render flow graph with node cards showing phase, actor, confidence',
    '        badge, kanban status, and @flag annotations. Clicking a node card anchors',
    '        to its seq row in the Pipeline table (links.body_anchor → #pipeline).',
    '        Clicking the Flow Graph heading anchors back to this frontmatter\'s',
    '        documented entry point (links.yaml_anchor → #computing-flow-definition).',
    'links:',
    '  yaml_anchor: "#computing-flow-definition"',
    '  body_anchor: "#flow-graph"',
    `  self_ref: ${JSON.stringify(args.fileName)}`,
    'canvas:',
    '  auto_layout:  true',
    '  layout_algo:  dagre-LR',
    '  snap_to_grid: true',
    '  grid_size:    20',
    '  minimap:      true',
    '  controls:     true',
    '  node_defaults:',
    '    width:  220',
    '    height: 80',
    '  edge_defaults:',
    '    type:     smoothstep',
    '    animated: true',
    'graph_meta:',
    '  node_count: 5',
    '  edge_count: 5',
    '  phase_count: 3',
    '  entry_node:  n-trigger',
    '  exit_node:   n-deliver',
    '  phases:',
    '    - id: P1',
    '      label: "Context Packaging"',
    '      seq_range: "S01–S02"',
    '      nodes: [n-trigger, n-pack]',
    '    - id: P2',
    '      label: "Generate + Validate"',
    '      seq_range: "S03–S04"',
    '      nodes: [n-process, n-validate]',
    '    - id: P3',
    '      label: "Deliver + Persist"',
    '      seq_range: "S05"',
    '      nodes: [n-deliver]',
    '  feedback_arcs:',
    '    - edge:           e5',
    '      from:           n-validate',
    '      from_handle:    correction',
    '      to:             n-process',
    '      to_handle:      correction',
    '      max_iterations: "{{runtime.maxRetry}}"',
    '      on_exhausted:   "@flag:validation-failed"',
    '  forward_edges:',
    '    - {edge: e1, from: n-trigger,  to: n-pack,     handle: signal}',
    '    - {edge: e2, from: n-pack,     to: n-process,  handle: context}',
    '    - {edge: e3, from: n-process,  to: n-validate, handle: md}',
    '    - {edge: e4, from: n-validate, to: n-deliver,  handle: valid_md}',
    'product: ' + JSON.stringify(product),
    'domain: ' + JSON.stringify(domain),
    'subject: ' + JSON.stringify(subject),
    'objective: ' + JSON.stringify(objective),
    'artifact: ' + JSON.stringify(artifact),
    'owner: ' + JSON.stringify(owner),
    'version: "{{version}}"',
    'status: ' + JSON.stringify(status),
    'runtime:',
    '  entry:    {key: entry,    type: string,  value: "n-trigger"}',
    '  exit:     {key: exit,     type: string,  value: "n-deliver"}',
    '  sandbox:  {key: sandbox,  type: string,  value: "quickjs-emscripten"}',
    '  trace:    {key: trace,    type: boolean, value: true}',
    '  maxRetry: {key: maxRetry, type: number,  value: 3}',
    'pipeline:',
    '  - seq: S01',
    '    node: n-trigger',
    '    label: "trigger / input"',
    '    actor: ["{{subject}}", "system"]',
    '    edge_in: "—"',
    '    edge_out: signal',
    '    user_action: "{{subject}} selects scope; states the active request objective and constraints"',
    `    sys_event: ${JSON.stringify(`Runtime injects __selected_scope, __frontmatter, __context_summary globals; compute assembles signal for ${requestSummary || artifact}`)}`,
    '    data_in: "—"',
    `    data_out: ${JSON.stringify(`signal {scope, fm, summary, request_scope: ${contextSummary || domain}}`)}`,
    '    trigger: scope-select event',
    '    on_fail: "@flag:waiting — node blocked until scope selection"',
    '    kanban: TBD',
    '    confidence: high',
    '    status: TBD',
    '  - seq: S02',
    '    node: n-pack',
    '    label: "context pack"',
    '    actor: ["system"]',
    '    edge_in: signal',
    '    edge_out: context',
    '    user_action: "—"',
    `    sys_event: ${JSON.stringify(`packContext() shapes signal into context bundle; includes ${contextSummary || domain}; prepends guideline_digest ≤ 800 tokens as system-prompt prefix`)}`,
    '    data_in: "signal {scope, fm, summary, request_scope}"',
    `    data_out: ${JSON.stringify(`context {selected_scope, frontmatter, context_summary, request_scope, required_sections: ${requiredSections.join(' | ') || 'none'}}`)}`,
    '    trigger: signal non-null',
    '    on_fail: "null emitted on context — all downstream nodes short-circuit"',
    '    kanban: TBD',
    '    confidence: high',
    '    status: TBD',
    '  - seq: S03',
    '    node: n-process',
    '    label: "generate / process"',
    '    actor: ["{{subject}}", "AI"]',
    '    edge_in: "context + correction|null"',
    '    edge_out: md',
    '    user_action: "Request injected as user turn; {{subject}} reviews streamed output for fit and clarity"',
    `    sys_event: ${JSON.stringify(`generateArtifact() calls /v1/messages model {{ai_model}} temp 0.3 max 1000 tokens; output must cover ${objective}`)}`,
    '    data_in: "context {selected_scope, frontmatter, context_summary, request_scope} + correction string[]|null"',
    '    data_out: "md string (raw streamed Markdown)"',
    '    trigger: context received',
    '    on_fail: "null emitted on md — validate short-circuits"',
    '    kanban: TBD',
    '    confidence: high',
    '    status: TBD',
    '  - seq: S04',
    '    node: n-validate',
    '    label: "review / validate"',
    '    actor: ["system"]',
    '    edge_in: md',
    '    edge_out: "valid_md | correction (feedback arc)"',
    '    user_action: "Validation badge appears on node card (high / low / @flag:failed)"',
    `    sys_event: ${JSON.stringify(`validateArtifact() runs V-01–V-07 plus coverage checks for ${validationFocus.join(', ') || 'request-specific requirements'}; first failure emits correction back to n-process via feedback arc e5; pass emits valid_md to n-deliver`)}`,
    '    data_in: "md"',
    '    data_out: "valid_md string (pass) OR correction string[] (fail — feedback arc)"',
    '    trigger: md received',
    '    on_fail: "retry ≤ {{runtime.maxRetry}}× via @edge:n-validate:correction→n-process:correction; then @flag:validation-failed on originating node"',
    '    kanban: TBD',
    '    confidence: high',
    '    status: TBD',
    '  - seq: S05',
    '    node: n-deliver',
    '    label: "deliver / persist"',
    '    actor: ["system"]',
    '    edge_in: valid_md',
    '    edge_out: "—"',
    '    user_action: "Validated artifact is delivered; {{subject}} can publish, iterate, or route to the next workflow step"',
    '    sys_event: "deliverArtifact() calls resolveVars() → parseMappingFn() per node → parseSigil() per cell → upsert flow_nodes + flow_edges → output re-render"',
    '    data_in: "valid_md string"',
    '    data_out: "rendered object + JSONB rows in flow_nodes, flow_edges"',
    '    trigger: valid_md non-null',
    '    on_fail: "short-circuits — output unchanged"',
    '    kanban: TBD',
    '    confidence: high',
    '    status: TBD',
    'mermaid: |',
    '  %%{init: {"theme": "base", "themeVariables": {"primaryColor":"#E1F5EE","primaryTextColor":"#085041","primaryBorderColor":"#1D9E75","lineColor":"#5F5E5A","secondaryColor":"#E6F1FB","tertiaryColor":"#FAEEDA"}}}%%',
    '  flowchart LR',
    '    classDef persona  fill:#E1F5EE,stroke:#1D9E75,color:#085041,stroke-width:1.5px',
    '    classDef input    fill:#E1F5EE,stroke:#1D9E75,color:#085041,stroke-width:1.5px',
    '    classDef default  fill:#E6F1FB,stroke:#378ADD,color:#0C447C,stroke-width:1.5px',
    '    classDef output   fill:#EAF3DE,stroke:#639922,color:#27500A,stroke-width:1.5px',
    '    classDef store    fill:#F1EFE8,stroke:#888780,color:#444441,stroke-width:1px',
    '    Actor(["{{subject}}"])',
    '    DB[("flow_nodes\\nflow_edges\\nJSONB")]',
    '    subgraph P1["S01–S02 · Context Packaging"]',
    '      n-trigger["S01 · n-trigger\\nTrigger / Input"]',
    '      n-pack["S02 · n-pack\\npackContext()"]',
    '      n-trigger -->|signal| n-pack',
    '    end',
    '    subgraph P2["S03–S04 · Generate + Validate"]',
    '      n-process["S03 · n-process\\ngenerateArtifact()"]',
    '      n-validate["S04 · n-validate\\nvalidateArtifact()"]',
    '      n-process -->|md| n-validate',
    '      n-validate -.->|"@flag:correction\\n≤ 3×"| n-process',
    '    end',
    '    subgraph P3["S05 · Deliver + Persist"]',
    '      n-deliver["S05 · n-deliver\\ndeliverArtifact()"]',
    '    end',
    '    Actor      -->|selects scope · types request| n-trigger',
    '    n-pack     -->|context|                       n-process',
    '    n-validate -->|valid_md|                      n-deliver',
    '    n-deliver  -->|upsert|                        DB',
    '    DB         -.->|reload · rehydrate|           n-trigger',
    '    class Actor persona',
    '    class n-trigger input',
    '    class n-pack,n-process,n-validate default',
    '    class n-deliver output',
    '    class DB store',
    '    click n-trigger  "#pipeline" "S01 · trigger / input"',
    '    click n-pack     "#pipeline" "S02 · context pack"',
    '    click n-process  "#pipeline" "S03 · generate / process"',
    '    click n-validate "#pipeline" "S04 · review / validate"',
    '    click n-deliver  "#pipeline" "S05 · deliver / persist"',
    'flow:',
    '  direction:  {key: direction,  type: string,  value: LR}',
    '  edgeType:   {key: edgeType,   type: string,  value: smoothstep}',
    '  snapToGrid: {key: snapToGrid, type: boolean, value: true}',
    '  computed:   {key: computed,   type: boolean, value: true}',
    '  nodes:',
    '    - id:            {key: id,            type: string,   value: "n-trigger"}',
    '      type:          {key: type,          type: string,   value: "input"}',
    '      label:         {key: label,         type: string,   value: "S01 · Trigger / Input"}',
    '      phase:         {key: phase,         type: string,   value: "emit"}',
    '      actor:         {key: actor,         type: array,    value: ["{{subject}}","system"]}',
    '      handles:       {key: handles,       type: object,   value: {source: [signal]}}',
    `      data:          {key: data,          type: object,   value: {objective: "{{objective}}", artifact: "{{artifact}}", request_scope: ${JSON.stringify(contextSummary || domain)}}}`,
    '      applies_rules: {key: applies_rules, type: array,    value: []}',
    '      db_writes:     {key: db_writes,     type: string,   value: "flow_nodes"}',
    '      retry_arc:     {key: retry_arc,     type: string,   value: "—"}',
    '      confidence:    {key: confidence,    type: string,   value: "high"}',
    '      status:        {key: status,        type: string,   value: "TBD"}',
    '      kanban:        {key: kanban,        type: string,   value: "TBD"}',
    '      compute:       {key: compute,       type: function, value: |',
    '        (inputs) => ({',
    '          signal: {',
    '            scope:   inputs.__selected_scope  ?? null,',
    '            fm:      inputs.__frontmatter     ?? {},',
    '            summary: inputs.__context_summary ?? ""',
    '          }',
    '        })',
    '      }',
    '    - id:            {key: id,            type: string,   value: "n-pack"}',
    '      type:          {key: type,          type: string,   value: "default"}',
    '      label:         {key: label,         type: string,   value: "S02 · packContext()"}',
    '      phase:         {key: phase,         type: string,   value: "pack"}',
    '      actor:         {key: actor,         type: array,    value: ["system"]}',
    '      handles:       {key: handles,       type: object,   value: {target: [signal], source: [context]}}',
    `      data:          {key: data,          type: object,   value: {required_sections: ${JSON.stringify(requiredSections)}, named_terms: ${JSON.stringify(args.profile.namedTerms)}, request_scope: ${JSON.stringify(contextSummary || domain)}}}`,
    '      applies_rules: {key: applies_rules, type: array,    value: []}',
    '      db_writes:     {key: db_writes,     type: string,   value: "flow_nodes"}',
    '      retry_arc:     {key: retry_arc,     type: string,   value: "—"}',
    '      confidence:    {key: confidence,    type: string,   value: "high"}',
    '      status:        {key: status,        type: string,   value: "TBD"}',
    '      kanban:        {key: kanban,        type: string,   value: "TBD"}',
    '      compute:       {key: compute,       type: function, value: |',
    '        (inputs) => ({',
    '          context: inputs.signal ? {',
    '            selected_scope:  inputs.signal.scope,',
    '            frontmatter:     inputs.signal.fm,',
    '            context_summary: inputs.signal.summary',
    '          } : null',
    '        })',
    '      }',
    '    - id:            {key: id,            type: string,   value: "n-process"}',
    '      type:          {key: type,          type: string,   value: "default"}',
    '      label:         {key: label,         type: string,   value: "S03 · generateArtifact()"}',
    '      phase:         {key: phase,         type: string,   value: "generate"}',
    '      actor:         {key: actor,         type: array,    value: ["{{subject}}","AI"]}',
    '      handles:       {key: handles,       type: object,   value: {target: [context, correction], source: [md]}}',
    `      data:          {key: data,          type: object,   value: {model: "{{ai_model}}", temperature: 0.3, max_tokens: 1000, request_scope: ${JSON.stringify(contextSummary || domain)}, objective_focus: ${JSON.stringify(buildObjectiveSummary(args.profile) || objective)}}}`,
    '      applies_rules: {key: applies_rules, type: array,    value: ["V-05"]}',
    '      db_writes:     {key: db_writes,     type: string,   value: "flow_nodes"}',
    '      retry_arc:     {key: retry_arc,     type: string,   value: "source"}',
    '      confidence:    {key: confidence,    type: string,   value: "high"}',
    '      status:        {key: status,        type: string,   value: "TBD"}',
    '      kanban:        {key: kanban,        type: string,   value: "TBD"}',
    '      compute:       {key: compute,       type: function, value: |',
    '        async (inputs) => ({',
    '          md: inputs.context',
    '            ? await callAnthropicAPI({',
    '                ...inputs.context,',
    '                correction: inputs.correction ?? null',
    '              })',
    '            : null',
    '        })',
    '      }',
    '    - id:            {key: id,            type: string,   value: "n-validate"}',
    '      type:          {key: type,          type: string,   value: "default"}',
    '      label:         {key: label,         type: string,   value: "S04 · validateArtifact()"}',
    '      phase:         {key: phase,         type: string,   value: "validate"}',
    '      actor:         {key: actor,         type: array,    value: ["system"]}',
    '      handles:       {key: handles,       type: object,   value: {target: [md], source: [valid_md, correction]}}',
    `      data:          {key: data,          type: object,   value: {rules: ["V-01","V-02","V-03","V-04","V-05","V-06","V-07"], max_retry: 3, required_sections: ${JSON.stringify(requiredSections)}, coverage_terms: ${JSON.stringify(validationFocus)}}}`,
    '      applies_rules: {key: applies_rules, type: array,    value: ["V-01","V-02","V-03","V-04","V-05","V-06","V-07"]}',
    '      db_writes:     {key: db_writes,     type: string,   value: "flow_nodes"}',
    '      retry_arc:     {key: retry_arc,     type: string,   value: "target"}',
    '      confidence:    {key: confidence,    type: string,   value: "high"}',
    '      status:        {key: status,        type: string,   value: "TBD"}',
    '      kanban:        {key: kanban,        type: string,   value: "TBD"}',
    '      compute:       {key: compute,       type: function, value: |',
    '        (inputs) => {',
    '          const result = runValidation(inputs.md);',
    '          return {',
    '            valid_md:   result.ok ? inputs.md    : null,',
    '            correction: result.ok ? null : result.errors',
    '          };',
    '        }',
    '      }',
    '    - id:            {key: id,            type: string,   value: "n-deliver"}',
    '      type:          {key: type,          type: string,   value: "output"}',
    '      label:         {key: label,         type: string,   value: "S05 · deliverArtifact()"}',
    '      phase:         {key: phase,         type: string,   value: "deliver"}',
    '      actor:         {key: actor,         type: array,    value: ["system"]}',
    '      handles:       {key: handles,       type: object,   value: {target: [valid_md]}}',
    '      data:          {key: data,          type: object,   value: {stores: ["flow_nodes","flow_edges"], triggers: "output re-render"}}',
    '      applies_rules: {key: applies_rules, type: array,    value: []}',
    '      db_writes:     {key: db_writes,     type: array,    value: ["flow_nodes","flow_edges"]}',
    '      retry_arc:     {key: retry_arc,     type: string,   value: "—"}',
    '      confidence:    {key: confidence,    type: string,   value: "high"}',
    '      status:        {key: status,        type: string,   value: "TBD"}',
    '      kanban:        {key: kanban,        type: string,   value: "TBD"}',
    '      compute:       {key: compute,       type: function, value: |',
    '        (inputs) => ({',
    '          rendered: inputs.valid_md',
    '            ? deliverArtifact(inputs.valid_md)',
    '            : null',
    '        })',
    '      }\n  subgraphs:\n    - {id: sg-p1, kind: subgraph, label: "Context Packaging", memberNodeIds: [n-trigger, n-pack], parentId: null}\n    - {id: sg-p2, kind: subgraph, label: "Generate + Validate", memberNodeIds: [n-process, n-validate], parentId: null}\n    - {id: sg-p3, kind: subgraph, label: "Deliver + Persist", memberNodeIds: [n-deliver], parentId: null}',
    '  edges:',
    '    - {id: e1, source: n-trigger,  sourceHandle: signal,     target: n-pack,     targetHandle: signal,     label: "signal",             animated: true}',
    '    - {id: e2, source: n-pack,     sourceHandle: context,    target: n-process,  targetHandle: context,    label: "context",            animated: true}',
    '    - {id: e3, source: n-process,  sourceHandle: md,         target: n-validate, targetHandle: md,         label: "md",                 animated: true}',
    '    - {id: e4, source: n-validate, sourceHandle: valid_md,   target: n-deliver,  targetHandle: valid_md,   label: "validated artifact", animated: true}',
    '    - {id: e5, source: n-validate, sourceHandle: correction, target: n-process,  targetHandle: correction, label: "@flag:correction",   animated: true}',
  ].join('\n')
}

export const buildDeterministicBaseTemplateKgcTurn = (args: BaseFallbackArgs): string => {
  void args.timestampMs
  const profile = analyzeKgcRequest(args.requestText)
  const frontmatter = buildFrontmatter({
    fileName: String(args.fileName || '').trim() || 'kgc.md',
    profile,
  })
  const body = buildBody({
    requestText: args.requestText,
    assistantText: String(args.assistantText || ''),
    profile,
    fileName: String(args.fileName || '').trim() || 'kgc.md',
  })
  return ['---', frontmatter, '---', body].join('\n').trimEnd() + '\n'
}
