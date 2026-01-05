import { TraversalSequenceSection } from '@/features/panels/views/OrchestratorTraversalSequenceSection'
import { AgenticRagNodeInspectorSection } from '@/features/panels/views/AgenticRagNodeInspectorSection'
import { buildAgenticPathInfo } from '@/features/panels/views/AgenticRagNodeInspectorSectionModel'
import { type OrchestratorTraversalSectionViewModel } from '@/features/panels/views/OrchestratorTraversalSectionModel'

interface OrchestratorTraversalSectionContentProps {
  viewModel: OrchestratorTraversalSectionViewModel
}

export function OrchestratorTraversalSectionContent({
  viewModel,
}: OrchestratorTraversalSectionContentProps) {
  const {
    graphNodesById,
    previewEdgeIds,
    lastTraversal,
    setLastTraversal,
    selectNode,
    editState,
    editPaths,
    selectedAgenticNode,
    agenticCopyStatus,
    onCopyAgenticRagNodeJson,
  } = viewModel

  const agenticPathInfo = buildAgenticPathInfo(selectedAgenticNode)

  return (
    <>
      <TraversalSequenceSection
        graphNodesById={graphNodesById}
        previewEdgeIds={previewEdgeIds}
        lastTraversal={lastTraversal}
        setLastTraversal={setLastTraversal}
        selectNode={selectNode}
        editState={editState}
        editPaths={editPaths}
      />
      <AgenticRagNodeInspectorSection
        selectedAgenticNode={selectedAgenticNode}
        agenticCopyStatus={agenticCopyStatus}
        onCopyAgenticRagNodeJson={onCopyAgenticRagNodeJson}
        agenticPathInfo={agenticPathInfo}
      />
    </>
  )
}
