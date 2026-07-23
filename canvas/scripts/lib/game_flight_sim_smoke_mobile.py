from __future__ import annotations

from typing import Any

from playwright.sync_api import Page


MOBILE_VIEWPORT = {"width": 375, "height": 812}


def verify_mobile_flight_hud(page: Page) -> dict[str, Any]:
    page.set_viewport_size(MOBILE_VIEWPORT)
    page.wait_for_timeout(250)
    layout = page.evaluate(
        """
        () => {
          const hud = document.querySelector('[data-kg-flight-sim-hud="1"]')
          const header = hud?.querySelector(':scope > header') || null
          const telemetry = header?.querySelector(':scope > section:last-child') || null
          const directional = hud?.querySelector(
            'section[aria-label="Touch flight controls"]',
          ) || null
          const lowerControls = hud?.querySelector(':scope > section:last-child') || null
          const directionalControls = Array.from(
            directional?.querySelectorAll('button') || [],
          )
          const lowerControlItems = Array.from(
            lowerControls?.querySelectorAll('button, label') || [],
          )
          const overlaps = directionalControls.flatMap((left, leftIndex) => {
            const leftRect = left.getBoundingClientRect()
            return lowerControlItems.flatMap((right, rightIndex) => {
              const rightRect = right.getBoundingClientRect()
              const overlapWidth = Math.min(leftRect.right, rightRect.right)
                - Math.max(leftRect.left, rightRect.left)
              const overlapHeight = Math.min(leftRect.bottom, rightRect.bottom)
                - Math.max(leftRect.top, rightRect.top)
              return overlapWidth > 0.5 && overlapHeight > 0.5
                ? [`directional-${leftIndex + 1}/lower-${rightIndex + 1}`]
                : []
            })
          })
          const namedTargets = [
            ['telemetry', telemetry],
            ['directional-controls', directional],
            ['lower-controls', lowerControls],
            ...Array.from(
              hud?.querySelectorAll('button, input[type="range"]') || [],
            ).map((element, index) => [
              `control-${index + 1}:${String(
                element.getAttribute('aria-label')
                || element.textContent
                || element.getAttribute('type')
                || '',
              ).trim()}`,
              element,
            ]),
          ]
          const viewport = {
            width: window.innerWidth,
            height: window.innerHeight,
          }
          const targets = namedTargets.map(([name, element]) => {
            if (!(element instanceof HTMLElement)) {
              return { name, present: false, visible: false, withinViewport: false }
            }
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            const visible = style.display !== 'none'
              && style.visibility !== 'hidden'
              && rect.width > 0
              && rect.height > 0
            const withinViewport = rect.left >= -0.5
              && rect.top >= -0.5
              && rect.right <= viewport.width + 0.5
              && rect.bottom <= viewport.height + 0.5
            return {
              name,
              present: true,
              visible,
              withinViewport,
              rect: {
                left: Number(rect.left.toFixed(2)),
                top: Number(rect.top.toFixed(2)),
                right: Number(rect.right.toFixed(2)),
                bottom: Number(rect.bottom.toFixed(2)),
                width: Number(rect.width.toFixed(2)),
                height: Number(rect.height.toFixed(2)),
              },
            }
          })
          return {
            viewport,
            telemetryText: String(telemetry?.textContent || '')
              .replace(/\\s+/g, ' ')
              .trim(),
            touchLabels: directionalControls.map(
              button => String(button.textContent || '').trim(),
            ),
            overlaps,
            targets,
          }
        }
        """
    )
    invalid_targets = [
        target
        for target in layout["targets"]
        if (
            target.get("present") is not True
            or target.get("visible") is not True
            or target.get("withinViewport") is not True
        )
    ]
    required_touch_labels = {
        "Pitch ▲",
        "Pitch ▼",
        "Roll ◀",
        "Roll ▶",
    }
    telemetry_text = str(layout.get("telemetryText") or "")
    if (
        layout.get("viewport") != MOBILE_VIEWPORT
        or invalid_targets
        or layout.get("overlaps")
        or not required_touch_labels.issubset(set(layout.get("touchLabels") or []))
        or "PIT" not in telemetry_text
        or "ROL" not in telemetry_text
    ):
        raise AssertionError(
            "Flight mobile HUD escaped the 375x812 viewport: "
            f"invalid={invalid_targets}, layout={layout}"
        )
    return layout
