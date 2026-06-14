import fs from 'node:fs'
import path from 'node:path'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import {
  buildStrybldrStoryboardDocument,
  buildStrybldrVideoHandoffFromGraphData,
  buildStrybldrVideoHandoffMarkdown,
  mergeStrybldrElementsIntoGraphData,
  serializeStrybldrStoryboardMarkdown,
} from '@/features/strybldr/strybldrStoryboard'
import { STRYBLDR_CAMERA_PROPERTY_KEY, readStrybldrCameraSettings, resolveStrybldrCameraOrbit, serializeStrybldrCameraSettings } from '@/features/strybldr/strybldrCamera'
import {
  resolveCameraOrbitFrameRay,
  resolveCameraOrbitSphereGridMeridianGeometry,
  resolveCameraOrbitSpherePointFromGridPoint,
  type CameraOrbitSphereConfig,
} from '@/lib/camera/orbitSphere'
import {
  createStrytreeCandidateRunAction,
  createStrytreeContinuationDraftAction,
  publishStrytreeCandidateAction,
  toggleStrytreeLikeAction,
  unlockStrytreeNodeAction,
} from '@/features/strybldr/strytreeWorkflow'
import { getCanvas2dSurfaceId, getToolbarRunAllFloatingPanelTab, isStoryboardCanvas2dRenderer, resolveCanvas2dRendererId, supportsToolbarRunAll } from '@/lib/config.render'
import { BYTEPLUS_VIDEO_POLL_BOUNDED_WINDOW_MS } from '@/features/chat/byteplusRunGeneration'
import { parseWorkspaceStrybldrStoryboardGraphDataCached } from '@/hooks/active-graph-data/workspaceStructuredGraph'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const readSource = (...parts: string[]): string => fs.readFileSync(path.resolve(process.cwd(), 'src', ...parts), 'utf8')

export async function testStrybldrStoryboardMarkdownParsesToStoryboardGraph() {
  const doc = buildStrybldrStoryboardDocument({
    createdAtMs: 1,
    mediaUrlBySourceUnitId: {
      'corpus-source-demo': 'blob:strybldr-demo',
    },
    sourceUnits: [
      {
        id: 'corpus-source-demo',
        workspacePath: '/demo.png.source.md',
        relativePath: 'demo.png',
        originalName: 'demo.png',
        mediaKind: 'image',
        mimeHint: 'image/png',
        byteSize: 128,
        textHash: 'abc123',
        status: 'unsupported',
        provenance: { importMode: 'file', importedAtMs: 1 },
      },
    ],
  })
  const text = serializeStrybldrStoryboardMarkdown(doc)
  const parsed = await loadGraphDataFromTextViaParser('demo.strybldr.md', text, { applyToStore: false })
  assert(parsed?.parserId === 'strybldr-storyboard', `expected strybldr parser, got ${parsed?.parserId}`)
  assert(parsed.graphData?.metadata && String((parsed.graphData.metadata as Record<string, unknown>).kgCanvas2dRenderer || '') === 'storyboard', 'expected Strybldr graph to advertise Storyboard renderer metadata')
  assert(String((parsed.graphData.metadata as Record<string, unknown>).graphSemanticKey || '').length > 0, 'expected shared graph semantic key metadata')
  assert((parsed.graphData.nodes || []).some(node => String(node.type || '') === 'StoryboardElement'), 'expected storyboard element nodes')
  assert((parsed.graphData.nodes || []).some(node => String(node.properties?.strybldrSourceUnitId || '') === 'corpus-source-demo'), 'expected provenance source-unit id on cards')
  assert((parsed.graphData.nodes || []).some(node => String(node.properties?.mediaKind || '') === 'image' && String(node.properties?.mimeHint || '') === 'image/png'), 'expected image media metadata for Viewer and Canvas rendering')

  const board = buildStoryboardBoardModel({ graphData: parsed.graphData, graphRevision: 1 })
  assert(board.totalCards >= 2, `expected Storyboard canvas cards from Strybldr graph, got ${board.totalCards}`)
  assert(board.lanes.some(lane => lane.id === 'Elements'), 'expected element lane in Strybldr board')
}

export async function testStrybldrConsolidatedDemoRoutesPanelsAndStoryboardRenderers() {
  const demoPath = path.resolve(process.cwd(), '../..', 'huijoohwee/docs/knowgrph-strybldr-demo.md')
  const text = fs.readFileSync(demoPath, 'utf8')
  const parsed = await loadGraphDataFromTextViaParser('knowgrph-strybldr-demo.md', text, {
    applyToStore: false,
    syncMarkdownDocument: false,
  })
  assert(parsed?.parserId === 'strybldr-storyboard', `expected Strybldr demo to use Strybldr parser, got ${parsed?.parserId}`)
  const graph = parsed.graphData
  assert(graph, 'expected parsed Strybldr graph')
  assert((graph.nodes || []).length > 0, 'expected Strybldr graph nodes for 2D renderers')
  assert((graph.edges || []).length > 0, 'expected Strybldr graph edges for Flow Editor projection')
  const metadata = (graph.metadata || {}) as Record<string, unknown>
  assert(String(metadata.kind || '') === 'strybldr-storyboard', `expected Strybldr graph kind to remain strybldr-storyboard, got ${String(metadata.kind || '')}`)
  assert(String(metadata.kgCanvas2dRenderer || '') === 'storyboard', 'expected Strybldr graph to advertise Storyboard renderer intent')
  assert(String(metadata.workflowForkId || '') === 'workflow-fork-rest-or-mcp', 'expected Strybldr graph metadata to preserve workflow fork')
  assert(String(metadata.workflowPublishId || '') === 'workflow-local-publish-packet', 'expected Strybldr graph metadata to preserve workflow publish packet')
  assert(Number(metadata.workflowEdgesCount || 0) >= 8, 'expected Strybldr graph metadata to count restored workflow edges')
  assert(
    (graph.edges || []).some(edge => edge.source === 'videodb-recreate-api-mcp-execution-card' && edge.target === 'workflow-fork-rest-mcp-card' && edge.label === 'operator_fork'),
    'expected parsed Strybldr graph to preserve the explicit REST/MCP fork edge',
  )
  assert(
    (graph.edges || []).some(edge => edge.source === 'videodb-recreate-review-card' && edge.target === 'videodb-recreate-publish-card' && edge.label === 'review_to_publish'),
    'expected parsed Strybldr graph to preserve the explicit publish edge',
  )
  const frontmatterMeta = metadata.frontmatterMeta as Record<string, unknown> | undefined
  assert(frontmatterMeta && String(frontmatterMeta.kgCanvas2dRenderer || '') === 'strybldr', 'expected Strybldr graph to preserve frontmatter renderer metadata')
  const flowDiagrams = frontmatterMeta?.flow_diagrams as Record<string, unknown> | undefined
  assert(flowDiagrams && typeof flowDiagrams === 'object', 'expected Strybldr graph to preserve routed flow_diagrams metadata')
  const flowDiagramEntries = Object.values((flowDiagrams.value || flowDiagrams) as Record<string, unknown>)
  for (const kind of ['mermaid_gitgraph', 'mermaid_architecture', 'mermaid_eventmodeling', 'mermaid_flowchart']) {
    assert(
      flowDiagramEntries.some(entry => String((entry as Record<string, unknown>)?.type || '') === kind),
      `expected Strybldr routed diagram metadata for ${kind}`,
    )
  }
  const board = buildStoryboardBoardModel({ graphData: graph, graphRevision: 1 })
  assert(board.totalCards > 0, `expected Storyboard/Strybldr board cards from Strybldr graph, got ${board.totalCards}`)
  const laneIds = new Set(board.lanes.map(lane => lane.id))
  for (const laneId of ['Source', 'Storyboard', 'Elements', 'Runtime', 'Fork', 'Review', 'Publish']) {
    assert(laneIds.has(laneId), `expected 77FAnT935IE Strybldr board to expose ${laneId} lane, got ${Array.from(laneIds).join(', ')}`)
  }
  const forkLane = board.lanes.find(lane => lane.id === 'Fork')
  assert(forkLane?.cards.some(card => card.title === 'Workflow fork: REST or MCP'), 'expected REST/MCP fork card to render in the Fork lane')
  const runtimeLane = board.lanes.find(lane => lane.id === 'Runtime')
  assert(runtimeLane?.cards.some(card => card.title === 'SenseNova media outputs'), 'expected SenseNova media output card to render in the Runtime lane')
  const reviewLane = board.lanes.find(lane => lane.id === 'Review')
  assert(reviewLane?.cards.some(card => card.title === 'Review search and stream'), 'expected review/search card to render in the Review lane')
  const publishLane = board.lanes.find(lane => lane.id === 'Publish')
  assert(publishLane?.cards.some(card => card.title === 'Local publish packet'), 'expected local publish packet card to render in the Publish lane')
  assert(!board.lanes.some(lane => lane.id === 'Storytree' || lane.id === 'ForkCompare'), 'expected cleaned 77FAnT935IE demo to omit unrelated Storytree and ForkCompare lanes')
  const storyboardCanvasText = readSource('components', 'StoryboardCanvas.tsx')
  assert(storyboardCanvasText.includes('strybldrWorkflowEdge'), 'expected Storyboard/Strybldr canvas edge layer to render graph-marked Strybldr workflow edges')
}

export function testStrybldrWorkspaceStructuredGraphFeedsStoryboardRenderers() {
  const demoName = 'knowgrph-strybldr-demo.md'
  const demoPath = path.resolve(process.cwd(), '../..', 'huijoohwee/docs', demoName)
  const text = fs.readFileSync(demoPath, 'utf8')
  const graph = parseWorkspaceStrybldrStoryboardGraphDataCached({
    markdownName: demoName,
    markdownText: text,
  })
  assert(graph, 'expected workspace structured parser to reuse the Strybldr parser graph')
  const metadata = (graph.metadata || {}) as Record<string, unknown>
  assert(String(graph.context || '') === 'strybldr-storyboard', `expected Strybldr context, got ${String(graph.context || '')}`)
  assert(String(metadata.kind || '') === 'strybldr-storyboard', `expected Strybldr graph kind, got ${String(metadata.kind || '')}`)
  assert(String(metadata.source || '') === `markdown:${demoName}`, `expected workspace markdown source metadata, got ${String(metadata.source || '')}`)
  assert((graph.nodes || []).length > 0, 'expected workspace Strybldr graph nodes for Storyboard renderer')
  const board = buildStoryboardBoardModel({ graphData: graph, graphRevision: 1 })
  assert(board.totalCards > 0, `expected workspace Strybldr graph to feed Storyboard/Strybldr board cards, got ${board.totalCards}`)

  const activeGraphHook = readSource('hooks', 'active-graph-data', 'useActiveGraphData.impl.ts')
  assert(activeGraphHook.includes('parseWorkspaceStrybldrStoryboardGraphDataCached'), 'expected active graph hook to reuse workspace Strybldr structured parser')
  assert(
    activeGraphHook.includes('if (workspaceStrybldrStoryboardGraphData) return workspaceStrybldrStoryboardGraphData'),
    'expected frontmatter-only renderers to prefer Strybldr storyboard graph over pending Markdown',
  )
}

export async function testStrybldrStoryboardParsesStrytreeStorytreeSnapshot() {
  const text = [
    '---',
    'kgStrybldrStoryboard: true',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "storyboard"',
    '---',
    '',
    '# Strytree fixture',
    '',
    '```json strybldr-storyboard',
    JSON.stringify({
      version: 1,
      runId: 'strytree-test',
      createdAtMs: 1,
      sources: [
        {
          sourceUnitId: 'strytree-contract',
          workspacePath: 'docs/documents/knowgrph-strytree-prd-tad.md',
          relativePath: 'knowgrph-strytree-prd-tad.md',
          originalName: 'Strytree contract',
          mediaKind: 'doc',
          mimeHint: 'text/markdown',
          byteSize: 0,
          textHash: 'contract',
          mediaUrl: 'docs/documents/knowgrph-strytree-prd-tad.md',
        },
      ],
      elements: [
        {
          id: 'element-ledger',
          sourceUnitId: 'strytree-contract',
          label: 'Server ledger quote',
          confidence: 1,
          evidenceKind: 'user-edit',
          provider: 'fallback',
          order: 1,
          summary: 'Quote generation cost before spend.',
          action: 'Keep credit state server-owned.',
          prompt: 'Prepare a provider-safe handoff.',
        },
      ],
      storytree: {
        storyId: 'story-test',
        title: 'Original Strytree fixture',
        tokenBalance: 120,
        generationCostCredits: 5,
        nodes: [
          {
            nodeId: 'root',
            title: 'Root branch',
            synopsis: 'A root branch opens the story universe.',
            status: 'hot',
            isFreeWindow: true,
            likes: 10,
            impressions: 100,
            ownAssetIds: ['root-asset'],
          },
          {
            nodeId: 'child',
            parentNodeId: 'root',
            title: 'Child branch',
            synopsis: 'A child branch derives its edge from parentNodeId.',
            status: 'locked',
            isProtected: true,
            unlockPriceCredits: 6,
            likes: 4,
            impressions: 20,
            paidUnlocks: 2,
            ownAssetIds: ['child-asset'],
          },
        ],
        candidateRuns: [
          {
            candidateRunId: 'candrun-root',
            parentNodeId: 'root',
            status: 'completed',
            maxCandidates: 2,
            quotedCostCredits: 10,
            scorecardMode: 'cost_continuity',
            candidates: [
              {
                candidateId: 'cand-a',
                title: 'Candidate A',
                synopsis: 'A private candidate that can be compared before publishing.',
                prompt: 'Continue with inherited visual continuity.',
                provider: 'local-harness',
                status: 'succeeded',
                creditCost: 5,
                elapsedMs: 42000,
                fallbackStatus: 'none',
                moderationStatus: 'approved',
                inheritedAssetCount: 1,
                continuityScore: 0.84,
                publishEligible: true,
              },
              {
                candidateId: 'cand-b',
                title: 'Candidate B',
                synopsis: 'A second candidate kept private until selected.',
                prompt: 'Continue with a sharper conflict.',
                provider: 'local-harness',
                status: 'succeeded',
                creditCost: 5,
                elapsedMs: 51000,
                fallbackStatus: 'fallback-preview',
                moderationStatus: 'approved',
                inheritedAssetCount: 1,
                continuityScore: 0.72,
                publishEligible: true,
              },
            ],
          },
        ],
      },
    }, null, 2),
    '```',
    '',
  ].join('\n')
  const parsed = await loadGraphDataFromTextViaParser('strytree.strybldr.md', text, { applyToStore: false })
  assert(parsed?.parserId === 'strybldr-storyboard', `expected strybldr parser, got ${parsed?.parserId}`)
  const graph = parsed.graphData
  const overview = (graph.nodes || []).find(node => String(node.type || '') === 'StorytreeSnapshot')
  assert(overview, 'expected Strytree overview node')
  assert(Number(overview.properties?.maxDepth || 0) === 1, `expected storytree runtime maxDepth, got ${String(overview.properties?.maxDepth || '')}`)
  assert(Number(overview.properties?.protectedBranchCount || 0) === 1, `expected protected branch count, got ${String(overview.properties?.protectedBranchCount || '')}`)
  const root = (graph.nodes || []).find(node => String(node.type || '') === 'StorytreeNode' && String(node.properties?.strytreeNodeId || '') === 'root')
  assert(root && Number(root.properties?.childBranchCount || 0) === 1, 'expected root branch to calculate childBranchCount')
  const child = (graph.nodes || []).find(node => String(node.type || '') === 'StorytreeNode' && String(node.properties?.parent_node_id || '') === 'root')
  assert(child, 'expected child node to preserve parent_node_id')
  assert(child.properties?.unlockRequired === true, 'expected child branch to calculate unlockRequired')
  assert(String(child.properties?.accessState || '') === 'unlock-ready', `expected child branch accessState, got ${String(child.properties?.accessState || '')}`)
  assert(Number(child.properties?.depth || -1) === 1, `expected child branch depth, got ${String(child.properties?.depth || '')}`)
  assert(Number(child.properties?.likeRate || 0) === 20, `expected child likeRate calculation, got ${String(child.properties?.likeRate || '')}`)
  assert(Number(child.properties?.projectedBalanceAfterUnlock || 0) === 114, `expected unlock balance projection, got ${String(child.properties?.projectedBalanceAfterUnlock || '')}`)
  assert(Array.isArray(child.properties?.inheritedAssetIds) && child.properties?.inheritedAssetIds.includes('root-asset'), 'expected child branch to inherit parent assets')
  assert((graph.edges || []).some(edge => edge.source === root.id && edge.target === child.id && edge.label === 'parent_node_id'), 'expected parent-derived storytree edge to connect root and child cards')
  const candidate = (graph.nodes || []).find(node => String(node.type || '') === 'StorytreeCandidate' && String(node.properties?.strytreeCandidateId || '') === 'cand-a')
  assert(candidate, 'expected ForkCompare candidate scorecard node')
  assert(Number(candidate.properties?.continuityScore || 0) === 0.84, `expected candidate continuity score, got ${String(candidate.properties?.continuityScore || '')}`)
  assert(candidate.properties?.publishEligible === true, 'expected candidate publish eligibility')
  assert((graph.edges || []).some(edge => edge.source === root.id && edge.target === candidate.id && edge.label === 'candidateOption'), 'expected candidate option edge from parent branch')
  assert(String((graph.metadata as Record<string, unknown>)?.strytreeStoryId || '') === 'story-test', 'expected storytree metadata')
  assert(Number((graph.metadata as Record<string, unknown>)?.strytreeCandidateRunsCount || 0) === 1, 'expected candidate run metadata')
  const board = buildStoryboardBoardModel({ graphData: graph, graphRevision: 1 })
  const storytreeLane = board.lanes.find(lane => lane.id === 'Storytree')
  assert(storytreeLane && storytreeLane.cards.some(card => card.title === 'Child branch'), `expected Strybldr board to expose Storytree lane cards, got ${JSON.stringify(board.lanes.map(lane => ({ id: lane.id, titles: lane.cards.map(card => card.title) })))}`)
  const forkCompareLane = board.lanes.find(lane => lane.id === 'ForkCompare')
  assert(forkCompareLane && forkCompareLane.cards.some(card => card.title === 'Candidate A'), 'expected Strybldr board to expose ForkCompare candidate cards')
  const handoff = buildStrybldrVideoHandoffFromGraphData(graph)
  assert(handoff.cards.some(card => card.lane === 'Storytree' && card.title === 'Child branch'), 'expected Run All handoff to include Storytree branch cards')
  assert(handoff.cards.some(card => card.lane === 'ForkCompare' && card.title === 'Candidate A'), 'expected Run All handoff to include ForkCompare candidate cards')
  assert(handoff.prompt.includes('approved Strybldr storyboard cards'), 'expected shared Strybldr handoff prompt')
}

export async function testStrybldrStorytreeWorkflowActionsMutateGraphState() {
  const text = [
    '---',
    'kgStrybldrStoryboard: true',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "storyboard"',
    '---',
    '',
    '```json strybldr-storyboard',
    JSON.stringify({
      version: 1,
      runId: 'strytree-workflow-test',
      createdAtMs: 1,
      sources: [
        {
          sourceUnitId: 'workflow-source',
          workspacePath: 'docs/documents/knowgrph-strytree-prd-tad.md',
          relativePath: 'knowgrph-strytree-prd-tad.md',
          originalName: 'Strytree workflow source',
          mediaKind: 'doc',
          mimeHint: 'text/markdown',
          byteSize: 0,
          textHash: 'workflow',
          mediaUrl: 'docs/documents/knowgrph-strytree-prd-tad.md',
        },
      ],
      elements: [],
      storytree: {
        storyId: 'workflow-story',
        title: 'Workflow story',
        tokenBalance: 12,
        generationCostCredits: 5,
        nodes: [
          {
            nodeId: 'root',
            title: 'Root branch',
            synopsis: 'Root branch.',
            status: 'active',
            isFreeWindow: true,
            likes: 1,
            impressions: 10,
            ownAssetIds: ['root-asset'],
          },
          {
            nodeId: 'locked-child',
            parentNodeId: 'root',
            title: 'Locked child',
            synopsis: 'Locked child branch.',
            status: 'locked',
            isProtected: true,
            unlockPriceCredits: 4,
            likes: 2,
            impressions: 20,
            ownAssetIds: ['child-asset'],
          },
        ],
      },
    }, null, 2),
    '```',
  ].join('\n')
  const parsed = await loadGraphDataFromTextViaParser('workflow.strybldr.md', text, { applyToStore: false })
  assert(parsed?.graphData, 'expected Strytree workflow graph')
  const root = (parsed.graphData.nodes || []).find(node => String(node.type || '') === 'StorytreeNode' && String(node.properties?.strytreeNodeId || '') === 'root')
  const child = (parsed.graphData.nodes || []).find(node => String(node.type || '') === 'StorytreeNode' && String(node.properties?.strytreeNodeId || '') === 'locked-child')
  assert(root?.id && child?.id, 'expected root and child storytree graph nodes')

  const liked = toggleStrytreeLikeAction(parsed.graphData, child.id)
  assert(liked.changed, 'expected like action to mutate graph')
  const likedChild = (liked.graphData.nodes || []).find(node => node.id === child.id)
  assert(likedChild?.properties?.likedByCurrentUser === true, 'expected branch to store local like state')
  assert(Number(likedChild?.properties?.likes || 0) === 3, `expected like count increment, got ${String(likedChild?.properties?.likes || '')}`)

  const unlocked = unlockStrytreeNodeAction(liked.graphData, child.id, 1000)
  assert(unlocked.changed, 'expected unlock action to mutate graph')
  const unlockedChild = (unlocked.graphData.nodes || []).find(node => node.id === child.id)
  const unlockedSnapshot = (unlocked.graphData.nodes || []).find(node => String(node.type || '') === 'StorytreeSnapshot')
  assert(String(unlockedChild?.properties?.accessState || '') === 'open', `expected unlock to open branch, got ${String(unlockedChild?.properties?.accessState || '')}`)
  assert(Number(unlockedSnapshot?.properties?.tokenBalance || 0) === 8, `expected unlock debit to update token balance, got ${String(unlockedSnapshot?.properties?.tokenBalance || '')}`)
  assert(Array.isArray(unlockedSnapshot?.properties?.strytreeLedgerEvents), 'expected unlock to append a ledger event')

  const drafted = createStrytreeContinuationDraftAction(unlocked.graphData, root.id, { prompt: 'Continue this branch safely.', nowMs: 2000 })
  assert(drafted.changed && drafted.createdNodeId, 'expected continuation action to create a draft child branch')
  const draftNode = (drafted.graphData.nodes || []).find(node => node.id === drafted.createdNodeId)
  const debitedSnapshot = (drafted.graphData.nodes || []).find(node => String(node.type || '') === 'StorytreeSnapshot')
  assert(String(draftNode?.type || '') === 'StorytreeNode', 'expected draft branch node')
  assert(String(draftNode?.properties?.strytreeStatus || '') === 'draft', 'expected draft branch status')
  assert(Array.isArray(draftNode?.properties?.inheritedAssetIds) && draftNode?.properties?.inheritedAssetIds.includes('root-asset'), 'expected draft branch to inherit parent assets')
  assert((drafted.graphData.edges || []).some(edge => edge.source === root.id && edge.target === drafted.createdNodeId && edge.label === 'parent_node_id'), 'expected draft edge to derive from parent branch')
  assert(Number(debitedSnapshot?.properties?.tokenBalance || 0) === 3, `expected generation debit to update token balance, got ${String(debitedSnapshot?.properties?.tokenBalance || '')}`)
  const handoff = buildStrybldrVideoHandoffFromGraphData(drafted.graphData)
  assert(handoff.cards.some(card => card.id === drafted.createdNodeId && card.lane === 'Storytree'), 'expected draft branch to feed Strybldr Run All')
}

export async function testStrybldrForkCompareCandidateWorkflowActions() {
  const text = [
    '---',
    'kgStrybldrStoryboard: true',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "storyboard"',
    '---',
    '',
    '```json strybldr-storyboard',
    JSON.stringify({
      version: 1,
      runId: 'forkcompare-workflow-test',
      createdAtMs: 1,
      sources: [
        {
          sourceUnitId: 'forkcompare-source',
          workspacePath: 'docs/documents/knowgrph-strytree-prd-tad.md',
          relativePath: 'knowgrph-strytree-prd-tad.md',
          originalName: 'Strytree ForkCompare source',
          mediaKind: 'doc',
          mimeHint: 'text/markdown',
          byteSize: 0,
          textHash: 'forkcompare',
          mediaUrl: 'docs/documents/knowgrph-strytree-prd-tad.md',
        },
      ],
      elements: [],
      storytree: {
        storyId: 'forkcompare-story',
        title: 'ForkCompare story',
        tokenBalance: 40,
        generationCostCredits: 5,
        nodes: [
          {
            nodeId: 'root',
            title: 'Root branch',
            synopsis: 'Root branch.',
            prompt: 'Continue with a bounded candidate comparison.',
            status: 'active',
            isFreeWindow: true,
            likes: 1,
            impressions: 10,
            ownAssetIds: ['root-asset'],
          },
        ],
      },
    }, null, 2),
    '```',
  ].join('\n')
  const parsed = await loadGraphDataFromTextViaParser('forkcompare.strybldr.md', text, { applyToStore: false })
  assert(parsed?.graphData, 'expected ForkCompare graph')
  const root = (parsed.graphData.nodes || []).find(node => String(node.type || '') === 'StorytreeNode' && String(node.properties?.strytreeNodeId || '') === 'root')
  assert(root?.id, 'expected root branch')

  const compared = createStrytreeCandidateRunAction(parsed.graphData, root.id, { nowMs: 3000 })
  assert(compared.changed, 'expected candidate run action to mutate graph')
  const candidates = (compared.graphData.nodes || []).filter(node => String(node.type || '') === 'StorytreeCandidate')
  assert(candidates.length === 3, `expected bounded fan-out of 3 candidates, got ${candidates.length}`)
  assert(candidates.every(node => node.properties?.publishEligible === true), 'expected all deterministic candidates to be publish eligible')
  assert((compared.graphData.edges || []).filter(edge => edge.label === 'candidateOption').length === 3, 'expected candidate option edges from parent branch')
  const debitedSnapshot = (compared.graphData.nodes || []).find(node => String(node.type || '') === 'StorytreeSnapshot')
  assert(Number(debitedSnapshot?.properties?.tokenBalance || 0) === 25, `expected candidate run debit to update token balance, got ${String(debitedSnapshot?.properties?.tokenBalance || '')}`)

  const published = publishStrytreeCandidateAction(compared.graphData, String(candidates[0]?.id || ''), 4000)
  assert(published.changed, 'expected candidate publish action to mutate graph')
  const publishedChild = (published.graphData.nodes || []).find(node => String(node.type || '') === 'StorytreeNode' && String(node.properties?.selectedCandidateId || '') === String(candidates[0]?.properties?.strytreeCandidateId || ''))
  assert(publishedChild, 'expected selected candidate to become one durable Storytree child')
  assert((published.graphData.edges || []).some(edge => edge.source === root.id && edge.target === publishedChild.id && edge.label === 'parent_node_id'), 'expected published candidate edge to derive from parent_node_id')
  const nextCandidates = (published.graphData.nodes || []).filter(node => String(node.type || '') === 'StorytreeCandidate')
  assert(nextCandidates.filter(node => String(node.properties?.candidateStatus || '') === 'published').length === 1, 'expected exactly one candidate to publish')
  assert(nextCandidates.filter(node => String(node.properties?.candidateStatus || '') === 'rejected').length === 2, 'expected rejected candidates to remain private audit artifacts')
}

export function testStrybldrRendererModeUsesSharedSurfaceRegistry() {
  const renderConfigText = readSource('lib', 'config.render.ts')
  const canvasViewportText = readSource('components', 'CanvasViewport.tsx')
  const storyboardCanvasText = readSource('components', 'StoryboardCanvas.tsx')
  const canvasViewMenuText = readSource('components', 'toolbar', 'canvasViewMenu.ts')
  const uiCopyText = readSource('lib', 'config-copy', 'uiCopy.ts')
  const strybldrStoryboardText = readSource('features', 'strybldr', 'strybldrStoryboard.ts')
  const importPresetsText = readSource('features', 'markdown-workspace', 'workspaceImport', 'canvasPresets.ts')
  const rendererDocText = fs.readFileSync(path.resolve(process.cwd(), '..', 'docs/documents/knowgrph-renderer-document.md'), 'utf8')
  const strybldrDocText = fs.readFileSync(path.resolve(process.cwd(), '..', 'docs/documents/knowgrph-strybldr-prd-tad.md'), 'utf8')
  const floatingPanelText = readSource('lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')
  const timelineVisibilityText = readSource('lib', 'timeline', 'timelineVisibility.ts')
  const timelineBottomPanelText = readSource('features', 'strybldr', 'StrybldrTimelineBottomPanel.tsx')
  const timelinePanelText = readSource('features', 'strybldr', 'StrybldrTimelinePanel.tsx')
  const storyboardTimelineText = readSource('components', 'StoryboardCanvas', 'storyboardTimeline.ts')
  const uiSliceInitialStateText = readSource('hooks', 'store', 'uiSliceInitialState.ts')
  const retiredRendererId = ['story', 'bldr'].join('')
  assert(resolveCanvas2dRendererId('strybldr') === undefined, 'expected Strybldr to be retired as a renderer id')
  assert(resolveCanvas2dRendererId(retiredRendererId) === undefined, 'expected no retired renderer remap')
  assert(resolveCanvas2dRendererId('storyboard') === 'storyboard', 'expected Storyboard to be the canonical Strybldr host renderer')
  const staleStorybldrText = ['story', 'bldr'].join('')
  for (const [label, text] of [
    ['renderer registry', renderConfigText],
    ['canvas view menu', canvasViewMenuText],
    ['ui copy', uiCopyText],
    ['strybldr markdown serializer', strybldrStoryboardText],
    ['workspace import presets', importPresetsText],
    ['renderer docs', rendererDocText],
    ['strybldr docs', strybldrDocText],
  ] as const) {
    assert(!new RegExp(staleStorybldrText, 'i').test(text), `expected ${label} to use storyboard, not stale storybldr naming`)
  }
  assert(!renderConfigText.includes('aliases:'), 'expected renderer registry to avoid per-renderer alias lists')
  assert(!renderConfigText.includes('CANVAS_2D_RENDERER_ID_BY_ALIAS'), 'expected renderer lookup to use canonical normalized tokens only')
  assert(getCanvas2dSurfaceId('storyboard') === 'storyboard', 'expected Storyboard to own the Strybldr-capable surface')
  assert(isStoryboardCanvas2dRenderer('storyboard'), 'expected shared Storyboard renderer helper to include Storyboard mode')
  assert(supportsToolbarRunAll('storyboard'), 'expected Storyboard to reuse Toolbar Run All dispatch')
  assert(getToolbarRunAllFloatingPanelTab('storyboard') === 'strybldr', 'expected Storyboard Run All to mount its Strybldr workflow consumer')
  assert(getToolbarRunAllFloatingPanelTab('flowEditor') === null, 'expected Flow Editor Run All to keep its always-mounted canvas runtime consumer')
  assert(supportsToolbarRunAll('flowEditor'), 'expected Flow Editor to keep Toolbar Run All dispatch')
  assert(!renderConfigText.includes("'strybldr',"), 'expected renderer registry to remove the Strybldr renderer id')
  assert(!renderConfigText.includes("registryLabel: 'Strybldr'"), 'expected renderer registry to remove the Strybldr renderer menu entry')
  assert(canvasViewportText.includes('StrybldrTimelineBottomPanelLazy'), 'expected Strybldr timeline to mount as the CanvasViewport bottom panel')
  assert(canvasViewportText.includes('workspaceEditorOverlayOpen={workspaceEditorOverlayOpen}'), 'expected Timeline bottom panel to receive Editor Workspace overlay state from CanvasViewport')
  assert(floatingPanelText.includes("floatingPanelView === 'timeline'"), 'expected Timeline to remain in the FloatingPanel view registry')
  assert(timelineVisibilityText.includes('TIMELINE_ENABLED_DEFAULT'), 'expected Timeline visibility default to live in shared timeline utils')
  assert(timelineVisibilityText.includes('shouldRenderTimelineSurface'), 'expected Timeline visibility gating to live in shared timeline utils')
  assert(timelineBottomPanelText.includes('HeaderActions'), 'expected Timeline bottom panel to reuse shared panel header actions')
  assert(timelineBottomPanelText.includes('onPinToggle={handlePinToggle}'), 'expected Timeline bottom panel to expose shared pin/unpin controls')
  assert(timelineBottomPanelText.includes('onMinimize={!minimized ? handleMinimize : undefined}'), 'expected Timeline bottom panel to reuse shared FloatingPanel minimize control')
  assert(timelineBottomPanelText.includes('onRestore={minimized ? handleRestore : undefined}'), 'expected Timeline bottom panel to reuse shared FloatingPanel restore control')
  assert(timelineBottomPanelText.includes('setTimelineEnabled(false)'), 'expected Timeline bottom panel close to update the shared Timeline setting')
  assert(timelineBottomPanelText.includes('beginOverlayPanelPositionDrag'), 'expected Timeline bottom panel drag to reuse the shared overlay panel drag utility')
  assert(timelineBottomPanelText.includes('UI_SELECTORS.draggablePanelIgnorePointerDown'), 'expected Timeline bottom panel drag to reuse shared no-drag heuristics')
  assert(timelineBottomPanelText.includes('data-kg-floating-panel-root="true"'), 'expected Timeline bottom panel to be excluded from FlowCanvas proxy-pan capture')
  assert(timelineBottomPanelText.includes('data-kg-strybldr-bottom-timeline-panel'), 'expected Timeline bottom panel to expose a bottom-panel marker')
  assert(timelineBottomPanelText.includes("import { WORKSPACE_LEFT_PANE_SELECTOR } from '@/lib/canvas/viewportMeasureElement'"), 'expected Timeline bottom panel to measure the shared Workspace left pane obstacle')
  assert(timelineBottomPanelText.includes('resolveWorkspaceCanvasLayerInsetLeft'), 'expected Timeline bottom panel to resolve canvas-only bounds from shared workspace geometry')
  assert(timelineBottomPanelText.includes('workspaceEditorOverlayOpen = false'), 'expected Timeline bottom panel to default workspace overlay bounds off')
  assert(timelineBottomPanelText.includes('data-kg-strybldr-bottom-timeline-root="canvas-viewport"'), 'expected Timeline bottom panel root to stay scoped to CanvasViewport')
  assert(timelineBottomPanelText.includes('data-kg-strybldr-bottom-timeline-layer="canvas-viewport"'), 'expected Timeline bottom panel layer to stay scoped to CanvasViewport')
  assert(timelineBottomPanelText.includes("className=\"absolute inset-0 z-[230] pointer-events-none\""), 'expected Timeline bottom panel layer to avoid fixed viewport overlay over Editor Workspace')
  assert(timelineBottomPanelText.includes("className=\"absolute inset-y-0 right-0 pointer-events-none\""), 'expected Timeline bottom panel bounds to occupy only the canvas-side strip when Editor Workspace is open')
  assert(timelineBottomPanelText.includes('style={layerStyle}'), 'expected Timeline bottom panel layer to apply measured workspace inset')
  assert(timelineBottomPanelText.includes("position: 'absolute' as const"), 'expected Timeline bottom panel geometry to be CanvasViewport-relative')
  assert(!timelineBottomPanelText.includes('className="fixed inset-0 z-[230] pointer-events-none"'), 'expected Timeline bottom panel to avoid viewport-fixed layer ownership')
  assert(timelinePanelText.includes('TimelineTransportControls'), 'expected Strybldr timeline panel to reuse the shared timeline transport control')
  assert(timelinePanelText.includes('useTimelineTransportPlayback'), 'expected Strybldr timeline panel to reuse the shared playback loop')
  assert(timelinePanelText.includes('buildStoryboardBoardModel'), 'expected Strybldr timeline panel to reuse the Storyboard board model')
  assert(timelinePanelText.includes('board.semanticKey'), 'expected Strybldr timeline state to reset from the shared Storyboard semantic key')
  assert(!timelinePanelText.includes('type="range"'), 'expected Strybldr timeline panel to avoid a local range input duplicate')
  assert(storyboardTimelineText.includes('buildStoryboardTimelineItems'), 'expected Storyboard timeline projection to live in a shared helper')
  assert(storyboardTimelineText.includes('resolveStoryboardTimelineIndex'), 'expected Strybldr selection to use shared timeline index semantics')
  assert(storyboardCanvasText.includes('toggleStrytreeLikeAction'), 'expected Strytree like parity to stay in the existing Storyboard surface')
  assert(storyboardCanvasText.includes('unlockStrytreeNodeAction'), 'expected Strytree unlock parity to stay in the existing Storyboard surface')
  assert(storyboardCanvasText.includes('createStrytreeContinuationDraftAction'), 'expected Strytree continuation parity to stay in the existing Storyboard surface')
  assert(storyboardCanvasText.includes('Storytree filter'), 'expected Strytree status filtering to stay in the existing Storyboard lane header')
  assert(storyboardCanvasText.includes('StorytreeEdgeConnector'), 'expected Storytree parent-child edge rendering to stay in the existing Storyboard surface')
  assert(storyboardCanvasText.includes('storytreeIncomingEdgeByCardId'), 'expected Storytree edge rendering to use active graph edges, not card hardcodes')
  assert(storyboardCanvasText.includes('data-kg-storytree-edge'), 'expected Storytree edge rendering to expose a validation marker')
  assert(storyboardCanvasText.includes('data-kg-storyboard-canvas-edge-layer'), 'expected Storyboard canvas to render visible graph edge layer between cards')
  assert(storyboardCanvasText.includes('candidateOption'), 'expected ForkCompare candidate option edges to use graph edges, not card hardcodes')
  assert(storyboardCanvasText.includes('ForkCompare scorecard'), 'expected ForkCompare scorecards to render in the existing Storyboard surface')
  assert(storyboardCanvasText.includes('createStrytreeCandidateRunAction'), 'expected ForkCompare fan-out action to stay in the Storyboard surface')
  assert(storyboardCanvasText.includes('publishStrytreeCandidateAction'), 'expected ForkCompare publish action to stay in the Storyboard surface')
  const strybldrPanelText = readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx')
  const strybldrCameraFloatingPanelText = readSource('features', 'strybldr', 'StrybldrCameraFloatingPanelView.tsx')
  const strybldrCameraPanelText = readSource('features', 'strybldr', 'StrybldrCameraPanel.tsx')
  const strybldrCameraModelText = readSource('features', 'strybldr', 'strybldrCamera.ts')
  const cameraOrbitSphereText = readSource('lib', 'camera', 'orbitSphere.ts')
  const toolbarMenuLauncherText = readSource('features', 'toolbar', 'ToolbarMenuLauncher.tsx')
  const canvasUtilsText = readSource('features', 'canvas', 'utils.ts')
  assert(strybldrPanelText.includes('Strybldr storytree workflow') && strybldrPanelText.includes("STRYBLDR_STORYTREE_ACTION_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-4'") && !strybldrPanelText.includes('grid grid-cols-4 gap-1'), 'expected Strytree workflow actions to be reachable from the active Strybldr panel with a mobile-first action grid owner')
  assert(strybldrPanelText.includes('Strybldr storytree filter'), 'expected Strytree filters to be reachable from the active Strybldr panel')
  assert(strybldrPanelText.includes('Strybldr ForkCompare candidates'), 'expected ForkCompare candidate run to be reachable from the active Strybldr panel')
  assert(!strybldrPanelText.includes('StrybldrCameraPanel') && !strybldrPanelText.includes('STRYBLDR_CAMERA_PROPERTY_KEY'), 'expected Strybldr FloatingPanel to omit duplicate Camera controls owned by the top-level Camera panel')
  assert(floatingPanelText.indexOf("{ view: 'view'") < floatingPanelText.indexOf("{ view: 'camera'"), 'expected FloatingPanel Camera to sit immediately to the right of View in the primary view registry')
  assert(floatingPanelText.includes("floatingPanelView === 'camera'") && floatingPanelText.includes('StrybldrCameraFloatingPanelViewLazy'), 'expected FloatingPanel Camera to render as a top-level panel view')
  assert(toolbarMenuLauncherText.includes("tab === 'camera'") && canvasUtilsText.includes("'view' | 'camera' | 'chat'"), 'expected shared FloatingPanel open bridge to support the top-level Camera view')
  assert(uiSliceInitialStateText.includes("view === 'camera'"), 'expected store-level FloatingPanel view guard to allow the top-level Camera view')
  assert(strybldrCameraFloatingPanelText.includes('aria-label="Camera panel"') && strybldrCameraFloatingPanelText.includes('StrybldrCameraPanel') && strybldrCameraFloatingPanelText.includes('STRYBLDR_CAMERA_PROPERTY_KEY'), 'expected top-level Camera panel to reuse the Strybldr camera owner and persist graph metadata')
  assert(strybldrCameraModelText.includes('Left Side') && strybldrCameraModelText.includes('Right Side') && strybldrCameraModelText.includes('Eye Level') && strybldrCameraModelText.includes('Wide') && strybldrCameraModelText.includes('Medium') && strybldrCameraModelText.includes('Close-up'), 'expected Camera model to own side, eye-level, and shot-size labels')
  assert(strybldrCameraModelText.includes('resolveStrybldrCameraOrbit') && strybldrCameraModelText.includes('orbitX') && strybldrCameraModelText.includes('orbitY'), 'expected Camera model to own reusable orbit-to-label mapping')
  assert(strybldrCameraPanelText.includes('Strybldr camera orbit sphere') && strybldrCameraPanelText.includes('onPointerDown') && strybldrCameraPanelText.includes('setPointerCapture') && strybldrCameraPanelText.includes('onPointerMove'), 'expected Camera preview to support dragging the camera around the sphere')
  assert(strybldrCameraPanelText.includes('role="tablist"') && strybldrCameraPanelText.includes('role="tab"') && strybldrCameraPanelText.includes('aria-selected={selected}') && strybldrCameraPanelText.includes('data-kg-strybldr-camera-shot-tabs'), 'expected Camera Wide/Medium/Close-up control to use Boords-like tab semantics')
  assert(strybldrCameraPanelText.includes('data-kg-strybldr-camera-selected-overlay="1"') && strybldrCameraPanelText.includes('clipPath: `inset(0 ${rightClipPercent}% 0 ${leftClipPercent}% round 6px)`') && strybldrCameraPanelText.includes("transition: 'clip-path 150ms ease-out'"), 'expected Camera shot-size selected state to use a clipped overlay highlight')
  assert(strybldrCameraPanelText.includes('STRYBLDR_CAMERA_SHOT_FRAMES') && strybldrCameraPanelText.includes('x: 99.25') && strybldrCameraPanelText.includes('y: 97.078125') && strybldrCameraPanelText.includes('width: 81.5') && strybldrCameraPanelText.includes('height: 45.84375'), 'expected Camera Medium shot to own the Boords-like SVG image frame geometry')
  assert(strybldrCameraPanelText.includes('data-kg-strybldr-camera-shot-frame={shot}') && strybldrCameraPanelText.includes('shot={draft.shot}') && !strybldrCameraPanelText.includes('const STRYBLDR_CAMERA_FRAME ='), 'expected Camera shot-size selection to drive the sphere image frame without a stale fixed frame constant')
  assert(!strybldrCameraPanelText.includes('text-type-subdued') && !strybldrCameraPanelText.includes('bg-surface-add_frame') && !strybldrCameraPanelText.includes('bg-surface-light'), 'expected Camera shot-size parity to stay repo-native without copying Boords class names')
  assert(strybldrCameraPanelText.includes('STRYBLDR_CAMERA_HANDLE_BODY_RECT') && strybldrCameraPanelText.includes('isPointOnStrybldrCameraHandle') && strybldrCameraPanelText.indexOf('if (!isPointOnStrybldrCameraHandle(point, draft)) return') < strybldrCameraPanelText.indexOf('event.currentTarget.setPointerCapture(event.pointerId)'), 'expected Camera dragging to start from the black camera handle rather than whole-sphere click repositioning')
  assert(strybldrCameraPanelText.includes('dragOffsetRef') && strybldrCameraPanelText.includes('point.x - pose.cameraX') && strybldrCameraPanelText.includes('resolveCameraOrbitSphereGridPointFromRenderedPoint') && !strybldrCameraPanelText.includes('Math.min(rect.width, rect.height) * 0.42'), 'expected Camera drag math to preserve the handle offset and resolve from rendered degree-grid points instead of stale DOM-radius pointer mapping')
  assert(strybldrCameraPanelText.indexOf('if (draggingCamera) setDraftFromPreviewPoint(event.clientX, event.clientY)') < strybldrCameraPanelText.indexOf('dragOffsetRef.current = { x: 0, y: 0 }'), 'expected Camera pointer-up to commit the final rendered degree-grid target before clearing drag state')
  assert(cameraOrbitSphereText.includes('Math.atan2(ray.rayLookTargetY - cameraPoint.cameraY, ray.rayLookTargetX - cameraPoint.cameraX) * 180 / Math.PI'), 'expected Camera glyph rotation to point from the degree-grid camera handle toward the storyboard frame center')
  assert(strybldrCameraPanelText.includes('data-kg-strybldr-camera-handle-body="1"') && strybldrCameraPanelText.includes('x: -7') && strybldrCameraPanelText.includes('width: 11') && strybldrCameraPanelText.includes('radius: 1.5'), 'expected Camera body handle to preserve the Boords-like black rect geometry')
  assert(strybldrCameraPanelText.includes('StrybldrCameraSphereGraphic') && strybldrCameraPanelText.includes('viewBox="0 0 280 240"') && strybldrCameraPanelText.includes('<linearGradient') && strybldrCameraPanelText.includes('<polygon') && strybldrCameraPanelText.includes('active:cursor-grabbing'), 'expected Camera preview to render a Boords-like 3D sphere grid with camera ray fidelity, not a flat 2D circle')
  assert(!strybldrCameraPanelText.includes('<clipPath') && strybldrCameraPanelText.indexOf('<image') < strybldrCameraPanelText.indexOf('<polygon'), 'expected Camera SVG child ordering to mirror the live Boords reference without stale clip-path layering')
  assert(strybldrCameraPanelText.includes("from '@/lib/camera/orbitSphere'") && cameraOrbitSphereText.includes('resolveCameraOrbitFrameAwarePoint') && cameraOrbitSphereText.includes('isPointWithinCameraOrbitRect({ x: cameraPoint.cameraX, y: cameraPoint.cameraY }, frame)') && strybldrCameraPanelText.includes('clearance: STRYBLDR_CAMERA_HANDLE_BODY_RECT.height * 0.36') && cameraOrbitSphereText.includes('rotation: Math.atan2(ray.rayLookTargetY - cameraPoint.cameraY, ray.rayLookTargetX - cameraPoint.cameraX) * 180 / Math.PI') && !strybldrCameraPanelText.includes('STRYBLDR_CAMERA_FRONT_EYE_LEVEL_CAMERA_POINT') && !strybldrCameraPanelText.includes('STRYBLDR_CAMERA_FRONT_EYE_LEVEL_CAMERA_POSE'), 'expected Camera handle point to be frame-aware from shared degree-grid geometry without a front eye-level hardcode')
  assert(cameraOrbitSphereText.includes('resolveCameraOrbitFrameRay') && cameraOrbitSphereText.includes('resolveCameraOrbitFrameRayTarget(cameraPoint, frame, options.projection)') && cameraOrbitSphereText.includes('resolveCameraOrbitFrameRayDirection') && cameraOrbitSphereText.includes('orbitVectorZ * depthPitchRatio') && cameraOrbitSphereText.includes('resolveCameraOrbitFrameRayFootprint') && cameraOrbitSphereText.includes('rayEdgeStartX') && cameraOrbitSphereText.includes('rayEdgeEndY') && !cameraOrbitSphereText.includes('resolveCameraOrbitFrameEdgePoints'), 'expected Camera ray to target the storyboard frame from shared 3D orbit-vector geometry with a clamped polygon footprint')
  assert(cameraOrbitSphereText.includes('resolveCameraOrbitSmoothPath') && cameraOrbitSphereText.includes('pathD: resolveCameraOrbitSmoothPath(meridianPoints)') && cameraOrbitSphereText.includes('const vector = resolveCameraOrbitSphereVectorFromGridPoint(gridPoint)') && cameraOrbitSphereText.includes('cameraX: config.centerX + latitudeGeometry.rx * Math.sin(longitudeRadians)') && cameraOrbitSphereText.includes('cameraY: latitudeGeometry.cy + latitudeGeometry.ry * Math.cos(longitudeRadians)') && !cameraOrbitSphereText.includes('Math.sqrt(Math.max(0, 1 - yProgress ** 2))'), 'expected Camera meridians, handle positions, and ray vectors to share the tuned degree-grid latitude ellipse intersections')
  assert(strybldrCameraPanelText.includes('STRYBLDR_CAMERA_SPHERE_LATITUDE_ROWS') && strybldrCameraPanelText.includes('STRYBLDR_CAMERA_SPHERE_LATITUDE_DEGREES = [-90, -45, 0, 45, 90]') && strybldrCameraPanelText.includes('resolveCameraOrbitSphereGridHighlight(STRYBLDR_CAMERA_ORBIT_SPHERE_CONFIG, orbitX, orbitY)') && strybldrCameraPanelText.includes('data-kg-strybldr-camera-grid-latitude={row.degree}') && strybldrCameraPanelText.includes("data-kg-strybldr-camera-grid-active={active ? '1' : undefined}"), 'expected Camera sphere grid to preserve the tuned five-band latitude geometry with degree-based highlight behavior')
  assert(strybldrCameraPanelText.includes('STRYBLDR_CAMERA_SPHERE_ACTIVE_STROKE_OPACITY') && strybldrCameraPanelText.includes('activeLatitudeGeometry') && strybldrCameraPanelText.includes('data-kg-strybldr-camera-grid-active-latitude={activeLatitudeGeometry.degree}') && !strybldrCameraPanelText.includes('cx="140" cy="120" rx="82" ry="16.400000000000002" opacity="0.58"'), 'expected Camera sphere highlight overlay to follow the active latitude degree instead of hardcoding the center row')
  assert(strybldrCameraPanelText.includes('STRYBLDR_CAMERA_SPHERE_LONGITUDE_DEGREES = [0, 45, 90, 135, 180, 225, 270, 315]') && strybldrCameraPanelText.includes('STRYBLDR_CAMERA_ORBIT_LONGITUDE_SPAN_DEGREES = 180') && cameraOrbitSphereText.includes('resolveCameraOrbitSphereGridPoints') && strybldrCameraPanelText.includes('resolveCameraOrbitSphereGridMeridianGeometry(STRYBLDR_CAMERA_ORBIT_SPHERE_CONFIG, longitude)') && cameraOrbitSphereText.includes('resolveCameraOrbitSpherePointFromGridPoint(config, gridPoint)') && strybldrCameraPanelText.includes('resolveCameraOrbitSphereOrbitFromGridPoint(STRYBLDR_CAMERA_ORBIT_SPHERE_CONFIG, gridPoint)') && cameraOrbitSphereText.includes('normalizeCameraOrbitDegrees(orbitX * config.longitudeSpanDegrees)') && cameraOrbitSphereText.includes('signedLongitude / config.longitudeSpanDegrees') && cameraOrbitSphereText.includes('sweepFlag: normalizedLongitude > 180 ? 0 : 1') && strybldrCameraPanelText.includes('data-kg-strybldr-camera-grid-longitude={longitude}') && strybldrCameraPanelText.includes('data-kg-strybldr-camera-grid-active-meridian={activeMeridianGeometry.longitude}') && strybldrCameraPanelText.includes('STRYBLDR_CAMERA_SPHERE_ACTIVE_MERIDIAN_OPACITY') && !strybldrCameraPanelText.includes('normalizeStrybldrCameraDegrees(orbitX * 90)') && !strybldrCameraPanelText.includes('<line x1="140" y1="38" x2="140" y2="202" opacity="0.68"'), 'expected Camera active meridian highlight and draggable handle to round-trip the full degree-grid longitude span from shared geometry')
  assert(strybldrCameraPanelText.includes('aria-label="Strybldr camera preview"') && !strybldrCameraPanelText.includes("cn('rounded-md border p-2'") && !strybldrCameraPanelText.includes('<span className={UI_THEME_TOKENS.text.tertiary}>Camera</span>'), 'expected Camera preview wrapper to avoid a duplicate inner frame and duplicate Camera angle heading around the orbit sphere')
  assert(strybldrCameraPanelText.includes('<image') && strybldrCameraPanelText.includes('xlinkHref={previewImageUrl}') && strybldrCameraPanelText.includes('preserveAspectRatio="xMidYMid slice"'), 'expected Camera sphere frame to render the selected storyboard card preview image via SVG image semantics')
  assert(strybldrCameraFloatingPanelText.includes('resolveStrybldrCameraPreviewImageUrl') && strybldrCameraFloatingPanelText.includes('media?.thumbnailUrl') && strybldrCameraFloatingPanelText.includes("reference.kind === 'image'"), 'expected top-level Camera owner to source preview images from storyboard media and image references')
  assert(strybldrCameraPanelText.includes('Add a note (optional)') && strybldrCameraPanelText.includes('Reframe') && strybldrCameraPanelText.includes('data-kg-strybldr-camera-panel="1"'), 'expected Camera panel to expose note and Reframe controls with a validation marker')
  assert(strybldrCameraModelText.includes("STRYBLDR_CAMERA_PROPERTY_KEY = 'strybldrCamera'") && strybldrStoryboardText.includes('buildStrybldrCameraHandoffLine'), 'expected Camera metadata to stay graph-owned and feed the Strybldr video handoff compiler')
  const draggedCameraOrbit = resolveStrybldrCameraOrbit(-0.66, -0.44)
  assert(draggedCameraOrbit.angle === 'left-side' && draggedCameraOrbit.level === 'high-angle' && draggedCameraOrbit.orbitX === -0.66 && draggedCameraOrbit.orbitY === -0.44, 'expected Camera orbit drag to resolve left-side high-angle framing')
  const rightCameraSettings = readStrybldrCameraSettings({ angle: 'right-side', level: 'low-angle', shot: 'medium' })
  assert(rightCameraSettings.orbitX === 0.25 && rightCameraSettings.orbitY === 0.5, 'expected saved right-side low-angle settings to hydrate onto the 45-degree longitude grid')
  const testCameraOrbitConfig: CameraOrbitSphereConfig<0 | 45 | 90 | 135 | 180 | 225 | 270 | 315, -90 | -45 | 0 | 45 | 90> = {
    centerX: 140,
    centerY: 120,
    radius: 82,
    longitudeSpanDegrees: 180,
    longitudeDegrees: [0, 45, 90, 135, 180, 225, 270, 315],
    latitudeDegrees: [-90, -45, 0, 45, 90],
    latitudeRows: [
      { degree: -90, key: 'bottom-pole', cy: 187.53994388482693, rx: 43.4533796671228, ry: 8.690675933424561 },
      { degree: -45, key: 'bottom', cy: 161, rx: 71.01408311032398, ry: 14.202816622064796 },
      { degree: 0, key: 'equator', cy: 120, rx: 82, ry: 16.400000000000002 },
      { degree: 45, key: 'upper', cy: 80.25, rx: 71.01408311032398, ry: 14.202816622064796 },
      { degree: 90, key: 'top', cy: 52.460056115173074, rx: 43.4533796671228, ry: 8.690675933424561 },
    ],
  }
  const frontEyeLevelPoint = resolveCameraOrbitSpherePointFromGridPoint(testCameraOrbitConfig, { longitude: 0, latitude: 0 })
  assert(Math.abs(frontEyeLevelPoint.cameraX - 140) < 0.001 && Math.abs(frontEyeLevelPoint.cameraY - 136.4) < 0.001, 'expected front eye-level camera point to intersect the equator latitude ellipse at longitude zero')
  assert(Math.abs(frontEyeLevelPoint.orbitVectorX) < 0.001 && Math.abs(frontEyeLevelPoint.orbitVectorY) < 0.001 && Math.abs(frontEyeLevelPoint.orbitVectorZ - 1) < 0.001, 'expected front eye-level ray vector to keep the camera on the 3D meridian origin')
  const rightLowAnglePoint = resolveCameraOrbitSpherePointFromGridPoint(testCameraOrbitConfig, { longitude: 45, latitude: -45 })
  assert(Math.abs(rightLowAnglePoint.cameraX - 190.214) < 0.001 && Math.abs(rightLowAnglePoint.cameraY - 171.043) < 0.001, 'expected diagonal camera point to intersect both longitude 45 and latitude -45 without row-center offset')
  assert(Math.abs(rightLowAnglePoint.orbitVectorX - 0.5) < 0.001 && Math.abs(rightLowAnglePoint.orbitVectorY + 0.707) < 0.001 && Math.abs(rightLowAnglePoint.orbitVectorZ - 0.5) < 0.001, 'expected diagonal ray vector to preserve longitude, latitude, and depth instead of reusing the flat SVG offset')
  const rightMeridian = resolveCameraOrbitSphereGridMeridianGeometry(testCameraOrbitConfig, 45)
  assert(rightMeridian.kind === 'curve' && rightMeridian.pathD.includes(`${rightLowAnglePoint.cameraX.toFixed(3)} ${rightLowAnglePoint.cameraY.toFixed(3)}`), 'expected active meridian curve to pass through the rendered diagonal latitude intersection')
  const mediumFrame = { x: 99.25, y: 97.078125, width: 81.5, height: 45.84375 }
  const frontEyeLevelRay = resolveCameraOrbitFrameRay(frontEyeLevelPoint, mediumFrame)
  const frontRayWidth = frontEyeLevelRay.rayEdgeEndX - frontEyeLevelRay.rayEdgeStartX
  assert(Math.abs(frontEyeLevelRay.rayTargetX - 140) < 0.001 && Math.abs(frontEyeLevelRay.rayTargetY - (mediumFrame.y + mediumFrame.height)) < 0.001 && frontRayWidth > mediumFrame.width * 0.4 && frontRayWidth < mediumFrame.width * 0.5, 'expected meridian-zero ray polygon to stay centered and clamped instead of spanning the full frame edge')
  const rightLowRay = resolveCameraOrbitFrameRay(rightLowAnglePoint, mediumFrame)
  assert(rightLowRay.rayTargetX > 152 && rightLowRay.rayTargetX < 153 && Math.abs(rightLowRay.rayTargetY - (mediumFrame.y + mediumFrame.height)) < 0.001, 'expected lower-right diagonal ray to intersect the bottom frame edge from the shared 3D longitude-latitude vector')
  const leftHighAnglePoint = resolveCameraOrbitSpherePointFromGridPoint(testCameraOrbitConfig, { longitude: 315, latitude: 45 })
  const leftHighRay = resolveCameraOrbitFrameRay(leftHighAnglePoint, mediumFrame)
  assert(leftHighRay.rayTargetX > 116 && leftHighRay.rayTargetX < 117 && Math.abs(leftHighRay.rayTargetY - mediumFrame.y) < 0.001 && Math.abs(leftHighRay.rayEdgeStartY - mediumFrame.y) < 0.001 && Math.abs(leftHighRay.rayEdgeEndY - mediumFrame.y) < 0.001, 'expected upper-left diagonal ray polygon to intersect the top frame edge from the shared 3D longitude-latitude vector')
}

export function testStrybldrImportImageAndFloatingPanelOwnersAreWired() {
  const launchText = readSource('lib', 'toolbar', 'LaunchDropdown.impl.tsx')
  const bridgeText = readSource('features', 'markdown-explorer', 'workspaceActionBridge.ts')
  const actionsText = readSource('features', 'markdown-workspace', 'useWorkspaceFileActions', 'importActions.ts')
  const canvasPresetsText = readSource('features', 'markdown-workspace', 'workspaceImport', 'canvasPresets.ts')
  const urlImportText = readSource('features', 'markdown-workspace', 'workspaceImport', 'urlImport.ts')
  const floatingPanelText = readSource('lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')
  const fallbackText = readSource('features', 'toolbar', 'launchDropdownFallbacks.ts')
  const imageBridgeText = readSource('lib', 'toolbar', 'launchImageImportBridge.ts')

  assert(launchText.includes('Import Image'), 'expected Launch dropdown to expose Import Image')
  assert(launchText.includes('importLocalImages'), 'expected Launch dropdown to use the workspace image import bridge')
  assert(launchText.includes('importLocalImagesWithWorkspaceBridgeRetry'), 'expected Launch dropdown to reuse the image-import bridge retry helper')
  assert(imageBridgeText.includes("setWorkspaceViewMode('editor')"), 'expected Launch image import to mount Workspace before retrying the workspace bridge')
  assert(imageBridgeText.includes('launch:import:localImages:bridge'), 'expected Launch image import to surface a bridge retry warning only after workspace-open retry fails')
  assert(bridgeText.includes('importLocalImages'), 'expected workspace action bridge to expose image import')
  assert(actionsText.includes('buildStrybldrStoryboardDocument'), 'expected image import to generate Strybldr storyboard document through the feature owner')
  assert(actionsText.includes('activateStrybldrImportSurface'), 'expected image import to switch to Storyboard mode through the shared import-surface owner')
  assert(actionsText.includes('storyPath || createdPath'), 'expected image import focus to land on the generated Strybldr artifact, not a raw image source file')
  assert(canvasPresetsText.includes("'storyboard'"), 'expected Import URL renderer presets to expose Storyboard without a Strybldr renderer alias')
  assert(!canvasPresetsText.includes("'strybldr'"), 'expected Import URL renderer presets to remove the Strybldr renderer option')
  assert(urlImportText.includes("args.canvas2dRenderer === 'storyboard'"), 'expected URL import to create Strybldr storyboard documents through the workspace import owner')
  assert(actionsText.includes("selectedCanvas2dRenderer === 'storyboard'"), 'expected renderer-selected URL import to activate the Strybldr surface')
  assert(!fallbackText.includes(`importLocalImages${'Fallback'}`), 'expected no duplicate image import fallback outside workspace owner')
  assert(floatingPanelText.includes('StrybldrFloatingPanelView'), 'expected Floating Panel to render the Strybldr owner view')
  assert(floatingPanelText.includes("view: 'strybldr'"), 'expected Floating Panel view registry to include Strybldr')
  assert(actionsText.includes('registerStrybldrImageFiles'), 'expected image import to register selected image Files for same-session local analysis')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('availableSourceUnitIds'), 'expected local analysis to address every registered imported image')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('Save card update'), 'expected Strybldr panel to expose the user update gate before generation')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('useActiveGraphRenderData(true)'), 'expected Strybldr panel Run All to reuse the active renderer graph projection')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('const graphData = activeGraphData || rawGraphData'), 'expected Strybldr panel to fall back to raw graph only when no active document graph exists')
  assert(readSource('components', 'Toolbar.tsx').includes('supportsToolbarRunAll'), 'expected toolbar Run All support to use the shared renderer helper')
  assert(readSource('components', 'Toolbar.tsx').includes('getToolbarRunAllFloatingPanelTab'), 'expected toolbar Run All panel mount to use the shared renderer helper')
  assert(readSource('components', 'Toolbar.tsx').includes('TOOLBAR_RUN_ALL_PANEL_RETRY_DELAY_MS'), 'expected toolbar Run All to retry after lazy Strybldr panel mount')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('WORKFLOW_RUN_ALL_EVENT'), 'expected Strybldr panel to consume the shared Run All event')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('STRYBLDR_RUN_ALL_DEDUPE_WINDOW_MS'), 'expected Strybldr panel to dedupe toolbar Run All retry events')
  assert(!readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes("canvas2dRenderer !== 'storyboard'"), 'expected mounted Strybldr panel to keep its Run All event consumer registered')
}

export async function testStrybldrVideoHandoffReusesBytePlusOwnerWithFallbackArtifact() {
  const doc = buildStrybldrStoryboardDocument({
    createdAtMs: 1,
    sourceUnits: [
      {
        id: 'corpus-source-video',
        workspacePath: '/reference.png.source.md',
        relativePath: 'reference.png',
        originalName: 'reference.png',
        mediaKind: 'image',
        mimeHint: 'image/png',
        byteSize: 256,
        textHash: 'def456',
        status: 'unsupported',
        provenance: { importMode: 'file', importedAtMs: 1 },
      },
    ],
    elements: [
      {
        id: 'approved-card',
        sourceUnitId: 'corpus-source-video',
        label: 'Hero product',
        confidence: 0.9,
        sourceBox: { xmin: 0.2, ymin: 0.2, xmax: 0.8, ymax: 0.8, unit: 'percentage' },
        evidenceKind: 'user-edit',
        provider: 'fallback',
        order: 2,
        summary: 'Approved edited product card.',
        action: 'Pan in slowly.',
        prompt: 'Create a premium product reveal.',
      },
    ],
  })
  const parsed = await loadGraphDataFromTextViaParser('reference.strybldr.md', serializeStrybldrStoryboardMarkdown(doc), { applyToStore: false })
  const graphWithCamera = parsed?.graphData
    ? {
      ...parsed.graphData,
      nodes: (parsed.graphData.nodes || []).map(node => node.id === 'approved-card'
        ? {
          ...node,
          properties: {
            ...(node.properties || {}),
            [STRYBLDR_CAMERA_PROPERTY_KEY]: serializeStrybldrCameraSettings({
              angle: 'front',
              level: 'eye-level',
              shot: 'close-up',
              note: 'Keep lens stable.',
            }),
          },
        }
        : node),
    }
    : null
  const handoff = buildStrybldrVideoHandoffFromGraphData(graphWithCamera)
  const markdown = buildStrybldrVideoHandoffMarkdown({
    handoff,
    status: 'fallback',
    provider: 'byteplus-modelark',
    errorReason: 'test fallback',
    elapsedMs: 42,
    paidCallCount: 0,
  })
  const panelText = readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx')
  assert(handoff.prompt.includes('Approved edited product card.'), 'expected handoff prompt to read updated graph card text')
  assert(handoff.prompt.includes('Camera: Front · Eye Level · Close-up · Keep lens stable.'), 'expected handoff prompt to include saved Strybldr camera metadata')
  assert(handoff.cards.some(card => card.camera === 'Camera: Front · Eye Level · Close-up · Keep lens stable.'), 'expected handoff card to preserve camera settings as data')
  assert(handoff.cards.some(card => card.sourceUnitId === 'corpus-source-video'), 'expected handoff cards to preserve source-unit provenance')
  assert(markdown.includes('kgStrybldrVideoHandoff: true'), 'expected fallback artifact frontmatter')
  assert(markdown.includes('paidCallCount: 0'), 'expected handoff cost evidence')
  assert(panelText.includes('generateRunVideoWithBytePlus'), 'expected Strybldr panel to reuse the BytePlus video owner')
  assert(panelText.includes('runStrybldrProviderWithTimeout'), 'expected Strybldr Run All to bound external provider calls before writing fallback')
  assert(panelText.includes('notifyWorkspaceFsChanged'), 'expected Strybldr handoff artifacts to refresh Source Files')
  assert(panelText.includes('buildStrybldrVideoHandoffMarkdown'), 'expected Strybldr panel to write structured fallback artifacts')

  const twoSourceDoc = buildStrybldrStoryboardDocument({
    createdAtMs: 1,
    sourceUnits: [
      {
        id: 'corpus-source-merge-a',
        workspacePath: '/merge-a.png.source.md',
        relativePath: 'merge-a.png',
        originalName: 'merge-a.png',
        mediaKind: 'image',
        mimeHint: 'image/png',
        byteSize: 128,
        textHash: 'merge-a',
        status: 'unsupported',
        provenance: { importMode: 'file', importedAtMs: 1 },
      },
      {
        id: 'corpus-source-merge-b',
        workspacePath: '/merge-b.png.source.md',
        relativePath: 'merge-b.png',
        originalName: 'merge-b.png',
        mediaKind: 'image',
        mimeHint: 'image/png',
        byteSize: 128,
        textHash: 'merge-b',
        status: 'unsupported',
        provenance: { importMode: 'file', importedAtMs: 1 },
      },
    ],
  })
  const twoSourceParsed = await loadGraphDataFromTextViaParser('merge.strybldr.md', serializeStrybldrStoryboardMarkdown(twoSourceDoc), { applyToStore: false })
  assert(twoSourceParsed?.graphData, 'expected two-source Strybldr graph for merge regression')
  const merged = mergeStrybldrElementsIntoGraphData({
    graphData: twoSourceParsed.graphData,
    elements: [
      {
        id: 'merge-detected-a',
        sourceUnitId: 'corpus-source-merge-a',
        label: 'Detected cart',
        confidence: 0.8,
        sourceBox: { xmin: 0.1, ymin: 0.2, xmax: 0.5, ymax: 0.6, unit: 'percentage' },
        evidenceKind: 'local-object-detection',
        provider: 'transformers-detr',
        order: 2,
        summary: 'Detected cart from local analysis.',
        action: 'Animate the cart.',
        prompt: 'Move the cart through the frame.',
      },
    ],
  })
  const mergedElementNodes = (merged.nodes || []).filter(node => String(node.type || '') === 'StoryboardElement')
  assert(mergedElementNodes.some(node => String(node.properties?.strybldrSourceUnitId || '') === 'corpus-source-merge-a' && String(node.properties?.evidenceKind || '') === 'local-object-detection'), 'expected analyzed source to receive local detection cards')
  assert(mergedElementNodes.some(node => String(node.properties?.strybldrSourceUnitId || '') === 'corpus-source-merge-b' && String(node.properties?.evidenceKind || '') === 'source-metadata'), 'expected local analysis merge to preserve fallback cards for un-analyzed sources')
}

export async function testStrybldrVideoHandoffKeepsProviderBackedRecreationReachable() {
  const panelText = readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx')
  const renderUrl = '/__chat_asset_proxy/strybldr-generated-video.mp4'
  const sourceUrl = ['https://assets.example.test', '/strybldr-generated-video.mp4'].join('')
  const generatedMarkdown = buildStrybldrVideoHandoffMarkdown({
    handoff: {
      prompt: 'Create one approved generated video.',
      referenceImageUrl: null,
      cards: [
        {
          id: 'generated-card',
          lane: 'Elements',
          title: 'Generated card',
          summary: 'Approved generated summary.',
          action: 'Render the edited beat.',
          prompt: 'Use the approved card fields.',
          camera: '',
          references: [],
          order: 1,
          sourceUnitId: 'generated-source',
        },
      ],
    },
    status: 'generated',
    provider: 'byteplus-modelark',
    model: 'video-model',
    renderUrl,
    sourceUrl,
    elapsedMs: 1234,
    paidCallCount: 1,
    cacheHit: false,
  })
  assert(BYTEPLUS_VIDEO_POLL_BOUNDED_WINDOW_MS >= 200000, `expected BytePlus video owner to expose a real task polling window, got ${BYTEPLUS_VIDEO_POLL_BOUNDED_WINDOW_MS}`)
  assert(panelText.includes('BYTEPLUS_VIDEO_POLL_BOUNDED_WINDOW_MS'), 'expected Strybldr video handoff to reuse the BytePlus bounded polling window')
  assert(panelText.includes('BYTEPLUS_VIDEO_POLL_BOUNDED_WINDOW_MS + 60000'), 'expected Strybldr handoff timeout to include task polling plus asset download slack')
  assert(!panelText.includes('VIDEO_HANDOFF_PROVIDER_TIMEOUT_MS = 6000'), 'expected Strybldr handoff not to force legitimate provider runs into fallback after six seconds')
  assert(panelText.includes("artifactProvider = 'knowgrph-local-animatic'"), 'expected unconfigured Strybldr runs to generate a local animatic instead of a fallback-only handoff')
  assert(panelText.includes("model = 'strybldr-local-animatic-v1'"), 'expected local Strybldr animatic generation to expose a stable model label')
  assert(panelText.indexOf("artifactProvider = 'knowgrph-local-animatic'") < panelText.indexOf("status = 'copied'"), 'expected local generated animatic to run before source-video copy fallback')
  assert(panelText.includes("status = 'generated'"), 'expected provider-backed Strybldr video recreation to remain a generated outcome, not fallback-only')
  assert(panelText.includes("status === 'fallback' ? 'strybldr-video-fallback'"), 'expected playable Strybldr videos to write non-fallback artifacts')
  assert(generatedMarkdown.includes('status: "generated"'), 'expected generated handoff markdown status')
  assert(generatedMarkdown.includes(`renderUrl: "${renderUrl}"`), 'expected generated handoff markdown to expose the render URL')
  assert(generatedMarkdown.includes(`sourceUrl: "${sourceUrl}"`), 'expected generated handoff markdown to preserve the source URL')
  assert(generatedMarkdown.includes('paidCallCount: 1'), 'expected generated handoff markdown to record paid call count')
  assert(generatedMarkdown.includes('## Video'), 'expected generated handoff markdown to include a playable video body')
  assert(generatedMarkdown.includes(`<video controls playsinline src="${renderUrl}"`), 'expected generated handoff markdown to render the shared proxied video URL')
  assert(!generatedMarkdown.includes('errorReason:'), 'expected generated handoff markdown not to carry a fallback error reason')

  const copiedMarkdown = buildStrybldrVideoHandoffMarkdown({
    handoff: {
      prompt: 'Copy one approved source video.',
      referenceImageUrl: null,
      sourceVideoUrl: sourceUrl,
      renderVideoUrl: renderUrl,
      cards: [
        {
          id: 'copied-card',
          lane: 'Source',
          title: 'Copied source',
          summary: 'Approved source video.',
          action: 'Fork the source motion.',
          prompt: 'Use the imported source video as the playable fork.',
          camera: '',
          references: [sourceUrl],
          order: 1,
          sourceUnitId: 'copied-source',
        },
      ],
    },
    status: 'copied',
    provider: 'byteplus-modelark',
    renderUrl,
    sourceUrl,
    copyReason: 'provider inactive; copied source video',
    elapsedMs: 123,
    paidCallCount: 0,
    cacheHit: false,
  })
  assert(copiedMarkdown.includes('status: "copied"'), 'expected copied source video handoff status')
  assert(copiedMarkdown.includes(`renderUrl: "${renderUrl}"`), 'expected copied handoff markdown to expose a render URL')
  assert(copiedMarkdown.includes(`sourceUrl: "${sourceUrl}"`), 'expected copied handoff markdown to preserve the source URL')
  assert(copiedMarkdown.includes('paidCallCount: 0'), 'expected copied source video to avoid paid generation cost')
  assert(copiedMarkdown.includes('copyReason:'), 'expected copied handoff markdown to explain the source-video fork')
  assert(copiedMarkdown.includes(`<video controls playsinline src="${renderUrl}"`), 'expected copied direct video handoff to stay visibly playable')

  const youtubeVideoId = ['Stry', 'Copied', '123'].join('')
  const youtubeSourceUrl = ['https://www.youtube.com/watch', `?v=${youtubeVideoId}`].join('')
  const youtubeRenderUrl = ['https://www.youtube.com/embed/', youtubeVideoId].join('')
  const youtubeCopiedMarkdown = buildStrybldrVideoHandoffMarkdown({
    handoff: {
      prompt: 'Copy one approved YouTube source.',
      referenceImageUrl: null,
      sourceVideoUrl: youtubeSourceUrl,
      renderVideoUrl: youtubeRenderUrl,
      cards: [
        {
          id: 'copied-youtube-card',
          lane: 'Source',
          title: 'Copied YouTube source',
          summary: 'Approved source video.',
          action: 'Fork the source motion.',
          prompt: 'Use the imported source video as the playable fork.',
          camera: '',
          references: [youtubeSourceUrl],
          order: 1,
          sourceUnitId: 'copied-youtube-source',
        },
      ],
    },
    status: 'copied',
    provider: 'byteplus-modelark',
    renderUrl: youtubeRenderUrl,
    sourceUrl: youtubeSourceUrl,
    copyReason: 'provider inactive; copied source video',
    elapsedMs: 123,
    paidCallCount: 0,
    cacheHit: false,
  })
  assert(youtubeCopiedMarkdown.includes(`<iframe src="${youtubeRenderUrl}"`), 'expected copied YouTube handoff to render the embeddable source video')
  assert(youtubeCopiedMarkdown.includes(`[Open source video](${youtubeSourceUrl})`), 'expected copied YouTube handoff to retain the source link')
}

export async function testStrybldrConsolidatedDemoGeneratesLocalPlayableAnimatic() {
  const demoPath = path.resolve(process.cwd(), '../..', 'huijoohwee/docs/knowgrph-strybldr-demo.md')
  const text = fs.readFileSync(demoPath, 'utf8')
  const parsed = await loadGraphDataFromTextViaParser('knowgrph-strybldr-demo.md', text, { applyToStore: false })
  assert(parsed?.parserId === 'strybldr-storyboard', `expected consolidated demo to parse as Strybldr, got ${String(parsed?.parserId || '')}`)
  assert(text.includes('videodb_character_clips_contract'), 'expected consolidated demo to include the VideoDB character clips contract')
  assert(text.includes('video.generate_stream(timeline=subject_timeline_ranges)'), 'expected consolidated demo to include the VideoDB timeline stream primitive')
  assert(text.includes('subject_clip_urls:'), 'expected consolidated demo to keep subject clip URLs in the publish packet schema')
  assert(text.includes('clip: ""'), 'expected consolidated demo to keep character clip URLs blank until live VideoDB responses')
  const handoff = buildStrybldrVideoHandoffFromGraphData(parsed.graphData)
  assert(handoff.cards.length >= 12, `expected consolidated demo handoff cards, got ${handoff.cards.length}`)
  assert(handoff.cards.some(card => card.id === 'videodb-character-clips-card'), 'expected consolidated demo handoff to include the VideoDB character clips card')
  assert(String(handoff.sourceVideoUrl || '').includes('77FAnT935IE'), `expected demo handoff to preserve import URL video source, got ${String(handoff.sourceVideoUrl || '')}`)
  assert(String(handoff.renderVideoUrl || '').includes('/embed/77FAnT935IE'), `expected demo handoff to preserve renderable source preview, got ${String(handoff.renderVideoUrl || '')}`)
  assert(String(handoff.localAnimaticHtml || '').includes('Strybldr Local Generated Video'), 'expected demo handoff to include generated local animatic HTML')
  assert(String(handoff.localAnimaticHtml || '').includes('knowgrph local animatic'), 'expected generated local animatic to identify the local generator')
  assert(String(handoff.localAnimaticHtml || '').includes('Chapter clips'), 'expected generated local animatic to expose runnable chapter clips')
  assert(!String(handoff.localAnimaticHtml || '').includes('stream.videodb.io'), 'expected local generated animatic not to fabricate VideoDB stream URLs')
  const markdown = buildStrybldrVideoHandoffMarkdown({
    handoff,
    status: 'generated',
    provider: 'knowgrph-local-animatic',
    model: 'strybldr-local-animatic-v1',
    renderUrl: handoff.renderVideoUrl,
    sourceUrl: handoff.sourceVideoUrl,
    elapsedMs: 25,
    paidCallCount: 0,
    cacheHit: false,
  })
  assert(markdown.includes('status: "generated"'), 'expected local generated animatic artifact status')
  assert(markdown.includes('provider: "knowgrph-local-animatic"'), 'expected local generated animatic provider')
  assert(markdown.includes('paidCallCount: 0'), 'expected local generated animatic to avoid paid calls')
  assert(markdown.includes('srcdoc='), 'expected local generated animatic to render as an embedded playable artifact')
  assert(markdown.includes('[Open source video](https://www.youtube.com/watch?v=77FAnT935IE)'), 'expected generated artifact to preserve import URL provenance')
}

export async function testStrybldrVideoSourceKeepsRenderableMediaAcrossMergeAndHandoff() {
  const videoId = ['Stry', 'Media', '123'].join('')
  const watchUrl = ['https://www.youtube.com/watch', `?v=${videoId}`].join('')
  const doc = buildStrybldrStoryboardDocument({
    createdAtMs: 1,
    mediaUrlBySourceUnitId: {
      'corpus-source-video-provider': watchUrl,
    },
    sourceUnits: [
      {
        id: 'corpus-source-video-provider',
        workspacePath: '/video-source.md',
        relativePath: 'video-source.md',
        originalName: 'video-source.md',
        mediaKind: 'video',
        mimeHint: 'text/markdown',
        byteSize: 64,
        textHash: 'provider-video',
        status: 'parsed',
        provenance: { importMode: 'url', importedAtMs: 1 },
      },
    ],
  })
  const parsed = await loadGraphDataFromTextViaParser('provider-video.strybldr.md', serializeStrybldrStoryboardMarkdown(doc), { applyToStore: false })
  assert(parsed?.graphData, 'expected provider video Strybldr graph')
  const board = buildStoryboardBoardModel({ graphData: parsed.graphData, graphRevision: 1 })
  const cards = board.lanes.flatMap(lane => lane.cards)
  assert(cards.some(card => card.media?.kind === 'iframe' && card.media.url.includes('/embed/')), 'expected Strybldr provider video cards to render through an iframe URL')
  assert(cards.some(card => card.references.some(reference => reference.kind === 'image' && reference.url.includes(`/vi/${videoId}/`))), 'expected Strybldr provider video cards to expose thumbnail image references')

  const merged = mergeStrybldrElementsIntoGraphData({
    graphData: parsed.graphData,
    elements: [
      {
        id: 'provider-video-edit',
        sourceUnitId: 'corpus-source-video-provider',
        label: 'Approved video beat',
        confidence: 0.8,
        sourceBox: { xmin: 0, ymin: 0, xmax: 1, ymax: 1, unit: 'percentage' },
        evidenceKind: 'user-edit',
        provider: 'fallback',
        order: 3,
        summary: 'Approved video source beat.',
        action: 'Use the source video as motion reference.',
        prompt: 'Animate from the approved provider video source.',
      },
    ],
  })
  const sourceNode = (merged.nodes || []).find(node => String(node.properties?.strybldrSourceUnitId || '') === 'corpus-source-video-provider')
  assert(String(sourceNode?.properties?.mediaKind || '') === 'video', 'expected Strybldr merge to preserve provider video mediaKind')
  const mergedBoard = buildStoryboardBoardModel({ graphData: merged, graphRevision: 2 })
  assert(mergedBoard.lanes.flatMap(lane => lane.cards).some(card => card.media?.kind === 'iframe'), 'expected merged Strybldr graph to keep renderable provider video media')
  const handoff = buildStrybldrVideoHandoffFromGraphData(merged)
  assert(String(handoff.referenceImageUrl || '').includes(`/vi/${videoId}/`), `expected video handoff reference image to use provider thumbnail, got ${String(handoff.referenceImageUrl || '')}`)
  assert(handoff.sourceVideoUrl === watchUrl, `expected video handoff to preserve source video URL, got ${String(handoff.sourceVideoUrl || '')}`)
  assert(String(handoff.renderVideoUrl || '').includes('/embed/'), `expected video handoff to expose a playable embed URL, got ${String(handoff.renderVideoUrl || '')}`)
  assert(handoff.cards.some(card => card.references.includes(watchUrl) && card.references.some(reference => reference.includes(`/vi/${videoId}/`))), 'expected video handoff cards to retain source URL and thumbnail references')
}

export function testStrybldrVisionHarnessUsesRequiredProvidersWithPrivacyGuard() {
  const localVisionText = readSource('features', 'strybldr', 'strybldrLocalVision.ts')
  assert(localVisionText.includes("@huggingface/transformers"), 'expected transformers.js package import')
  assert(localVisionText.includes("Xenova/detr-resnet-50"), 'expected DETR object detection model')
  assert(localVisionText.includes("@vladmandic/human"), 'expected @vladmandic/human package import')
  assert(localVisionText.includes('description: { enabled: false }'), 'expected Human face descriptor disabled')
  assert(localVisionText.includes('emotion: { enabled: false }'), 'expected Human emotion inference disabled')
  assert(localVisionText.includes("evidenceKind: 'local-object-detection'"), 'expected local object detection evidence tags')
  assert(localVisionText.includes("evidenceKind: 'local-human-geometry'"), 'expected privacy-safe human geometry evidence tags')
}
