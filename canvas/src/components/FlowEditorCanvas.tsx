import FlowEditorCanvasRuntime from '@/components/FlowEditorCanvas.runtime'

export default function FlowEditorCanvas(props: {
  active?: boolean
  flowEditorSurfaceId?: string
  storyboardCardsMode?: boolean
  widgetDropCaptureEnabled?: boolean
  geospatialWidgetPanelMode?: boolean
}) {
  const active = props.active !== false
  const flowEditorViewActive = active
  const documentStructureBaselineLock = false
  const canEdit = active && !documentStructureBaselineLock
  void flowEditorViewActive
  void canEdit
  return <FlowEditorCanvasRuntime {...props} />
}
