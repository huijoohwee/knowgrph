import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testChatInputRapidOpenCloseSwitchCycles() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')
    const root = createRoot(container)

    for (let i = 0; i < 80; i += 1) {
      const opened = i % 5 !== 0
      const multiline = i % 2 === 0
      const value = `cycle-${i}`
      await act(async () => {
        root.render(
          <section>
            {opened ? (
              <PlainTextInputEditor
                value={value}
                onChange={() => {}}
                multiline={multiline}
                className="w-full h-10"
                placeholder="chat input stress"
              />
            ) : null}
          </section>,
        )
      })
      const selector = multiline ? 'textarea' : 'input[type="text"]'
      const el = container.querySelector(selector) as HTMLTextAreaElement | HTMLInputElement | null
      if (!opened) {
        if (el) throw new Error('expected input editor to unmount during closed cycle')
        continue
      }
      if (!el) throw new Error(`expected input editor for cycle ${i}`)
      if (el.value !== value) {
        throw new Error(`expected stable value "${value}" for cycle ${i}, got "${el.value}"`)
      }
    }

    await act(async () => {
      root.unmount()
    })
  } finally {
    restore()
  }
}
