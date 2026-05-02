import type { JSONValue } from 'grph-shared/graph/types'

export type { GraphData, GraphEdge, GraphNode, JSONValue } from 'grph-shared/graph/types'

export type SelectionAnchorIds = {
  selectionNodeIds: string[];
  selectionEdgeIds: string[];
};

export interface JsonLdGraphMappingConfig {
  contextEdgeProperties?: string[];
}

export type AgenticGraphRagTraversePath = {
  query?: string;
  traverse?: JSONValue;
  multiHop?: JSONValue;
};

export type AgenticGraphRagExamplePath = {
  example?: string;
  hops?: JSONValue;
};

export type AgenticGraphRagPathValue = AgenticGraphRagTraversePath | AgenticGraphRagExamplePath;

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type AgenticRagNodeId = Brand<string, 'AgenticRagNodeId'>;

export type AgenticRagChunkText = Brand<string, 'AgenticRagChunkText'>;

export type AgenticRagEmbedding = Brand<number[], 'AgenticRagEmbedding'>;

export interface AgenticRagGeo {
  lat: number;
  lng: number;
}

export type AgenticRagMediaKind = 'image' | 'svg' | 'video' | 'iframe';

export type AgenticRagMediaUrl = Brand<string, 'AgenticRagMediaUrl'>;

export interface AgenticRagNodeProvenance {
  source?: string;
  confidence?: number;
  timestamp?: string;
  curator?: string;
  [key: string]: JSONValue | undefined;
}

export type ParsedAgenticGraphRagTraversePath = {
  query?: string;
  traverse?: AgenticRagNodeId[];
  multiHop?: string[];
};

export type ParsedAgenticGraphRagExamplePath = {
  example?: string;
  hops?: string[];
};

export type ParsedAgenticGraphRagPath =
  | ParsedAgenticGraphRagTraversePath
  | ParsedAgenticGraphRagExamplePath;

export interface AgenticRagNodeView {
  id: AgenticRagNodeId;
  labels: string[];
  properties: Record<string, JSONValue>;
  chunkText?: AgenticRagChunkText;
  embedding?: AgenticRagEmbedding;
  geo?: AgenticRagGeo;
  mediaKind?: AgenticRagMediaKind;
  mediaUrl?: AgenticRagMediaUrl;
  provenance?: AgenticRagNodeProvenance;
  graphRAGPath?: AgenticGraphRagPathValue;
  parsedGraphRagTraversePath?: ParsedAgenticGraphRagTraversePath | null;
  parsedGraphRagExamplePath?: ParsedAgenticGraphRagExamplePath | null;
}
