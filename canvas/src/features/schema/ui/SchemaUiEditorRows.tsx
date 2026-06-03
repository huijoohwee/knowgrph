import type { GraphSchema } from '@/lib/graph/schema'
import { MarkdownStructuredTextEditor } from '@/features/markdown/ui/MarkdownStructuredTextEditor'
import { Eraser } from 'lucide-react'
import { TwoColumnEditorGrid } from '@/features/panels/ui/TwoColumnEditorGrid'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_PANEL_INLINE_FIELD_CLASSNAME,
  UI_RESPONSIVE_SCHEMA_PROPERTY_NAME_CLASSNAME,
  UI_RESPONSIVE_SCHEMA_RULES_TEXT_EDITOR_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { uiToolbarButtonMutedClassName } from '@/features/toolbar/ui/toolbarStyles'

const schemaInputClassName = `${UI_RESPONSIVE_PANEL_INLINE_FIELD_CLASSNAME} rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${UI_THEME_TOKENS.focus.primaryBorderRing}`
const schemaActionButtonClassName = `App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${uiToolbarButtonMutedClassName}`
const schemaLabelClassName = `text-xs ${UI_THEME_TOKENS.text.secondary} mb-1`
const schemaValueTextClassName = `text-xs ${UI_THEME_TOKENS.text.primary}`

function SchemaSubstepHeader({ title, label }: { title: string; label?: string }) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-sm')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  return (
    <div className="flex items-center justify-between mb-1">
      <span className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-semibold ${UI_THEME_TOKENS.text.primary}`}>
        {title}
      </span>
      {label && (
        <span className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.primary}`}>
          {label}
        </span>
      )}
    </div>
  )
}

export interface SchemaUiHeaderRowProps {
  type: 'node' | 'edge'
  availableKeys: string[]
  selectedKey: string
  newKey: string
  setSelectedKey: (key: string) => void
  setNewKey: (key: string) => void
  error: string
}

export function SchemaUiHeaderRow({
  type,
  availableKeys,
  selectedKey,
  newKey,
  setSelectedKey,
  setNewKey,
  error,
}: SchemaUiHeaderRowProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-sm')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  return (
    <>
      <div className="Stack Stack_horizontal items-center gap-1 mb-1">
        <select
          value={selectedKey}
          onChange={e => setSelectedKey(e.target.value)}
          className={`${schemaInputClassName} ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}
        >
          {availableKeys.length === 0 && <option value="">(none)</option>}
          {availableKeys.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <input
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          placeholder={type === 'node' ? 'New node type…' : 'New edge label…'}
          className={`${schemaInputClassName} ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} flex-1`}
        />
        <button
          type="button"
          onClick={() => { if (newKey.trim()) { setSelectedKey(newKey.trim()); setNewKey('') } }}
          className={`${schemaActionButtonClassName} ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}
        >
          Add
        </button>
      </div>
      {error && (
        <div className={`${uiPanelMicroLabelTextSizeClass} text-red-600 mb-2`}>
          {error}
        </div>
      )}
    </>
  )
}

export interface SchemaUiTemplatePropsRowProps {
  templateText: string
  propsText: string
  setTemplateText: (text: string) => void
  setPropsText: (text: string) => void
}

export interface SchemaUiMetadataContextRowProps {
  metadataText: string
  contextText: string
  setMetadataText: (text: string) => void
  setContextText: (text: string) => void
}

export function SchemaUiMetadataContextRow({
  metadataText,
  contextText,
  setMetadataText,
  setContextText,
}: SchemaUiMetadataContextRowProps) {
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  return (
    <TwoColumnEditorGrid className="mt-2">
      <div className="flex min-h-0 flex-col">
        <SchemaSubstepHeader title="Metadata" label="Metadata" />
        <div className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.secondary} mb-1`}>
          Shared provenance and RAG configuration belong here, not in per-type properties.
        </div>
        <MarkdownStructuredTextEditor
          value={metadataText}
          onChange={v => setMetadataText(v)}
          className="w-full flex-1 min-h-0"
          language="json"
        />
      </div>
      <div className="flex min-h-0 flex-col">
        <SchemaSubstepHeader title="Context" label="Context" />
        <div className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.secondary} mb-1`}>
          JSON-LD context for schema serialization.
        </div>
        <MarkdownStructuredTextEditor
          value={contextText}
          onChange={v => setContextText(v)}
          className="w-full flex-1 min-h-0"
          language="json"
        />
      </div>
    </TwoColumnEditorGrid>
  )
}

export function SchemaUiTemplatePropsRow({
  templateText,
  propsText,
  setTemplateText,
  setPropsText,
}: SchemaUiTemplatePropsRowProps) {
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  return (
    <TwoColumnEditorGrid className="flex-1 min-h-0">
      <div className="flex min-h-0 flex-col">
        <SchemaSubstepHeader title="Template" label="Template" />
        <MarkdownStructuredTextEditor
          value={templateText}
          onChange={v => setTemplateText(v)}
          className="w-full flex-1 min-h-0"
          language="json"
        />
      </div>
      <div className="flex min-h-0 flex-col">
        <SchemaSubstepHeader title="Properties" label="Properties" />
        <div className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.secondary} mb-1`}>
          For shared schemas, keep provenance and RAG configuration in top-level metadata or context,
          not in node or edge properties.
        </div>
        <MarkdownStructuredTextEditor
          value={propsText}
          onChange={v => setPropsText(v)}
          className="w-full flex-1 min-h-0"
          language="json"
        />
      </div>
    </TwoColumnEditorGrid>
  )
}

export interface SchemaUiValidationRulesRowProps {
  type: 'node' | 'edge'
  schema: GraphSchema
  selectedKey: string
  propertyNames: string[]
  validationText: string
  rulesText: string
  setValidationText: (text: string) => void
  setRulesText: (text: string) => void
  requiredSet: Set<string>
  setRequiredSet: (next: Set<string>) => void
  typesMap: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>
  setTypesMap: (next: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>) => void
  bulkType: 'string' | 'number' | 'boolean' | 'array' | 'object'
  setBulkType: (next: 'string' | 'number' | 'boolean' | 'array' | 'object') => void
  rulesTitle?: string
  rulesHelperText?: string
}

export function SchemaUiValidationRulesRow({
  type,
  schema,
  selectedKey,
  propertyNames,
  validationText,
  rulesText,
  setValidationText,
  setRulesText,
  requiredSet,
  setRequiredSet,
  typesMap,
  setTypesMap,
  bulkType,
  setBulkType,
  rulesTitle,
  rulesHelperText,
}: SchemaUiValidationRulesRowProps) {
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  return (
    <TwoColumnEditorGrid className="mt-2">
      <div className="flex min-h-0 flex-col">
        <SchemaSubstepHeader title="Validation" label="Validation" />
        <div className="mb-2">
          <div className={schemaLabelClassName}>{UI_COPY.validationRequiredFieldsTitle}</div>
          <div className="grid grid-cols-3 gap-1">
            {propertyNames.length === 0 && <div className={`text-xs ${UI_THEME_TOKENS.text.tertiary}`}>(no properties)</div>}
            {propertyNames.map(p => (
              <label key={p} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={requiredSet.has(p)}
                  onChange={e => {
                    const next = new Set(requiredSet)
                    if (e.target.checked) next.add(p); else next.delete(p)
                    setRequiredSet(next)
                  }}
                  className={`rounded ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.selectionControl}`}
                />
                <span>{p}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mb-2">
          <div className={schemaLabelClassName}>{UI_COPY.validationPropertyTypesTitle}</div>
          <div className="grid grid-cols-2 gap-1">
            {propertyNames.map(p => (
              <div key={p} className="flex items-center gap-1">
                <span className={`${schemaValueTextClassName} ${UI_RESPONSIVE_SCHEMA_PROPERTY_NAME_CLASSNAME}`}>{p}</span>
                <select
                  value={typesMap[p] ?? 'string'}
                  onChange={e => {
                    const v = e.target.value as 'string' | 'number' | 'boolean' | 'array' | 'object'
                    setTypesMap({ ...typesMap, [p]: v })
                  }}
                  className={`${UI_RESPONSIVE_PANEL_INLINE_FIELD_CLASSNAME} text-xs rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${UI_THEME_TOKENS.focus.primaryBorderRing} flex-1`}
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="array">array</option>
                  <option value="object">object</option>
                </select>
              </div>
            ))}
          </div>
        </div>
        <div className="Stack Stack_horizontal items-center gap-1 mb-2">
          <button
            type="button"
            className={schemaActionButtonClassName}
            onClick={() => setRequiredSet(new Set(propertyNames))}
          >
            {UI_COPY.validationRequireAllButtonLabel}
          </button>
          <button
            type="button"
            className={schemaActionButtonClassName}
            onClick={() => {
              const nums = propertyNames.filter(p => (typesMap[p] ?? 'string') === 'number')
              setRequiredSet(new Set(nums))
            }}
          >
            {UI_COPY.validationRequireNumericButtonLabel}
          </button>
          <button
            type="button"
            className={`${schemaActionButtonClassName} inline-flex items-center gap-1`}
            onClick={() => setRequiredSet(new Set())}
          >
            <Eraser className="w-3.5 h-3.5" />
            {UI_COPY.validationClearRequiredButtonLabel}
          </button>
          <select
            value={bulkType}
            onChange={e => setBulkType(e.target.value as typeof bulkType)}
            className={`${schemaInputClassName} text-xs`}
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="array">array</option>
            <option value="object">object</option>
          </select>
          <button
            type="button"
            className={schemaActionButtonClassName}
            onClick={() => {
              const next: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'> = {}
              propertyNames.forEach(p => { next[p] = bulkType })
              setTypesMap(next)
            }}
          >
            {UI_COPY.validationSetAllTypesButtonLabel}
          </button>
          <button
            type="button"
            className={schemaActionButtonClassName}
            onClick={() => {
              const inferred: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'> = {}
              propertyNames.forEach(p => {
                const specType = (type === 'node'
                  ? schema.propertySchemas?.node?.[selectedKey]?.[p]?.type
                  : schema.propertySchemas?.edge?.[selectedKey]?.[p]?.type)
                inferred[p] = specType ?? 'string'
              })
              setTypesMap(inferred)
            }}
          >
            {UI_COPY.validationInferTypesButtonLabel}
          </button>
        </div>
        <MarkdownStructuredTextEditor
          value={validationText}
          onChange={v => setValidationText(v)}
          className="w-full flex-1 min-h-0"
          language="json"
        />
      </div>
      <div className="flex min-h-0 flex-col">
        <SchemaSubstepHeader title={rulesTitle ?? 'Rules'} label={rulesTitle ?? 'Rules'} />
        {rulesHelperText ? (
          <div className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.secondary} mb-1`}>
            {rulesHelperText}
          </div>
        ) : null}
        <MarkdownStructuredTextEditor
          value={rulesText}
          onChange={v => setRulesText(v)}
          className="w-full flex-1 min-h-0"
          language="json"
        />
      </div>
    </TwoColumnEditorGrid>
  )
}

export function SchemaUiRulesRow({
  title,
  rulesText,
  setRulesText,
  helperText,
  className,
}: {
  title: string
  rulesText: string
  setRulesText: (text: string) => void
  helperText?: string
  className?: string
}) {
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  return (
    <div className={className ?? ''}>
      <SchemaSubstepHeader title={title} label={title} />
      {helperText ? (
        <div className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.secondary} mb-1`}>
          {helperText}
        </div>
      ) : null}
      <MarkdownStructuredTextEditor
        value={rulesText}
        onChange={v => setRulesText(v)}
        className={UI_RESPONSIVE_SCHEMA_RULES_TEXT_EDITOR_CLASSNAME}
        language="json"
      />
    </div>
  )
}

export interface SchemaUiLayoutSectionProps {
  layoutCharge: number
  layoutCenterStrength: number
  layoutAlphaDecay: number
  fitPadding: number
  setLayoutCharge: (n: number) => void
  setLayoutCenterStrength: (n: number) => void
  setLayoutAlphaDecay: (n: number) => void
  setFitPadding: (n: number) => void
  linkDistanceText: string
  collisionByTypeText: string
  setLinkDistanceText: (t: string) => void
  setCollisionByTypeText: (t: string) => void
}

export function SchemaUiLayoutSection({
  layoutCharge,
  layoutCenterStrength,
  layoutAlphaDecay,
  fitPadding,
  setLayoutCharge,
  setLayoutCenterStrength,
  setLayoutAlphaDecay,
  setFitPadding,
  linkDistanceText,
  setLinkDistanceText,
  collisionByTypeText,
  setCollisionByTypeText,
}: SchemaUiLayoutSectionProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )

  return (
    <div className="mt-2">
      <SchemaSubstepHeader title="Layout" label="Layout" />
      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col">
          <label className={schemaLabelClassName}>Charge</label>
          <input
            type="range"
            min="-1000"
            max="1000"
            step="10"
            className="w-full"
            value={layoutCharge}
            onChange={e => setLayoutCharge(parseFloat(e.target.value))}
          />
          <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary}`}>{layoutCharge}</div>
        </div>
        <div className="flex flex-col">
          <label className={schemaLabelClassName}>Center Strength</label>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            className="w-full"
            value={layoutCenterStrength}
            onChange={e => setLayoutCenterStrength(parseFloat(e.target.value))}
          />
          <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary}`}>{layoutCenterStrength}</div>
        </div>
        <div className="flex flex-col">
          <label className={schemaLabelClassName}>Alpha Decay</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            className="w-full"
            value={layoutAlphaDecay}
            onChange={e => setLayoutAlphaDecay(parseFloat(e.target.value))}
          />
          <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary}`}>{layoutAlphaDecay}</div>
        </div>
        <div className="flex flex-col">
          <label className={schemaLabelClassName}>Fit Padding</label>
          <input
            type="range"
            min="0"
            max="200"
            step="1"
            className="w-full"
            value={fitPadding}
            onChange={e => setFitPadding(parseFloat(e.target.value))}
          />
          <div className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary}`}>{fitPadding}</div>
        </div>
      </div>
      <TwoColumnEditorGrid className="mt-2">
        <div className="flex min-h-0 flex-col">
          <div className="text-xs font-medium mb-1">Link Distance by Label</div>
          <MarkdownStructuredTextEditor
            value={linkDistanceText}
            onChange={v => setLinkDistanceText(v)}
            className="w-full flex-1 min-h-0"
            language="json"
          />
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="text-xs font-medium mb-1">Collision Radius by Node Type</div>
          <MarkdownStructuredTextEditor
            value={collisionByTypeText}
            onChange={v => setCollisionByTypeText(v)}
            className="w-full flex-1 min-h-0"
            language="json"
          />
        </div>
      </TwoColumnEditorGrid>
    </div>
  )
}
