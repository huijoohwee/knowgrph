export type ZoomFitIntent = 'fitToView' | 'fitToScreen' | 'initialFit'

export type ZoomCommandType = 'in' | 'out' | 'reset' | 'selection' | 'fit'

export type ZoomRequest =
  | { type: Exclude<ZoomCommandType, 'fit'>; at?: number }
  | { type: 'fit'; intent: ZoomFitIntent; at?: number }
  | { type: 'transform'; payload: { k: number; x: number; y: number }; at?: number }
