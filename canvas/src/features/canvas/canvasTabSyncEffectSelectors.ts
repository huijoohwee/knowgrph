import type { CanvasTabSyncRuntimeProps } from '@/features/canvas/canvasTabSyncRuntimeContract'

export type CanvasTabSyncTransportEffectProps = Pick<
  CanvasTabSyncRuntimeProps,
  | 'graphId'
  | 'tabId'
  | 'syncRef'
  | 'applyingRemoteRef'
  | 'lastSelectionRemoteTimestampRef'
  | 'lastSchemaRemoteTimestampRef'
  | 'selectNode'
  | 'selectEdge'
  | 'setSchema'
>

export type CanvasTabSyncSelectionPublishEffectProps = Pick<
  CanvasTabSyncRuntimeProps,
  | 'graphId'
  | 'tabId'
  | 'selectedNodeId'
  | 'selectedEdgeId'
  | 'syncRef'
  | 'applyingRemoteRef'
  | 'lastSelectionRef'
>

export type CanvasTabSyncSchemaPublishEffectProps = Pick<
  CanvasTabSyncRuntimeProps,
  | 'graphId'
  | 'tabId'
  | 'schema'
  | 'syncRef'
  | 'applyingRemoteRef'
  | 'lastSchemaHashRef'
>

type CanvasTabSyncSharedBaseEffectProps = Pick<
  CanvasTabSyncRuntimeProps,
  'graphId' | 'tabId' | 'syncRef' | 'applyingRemoteRef'
>

type CanvasTabSyncTransportEffectSpecificProps = Omit<
  CanvasTabSyncTransportEffectProps,
  keyof CanvasTabSyncSharedBaseEffectProps
>

type CanvasTabSyncSelectionPublishEffectSpecificProps = Omit<
  CanvasTabSyncSelectionPublishEffectProps,
  keyof CanvasTabSyncSharedBaseEffectProps
>

type CanvasTabSyncSchemaPublishEffectSpecificProps = Omit<
  CanvasTabSyncSchemaPublishEffectProps,
  keyof CanvasTabSyncSharedBaseEffectProps
>

type CanvasTabSyncTransportEffectDeps = readonly [
  CanvasTabSyncRuntimeProps['applyingRemoteRef'],
  CanvasTabSyncRuntimeProps['graphId'],
  CanvasTabSyncRuntimeProps['lastSchemaRemoteTimestampRef'],
  CanvasTabSyncRuntimeProps['lastSelectionRemoteTimestampRef'],
  CanvasTabSyncRuntimeProps['selectEdge'],
  CanvasTabSyncRuntimeProps['selectNode'],
  CanvasTabSyncRuntimeProps['setSchema'],
  CanvasTabSyncRuntimeProps['syncRef'],
  CanvasTabSyncRuntimeProps['tabId'],
]

type CanvasTabSyncSharedPublishEffectDeps = readonly [
  CanvasTabSyncRuntimeProps['applyingRemoteRef'],
  CanvasTabSyncRuntimeProps['graphId'],
  CanvasTabSyncRuntimeProps['syncRef'],
  CanvasTabSyncRuntimeProps['tabId'],
]

type CanvasTabSyncSelectionPublishEffectDeps = readonly [
  ...CanvasTabSyncSharedPublishEffectDeps,
  CanvasTabSyncRuntimeProps['lastSelectionRef'],
  CanvasTabSyncRuntimeProps['selectedEdgeId'],
  CanvasTabSyncRuntimeProps['selectedNodeId'],
]

type CanvasTabSyncSchemaPublishEffectDeps = readonly [
  ...CanvasTabSyncSharedPublishEffectDeps,
  CanvasTabSyncRuntimeProps['lastSchemaHashRef'],
  CanvasTabSyncRuntimeProps['schema'],
]

type CanvasTabSyncTransportEffectSpecificDeps = readonly [
  CanvasTabSyncRuntimeProps['lastSchemaRemoteTimestampRef'],
  CanvasTabSyncRuntimeProps['lastSelectionRemoteTimestampRef'],
  CanvasTabSyncRuntimeProps['selectEdge'],
  CanvasTabSyncRuntimeProps['selectNode'],
  CanvasTabSyncRuntimeProps['setSchema'],
]

type CanvasTabSyncSelectionPublishEffectSpecificDeps = readonly [
  CanvasTabSyncRuntimeProps['lastSelectionRef'],
  CanvasTabSyncRuntimeProps['selectedEdgeId'],
  CanvasTabSyncRuntimeProps['selectedNodeId'],
]

type CanvasTabSyncSchemaPublishEffectSpecificDeps = readonly [
  CanvasTabSyncRuntimeProps['lastSchemaHashRef'],
  CanvasTabSyncRuntimeProps['schema'],
]

function selectCanvasTabSharedBaseEffectProps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSharedBaseEffectProps {
  return {
    graphId: props.graphId,
    tabId: props.tabId,
    syncRef: props.syncRef,
    applyingRemoteRef: props.applyingRemoteRef,
  }
}

function selectCanvasTabSharedTransportEffectProps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSharedBaseEffectProps {
  return selectCanvasTabSharedBaseEffectProps(props)
}

function selectCanvasTabSharedPublishEffectProps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSharedBaseEffectProps {
  return selectCanvasTabSharedBaseEffectProps(props)
}

function selectCanvasTabTransportEffectSpecificProps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncTransportEffectSpecificProps {
  return {
    lastSelectionRemoteTimestampRef: props.lastSelectionRemoteTimestampRef,
    lastSchemaRemoteTimestampRef: props.lastSchemaRemoteTimestampRef,
    selectNode: props.selectNode,
    selectEdge: props.selectEdge,
    setSchema: props.setSchema,
  }
}

function selectCanvasTabSelectionPublishEffectSpecificProps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSelectionPublishEffectSpecificProps {
  return {
    selectedNodeId: props.selectedNodeId,
    selectedEdgeId: props.selectedEdgeId,
    lastSelectionRef: props.lastSelectionRef,
  }
}

function selectCanvasTabSchemaPublishEffectSpecificProps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSchemaPublishEffectSpecificProps {
  return {
    schema: props.schema,
    lastSchemaHashRef: props.lastSchemaHashRef,
  }
}

function selectCanvasTabSharedPublishEffectDeps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSharedPublishEffectDeps {
  return [
    props.applyingRemoteRef,
    props.graphId,
    props.syncRef,
    props.tabId,
  ] as const
}

function selectCanvasTabTransportEffectSpecificDeps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncTransportEffectSpecificDeps {
  return [
    props.lastSchemaRemoteTimestampRef,
    props.lastSelectionRemoteTimestampRef,
    props.selectEdge,
    props.selectNode,
    props.setSchema,
  ] as const
}

function selectCanvasTabSelectionPublishEffectSpecificDeps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSelectionPublishEffectSpecificDeps {
  return [
    props.lastSelectionRef,
    props.selectedEdgeId,
    props.selectedNodeId,
  ] as const
}

function selectCanvasTabSchemaPublishEffectSpecificDeps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSchemaPublishEffectSpecificDeps {
  return [
    props.lastSchemaHashRef,
    props.schema,
  ] as const
}

export function selectCanvasTabSyncTransportEffectProps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncTransportEffectProps {
  return {
    ...selectCanvasTabSharedTransportEffectProps(props),
    ...selectCanvasTabTransportEffectSpecificProps(props),
  }
}

export function selectCanvasTabSelectionPublishEffectProps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSelectionPublishEffectProps {
  return {
    ...selectCanvasTabSharedPublishEffectProps(props),
    ...selectCanvasTabSelectionPublishEffectSpecificProps(props),
  }
}

export function selectCanvasTabSchemaPublishEffectProps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSchemaPublishEffectProps {
  return {
    ...selectCanvasTabSharedPublishEffectProps(props),
    ...selectCanvasTabSchemaPublishEffectSpecificProps(props),
  }
}

export function selectCanvasTabSyncTransportEffectDeps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncTransportEffectDeps {
  return [
    props.applyingRemoteRef,
    props.graphId,
    ...selectCanvasTabTransportEffectSpecificDeps(props),
    props.syncRef,
    props.tabId,
  ] as const
}

export function selectCanvasTabSelectionPublishEffectDeps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSelectionPublishEffectDeps {
  return [
    ...selectCanvasTabSharedPublishEffectDeps(props),
    ...selectCanvasTabSelectionPublishEffectSpecificDeps(props),
  ] as const
}

export function selectCanvasTabSchemaPublishEffectDeps(
  props: CanvasTabSyncRuntimeProps,
): CanvasTabSyncSchemaPublishEffectDeps {
  return [
    ...selectCanvasTabSharedPublishEffectDeps(props),
    ...selectCanvasTabSchemaPublishEffectSpecificDeps(props),
  ] as const
}
