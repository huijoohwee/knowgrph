import React from 'react'
import { Settings as SettingsIcon, Tag as TagIcon } from 'lucide-react'
import { ScopeIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import { getPillClass } from '@/lib/ui/icons'

export const renderSettingInput = (
  key: string,
  type: string,
  writable: boolean,
  values: Record<string, string | number | boolean>,
  setValues: React.Dispatch<React.SetStateAction<Record<string, string | number | boolean>>>,
  dirtyRef: React.MutableRefObject<Set<string>>,
  options?: string[],
) => {
  const colorKeyDefaults: Record<string, string> = {
    'three.camera.backgroundColor': '#020617',
    'three.camera.fogColor': '#1e1b4b',
    'three.graph.starfieldColor': '#facc15',
  }
  const v = values[key]
  const pillBaseRaw = values.uiIconPillClass
  const pillBaseClass =
    typeof pillBaseRaw === 'string' && pillBaseRaw.trim().length > 0
      ? pillBaseRaw
      : 'inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5'
  const badgeChipBaseRaw = values.uiIconBadgeChipClass
  const badgeChipBaseClass =
    typeof badgeChipBaseRaw === 'string' && badgeChipBaseRaw.trim().length > 0
      ? badgeChipBaseRaw
      : 'inline-flex items-center rounded-full border px-1 py-[1px] bg-white'
  const rawPanelInputClass = values['uiPanelKeyValueInputClass']
  const uiPanelKeyValueInputClass =
    typeof rawPanelInputClass === 'string' && rawPanelInputClass.trim().length > 0
      ? rawPanelInputClass
      : 'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right'
  if (!writable) return <span className="text-gray-700">{String(v)}</span>
  if (type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={Boolean(v)}
        onChange={e => {
          dirtyRef.current.add(key)
          setValues(prev => ({ ...prev, [key]: e.target.checked }))
        }}
      />
    )
  }
  if (key === 'uiIconColorClass' || key === 'uiIconHoverBgClass') {
    const str = String(v || '')
    const placeholder = key === 'uiIconColorClass' ? 'text-gray-600' : 'hover:bg-gray-100'
    const appliedClass = str.trim().length > 0 ? str : placeholder
    const previewBase =
      'w-8 h-6 p-0 border border-gray-300 rounded bg-white text-xs flex items-center justify-center'
    const previewClass =
      key === 'uiIconColorClass'
        ? `${previewBase} ${appliedClass}`
        : `${previewBase} text-gray-600 ${appliedClass}`
    const previewLabel = key === 'uiIconColorClass' ? 'Aa' : 'Hover'
    return (
      <div className="flex items-center gap-2">
        <input type="text" value={previewLabel} readOnly className={previewClass} />
        <input
          type="text"
          value={str}
          onChange={e => {
            const next = e.target.value
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1`}
          placeholder={placeholder}
        />
      </div>
    )
  }
  if (key === 'uiIconButtonPaddingClass') {
    const str = String(v || '')
    const placeholder = 'p-2'
    const appliedClass = str.trim().length > 0 ? str : placeholder
    const previewClass = [
      'inline-flex items-center justify-center w-8 h-6 rounded border border-dashed border-gray-300 bg-white text-xs',
      appliedClass,
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className="flex items-center gap-2">
        <div className={previewClass}>
          <SettingsIcon className="w-3 h-3" aria-hidden="true" />
        </div>
        <input
          type="text"
          value={str}
          onChange={e => {
            const next = e.target.value
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1`}
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
      'inline-flex items-center justify-center w-8 h-6 text-xs',
      appliedClass,
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className="flex items-center gap-2">
        <div className={previewClass}>
          <TagIcon className="w-3 h-3" aria-hidden="true" />
          <span>Scope</span>
        </div>
        <input
          type="text"
          value={str}
          onChange={e => {
            const next = e.target.value
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1`}
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
            baseClass: `${pillBaseClass} inline-flex items-center gap-1`,
            legendTextSizeClass: appliedClass,
            textColorClass: 'text-gray-700',
          })
        : ''
    const badgePreviewClass =
      key === 'uiIconPillBadgeTextSizeClass'
        ? getPillClass('badge', {
            baseClass: `${pillBaseClass} inline-flex items-center gap-1`,
            badgeTextSizeClass: appliedClass,
            textColorClass: 'text-gray-700',
          })
        : ''
    return (
      <div className="flex items-center gap-2">
        {key === 'uiIconPillLegendTextSizeClass' ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className={legendPreviewClass}>
              <ScopeIcon scope="node" className="w-3 h-3 text-gray-500" strokeWidth={1.5} aria-hidden="true" />
              <span>Base</span>
            </span>
            <span className={legendPreviewClass}>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
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
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
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
        <input
          type="text"
          value={str}
          onChange={e => {
            const next = e.target.value
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1`}
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
      'inline-flex items-center justify-center w-8 h-6 bg-white text-[9px]',
      appliedClass,
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className="flex items-center gap-2">
        <div className={previewClass}>
          <TagIcon className="w-3 h-3" aria-hidden="true" />
          <span>Badge</span>
        </div>
        <input
          type="text"
          value={str}
          onChange={e => {
            const next = e.target.value
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1`}
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
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className="flex items-center gap-2">
        <div className={previewClass}>
          <TagIcon className="w-3 h-3" aria-hidden="true" />
          <span>Badge</span>
        </div>
        <input
          type="text"
          value={str}
          onChange={e => {
            const next = e.target.value
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1`}
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
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={colorValue}
          onChange={e => {
            const next = e.target.value
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className="w-8 h-6 p-0 border border-gray-300 rounded cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={str}
          onChange={e => {
            const next = e.target.value
            dirtyRef.current.add(key)
            setValues(prev => ({ ...prev, [key]: next }))
          }}
          className={`${uiPanelKeyValueInputClass} flex-1`}
          placeholder={fallback}
        />
      </div>
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
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white"
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
      : 'w-full h-6 px-2 text-sm border border-gray-300 rounded'
  const finalInputClass = baseInputClass
  return (
    <input
      type={type === 'number' ? 'number' : 'text'}
      value={type === 'number' ? (isNaN(Number(v)) ? '' : Number(v)) : String(v ?? '')}
      onChange={e => {
        const val = type === 'number' ? Number(e.target.value || '0') : e.target.value
        dirtyRef.current.add(key)
        setValues(prev => ({ ...prev, [key]: val }))
      }}
      className={finalInputClass}
    />
  )
}
