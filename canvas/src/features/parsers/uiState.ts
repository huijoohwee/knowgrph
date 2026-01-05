import { create } from 'zustand'

export const DEFAULT_PARSER_SCRIPT_TEXT = '# Default Python parser script\n# Replace with your own parser implementation.\n'

type ParserUIState = {
  inputName: string
  inputText: string
  selectedId: string
  warnings: string[]
  counts: { n: number; e: number }
  attemptedAutoDetect: boolean
  scriptText: string
  preferredLanguage: 'json' | 'text' | 'yaml'
  parserLoadOk: boolean | null
  parserLoadMsg: string
  dataLoadOk: boolean | null
  dataLoadMsg: string
  setLastInput: (name: string, text: string) => void
  setSelectedId: (id: string) => void
  setWarnings: (w: string[]) => void
  setCounts: (c: { n: number; e: number }) => void
  setAttemptedAutoDetect: (v: boolean) => void
  setScriptText: (t: string) => void
  setPreferredLanguage: (l: 'json' | 'text' | 'yaml') => void
  setParserLoadStatus: (ok: boolean | null, msg: string) => void
  setDataLoadStatus: (ok: boolean | null, msg: string) => void
  reset: () => void
}

export const useParserUIState = create<ParserUIState>((set) => ({
  inputName: '',
  inputText: '',
  selectedId: '',
  warnings: [],
  counts: { n: 0, e: 0 },
  attemptedAutoDetect: false,
  scriptText: DEFAULT_PARSER_SCRIPT_TEXT,
  preferredLanguage: 'text',
  parserLoadOk: null,
  parserLoadMsg: '',
  dataLoadOk: null,
  dataLoadMsg: '',
  setLastInput: (name, text) => set({ inputName: name, inputText: text }),
  setSelectedId: (id) => set({ selectedId: id }),
  setWarnings: (w) => set({ warnings: w || [] }),
  setCounts: (c) => set({ counts: c || { n: 0, e: 0 } }),
  setAttemptedAutoDetect: (v) => set({ attemptedAutoDetect: !!v }),
  setScriptText: (t) => set({ scriptText: t || '' }),
  setPreferredLanguage: (l) => set({ preferredLanguage: l }),
  setParserLoadStatus: (ok, msg) => set({ parserLoadOk: ok, parserLoadMsg: msg || '' }),
  setDataLoadStatus: (ok, msg) => set({ dataLoadOk: ok, dataLoadMsg: msg || '' }),
  reset: () => set({ inputName: '', inputText: '', selectedId: '', warnings: [], counts: { n: 0, e: 0 }, attemptedAutoDetect: false, parserLoadOk: null, parserLoadMsg: '', dataLoadOk: null, dataLoadMsg: '', scriptText: DEFAULT_PARSER_SCRIPT_TEXT, preferredLanguage: 'text' }),
}))
