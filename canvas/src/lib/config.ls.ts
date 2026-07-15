import {
  LS_KEYS,
  LS_KEY_VIEWPORT_LAST,
  LS_KEY_VIEWPORT_PINNED,
  SESSION_KEYS,
  STORAGE_CHANNELS,
} from './config.ls.keys'
export {
  LS_KEYS,
  LS_KEY_VIEWPORT_LAST,
  LS_KEY_VIEWPORT_PINNED,
  SESSION_KEYS,
  STORAGE_CHANNELS,
} from './config.ls.keys'

import { LS_KEY_OWNERS, type LsKeyOwner } from './config.ls.owners'
import { serializeMarkdownPipeTable } from '@/features/markdown/ui/markdownDataViewSerialize'
export { LS_KEY_OWNERS, type LsKeyOwner } from './config.ls.owners'

export type LsKeyId = keyof typeof LS_KEYS;
export type LsStorageKey =
  | (typeof LS_KEYS)[LsKeyId]
  | SchemaSubsectionStorageKey
  | ChatHistoryStorageKey
  | MarkdownCollapsedHeadingIdsStorageKey
  | MarkdownDataViewConfigStorageKey;

export type SchemaSubsectionStorageKeyPrefix = (typeof LS_KEYS)['schemaSubsectionPrefix'];
export type SchemaSubsectionStorageKey = `${SchemaSubsectionStorageKeyPrefix}${string}`;

export const getSchemaSubsectionStorageKey = (slug: string): SchemaSubsectionStorageKey =>
  `${LS_KEYS.schemaSubsectionPrefix}${String(slug ?? '')}` as SchemaSubsectionStorageKey;

export type ChatHistoryStorageKeyPrefix = (typeof LS_KEYS)['chatHistoryPrefix'];
export type ChatHistoryStorageKey = `${ChatHistoryStorageKeyPrefix}${string}`;

export const getChatHistoryStorageKey = (graphSignature: string): ChatHistoryStorageKey =>
  `${LS_KEYS.chatHistoryPrefix}${String(graphSignature ?? '')}` as ChatHistoryStorageKey;

export type MarkdownCollapsedHeadingIdsStorageKeyPrefix = (typeof LS_KEYS)['markdownCollapsedHeadingIds'];
export type MarkdownCollapsedHeadingIdsStorageKey = `${MarkdownCollapsedHeadingIdsStorageKeyPrefix}:${string}`;

export type MarkdownDataViewConfigStorageKeyPrefix = (typeof LS_KEYS)['markdownDataViewConfigPrefix'];
export type MarkdownDataViewConfigStorageKey = `${MarkdownDataViewConfigStorageKeyPrefix}${string}`;

export const getMarkdownCollapsedHeadingIdsStorageKey = (scopeKey: string): MarkdownCollapsedHeadingIdsStorageKey =>
  `${LS_KEYS.markdownCollapsedHeadingIds}:${String(scopeKey ?? '')}` as MarkdownCollapsedHeadingIdsStorageKey;

export const getMarkdownDataViewConfigStorageKey = (scopeKey: string): MarkdownDataViewConfigStorageKey =>
  `${LS_KEYS.markdownDataViewConfigPrefix}${String(scopeKey ?? '')}` as MarkdownDataViewConfigStorageKey;

export const SCHEMA_SECTIONS = [
  {
    id: 'schemaApplyPresets',
    label: 'Apply presets from data/config/schema/',
    collapsedKey: 'schemaUiStep31Collapsed',
  },
  {
    id: 'schemaTuneRules',
    label: 'Tune node, edge, and layout rules',
    collapsedKey: 'schemaUiStep32Collapsed',
  },
  {
    id: 'schemaCustomizeUi',
    label: 'Customize node and edge UI',
    collapsedKey: 'schemaUiStep33Collapsed',
  },
  {
    id: 'schemaValidationRules',
    label: 'Validation and rules',
    collapsedKey: 'schemaUiStep332Collapsed',
  },
] as const;

export type SchemaSectionId = (typeof SCHEMA_SECTIONS)[number]['id'];

export const SCHEMA_SECTION_IDS: readonly SchemaSectionId[] = SCHEMA_SECTIONS.map(section => section.id);

export const ORCHESTRATOR_SECTIONS = [
  {
    id: 'graphRag',
    label: 'GraphRAG Workflow (AgenticRAG)',
    collapsedKey: 'orchestratorGraphRagCollapsed',
  },
  {
    id: 'presets',
    label: 'Traversal presets and helpers',
    collapsedKey: 'orchestratorPresetsCollapsed',
  },
  {
    id: 'editor',
    label: 'Traversal editor and layers',
    collapsedKey: 'orchestratorEditorCollapsed',
  },
  {
    id: 'context',
    label: 'AgenticRAG context and ignore filters',
    collapsedKey: 'orchestratorContextCollapsed',
  },
  {
    id: 'workflowIndexing',
    label: 'Indexing parameters',
    collapsedKey: 'orchestratorWorkflowIndexingCollapsed',
  },
  {
    id: 'workflowTracing',
    label: 'Tracing options',
    collapsedKey: 'orchestratorWorkflowTracingCollapsed',
  },
] as const;

export type OrchestratorSectionId = (typeof ORCHESTRATOR_SECTIONS)[number]['id'];

export const ORCHESTRATOR_SECTION_IDS: readonly OrchestratorSectionId[] = ORCHESTRATOR_SECTIONS.map(
  section => section.id,
);

export const RENDER_SECTIONS = [
  {
    id: 'renderPresets',
    label: 'Render presets and tuning',
    collapsedKey: 'renderPresetsCollapsed',
  },
  {
    id: 'datasetInspector',
    label: 'Dataset inspector',
    collapsedKey: 'renderDatasetInspectorCollapsed',
  },
  {
    id: 'codebaseIndexPipeline',
    label: 'Codebase index pipeline',
    collapsedKey: 'renderCodebaseIndexCollapsed',
  },
  {
    id: 'threeLinks',
    label: 'Renderer: edges and particles',
    collapsedKey: 'renderThreeLinksCollapsed',
  },
  {
    id: 'threeLayout',
    label: 'Renderer: layout and geometry',
    collapsedKey: 'renderThreeLayoutCollapsed',
  },
  {
    id: 'threeBackgroundFog',
    label: 'Renderer: background and fog',
    collapsedKey: 'renderThreeBackgroundFogCollapsed',
  },
  {
    id: 'threeStarfield',
    label: 'Renderer: starfield and depth',
    collapsedKey: 'renderThreeStarfieldCollapsed',
  },
  {
    id: 'threeCamera',
    label: 'Renderer: camera and motion',
    collapsedKey: 'renderThreeCameraCollapsed',
  },
  {
    id: 'threeSelection',
    label: 'Renderer: selection highlighting',
    collapsedKey: 'renderThreeSelectionCollapsed',
  },
] as const;

export type RenderSectionId = (typeof RENDER_SECTIONS)[number]['id'];

export type SessionKeyId = keyof typeof SESSION_KEYS;
export type SessionStorageKey = (typeof SESSION_KEYS)[SessionKeyId];

export type StorageChannelId = keyof typeof STORAGE_CHANNELS;
export type StorageChannelKey = (typeof STORAGE_CHANNELS)[StorageChannelId];

export function getLsKeyDiagnostics(): { id: LsKeyId; storageKey: (typeof LS_KEYS)[LsKeyId]; owner: LsKeyOwner }[] {
  const ids = Object.keys(LS_KEYS) as LsKeyId[];
  return ids.map(id => ({
    id,
    storageKey: LS_KEYS[id],
    owner: LS_KEY_OWNERS[id],
  }));
}

export function getOrchestratorSectionDiagnostics(): {
  id: OrchestratorSectionId;
  label: string;
  collapsedKeyId: LsKeyId;
  collapsedStorageKey: LsStorageKey;
  owner: LsKeyOwner;
}[] {
  return ORCHESTRATOR_SECTIONS.map(section => {
    const collapsedKeyId = section.collapsedKey as LsKeyId;
    return {
      id: section.id,
      label: section.label,
      collapsedKeyId,
      collapsedStorageKey: LS_KEYS[collapsedKeyId],
      owner: LS_KEY_OWNERS[collapsedKeyId],
    };
  });
}

export type OrchestratorSectionAnalyticsRecord = {
  sectionId: OrchestratorSectionId;
  label: string;
  collapsedKeyId: LsKeyId;
  collapsedStorageKey: LsStorageKey;
  owner: LsKeyOwner;
};

export function getOrchestratorSectionAnalyticsPayload(): OrchestratorSectionAnalyticsRecord[] {
  const diagnostics = getOrchestratorSectionDiagnostics();
  return diagnostics.map(diagnostic => ({
    sectionId: diagnostic.id,
    label: diagnostic.label,
    collapsedKeyId: diagnostic.collapsedKeyId,
    collapsedStorageKey: diagnostic.collapsedStorageKey,
    owner: diagnostic.owner,
  }));
}

export type OrchestratorSectionToggleAnalyticsEvent = OrchestratorSectionAnalyticsRecord & {
  collapsed: boolean;
};

export function buildOrchestratorSectionToggleAnalyticsEvent(
  sectionId: OrchestratorSectionId,
  collapsed: boolean,
): OrchestratorSectionToggleAnalyticsEvent | null {
  const payload = getOrchestratorSectionAnalyticsPayload().find(record => record.sectionId === sectionId);
  if (!payload) return null;
  return {
    ...payload,
    collapsed,
  };
}

export function getOrchestratorSectionMarkdownTable(): string {
  const diagnostics = getOrchestratorSectionDiagnostics();
  return serializeMarkdownPipeTable({
    columns: ['Section ID', 'Label', 'Storage Key', 'Owner'],
    rows: diagnostics.map(diagnostic => [diagnostic.id, diagnostic.label, diagnostic.collapsedStorageKey, diagnostic.owner]),
  }).join('\n');
}

export function getRenderSectionDiagnostics(): {
  id: RenderSectionId;
  label: string;
  collapsedKeyId: LsKeyId;
  collapsedStorageKey: LsStorageKey;
  owner: LsKeyOwner;
}[] {
  return RENDER_SECTIONS.map(section => {
    const collapsedKeyId = section.collapsedKey as LsKeyId;
    return {
      id: section.id,
      label: section.label,
      collapsedKeyId,
      collapsedStorageKey: LS_KEYS[collapsedKeyId],
      owner: LS_KEY_OWNERS[collapsedKeyId],
    };
  });
}

export type RenderSectionAnalyticsRecord = {
  sectionId: RenderSectionId;
  label: string;
  collapsedKeyId: LsKeyId;
  collapsedStorageKey: LsStorageKey;
  owner: LsKeyOwner;
};

export function getRenderSectionAnalyticsPayload(): RenderSectionAnalyticsRecord[] {
  const diagnostics = getRenderSectionDiagnostics();
  return diagnostics.map(diagnostic => ({
    sectionId: diagnostic.id,
    label: diagnostic.label,
    collapsedKeyId: diagnostic.collapsedKeyId,
    collapsedStorageKey: diagnostic.collapsedStorageKey,
    owner: diagnostic.owner,
  }));
}

export type RenderSectionToggleAnalyticsEvent = RenderSectionAnalyticsRecord & {
  collapsed: boolean;
};

export function buildRenderSectionToggleAnalyticsEvent(
  sectionId: RenderSectionId,
  collapsed: boolean,
): RenderSectionToggleAnalyticsEvent | null {
  const payload = getRenderSectionAnalyticsPayload().find(record => record.sectionId === sectionId);
  if (!payload) return null;
  return {
    ...payload,
    collapsed,
  };
}

export function getRenderSectionMarkdownTable(): string {
  const diagnostics = getRenderSectionDiagnostics();
  return serializeMarkdownPipeTable({
    columns: ['Section ID', 'Label', 'Storage Key', 'Owner'],
    rows: diagnostics.map(diagnostic => [diagnostic.id, diagnostic.label, diagnostic.collapsedStorageKey, diagnostic.owner]),
  }).join('\n');
}
