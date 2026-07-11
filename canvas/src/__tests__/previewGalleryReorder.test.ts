import React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import PreviewGallery from '@/lib/panels/views/preview-panel/ui/PreviewGallery.impl'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const createDataTransfer = (): DataTransfer => {
  const store = new Map<string, string>()
  const dt: DataTransfer = {
    dropEffect: 'none',
    effectAllowed: 'all',
    files: {} as never,
    items: {} as never,
    types: [],
    clearData: (format?: string) => {
      if (!format) store.clear()
      else store.delete(format)
    },
    getData: (format: string) => store.get(format) ?? '',
    setData: (format: string, data: string) => {
      store.set(format, data)
    },
    setDragImage: () => {},
  }
  return dt
}

const dispatchDragEvent = (win: Window, target: EventTarget, type: string, dataTransfer?: DataTransfer) => {
  const DragEventCtor = (win as unknown as { DragEvent?: typeof DragEvent }).DragEvent
  if (typeof DragEventCtor === 'function') {
    const ev = new DragEventCtor(type, { bubbles: true, cancelable: true, dataTransfer })
    target.dispatchEvent(ev)
    return
  }

  const eventCtor =
    (win as unknown as { Event?: typeof Event }).Event ?? (globalThis as unknown as { Event: typeof Event }).Event
  const ev = new eventCtor(type, { bubbles: true, cancelable: true }) as DragEvent
  if (dataTransfer) Object.defineProperty(ev, 'dataTransfer', { value: dataTransfer, configurable: true })
  target.dispatchEvent(ev)
}

export async function testPreviewGalleryArrowMovesThirdSlideAboveSecond() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const items = [
      { id: '1', label: 'Slide 1' },
      { id: '2', label: 'Slide 2' },
      { id: '3', label: 'Slide 3' },
    ]

    const reordered: string[][] = []

    flushSync(() => {
      root.render(
        React.createElement(PreviewGallery, {
          items,
          activeId: '1',
          onSelect: () => {},
          onReorder: (nextIds: string[]) => {
            reordered.push(nextIds)
          },
          showPreview: false,
        }),
      )
    })

    const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const upButtons = buttons.filter(btn => (btn.textContent || '').trim() === '↑')
    if (upButtons.length < 2) {
      throw new Error(`expected at least two up arrows, got ${upButtons.length}`)
    }

    const thirdUp = upButtons[1]
    flushSync(() => {
      thirdUp.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    })

    if (!reordered.length) {
      throw new Error('expected onReorder to be called at least once')
    }
    const last = reordered[reordered.length - 1]
    const actual = last.join(' ')
    const expected = ['1', '3', '2'].join(' ')
    if (actual !== expected) {
      throw new Error(`expected order ${expected}, got ${actual}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testPreviewGalleryDragMovesThirdSlideAboveSecond() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const items = [
      { id: '1', label: 'Slide 1' },
      { id: '2', label: 'Slide 2' },
      { id: '3', label: 'Slide 3' },
    ]

    const reordered: string[][] = []

    flushSync(() => {
      root.render(
        React.createElement(PreviewGallery, {
          items,
          activeId: '1',
          onSelect: () => {},
          onReorder: (nextIds: string[]) => {
            reordered.push(nextIds)
          },
          showPreview: false,
        }),
      )
    })

    const cards = Array.from(
      container.querySelectorAll('section[draggable="true"]'),
    ) as HTMLElement[]
    if (cards.length !== 3) {
      throw new Error(`expected 3 draggable slide cards, got ${cards.length}`)
    }

    const third = cards[2]
    const second = cards[1]

    const dataTransfer = createDataTransfer()
    flushSync(() => {
      dispatchDragEvent(dom.window, third, 'dragstart', dataTransfer)
      dataTransfer.setData('text/plain', '3')
      dispatchDragEvent(dom.window, second, 'drop', dataTransfer)
    })

    if (!reordered.length) {
      throw new Error('expected onReorder to be called at least once')
    }
    const last = reordered[reordered.length - 1]
    const actual = last.join(' ')
    const expected = ['1', '3', '2'].join(' ')
    if (actual !== expected) {
      throw new Error(`expected order ${expected}, got ${actual}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testPreviewGalleryDragMovesFirstSlideBelowThird() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const items = [
      { id: '1', label: 'Slide 1' },
      { id: '2', label: 'Slide 2' },
      { id: '3', label: 'Slide 3' },
    ]

    const reordered: string[][] = []

    flushSync(() => {
      root.render(
        React.createElement(PreviewGallery, {
          items,
          activeId: '1',
          onSelect: () => {},
          onReorder: (nextIds: string[]) => {
            reordered.push(nextIds)
          },
          showPreview: false,
        }),
      )
    })

    const cards = Array.from(
      container.querySelectorAll('section[draggable="true"]'),
    ) as HTMLElement[]
    if (cards.length !== 3) {
      throw new Error(`expected 3 draggable slide cards, got ${cards.length}`)
    }

    const first = cards[0]
    const third = cards[2]

    const dataTransfer = createDataTransfer()
    flushSync(() => {
      dispatchDragEvent(dom.window, first, 'dragstart', dataTransfer)
      dataTransfer.setData('text/plain', '1')
      dispatchDragEvent(dom.window, third, 'drop', dataTransfer)
    })

    if (!reordered.length) {
      throw new Error('expected onReorder to be called at least once')
    }
    const last = reordered[reordered.length - 1]
    const actual = last.join(' ')
    const expected = ['2', '3', '1'].join(' ')
    if (actual !== expected) {
      throw new Error(`expected order ${expected}, got ${actual}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testPreviewGalleryDragMovesFirstSlideToLastInLongerList() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const items = [
      { id: '1', label: 'Slide 1' },
      { id: '2', label: 'Slide 2' },
      { id: '3', label: 'Slide 3' },
      { id: '4', label: 'Slide 4' },
      { id: '5', label: 'Slide 5' },
    ]

    const reordered: string[][] = []

    flushSync(() => {
      root.render(
        React.createElement(PreviewGallery, {
          items,
          activeId: '1',
          onSelect: () => {},
          onReorder: (nextIds: string[]) => {
            reordered.push(nextIds)
          },
          showPreview: false,
        }),
      )
    })

    const cards = Array.from(
      container.querySelectorAll('section[draggable="true"]'),
    ) as HTMLElement[]
    if (cards.length !== 5) {
      throw new Error(`expected 5 draggable slide cards, got ${cards.length}`)
    }

    const first = cards[0]
    const last = cards[4]

    const dataTransfer = createDataTransfer()
    flushSync(() => {
      dispatchDragEvent(dom.window, first, 'dragstart', dataTransfer)
      dataTransfer.setData('text/plain', '1')
      dispatchDragEvent(dom.window, last, 'drop', dataTransfer)
    })

    if (!reordered.length) {
      throw new Error('expected onReorder to be called at least once')
    }
    const lastOrder = reordered[reordered.length - 1]
    const actual = lastOrder.join(' ')
    const expected = ['2', '3', '4', '5', '1'].join(' ')
    if (actual !== expected) {
      throw new Error(`expected order ${expected}, got ${actual}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}

export async function testPreviewGalleryDragMovesLastSlideToFirstInLongerList() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const items = [
      { id: '1', label: 'Slide 1' },
      { id: '2', label: 'Slide 2' },
      { id: '3', label: 'Slide 3' },
      { id: '4', label: 'Slide 4' },
      { id: '5', label: 'Slide 5' },
    ]

    const reordered: string[][] = []

    flushSync(() => {
      root.render(
        React.createElement(PreviewGallery, {
          items,
          activeId: '5',
          onSelect: () => {},
          onReorder: (nextIds: string[]) => {
            reordered.push(nextIds)
          },
          showPreview: false,
        }),
      )
    })

    const cards = Array.from(
      container.querySelectorAll('section[draggable="true"]'),
    ) as HTMLElement[]
    if (cards.length !== 5) {
      throw new Error(`expected 5 draggable slide cards, got ${cards.length}`)
    }

    const first = cards[0]
    const last = cards[4]

    const dataTransfer = createDataTransfer()
    flushSync(() => {
      dispatchDragEvent(dom.window, last, 'dragstart', dataTransfer)
      dataTransfer.setData('text/plain', '5')
      dispatchDragEvent(dom.window, first, 'drop', dataTransfer)
    })

    if (!reordered.length) {
      throw new Error('expected onReorder to be called at least once')
    }
    const lastOrder = reordered[reordered.length - 1]
    const actual = lastOrder.join(' ')
    const expected = ['5', '1', '2', '3', '4'].join(' ')
    if (actual !== expected) {
      throw new Error(`expected order ${expected}, got ${actual}`)
    }

    root.unmount()
  } finally {
    restore()
  }
}
