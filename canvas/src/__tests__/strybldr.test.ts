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
import {
  createStrytreeCandidateRunAction,
  createStrytreeContinuationDraftAction,
  publishStrytreeCandidateAction,
  toggleStrytreeLikeAction,
  unlockStrytreeNodeAction,
} from '@/features/strybldr/strytreeWorkflow'
import { getCanvas2dSurfaceId, getToolbarRunAllFloatingPanelTab, isStoryboardCanvas2dRenderer, resolveCanvas2dRendererId, supportsToolbarRunAll } from '@/lib/config.render'
import { BYTEPLUS_VIDEO_POLL_BOUNDED_WINDOW_MS } from '@/features/chat/byteplusRunGeneration'

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
  assert(parsed.graphData?.metadata && String((parsed.graphData.metadata as Record<string, unknown>).kgCanvas2dRenderer || '') === 'strybldr', 'expected Strybldr renderer metadata')
  assert(String((parsed.graphData.metadata as Record<string, unknown>).graphSemanticKey || '').length > 0, 'expected shared graph semantic key metadata')
  assert((parsed.graphData.nodes || []).some(node => String(node.type || '') === 'StoryboardElement'), 'expected storyboard element nodes')
  assert((parsed.graphData.nodes || []).some(node => String(node.properties?.strybldrSourceUnitId || '') === 'corpus-source-demo'), 'expected provenance source-unit id on cards')
  assert((parsed.graphData.nodes || []).some(node => String(node.properties?.mediaKind || '') === 'image' && String(node.properties?.mimeHint || '') === 'image/png'), 'expected image media metadata for Viewer and Canvas rendering')

  const board = buildStoryboardBoardModel({ graphData: parsed.graphData, graphRevision: 1 })
  assert(board.totalCards >= 2, `expected Storyboard canvas cards from Strybldr graph, got ${board.totalCards}`)
  assert(board.lanes.some(lane => lane.id === 'Elements'), 'expected element lane in Strybldr board')
}

export async function testStrybldrStoryboardParsesStrytreeStorytreeSnapshot() {
  const text = [
    '---',
    'kgStrybldrStoryboard: true',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "strybldr"',
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
    'kgCanvas2dRenderer: "strybldr"',
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
    'kgCanvas2dRenderer: "strybldr"',
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
  const floatingPanelText = readSource('lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')
  const timelineVisibilityText = readSource('lib', 'timeline', 'timelineVisibility.ts')
  const timelineBottomPanelText = readSource('features', 'strybldr', 'StrybldrTimelineBottomPanel.tsx')
  const timelinePanelText = readSource('features', 'strybldr', 'StrybldrTimelinePanel.tsx')
  const storyboardTimelineText = readSource('components', 'StoryboardCanvas', 'storyboardTimeline.ts')
  const retiredRendererId = ['story', 'bldr'].join('')
  assert(resolveCanvas2dRendererId('strybldr') === 'strybldr', 'expected canonical strybldr renderer id')
  assert(resolveCanvas2dRendererId(retiredRendererId) === undefined, 'expected no retired renderer remap')
  assert(/strybldr:\s*\{[\s\S]*?aliases:\s*\[\]/.test(renderConfigText), 'expected no Strybldr renderer aliases')
  assert(getCanvas2dSurfaceId('strybldr') === 'storyboard', 'expected Strybldr mode to reuse the Storyboard surface')
  assert(isStoryboardCanvas2dRenderer('strybldr'), 'expected shared Storyboard renderer helper to include Strybldr mode')
  assert(supportsToolbarRunAll('strybldr'), 'expected Strybldr to reuse Toolbar Run All dispatch')
  assert(getToolbarRunAllFloatingPanelTab('strybldr') === 'strybldr', 'expected Strybldr Run All to mount its shared floating panel consumer')
  assert(getToolbarRunAllFloatingPanelTab('flowEditor') === null, 'expected Flow Editor Run All to keep its always-mounted canvas runtime consumer')
  assert(supportsToolbarRunAll('flowEditor'), 'expected Flow Editor to keep Toolbar Run All dispatch')
  assert(canvasViewportText.includes('StrybldrTimelineBottomPanelLazy'), 'expected Strybldr timeline to mount as the CanvasViewport bottom panel')
  assert(!floatingPanelText.includes("floatingPanelView === 'timeline'"), 'expected Timeline to stay out of the FloatingPanel view registry')
  assert(timelineVisibilityText.includes('TIMELINE_ENABLED_DEFAULT'), 'expected Timeline visibility default to live in shared timeline utils')
  assert(timelineVisibilityText.includes('shouldRenderTimelineSurface'), 'expected Timeline visibility gating to live in shared timeline utils')
  assert(timelineBottomPanelText.includes('HeaderActions'), 'expected Timeline bottom panel to reuse shared panel header actions')
  assert(timelineBottomPanelText.includes('onPinToggle={handlePinToggle}'), 'expected Timeline bottom panel to expose shared pin/unpin controls')
  assert(timelineBottomPanelText.includes('onMinimize={!minimized ? handleMinimize : undefined}'), 'expected Timeline bottom panel to reuse shared FloatingPanel minimize control')
  assert(timelineBottomPanelText.includes('onRestore={minimized ? handleRestore : undefined}'), 'expected Timeline bottom panel to reuse shared FloatingPanel restore control')
  assert(timelineBottomPanelText.includes('setTimelineEnabled(false)'), 'expected Timeline bottom panel close to update the shared Timeline setting')
  assert(timelineBottomPanelText.includes('startPointerDrag'), 'expected Timeline bottom panel drag to reuse the shared pointer drag utility')
  assert(timelineBottomPanelText.includes('UI_SELECTORS.draggablePanelIgnorePointerDown'), 'expected Timeline bottom panel drag to reuse shared no-drag heuristics')
  assert(timelineBottomPanelText.includes('data-kg-strybldr-bottom-timeline-panel'), 'expected Timeline bottom panel to expose a bottom-panel marker')
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
  assert(strybldrPanelText.includes('Strybldr storytree workflow'), 'expected Strytree workflow actions to be reachable from the active Strybldr panel')
  assert(strybldrPanelText.includes('Strybldr storytree filter'), 'expected Strytree filters to be reachable from the active Strybldr panel')
  assert(strybldrPanelText.includes('Strybldr ForkCompare candidates'), 'expected ForkCompare candidate run to be reachable from the active Strybldr panel')
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
  assert(actionsText.includes('activateStrybldrImportSurface'), 'expected image import to switch to Strybldr mode through the shared import-surface owner')
  assert(actionsText.includes('storyPath || createdPath'), 'expected image import focus to land on the generated Strybldr artifact, not a raw image source file')
  assert(canvasPresetsText.includes("'strybldr'"), 'expected Import URL renderer presets to expose Strybldr without a new renderer alias')
  assert(urlImportText.includes("args.canvas2dRenderer === 'strybldr'"), 'expected URL import to create Strybldr storyboard documents through the workspace import owner')
  assert(actionsText.includes("selectedCanvas2dRenderer === 'strybldr'"), 'expected renderer-selected URL import to activate the Strybldr surface')
  assert(!fallbackText.includes(`importLocalImages${'Fallback'}`), 'expected no duplicate image import fallback outside workspace owner')
  assert(floatingPanelText.includes('StrybldrFloatingPanelView'), 'expected Floating Panel to render the Strybldr owner view')
  assert(floatingPanelText.includes("view: 'strybldr'"), 'expected Floating Panel view registry to include Strybldr')
  assert(actionsText.includes('registerStrybldrImageFiles'), 'expected image import to register selected image Files for same-session local analysis')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('availableSourceUnitIds'), 'expected local analysis to address every registered imported image')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('Save card update'), 'expected Strybldr panel to expose the user update gate before generation')
  assert(readSource('components', 'Toolbar.tsx').includes('supportsToolbarRunAll'), 'expected toolbar Run All support to use the shared renderer helper')
  assert(readSource('components', 'Toolbar.tsx').includes('getToolbarRunAllFloatingPanelTab'), 'expected toolbar Run All panel mount to use the shared renderer helper')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('WORKFLOW_RUN_ALL_EVENT'), 'expected Strybldr panel to consume the shared Run All event')
  assert(!readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes("canvas2dRenderer !== 'strybldr'"), 'expected mounted Strybldr panel to keep its Run All event consumer registered')
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
  const handoff = buildStrybldrVideoHandoffFromGraphData(parsed?.graphData)
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
  assert(panelText.includes('if (handoff.sourceVideoUrl && handoff.renderVideoUrl)'), 'expected Strybldr source-video handoff to copy/fork without a paid provider call first')
  assert(panelText.indexOf('if (handoff.sourceVideoUrl && handoff.renderVideoUrl)') < panelText.indexOf('generateRunVideoWithBytePlus({'), 'expected source-video copy path to run before BytePlus generation')
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
