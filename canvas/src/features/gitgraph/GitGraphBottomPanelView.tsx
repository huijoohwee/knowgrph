import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useFlowEditorDiagramSelectionBridge } from './useFlowEditorDiagramSelectionBridge'
import { useMermaidGitGraphDocument } from './useMermaidGitGraphDocument'
import { parseMermaidDiagramCodeModel } from '@/lib/mermaid/mermaidDiagramCode'
import {
  findGitGraphCommandForRowKey,
  resolveGitGraphCommandRowKey,
  resolveGitGraphSelectedCommand,
} from '@/lib/mermaid/mermaidGitGraphSelection'
import { useGraphStore } from '@/hooks/useGraphStore'

export function GitGraphBottomPanelView({
  compact = false,
}: {
  compact?: boolean
}) {
  const { code, graphData, themeMode, gitGraphModel: gitGraphCommandModel } = useMermaidGitGraphDocument()
  const model = React.useMemo(() => parseMermaidDiagramCodeModel(code, 'gitgraph'), [code])
  const {
    gitGraphSelectedCommandLineIndex,
    mermaidDiagramSelectedRowKey,
    setGitGraphSelectedCommandLineIndex,
    setMermaidDiagramSelectedRowKey,
  } = useGraphStore(
    useShallow(state => ({
      gitGraphSelectedCommandLineIndex: state.gitGraphSelectedCommandLineIndex,
      mermaidDiagramSelectedRowKey: state.mermaidDiagramSelectedRowKeyByKind.gitgraph || '',
      setGitGraphSelectedCommandLineIndex: state.setGitGraphSelectedCommandLineIndex,
      setMermaidDiagramSelectedRowKey: state.setMermaidDiagramSelectedRowKey,
    })),
  )
  const { handleDiagramSelectedRowKeyChange } = useFlowEditorDiagramSelectionBridge({
    graphData,
    diagramModel: model,
    kind: 'gitgraph',
  })
  const handleSelectedRowKeyChange = React.useCallback((rowKey: string | null) => {
    const command = findGitGraphCommandForRowKey(gitGraphCommandModel.commands, rowKey, model)
    setGitGraphSelectedCommandLineIndex(command?.lineIndex ?? null)
    handleDiagramSelectedRowKeyChange(rowKey)
  }, [gitGraphCommandModel.commands, handleDiagramSelectedRowKeyChange, model, setGitGraphSelectedCommandLineIndex])

  React.useEffect(() => {
    const selectedCommand = resolveGitGraphSelectedCommand({
      commands: gitGraphCommandModel.commands,
      diagramModel: model,
      selectedRowKey: mermaidDiagramSelectedRowKey,
      selectedLineIndex: gitGraphSelectedCommandLineIndex,
    })
    if (!selectedCommand) return
    const selectedCommandIndex = gitGraphCommandModel.commands.indexOf(selectedCommand)
    const rowKey = resolveGitGraphCommandRowKey(selectedCommand, selectedCommandIndex, model)
    if (selectedCommand.lineIndex !== gitGraphSelectedCommandLineIndex) {
      setGitGraphSelectedCommandLineIndex(selectedCommand.lineIndex)
    }
    if (rowKey && rowKey !== mermaidDiagramSelectedRowKey) {
      setMermaidDiagramSelectedRowKey('gitgraph', rowKey)
      handleDiagramSelectedRowKeyChange(rowKey)
    }
  }, [
    gitGraphCommandModel.commands,
    gitGraphSelectedCommandLineIndex,
    handleDiagramSelectedRowKeyChange,
    mermaidDiagramSelectedRowKey,
    model,
    setGitGraphSelectedCommandLineIndex,
    setMermaidDiagramSelectedRowKey,
  ])

  return (
    <MermaidDiagramPanelView
      code={code}
      model={model}
      kind="gitgraph"
      title="GitGraph"
      emptyLabel="No GitGraph Mermaid frontmatter."
      rootThemeMode={themeMode}
      compact={compact}
      surface="bottomPanel"
      renderMode="diagram"
      onSelectedRowKeyChange={handleSelectedRowKeyChange}
    />
  )
}
