import { useMemo } from 'react';
import { normalized as normalizeText } from '@/features/panels/utils/json';
import { UI_LABELS, SCHEMA_KEYS } from '@/lib/config';
import {
  isGraphDataTablePropertyColumnKey,
  parseGraphDataTablePropertyColumnKey,
  GraphDataTableColumnKey
} from '@/features/graph-data-table/graphDataTable';
import { GraphField, GraphFieldId, GraphFieldSettingsById } from '@/features/graph-fields/graphFields';

interface UseGraphFieldsFilteringProps {
  search: string;
  filteredGraphFieldColumnKeys: GraphDataTableColumnKey[];
  fieldById: Map<GraphFieldId, GraphField>;
  schemaDefinedFieldIds: ReadonlySet<GraphFieldId>;
  settingsById: GraphFieldSettingsById;
}

export function useGraphFieldsFiltering({
  search,
  filteredGraphFieldColumnKeys,
  fieldById,
  schemaDefinedFieldIds,
  settingsById,
}: UseGraphFieldsFilteringProps) {
  return useMemo(() => {
    const q = normalizeText(search).trim();
    const globalSchemaLabel = UI_LABELS.globalSchema;
    const globalSchemaVisible =
      !q ||
      normalizeText(globalSchemaLabel).includes(q) ||
      normalizeText(SCHEMA_KEYS.globalSchema).includes(q);

    const localSchemaPropsLabel = UI_LABELS.localSchemaProperties;
    const localSchemaTemplateLabel = UI_LABELS.localSchemaTemplate;
    const localSchemaValidationLabel = UI_LABELS.localSchemaValidation;
    const localSchemaLocalRulesLabel = UI_LABELS.localSchemaLocalRules;

    const localSchemaPropsVisible =
      !q ||
      normalizeText(localSchemaPropsLabel).includes(q) ||
      normalizeText(SCHEMA_KEYS.localSchemaProperties).includes(q);
    const localSchemaTemplateVisible =
      !q ||
      normalizeText(localSchemaTemplateLabel).includes(q) ||
      normalizeText(SCHEMA_KEYS.localSchemaTemplate).includes(q);
    const localSchemaValidationVisible =
      !q ||
      normalizeText(localSchemaValidationLabel).includes(q) ||
      normalizeText(SCHEMA_KEYS.localSchemaValidation).includes(q);
    const localSchemaLocalRulesVisible =
      !q ||
      normalizeText(localSchemaLocalRulesLabel).includes(q) ||
      normalizeText(SCHEMA_KEYS.localSchemaLocalRules).includes(q);

    const baseColumnKeys = filteredGraphFieldColumnKeys.filter(
      k => !isGraphDataTablePropertyColumnKey(k),
    );

    const propertyColumnKeys = filteredGraphFieldColumnKeys.filter(
      isGraphDataTablePropertyColumnKey,
    );

    const basePropertyColumnKeys: GraphDataTableColumnKey[] = [];
    const customPropertyColumnKeys: GraphDataTableColumnKey[] = [];
    const derivedPropertyColumnKeys: GraphDataTableColumnKey[] = [];

    for (const key of propertyColumnKeys) {
      const parsed = parseGraphDataTablePropertyColumnKey(key);
      if (!parsed) continue;
      const graphFieldId = `${parsed.scope}:${parsed.propertyKey}` as GraphFieldId;
      const field = fieldById.get(graphFieldId);
      const isSchemaDefined = field ? schemaDefinedFieldIds.has(field.id) : false;
      const rawSettings = settingsById[graphFieldId];
      const isCustom = rawSettings?.isCustom === true;
      if (isSchemaDefined) basePropertyColumnKeys.push(key);
      else if (isCustom) customPropertyColumnKeys.push(key);
      else derivedPropertyColumnKeys.push(key);
    }

    return {
      globalSchemaVisible,
      localSchemaPropsVisible,
      localSchemaTemplateVisible,
      localSchemaValidationVisible,
      localSchemaLocalRulesVisible,
      baseColumnKeys,
      basePropertyColumnKeys,
      customPropertyColumnKeys,
      derivedPropertyColumnKeys,
      globalSchemaLabel,
      localSchemaPropsLabel,
      localSchemaTemplateLabel,
      localSchemaValidationLabel,
      localSchemaLocalRulesLabel,
    };
  }, [search, filteredGraphFieldColumnKeys, fieldById, schemaDefinedFieldIds, settingsById]);
}
