import React from 'react'
import { Settings as SettingsIcon, Tag as TagIcon } from 'lucide-react'
import { ScopeIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import { getIconSizeClass, getPillClass } from '@/lib/ui/icons'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'

export const renderSettingInput = (
  key: string,
  type: string,
  writable: boolean,
  values: Record<string, string | number | boolean>,
  setValues: React.Dispatch<React.SetStateAction<Record<string, string | number | boolean>>>,
  dirtyRef: React.MutableRefObject<Set<string>>,
  options?: string[],
  displayValueOverride?: string | number | boolean,
) => {
  const colorKeyDefaults: Record<string, string> = {
    'three.camera.backgroundColor': '#020617',
    'three.camera.fogColor': '#1e1b4b',
    'three.graph.starfieldColor': '#facc15',
  }
  const v = typeof displayValueOverride === 'undefined' ? values[key] : displayValueOverride
  const pillBaseRaw = values.uiIconPillClass
  const pillBaseClass =
    typeof pillBaseRaw === 'string' && pillBaseRaw.trim().length > 0
      ? pillBaseRaw
      : `inline-flex items-center gap-1 h-6 rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} px-1.5`
  const badgeChipBaseRaw = values.uiIconBadgeChipClass
  const badgeChipBaseClass =
    typeof badgeChipBaseRaw === 'string' && badgeChipBaseRaw.trim().length > 0
      ? badgeChipBaseRaw
      : `inline-flex items-center gap-1 h-6 rounded-full border px-1 ${UI_THEME_TOKENS.panel.bg}`
  const rawPanelInputClass = values['uiPanelKeyValueInputClass']
  const uiPanelKeyValueInputClass =
    typeof rawPanelInputClass === 'string' && rawPanelInputClass.trim().length > 0
      ? rawPanelInputClass
      : `w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`
  const uiPanelKeyValueTextareaClass = [
    ...uiPanelKeyValueInputClass.split(/\s+/).filter(token => token && token !== 'h-6' && token !== 'text-right'),
    'py-1',
    'text-left',
    'font-mono',
    'text-xs',
  ].join(' ')
  const iconSizeClass = getIconSizeClass(values.uiIconScale === 'compact' ? 'compact' : 'default')
  const iconStrokeWidth =
    typeof values.uiIconStrokeWidth === 'number' && Number.isFinite(values.uiIconStrokeWidth)
      ? values.uiIconStrokeWidth
      : 1.5
  if (!writable) return <span className={UI_THEME_TOKENS.text.primary}>{String(v)}</span>
  if (type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={Boolean(v)}
        onChange={e => {
          dirtyRef.current.add(key)
          setValues(prev => ({ ...prev, [key]: e.target.checked }))
        }}
        className={`w-4 h-4 rounded ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.selectionControl}`}
      />
    )
  }
  if (key === 'payments.stripe.secretKey' || key === 'payments.stripe.webhookSecret') {
    const str = String(v || '')
    return (
      <PlainTextInputEditor
        value={str}
        onChange={next => {
          dirtyRef.current.add(key)
          setValues(prev => ({ ...prev, [key]: next }))
        }}
        className={uiPanelKeyValueInputClass}
        inputType="password"
      />
    )
  }
  if (key === 'uiIconColorClass' || key === 'uiIconHoverBgClass') {
    const str = String(v || '')
    const placeholder = key === 'uiIconColorClass' ? UI_THEME_TOKENS.icon.color : UI_THEME_TOKENS.button.hoverBg
    const appliedClass = str.trim().length > 0 ? str : placeholder
    const previewBase =
      `w-8 h-6 p-0 border ${UI_THEME_TOKENS.input.border} rounded ${UI_THEME_TOKENS.panel.bg} text-xs flex items-center justify-center`
    const previewClass =
      key === 'uiIconColorClass'
        ? `${previewBase} ${appliedClass}`
        : `${previewBase} ${UI_THEME_TOKENS.text.secondary} ${appliedClass}`
    const previewLabel = key === 'uiIconColorClass' ? 'Aa' : 'Hover'
    return (
      <div className="flex w-full min-w-0 items-center gap-2">
        <PlainTextInputEditor value={previewLabel} readOnly className={previewClass} />
        <PlainTextInputEditor
          value={str}
          onChange={next => {
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1 min-w-0`}
          placeholder={placeholder}
        />
      </div>
    )
  }
  if (key === 'uiIconButtonPaddingClass') {
    const str = String(v || '')
    const placeholder = UI_THEME_TOKENS.button.padding
    const appliedClass = str.trim().length > 0 ? str : placeholder
    const previewClass = [
      `inline-flex items-center justify-center w-8 h-6 rounded border border-dashed ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.panel.bg} text-xs`,
      appliedClass,
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className={previewClass}>
          <SettingsIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden="true" />
        </div>
        <PlainTextInputEditor
          value={str}
          onChange={next => {
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1 min-w-0`}
          placeholder={placeholder}
        />
      </div>
    )
  }
  if (key === 'uiIconPillClass') {
    const str = String(v || '')
    const placeholder = pillBaseClass
    const appliedClass = str.trim().length > 0 ? str : placeholder
    const previewClass = [
      appliedClass,
      'inline-flex items-center justify-center gap-1 h-6 box-border text-xs',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className={previewClass}>
          <TagIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden="true" />
          <span>Scope</span>
        </div>
        <PlainTextInputEditor
          value={str}
          onChange={next => {
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1 min-w-0`}
          placeholder={pillBaseClass}
        />
      </div>
    )
  }
  if (key === 'uiIconPillLegendTextSizeClass' || key === 'uiIconPillBadgeTextSizeClass') {
    const str = String(v || '')
    const placeholder = key === 'uiIconPillLegendTextSizeClass' ? 'text-xs' : 'text-[9px]'
    const appliedClass = str.trim().length > 0 ? str : placeholder
    const legendPreviewClass =
      key === 'uiIconPillLegendTextSizeClass'
        ? getPillClass('legend', {
            baseClass: `${pillBaseClass} inline-flex items-center gap-1 box-border h-6`,
            legendTextSizeClass: appliedClass,
            textColorClass: UI_THEME_TOKENS.text.primary,
          })
        : ''
    const badgePreviewClass =
      key === 'uiIconPillBadgeTextSizeClass'
        ? getPillClass('badge', {
            baseClass: `${pillBaseClass} inline-flex items-center gap-1 box-border h-6`,
            badgeTextSizeClass: appliedClass,
            textColorClass: UI_THEME_TOKENS.text.primary,
          })
        : ''
    return (
      <div className="flex w-full min-w-0 items-center gap-2">
        {key === 'uiIconPillLegendTextSizeClass' ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className={legendPreviewClass}>
              <ScopeIcon scope="node" className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden="true" />
              <span>Base</span>
            </span>
            <span className={legendPreviewClass}>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={iconSizeClass}
                fill="none"
                stroke="currentColor"
                strokeWidth={iconStrokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M9 12h3l2-3" />
              </svg>
              <span>Origin</span>
            </span>
            <span className={legendPreviewClass}>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={iconSizeClass}
                fill="none"
                stroke="currentColor"
                strokeWidth={iconStrokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12c2-4 5.5-6.5 10-6.5S20 8 22 12c-2 4-5.5 6.5-10 6.5S4 16 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Visibility</span>
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            <span className={badgePreviewClass}>
              <span>Base</span>
            </span>
          </div>
        )}
        <PlainTextInputEditor
          value={str}
          onChange={next => {
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1 min-w-0`}
          placeholder={placeholder}
        />
      </div>
    )
  }
  if (key === 'uiIconBadgeChipClass') {
    const str = String(v || '')
    const placeholder = 'px-1 py-[1px] rounded-full border'
    const appliedClass = str.trim().length > 0 ? str : placeholder
    const previewClass = [
      appliedClass,
      `inline-flex items-center justify-center gap-1 h-6 box-border ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.primary} text-[9px]`,
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className={previewClass}>
          <TagIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} aria-hidden="true" />
          <span>Badge</span>
        </div>
        <PlainTextInputEditor
          value={str}
          onChange={next => {
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1 min-w-0`}
          placeholder={placeholder}
        />
      </div>
    )
  }
  if (key === 'uiIconBadgeChipTextSizeClass') {
    const str = String(v || '')
    const placeholder = 'text-[9px]'
    const appliedClass = str.trim().length > 0 ? str : placeholder
    const previewClass = [
      badgeChipBaseClass,
      appliedClass,
      `inline-flex items-center gap-1 h-6 box-border ${UI_THEME_TOKENS.text.primary}`,
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className={previewClass}>
          <TagIcon className="w-3 h-3" aria-hidden="true" />
          <span>Badge</span>
        </div>
        <PlainTextInputEditor
          value={str}
          onChange={next => {
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1 min-w-0`}
          placeholder={placeholder}
        />
      </div>
    )
  }
  if (key in colorKeyDefaults) {
    const str = String(v || '')
    const fallback = colorKeyDefaults[key]
    const normalized = str.trim() || fallback
    const colorValue =
      normalized.startsWith('#') && (normalized.length === 4 || normalized.length === 7)
        ? normalized
        : '#000000'
    return (
      <div className="flex w-full min-w-0 items-center gap-2">
        <input
          type="color"
          value={colorValue}
          onChange={e => {
            const next = e.target.value
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`w-8 h-6 p-0 border ${UI_THEME_TOKENS.input.border} rounded cursor-pointer bg-transparent`}
        />
        <PlainTextInputEditor
          value={str}
          onChange={next => {
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1 min-w-0`}
          placeholder={fallback}
        />
      </div>
    )
  }
  if (key === 'chatAuthMode') {
    const raw = String(v ?? '').trim()
    const normalized = raw === 'byok' ? 'byok' : 'serverManaged'
    return (
      <select
        value={normalized}
        onChange={e => {
          const selected = e.target.value === 'byok' ? 'byok' : 'serverManaged'
          dirtyRef.current.add(key)
          setValues(prev => {
            const next: Record<string, string | number | boolean> = { ...prev, [key]: selected }
            if (selected === 'serverManaged') {
              dirtyRef.current.add('chatApiKey')
              next.chatApiKey = ''
            }
            return next
          })
        }}
        className={`w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`}
      >
        <option value="serverManaged">Server-managed Key</option>
        <option value="byok">BYOK</option>
      </select>
    )
  }
  if (key === 'maps.grabmaps.authMode') {
    const raw = String(v ?? '').trim().toLowerCase()
    const normalized = raw === 'servermanaged' ? 'serverManaged' : 'byok'
    return (
      <select
        value={normalized}
        onChange={e => {
          const selected = e.target.value === 'serverManaged' ? 'serverManaged' : 'byok'
          dirtyRef.current.add(key)
          setValues(prev => {
            const next: Record<string, string | number | boolean> = { ...prev, [key]: selected }
            if (selected === 'serverManaged') {
              dirtyRef.current.add('maps.grabmaps.apiKey')
              next['maps.grabmaps.apiKey'] = ''
            }
            return next
          })
        }}
        className={`w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`}
      >
        <option value="byok">BYOK</option>
        <option value="serverManaged">Server-managed Key</option>
      </select>
    )
  }

  if (key === 'chatModel' && !Array.isArray(options)) {
    const str = String(v ?? '')
    return (
      <PlainTextInputEditor
        value={str}
        list="settings-chat-model-options"
        spellCheck={false}
        onChange={next => {
          dirtyRef.current.add(key)
          setValues(prev => ({ ...prev, [key]: next }))
        }}
        className={`w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-left ${UI_THEME_TOKENS.focus.primaryBorderRing}`}
      />
    )
  }

  if (type === 'string' && Array.isArray(options) && options.length > 0) {
    const raw = String(v ?? '').trim()
    const normalized = raw && options.includes(raw) ? raw : (options[0] || '')
    return (
      <select
        value={normalized}
        onChange={e => {
          const selected = String(e.target.value || '').trim()
          dirtyRef.current.add(key)
          setValues(prev => ({ ...prev, [key]: selected }))
        }}
        className={`w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`}
      >
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }
  if (key === 'maps.grabmaps.apiKey') {
    const authModeRaw = String(values['maps.grabmaps.authMode'] || '').trim().toLowerCase()
    const authMode = authModeRaw === 'servermanaged' ? 'serverManaged' : 'byok'
    if (authMode !== 'byok') {
      return (
        <PlainTextInputEditor
          value=""
          readOnly
          placeholder="Server-managed Key"
          className={`w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`}
        />
      )
    }
    const str = String(v || '')
    return (
      <input
        type="password"
        value={str}
        autoComplete="off"
        spellCheck={false}
        onChange={e => {
          const next = e.target.value
          dirtyRef.current.add(key)
          setValues(prev => ({ ...prev, [key]: next }))
        }}
        className={`w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`}
      />
    )
  }
  if (key === 'chatApiKey') {
    const authMode = String(values.chatAuthMode || '').trim() === 'byok' ? 'byok' : 'serverManaged'
    if (authMode !== 'byok') {
      return (
        <PlainTextInputEditor
          value=""
          readOnly
          placeholder="Server-managed Key"
          className={`w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`}
        />
      )
    }
    const str = String(v || '')
    return (
      <input
        type="password"
        value={str}
        autoComplete="off"
        spellCheck={false}
        onChange={e => {
          const next = e.target.value
          dirtyRef.current.add(key)
          setValues(prev => ({ ...prev, [key]: next }))
        }}
        className={`w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} rounded text-right`}
      />
    )
  }
  if (key === 'chatSystemPrompt' || key === 'integrationConfigsJson') {
    const str = String(v ?? '')
    const rows = key === 'integrationConfigsJson' ? 6 : 4
    const minHeightClass = key === 'integrationConfigsJson' ? 'min-h-24' : 'min-h-16'
    return (
      <PlainTextInputEditor
        multiline
        rows={rows}
        value={str}
        spellCheck={false}
        onChange={next => {
          dirtyRef.current.add(key)
          setValues(prev => ({ ...prev, [key]: next }))
        }}
        className={`${uiPanelKeyValueTextareaClass} ${minHeightClass}`}
      />
    )
  }
  if (type === 'json') {
    const str = String(v ?? '')
    return (
      <PlainTextInputEditor
        multiline
        rows={6}
        value={str}
        spellCheck={false}
        onChange={next => {
          dirtyRef.current.add(key)
          setValues(prev => ({ ...prev, [key]: next }))
        }}
        className={`${uiPanelKeyValueTextareaClass} min-h-24`}
      />
    )
  }
  if (key === 'chatEndpointUrl') {
    const str = String(v ?? '')
    return (
      <PlainTextInputEditor
        value={str}
        spellCheck={false}
        onChange={next => {
          dirtyRef.current.add(key)
          setValues(prev => ({ ...prev, [key]: next }))
        }}
        className={`w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-left ${UI_THEME_TOKENS.focus.primaryBorderRing}`}
      />
    )
  }
  if (options && options.length > 0) {
    const raw = String(v ?? '')
    const normalized = options.includes(raw) ? raw : options[0]
    return (
      <select
        value={normalized}
        onChange={e => {
          const val = e.target.value
          const next = options.includes(val) ? val : options[0]
          dirtyRef.current.add(key)
          setValues(prev => ({ ...prev, [key]: next }))
        }}
        className={`w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`}
      >
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }
  const isClassLikeKey = key.toLowerCase().includes('class')
  const baseInputClass =
    type === 'number' || isClassLikeKey
      ? uiPanelKeyValueInputClass
      : `w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`
  const finalInputClass = baseInputClass
  return (
    <PlainTextInputEditor
      inputType={type === 'number' ? 'number' : 'text'}
      value={type === 'number' ? (isNaN(Number(v)) ? '' : String(Number(v))) : String(v ?? '')}
      onChange={next => {
        const val = type === 'number' ? Number(next || '0') : next
        dirtyRef.current.add(key)
        setValues(prev => ({ ...prev, [key]: val }))
      }}
      className={finalInputClass}
    />
  )
}
