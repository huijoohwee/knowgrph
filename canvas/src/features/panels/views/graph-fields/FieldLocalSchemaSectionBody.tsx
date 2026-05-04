import React from 'react'
import type { GraphSchema, PropertySpec } from '@/lib/graph/schema'
import type { JSONValue } from '@/lib/graph/types'
import type { GraphFieldsSelectedView } from '@/features/panels/views/GraphFieldsView'
import { UI_COPY, UI_LABELS } from '@/lib/config.copy'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import FieldTemplatesSection from '@/features/panels/views/graph-fields/FieldTemplatesSection'
import FieldLocalSchemaRowsEditor from '@/features/panels/views/graph-fields/FieldLocalSchemaRowsEditor'
import FieldLocalSchemaValidationEditor, {
  type ValidationWarning,
} from '@/features/panels/views/graph-fields/FieldLocalSchemaValidationEditor'

type FieldLocalSchemaRow = { id: string; key: string; value: string }

type FieldLocalSchemaSectionBodyProps = {
  schema: GraphSchema | null
  localSchemaFacet: 'template' | 'properties' | 'validation' | 'localRules' | null
  localSchemaScope: 'node' | 'edge'
  localSchemaOwnerKey: string
  localSchemaNodeTypes: string[]
  localSchemaEdgeLabels: string[]
  localSchemaOwnerCandidates: string[]
  hasLocalSchemaOwner: boolean
  localSchemaError: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelMonospaceTextClass: string
  setSelectedGlobalView: React.Dispatch<React.SetStateAction<GraphFieldsSelectedView>>
  applyLocalSchemaText: () => void
  resetLocalSchemaText: () => void
  validationPropertyNames: string[]
  localValidationWarnings: ValidationWarning[]
  localValidationRequiredSet: Set<string>
  setLocalValidationRequiredSet: React.Dispatch<React.SetStateAction<Set<string>>>
  localValidationTypesMap: Record<string, PropertySpec['type']>
  setLocalValidationTypesMap: React.Dispatch<
    React.SetStateAction<Record<string, PropertySpec['type']>>
  >
  localValidationBulkType: PropertySpec['type']
  setLocalValidationBulkType: React.Dispatch<React.SetStateAction<PropertySpec['type']>>
  localValidationSeverity: 'error' | 'warn'
  setLocalValidationSeverity: React.Dispatch<React.SetStateAction<'error' | 'warn'>>
  localValidationOtherText: string
  setLocalValidationOtherText: React.Dispatch<React.SetStateAction<string>>
  getValidationControlId: (kind: 'required' | 'type', key: string) => string
  focusValidationControl: (kind: 'required' | 'type', key: string) => void
  localSchemaRows: FieldLocalSchemaRow[]
  setLocalSchemaRows: React.Dispatch<React.SetStateAction<FieldLocalSchemaRow[]>>
  suggestedPropertyKeys: string[]
  suggestedPropertyTypeByKey: Record<string, PropertySpec['type']>
  suggestedPropertySampleByKey: Record<string, JSONValue | null>
  enumCandidatesByKey: Record<string, string[]>
}

export default function FieldLocalSchemaSectionBody({
  schema,
  localSchemaFacet,
  localSchemaScope,
  localSchemaOwnerKey,
  localSchemaNodeTypes,
  localSchemaEdgeLabels,
  localSchemaOwnerCandidates,
  hasLocalSchemaOwner,
  localSchemaError,
  uiPanelKeyValueTextSizeClass,
  uiPanelMonospaceTextClass,
  setSelectedGlobalView,
  applyLocalSchemaText,
  resetLocalSchemaText,
  validationPropertyNames,
  localValidationWarnings,
  localValidationRequiredSet,
  setLocalValidationRequiredSet,
  localValidationTypesMap,
  setLocalValidationTypesMap,
  localValidationBulkType,
  setLocalValidationBulkType,
  localValidationSeverity,
  setLocalValidationSeverity,
  localValidationOtherText,
  setLocalValidationOtherText,
  getValidationControlId,
  focusValidationControl,
  localSchemaRows,
  setLocalSchemaRows,
  suggestedPropertyKeys,
  suggestedPropertyTypeByKey,
  suggestedPropertySampleByKey,
  enumCandidatesByKey,
}: FieldLocalSchemaSectionBodyProps) {
  const schemaPanelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3 space-y-3`
  const schemaInputClassName = `h-9 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} px-2 ${UI_THEME_TOKENS.input.text} ${UI_THEME_TOKENS.focus.primaryBorderRing}`
  const schemaSectionHeadingClassName = `${uiPanelKeyValueTextSizeClass} font-semibold ${UI_THEME_TOKENS.text.primary}`
  return (
    <div className="p-3 space-y-3">
      <div className={schemaPanelClassName}>
        <div className="flex items-center gap-2">
          <select
            value={localSchemaScope}
            onChange={e => {
              const nextScope = e.target.value === 'edge' ? 'edge' : 'node'
              const nextCandidates =
                nextScope === 'node' ? localSchemaNodeTypes : localSchemaEdgeLabels
              setSelectedGlobalView(prev => {
                if (!prev || prev.kind !== 'localSchema') return prev
                return {
                  ...prev,
                  scope: nextScope,
                  ownerKey: nextCandidates[0] ?? '',
                }
              })
            }}
            className={`${schemaInputClassName} ${uiPanelKeyValueTextSizeClass}`}
          >
            <option value="node">{UI_COPY.graphFieldsScopeNodeLabel}</option>
            <option value="edge">{UI_COPY.graphFieldsScopeEdgeLabel}</option>
          </select>
          <select
            value={localSchemaOwnerKey}
            onChange={e => {
              const v = e.target.value
              setSelectedGlobalView(prev => {
                if (!prev || prev.kind !== 'localSchema') return prev
                return { ...prev, ownerKey: v }
              })
            }}
            className={`${schemaInputClassName} flex-1 min-w-0 ${uiPanelKeyValueTextSizeClass}`}
          >
            {localSchemaOwnerCandidates.length === 0 ? (
              <option value="">(none)</option>
            ) : (
              localSchemaOwnerCandidates.map(k => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {localSchemaFacet === 'template' ? (
        schema ? (
          <FieldTemplatesSection
            schema={schema}
            scope={localSchemaScope}
            ownerKey={localSchemaOwnerKey}
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
          />
        ) : null
      ) : !hasLocalSchemaOwner ? (
        <div className={`p-3 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
          {UI_COPY.graphFieldsLocalSchemaSelectOwnerEmpty}
        </div>
      ) : (
        <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3 space-y-2`}>
          <div className={schemaSectionHeadingClassName}>
            {localSchemaFacet === 'properties'
              ? UI_COPY.graphFieldsLocalSchemaFacetPropertiesLabel
              : localSchemaFacet === 'validation'
                ? UI_COPY.graphFieldsLocalSchemaFacetValidationLabel
                : UI_COPY.graphFieldsLocalSchemaFacetLocalRulesLabel}
          </div>
          {localSchemaError ? (
            <div className={`${uiPanelKeyValueTextSizeClass} text-red-600`}>
              {localSchemaError}
            </div>
          ) : null}
          <div className="mb-1 flex items-center gap-1">
            <button
              type="button"
              onClick={applyLocalSchemaText}
              className={[
                'App-toolbar__btn',
                UI_THEME_TOKENS.button.neutralMuted,
                UI_THEME_TOKENS.button.hoverBg,
                uiPanelKeyValueTextSizeClass,
              ].join(' ')}
            >
              {UI_COPY.orchestratorApplyChangesLabel}
            </button>
            <button
              type="button"
              onClick={resetLocalSchemaText}
              disabled={!hasLocalSchemaOwner}
              className={[
                'App-toolbar__btn',
                UI_THEME_TOKENS.button.neutralMuted,
                UI_THEME_TOKENS.button.hoverBg,
                uiPanelKeyValueTextSizeClass,
              ].join(' ')}
            >
              {UI_LABELS.reset}
            </button>
          </div>

          {localSchemaFacet === 'validation' ? (
            <FieldLocalSchemaValidationEditor
              schema={schema}
              localSchemaScope={localSchemaScope}
              localSchemaOwnerKey={localSchemaOwnerKey}
              uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
              uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
              setSelectedGlobalView={setSelectedGlobalView}
              validationPropertyNames={validationPropertyNames}
              localValidationWarnings={localValidationWarnings}
              localValidationRequiredSet={localValidationRequiredSet}
              setLocalValidationRequiredSet={setLocalValidationRequiredSet}
              localValidationTypesMap={localValidationTypesMap}
              setLocalValidationTypesMap={setLocalValidationTypesMap}
              localValidationBulkType={localValidationBulkType}
              setLocalValidationBulkType={setLocalValidationBulkType}
              localValidationSeverity={localValidationSeverity}
              setLocalValidationSeverity={setLocalValidationSeverity}
              localValidationOtherText={localValidationOtherText}
              setLocalValidationOtherText={setLocalValidationOtherText}
              getValidationControlId={getValidationControlId}
              focusValidationControl={focusValidationControl}
            />
          ) : localSchemaFacet === 'properties' || localSchemaFacet === 'localRules' ? (
            <FieldLocalSchemaRowsEditor
              localSchemaFacet={localSchemaFacet}
              schema={schema}
              hasLocalSchemaOwner={hasLocalSchemaOwner}
              localSchemaScope={localSchemaScope}
              localSchemaOwnerKey={localSchemaOwnerKey}
              uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
              uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
              localSchemaRows={localSchemaRows}
              setLocalSchemaRows={setLocalSchemaRows}
              suggestedPropertyKeys={suggestedPropertyKeys}
              suggestedPropertyTypeByKey={suggestedPropertyTypeByKey}
              suggestedPropertySampleByKey={suggestedPropertySampleByKey}
              enumCandidatesByKey={enumCandidatesByKey}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
