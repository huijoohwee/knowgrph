import { buildNodeOverlayOpenExternalAction, openNodeOverlayExternalUrl } from '@/components/FlowEditor/nodeOverlayOpenExternalAction'

export function testNodeOverlayOpenExternalActionBuildsVisibleContract() {
  const blankAction = buildNodeOverlayOpenExternalAction({
    url: '   ',
    label: 'Open ref',
  })
  if (blankAction !== undefined) {
    throw new Error(`expected shared node-overlay external action builder to skip blank urls, got ${JSON.stringify(blankAction)}`)
  }

  const visibleAction = buildNodeOverlayOpenExternalAction({
    url: 'https://example.com/ref',
    label: 'Open ref',
  })
  if (!visibleAction || visibleAction.visible !== true || visibleAction.label !== 'Open ref') {
    throw new Error(`expected shared node-overlay external action builder to return the visible toolbar contract, got ${JSON.stringify(visibleAction)}`)
  }
}

export function testNodeOverlayOpenExternalActionOpensWindowSafely() {
  const globalWindow = globalThis as unknown as { window?: Pick<Window, 'open'> }
  const previousWindow = globalWindow.window
  const calls: unknown[][] = []
  globalWindow.window = {
    open: (...args: unknown[]) => {
      calls.push(args)
      return null as unknown as Window
    },
  }
  try {
    openNodeOverlayExternalUrl('https://example.com/direct')
    buildNodeOverlayOpenExternalAction({
      url: 'https://example.com/from-action',
      label: 'Open source',
    })?.onOpen()
  } finally {
    globalWindow.window = previousWindow
  }
  if (calls.length !== 2) {
    throw new Error(`expected shared node-overlay external action helpers to open exactly twice, got ${JSON.stringify(calls)}`)
  }
  const [directCall, actionCall] = calls
  if (
    directCall[0] !== 'https://example.com/direct'
    || directCall[1] !== '_blank'
    || directCall[2] !== 'noopener,noreferrer'
  ) {
    throw new Error(`expected direct shared node-overlay external open to preserve the canonical window.open arguments, got ${JSON.stringify(directCall)}`)
  }
  if (
    actionCall[0] !== 'https://example.com/from-action'
    || actionCall[1] !== '_blank'
    || actionCall[2] !== 'noopener,noreferrer'
  ) {
    throw new Error(`expected shared node-overlay external action contract to reuse the canonical window.open arguments, got ${JSON.stringify(actionCall)}`)
  }
}
