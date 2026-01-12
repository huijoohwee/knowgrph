import React from 'react'
import { createRoot } from 'react-dom/client'
import PreviewGallery from '@/features/panels/views/preview-panel/ui/PreviewGallery'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const waitForNextFrame = (win: Window): Promise<void> => {
  const anyWindow = win as unknown as { requestAnimationFrame?: (cb: () => void) => number }
  if (!anyWindow.requestAnimationFrame) {
    anyWindow.requestAnimationFrame = (cb: () => void) =>
      setTimeout(cb, 0) as unknown as number
  }
  return new Promise<void>(resolve => anyWindow.requestAnimationFrame!(() => resolve()))
}

export async function testPreviewGalleryArrowMovesThirdSlideAboveSecond() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const items = [
      { id: '1', label: 'Slide 1' },
      { id: '2', label: 'Slide 2' },
      { id: '3', label: 'Slide 3' },
    ]

    const reordered: string[][] = []

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

    await waitForNextFrame(dom.window)

    const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const upButtons = buttons.filter(btn => (btn.textContent || '').trim() === '↑')
    if (upButtons.length < 2) {
      throw new Error(`expected at least two up arrows, got ${upButtons.length}`)
    }

    const thirdUp = upButtons[1]
    thirdUp.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    await waitForNextFrame(dom.window)

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
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const items = [
      { id: '1', label: 'Slide 1' },
      { id: '2', label: 'Slide 2' },
      { id: '3', label: 'Slide 3' },
    ]

    const reordered: string[][] = []

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

    await waitForNextFrame(dom.window)

    const cards = Array.from(
      container.querySelectorAll('div[draggable="true"]'),
    ) as HTMLDivElement[]
    if (cards.length !== 3) {
      throw new Error(`expected 3 draggable slide cards, got ${cards.length}`)
    }

    const third = cards[2]
    const second = cards[1]

    const dataTransfer: DataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'all',
      files: {} as never,
      items: {} as never,
      types: [],
      clearData: () => {},
      getData: () => '3',
      setData: () => {},
      setDragImage: () => {},
    }

    third.dispatchEvent(
      new dom.window.Event('dragstart', {
        bubbles: true,
        cancelable: true,
      }) as DragEvent,
    )

    second.dispatchEvent(
      new dom.window.Event('dragover', {
        bubbles: true,
        cancelable: true,
      }) as DragEvent,
    )

    await waitForNextFrame(dom.window)

    const topBands = Array.from(
      container.querySelectorAll('div.border-t-2.cursor-move'),
    ) as HTMLDivElement[]
    if (!topBands.length) {
      throw new Error('expected at least one top insertion band')
    }
    const targetBand = topBands[0]

    Object.defineProperty(second, 'draggable', {
      value: true,
      configurable: true,
    })

    const dropEvent = new dom.window.Event('drop', {
      bubbles: true,
      cancelable: true,
    }) as DragEvent
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
      configurable: true,
    })
    targetBand.dispatchEvent(dropEvent)

    await waitForNextFrame(dom.window)

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
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const items = [
      { id: '1', label: 'Slide 1' },
      { id: '2', label: 'Slide 2' },
      { id: '3', label: 'Slide 3' },
    ]

    const reordered: string[][] = []

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

    await waitForNextFrame(dom.window)

    const cards = Array.from(
      container.querySelectorAll('div[draggable="true"]'),
    ) as HTMLDivElement[]
    if (cards.length !== 3) {
      throw new Error(`expected 3 draggable slide cards, got ${cards.length}`)
    }

    const first = cards[0]
    const third = cards[2]

    const dataTransfer: DataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'all',
      files: {} as never,
      items: {} as never,
      types: [],
      clearData: () => {},
      getData: () => '1',
      setData: () => {},
      setDragImage: () => {},
    }

    first.dispatchEvent(
      new dom.window.Event('dragstart', {
        bubbles: true,
        cancelable: true,
      }) as DragEvent,
    )

    third.dispatchEvent(
      new dom.window.Event('dragover', {
        bubbles: true,
        cancelable: true,
      }) as DragEvent,
    )

    await waitForNextFrame(dom.window)

    const bottomBands = Array.from(
      container.querySelectorAll('div.border-b-2.cursor-move'),
    ) as HTMLDivElement[]
    if (!bottomBands.length) {
      throw new Error('expected at least one bottom insertion band')
    }
    const targetBand = bottomBands[0]

    Object.defineProperty(third, 'draggable', {
      value: true,
      configurable: true,
    })

    const dropEvent = new dom.window.Event('drop', {
      bubbles: true,
      cancelable: true,
    }) as DragEvent
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
      configurable: true,
    })
    targetBand.dispatchEvent(dropEvent)

    await waitForNextFrame(dom.window)

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
    const container = doc.createElement('div')
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

    await waitForNextFrame(dom.window)

    const cards = Array.from(
      container.querySelectorAll('div[draggable="true"]'),
    ) as HTMLDivElement[]
    if (cards.length !== 5) {
      throw new Error(`expected 5 draggable slide cards, got ${cards.length}`)
    }

    const first = cards[0]
    const last = cards[4]

    const dataTransfer: DataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'all',
      files: {} as never,
      items: {} as never,
      types: [],
      clearData: () => {},
      getData: () => '1',
      setData: () => {},
      setDragImage: () => {},
    }

    first.dispatchEvent(
      new dom.window.Event('dragstart', {
        bubbles: true,
        cancelable: true,
      }) as DragEvent,
    )

    last.dispatchEvent(
      new dom.window.Event('dragover', {
        bubbles: true,
        cancelable: true,
      }) as DragEvent,
    )

    await waitForNextFrame(dom.window)

    const bottomBands = Array.from(
      container.querySelectorAll('div.border-b-2.cursor-move'),
    ) as HTMLDivElement[]
    if (!bottomBands.length) {
      throw new Error('expected at least one bottom insertion band in longer list')
    }
    const targetBand = bottomBands[bottomBands.length - 1]

    Object.defineProperty(last, 'draggable', {
      value: true,
      configurable: true,
    })

    const dropEvent = new dom.window.Event('drop', {
      bubbles: true,
      cancelable: true,
    }) as DragEvent
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
      configurable: true,
    })
    targetBand.dispatchEvent(dropEvent)

    await waitForNextFrame(dom.window)

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
    const container = doc.createElement('div')
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

    await waitForNextFrame(dom.window)

    const cards = Array.from(
      container.querySelectorAll('div[draggable="true"]'),
    ) as HTMLDivElement[]
    if (cards.length !== 5) {
      throw new Error(`expected 5 draggable slide cards, got ${cards.length}`)
    }

    const first = cards[0]
    const last = cards[4]

    const dataTransfer: DataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'all',
      files: {} as never,
      items: {} as never,
      types: [],
      clearData: () => {},
      getData: () => '5',
      setData: () => {},
      setDragImage: () => {},
    }

    last.dispatchEvent(
      new dom.window.Event('dragstart', {
        bubbles: true,
        cancelable: true,
      }) as DragEvent,
    )

    first.dispatchEvent(
      new dom.window.Event('dragover', {
        bubbles: true,
        cancelable: true,
      }) as DragEvent,
    )

    await waitForNextFrame(dom.window)

    const topBands = Array.from(
      container.querySelectorAll('div.border-t-2.cursor-move'),
    ) as HTMLDivElement[]
    if (!topBands.length) {
      throw new Error('expected at least one top insertion band in longer list')
    }
    const targetBand = topBands[0]

    Object.defineProperty(first, 'draggable', {
      value: true,
      configurable: true,
    })

    const dropEvent = new dom.window.Event('drop', {
      bubbles: true,
      cancelable: true,
    }) as DragEvent
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
      configurable: true,
    })
    targetBand.dispatchEvent(dropEvent)

    await waitForNextFrame(dom.window)

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
