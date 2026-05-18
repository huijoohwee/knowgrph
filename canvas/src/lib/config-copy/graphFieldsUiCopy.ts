import { AGENTIC_RAG_SCHEMA_URL } from '@/lib/agenticrag'

export const createGraphFieldsUiCopy = (shared: {
  clipboardNotAvailable: string
  copyFailed: string
}) => ({
  graphFieldsRawNodesEdgesToastTitle: 'Raw JSON fields via rawToGraphData',
  graphFieldsRawNodesEdgesToastBody:
    'This graph was ingested as raw JSON (context: "raw-nodes-edges"). Node and edge properties shown here come from rawToGraphData → map important fields like chunk_text, media_url, graphRAGPath, and workflow phases to AgenticRAG roles in Field Settings so tables, schema, and JSON-LD exports stay aligned.',
  graphFieldsNewFieldMissingNameStatus: 'New field: missing name',
  graphFieldsNewFieldNameCannotContainColonStatus: 'New field: name cannot include ":"',
  graphFieldsNewFieldAlreadyExistsStatus: 'New field: already exists',
  graphFieldsCreatedFieldStatus: (id: string) => `Created field ${id}`,
  graphFieldsAgenticLegendPillLabel:
    'AgenticRAG fields: chunk_text, embedding, geo, media_url, graphRAGPath (table mapping to JSON-LD)',
  graphFieldsSelectFieldToEdit: 'Select a field to edit',
  graphFieldsSelectFieldToViewSamples: 'Select a field to view samples',
  graphFieldsScopeNodeLabel: 'Node',
  graphFieldsScopeEdgeLabel: 'Edge',
  graphFieldsFieldSettingsTitle: 'Field Settings',
  graphFieldsLocalSchemaSelectOwnerEmpty: 'Select an owner to edit local schema.',
  graphFieldsLocalSchemaFacetTemplateJsonLabel: 'Template (JSON)',
  graphFieldsLocalSchemaFacetPropertiesLabel: 'Properties',
  graphFieldsLocalSchemaFacetValidationLabel: 'Validation',
  graphFieldsLocalSchemaFacetLocalRulesLabel: 'Local rules',
  graphFieldsHiddenToggleOnLabel: 'Yes',
  graphFieldsHiddenToggleOffLabel: 'No',
  graphFieldsDescriptionLabel: 'Description',
  graphFieldsNoOptions: 'No options',
  graphFieldsAddOptionFromSamplesPlaceholder: 'Add option from graph data…',
  graphFieldsAddAllSuggestionsLabel: 'Add all',
  graphFieldsNoSamplesFound: 'No samples found',
  graphFieldsClipboardNotAvailable: shared.clipboardNotAvailable,
  graphFieldsCopyFailed: shared.copyFailed,
  graphFieldsSamplesCopiedStatus: (count: number) =>
    `Copied ${count.toLocaleString()} sample ${count === 1 ? 'value' : 'values'}`,
  graphFieldsSamplesAddedToOptionsStatus: (count: number) =>
    `Added ${count.toLocaleString()} option ${count === 1 ? 'value' : 'values'} from samples`,
  graphFieldsJsonDefaultClearedStatus: 'Cleared JSON default',
  graphFieldsJsonDefaultInvalidStatus: 'Invalid JSON default',
  graphFieldsJsonDefaultAppliedStatus: 'Applied JSON default',
  graphFieldsJsonDefaultFormattedStatus: 'Formatted JSON default',
  graphFieldsNodeColorLabel: 'Node field color',
  graphFieldsEdgeColorLabel: 'Edge field color',
  graphFieldsColorSwatchTooltip: (scope: 'node' | 'edge') =>
    `Color swatch for ${scope === 'node' ? 'node' : 'edge'} fields → updates schema.${
      scope === 'node' ? 'nodeStyles' : 'edgeStyles'
    } color so Multi-dimensional Table, Renderer, and AgenticRAG JSON-LD exports share the same visual encoding.`,
  graphFieldsStylesSectionTitle: 'Styles',
  graphFieldsSchemaExtrasSectionTitle: 'Schema extras',
  graphFieldsAdvancedSchemaSectionTitle: 'Advanced schema',
  graphFieldsSchemaUiEditorSectionTitle: 'Schema UI editor',
  graphFieldsResyncButtonLabel: 'Re-sync',
  graphFieldsVisibleTotalStatus: (visible: number, total: number) =>
    `Visible ${visible} · Total ${total}`,
  graphFieldsAgenticFieldSettingsDescription:
    `Field Settings → map node and edge properties to AgenticRAG JSON-LD roles (see ${AGENTIC_RAG_SCHEMA_URL}/node-schema.jsonld and ${AGENTIC_RAG_SCHEMA_URL}/edge-schema.jsonld) so Multi-dimensional Table, schema docs, and workflows share a single field interpretation.`,
  graphFieldsAgenticLegendChipLabel: 'AgenticRAG node fields',
  graphFieldsIconLegendHeaderLabel: 'Help Icon Library legend',
  validationRequiredFieldsTitle: 'Required fields',
  validationPropertyTypesTitle: 'Property types',
  validationAdditionalOptionsJsonTitle: 'Additional options (JSON)',
  validationSeverityLabel: 'Severity',
  validationSeverityErrorLabel: 'Error',
  validationSeverityWarnLabel: 'Warn',
  validationRequireAllButtonLabel: 'Require all',
  validationRequireNumericButtonLabel: 'Require numeric',
  validationClearRequiredButtonLabel: 'Clear required',
  validationSetAllTypesButtonLabel: 'Set all types',
  validationInferTypesButtonLabel: 'Infer types',
} as const)
