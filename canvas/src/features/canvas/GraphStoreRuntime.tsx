import React from 'react'
import { GraphStoreBootstrapRuntime } from '@/features/canvas/GraphStoreBootstrapRuntime'
import { GraphStoreDocumentUiRuntime } from '@/features/canvas/GraphStoreDocumentUiRuntime'
import { GraphStoreMarkdownEmptyTraceDebugRuntime } from '@/features/canvas/GraphStoreMarkdownEmptyTraceDebugRuntime'

export function GraphStoreRuntime() {
  return (
    <>
      <GraphStoreBootstrapRuntime />
      <GraphStoreMarkdownEmptyTraceDebugRuntime />
      <GraphStoreDocumentUiRuntime />
    </>
  )
}
