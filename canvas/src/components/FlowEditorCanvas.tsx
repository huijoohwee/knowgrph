import FlowEditorCanvasRuntime from '@/components/FlowEditorCanvas.runtime'

export default function FlowEditorCanvas(props: {
  active?: boolean
  widgetDropCaptureEnabled?: boolean
  geospatialWidgetPanelMode?: boolean
}) {
  return <FlowEditorCanvasRuntime {...props} />
}
