import React from 'react'
import BottomPanelCodeTab from '@/components/BottomPanel/BottomPanelCodeTab'

type Handlers = {
  onChange: (value: string) => void
  onSelectionChange: (start: number, end: number) => void
  onDoubleClick: (start: number, end: number) => void
  onBlur: () => void
}

export default function BottomPanelCurationJsonMultiPane(props: {
  codeText: string
  codeError: string
  codeRef: React.RefObject<import('@/features/monaco/MonacoTextEditor').MonacoTextEditorHandle | null>
  handlers: Handlers
  header?: React.ReactNode
  graphJsonText: string
  jsonSourceDocumentText: string | null
}) {
  const { codeText, codeError, codeRef, handlers, header, graphJsonText, jsonSourceDocumentText } = props

  const hasSource =
    typeof jsonSourceDocumentText === 'string' && jsonSourceDocumentText.trim().length > 0

  const noopHandlers = React.useMemo<Handlers>(
    () => ({
      onChange: () => void 0,
      onSelectionChange: () => void 0,
      onDoubleClick: () => void 0,
      onBlur: () => void 0,
    }),
    [],
  )

  if (!hasSource) {
    return (
      <BottomPanelCodeTab
        codeText={codeText}
        codeError={codeError}
        codeRef={codeRef}
        handlers={handlers}
        readOnly={false}
        header={header}
        uri="inmemory://model/curation.json"
      />
    )
  }

  return (
    <div className="h-full min-h-0 grid grid-cols-2 gap-2">
      <BottomPanelCodeTab
        codeText={codeText}
        codeError={codeError}
        codeRef={codeRef}
        handlers={handlers}
        readOnly={false}
        header={header}
        uri="inmemory://model/curation.source.json"
      />
      <BottomPanelCodeTab
        codeText={graphJsonText}
        codeError=""
        codeRef={{ current: null }}
        handlers={noopHandlers}
        readOnly={true}
        header={null}
        uri="inmemory://model/curation.derived.graph.json"
      />
    </div>
  )
}
