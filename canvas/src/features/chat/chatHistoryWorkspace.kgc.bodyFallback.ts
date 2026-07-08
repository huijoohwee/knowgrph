import { analyzeKgcRequest, sanitizeRequestIntent } from './chatKgcRequestProfile'
import {
  buildGuardrailRows,
  buildNamedTermSummary,
  buildOpenQuestions,
  buildSnapshotRows,
  fallbackActor,
  fallbackArtifact,
  fallbackDomain,
  fallbackObjective,
  fallbackOwner,
  fallbackProduct,
  fallbackStatus,
} from './chatHistoryWorkspace.kgc.fallbackSections'
import {
  buildFlowContextSummary,
  buildObjectiveSummary,
  buildRequestSummary,
  deriveOutputTargetFileName,
} from './chatHistoryWorkspace.kgc.fallbackCommon'
import { buildResponseMarkdown, summariseAssistantSignal } from './chatHistoryWorkspace.kgc.responseProjection'

const buildUseCaseText = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  const surfaces = [
    profile.signals.mcp ? 'MCP delivery' : '',
    profile.signals.externalUsers ? 'external-user access' : '',
    profile.signals.openClaw ? 'OpenClaw and related marketplace surfaces' : (profile.signals.marketplace ? 'marketplace surfaces' : 'the stated delivery surfaces'),
    profile.signals.stripe ? 'checkout completion' : (profile.signals.payments ? 'payment completion' : ''),
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
    profile.signals.stripe || profile.signals.payments ? 'payment or checkout transitions' : '',
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
    profile.signals.stripe ? 'Stripe checkout and payment completion' : '',
    profile.signals.rxdb ? 'RxDB local-first state' : '',
    profile.signals.maplibre ? 'MapLibre spatial presentation' : '',
  ].filter(Boolean)
  const namedTerms = buildNamedTermSummary(profile)
  return `Shape a lean response package that turns the request into an actionable handoff covering ${channels.join(', ') || namedTerms || 'the active request terms'}. Keep text and rich-media handoff ready for editor workspace widgets, cards, edges, and Rich Media Panels when the response includes renderable handles such as \`outputSrcDoc\` or media URLs. Make the deliverable concrete enough for follow-through without drifting into boilerplate, stale template prose, or unrelated examples.`
}

const buildUserFlowText = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  const conversionMoment = profile.signals.stripe
    ? 'completes the Stripe checkout flow and unlocks the paid entitlement or action'
    : (profile.signals.payments ? 'completes checkout and unlocks the paid entitlement or action' : 'crosses from free exploration into paid activation')
  if (profile.signals.payments || profile.signals.stripe || profile.signals.subscriptions || profile.signals.payPerUse || profile.signals.conversion) {
    return `A user discovers the \`{{product}}\` offer, evaluates the entry point, reaches the requested paid or conversion action, ${conversionMoment}, and then receives the promised output, capability, or follow-up access.`
  }
  return `\`{{subject}}\` opens the workspace, provides the active request terms, reviews generated text plus connected render outputs, edits assumptions inline, and persists the validated handoff so downstream panels and cards stay aligned with the same source values.`
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
    profile.signals.stripe ? 'Stripe can cover checkout, payment confirmation, and post-payment handoff' : '',
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
    : (profile.signals.marketplace ? 'package the offer for marketplace discovery' : 'package the active request terms')
  return `S01 captures the active request brief for \`{{product}}\`. S02 shapes context around ${marketplaceStep}, named terms, and the requested \`{{artifact}}\`. S03 generates the response package. S04 checks term coverage, assumptions, transitions, and boundaries. S05 persists a reusable handoff. In practice the workflow should move from input -> context -> draft -> review -> delivery instead of stopping at generic prose.`
}

const buildDataFlowText = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  if (profile.signals.creativeScript) {
    const fileNote = profile.outputFile ? ` plus output target ${profile.outputFile}` : ''
    return `Request text and workspace context become a bounded creative bundle containing tone, pacing, originality constraints${fileNote}. That bundle becomes \`{{artifact}}\` markdown, validation yields either corrective feedback or approved output, and approved output becomes persisted workspace state with creative intent and safety assumptions intact.`
  }
  const transitionPayload = profile.signals.stripe
    ? 'Stripe checkout trigger, payment state, and post-payment entitlement'
    : (profile.signals.payments || profile.signals.conversion ? 'conversion trigger and post-conversion entitlement' : 'handoff state and downstream render targets')
  const stackPayload = [
    profile.signals.rxdb ? 'RxDB-backed local context' : '',
    profile.signals.maplibre ? 'MapLibre-relevant spatial context' : '',
  ].filter(Boolean)
  const namedTerms = buildNamedTermSummary(profile) || 'the active request terms'
  return `Request text and workspace context become a bounded bundle containing ${namedTerms}, ${transitionPayload}${stackPayload.length ? `, and ${stackPayload.join(' plus ')}` : ''}. Inline compute can read connected input handles, emit text output plus optional \`outputSrcDoc\` markup and media URLs, and Rich Media Panels consume those handles directly. Edits to source cards or widgets recompute downstream panels instead of copying stale values.`
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

const buildDocumentLead = (profile: ReturnType<typeof analyzeKgcRequest>): string => {
  const focus = [
    profile.signals.mcp ? 'delivery packaging' : '',
    profile.signals.externalUsers ? 'target users' : '',
    profile.signals.marketplace || profile.signals.openClaw ? 'distribution context' : '',
    profile.signals.subscriptions || profile.signals.payPerUse || profile.signals.conversion ? 'action and monetization logic' : '',
    profile.signals.stripe || profile.signals.payments ? 'checkout transitions' : '',
    profile.signals.rxdb || profile.signals.maplibre ? 'implementation boundaries' : '',
  ].filter(Boolean)
  const namedTerms = buildNamedTermSummary(profile)
  return `> This document packages \`{{artifact}}\` for \`{{subject}}\` around the active request. Shared terms stay aligned through frontmatter, while the body stays focused on ${focus.join(', ') || namedTerms || 'the active request'} instead of generic template narration.`
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

export const buildBody = (args: {
  requestText: string
  assistantText: string
  profile: ReturnType<typeof analyzeKgcRequest>
  fileName: string
  responseSurfaceBlock?: string
}): string => {
  const requestSummary = buildRequestSummary(args.profile) || sanitizeRequestIntent(args.requestText, 260) || 'Current request'
  const assistantSignal = summariseAssistantSignal(args.assistantText)
  const subject = fallbackActor(args.profile.subject)
  const artifact = fallbackArtifact(args.profile.artifact)
  const domain = fallbackDomain(args.profile.domain, args.profile.topics)
  const objectiveSummary = buildObjectiveSummary(args.profile) || fallbackObjective(args.profile.objective)
  const owner = fallbackOwner(args.profile.owner)
  const defaultOutputTarget = deriveOutputTargetFileName(args.fileName)
  const responseMarkdown = buildResponseMarkdown({
    profile: args.profile,
    assistantText: args.assistantText,
  })
  const variableLinkRows = buildVariableLinkRows(args.profile)
  const snapshotRows = buildSnapshotRows({
    profile: args.profile,
    outputTarget: args.profile.outputFile || defaultOutputTarget,
    objectiveSummary,
  })
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
    '## Response',
    '',
    responseMarkdown,
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
        'This base path does not infer missing business decisions, create alternate mappings, or inject project-specific vocabulary when the request does not provide it. Domain-specific choices should be added only when the request or later context makes them explicit.',
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
        ...buildGuardrailRows(args.profile).map(row => `| ${row[0]} | ${row[1]} | ${row[2]} |`),
      ]),
    '',
    '## TAD — Technical Architecture',
    '',
    workflowBlock.trimEnd(),
    dataFlowBlock.trimEnd(),
    monetizationBlock.trimEnd(),
    integrationsBlock.trimEnd(),
    (args.responseSurfaceBlock || '').trimEnd(),
    assistantSignal
      ? `Recovered partial assistant signal is kept only as context for regeneration: ${assistantSignal}.\n`
      : '',
    '### Compute Inline Mapping Spec',
    '',
    '```yaml',
    'compute:',
    '  key: compute',
    '  type: function',
    '  value: |',
    '    (inputs) => ({',
    '      result: transform(inputs.upstream_handle)',
    '    })',
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

export const buildResponseOnlyBody = (args: {
  assistantText: string
  profile: ReturnType<typeof analyzeKgcRequest>
}): string => {
  const responseMarkdown = buildResponseMarkdown({
    profile: args.profile,
    assistantText: args.assistantText,
  })
  return [
    '# Chat Response',
    '',
    '`{{artifact}}` · {{date}}',
    '',
    '## Response',
    '',
    responseMarkdown,
  ].join('\n').trimEnd()
}
