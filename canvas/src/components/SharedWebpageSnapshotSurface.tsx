import React from 'react'
import type { WebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutExport'
import { pickWebpageSnapshotRects } from 'grph-shared/rich-media/webpageSnapshot'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type SharedWebpageSnapshotSurfaceProps = {
  url: string
  title: string
  titleLabel: string
  hostLabel: string
  snap: WebpageLayoutSnapshot | null
  blocked: boolean
  metaImageSrc?: string
  faviconSrc?: string
  hostIconSrc?: string
  className?: string
  style?: React.CSSProperties
  thumbnailInteractive?: boolean
}

export function SharedWebpageSnapshotSurface(props: SharedWebpageSnapshotSurfaceProps) {
  const viewportW = typeof props.snap?.meta?.viewport?.w === 'number' ? props.snap.meta.viewport.w : 1100
  const viewportH = typeof props.snap?.meta?.viewport?.h === 'number' ? props.snap.meta.viewport.h : 720
  const rects = props.snap ? pickWebpageSnapshotRects(props.snap) : []
  const overlayBadgeClassName = `rounded border ${UI_THEME_TOKENS.panel.border} bg-[color:var(--kg-panel-bg)]/90 px-2 py-1`

  return (
    <div className={props.className} style={props.style} data-kg-webpage-snapshot="1" data-src={props.url}>
      <div
        className="w-full h-full relative"
        data-kg-media-thumbnail={props.thumbnailInteractive ? '1' : undefined}
        role={props.thumbnailInteractive ? 'button' : undefined}
        tabIndex={props.thumbnailInteractive ? 0 : undefined}
      >
        {props.metaImageSrc ? (
          <img
            src={props.metaImageSrc}
            alt={props.titleLabel}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover', filter: 'saturate(1.05) contrast(1.02)' }}
          />
        ) : props.faviconSrc ? (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.06), rgba(148,163,184,0.10))' }}>
            <img
              src={props.faviconSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'contain', padding: '18%', opacity: 0.6, filter: 'saturate(1.05) contrast(1.02)' }}
            />
          </div>
        ) : props.hostIconSrc ? (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.06), rgba(148,163,184,0.10))' }}>
            <img
              src={props.hostIconSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'contain', padding: '18%', opacity: 0.65, filter: 'saturate(1.05) contrast(1.02)' }}
            />
          </div>
        ) : null}
        {props.snap ? (
          <svg
            viewBox={`0 0 ${Math.max(1, viewportW)} ${Math.max(1, viewportH)}`}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 w-full h-full"
            aria-label={props.title || props.url}
            role="img"
          >
            <rect x={0} y={0} width={viewportW} height={viewportH} fill="#ffffff" />
            {rects.map((r, idx) => (
              <g key={idx}>
                <rect
                  x={r.rect.x}
                  y={r.rect.y}
                  width={r.rect.w}
                  height={r.rect.h}
                  fill="rgba(0,0,0,0.03)"
                  stroke="rgba(0,0,0,0.12)"
                  strokeWidth={1}
                />
                {r.text && r.rect.w >= 140 && r.rect.h >= 26 ? (
                  <text
                    x={r.rect.x + 8}
                    y={r.rect.y + 18}
                    fontSize={14}
                    fill="rgba(0,0,0,0.55)"
                    fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
                  >
                    {r.text.length > 46 ? `${r.text.slice(0, 45)}…` : r.text}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
        ) : (
          <div className="absolute inset-0 bg-black/5" />
        )}
        <div aria-hidden={true} className="absolute inset-0 pointer-events-none">
          <div className={overlayBadgeClassName} style={{ maxWidth: 'min(520px, 92%)' }}>
            <div className={`text-[11px] font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>{props.titleLabel}</div>
            <div className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary} truncate`}>{props.hostLabel}</div>
          </div>
          {props.blocked ? (
            <div className={`absolute right-2 top-2 ${overlayBadgeClassName}`}>
              <div className={`text-[10px] font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Blocked</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
