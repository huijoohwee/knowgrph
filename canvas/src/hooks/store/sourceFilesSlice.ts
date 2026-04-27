import { StateCreator } from 'zustand';
import type { GraphState, SourceFile } from './types';
import { reorderList } from '@/lib/reorder';
import { hashStringToHex } from '@/lib/hash/stringHash';
import { readEnvString } from '@/lib/config.env';
import { normalizeWorkspacePath, workspaceBasename } from '@/features/workspace-fs/path';
import { WORKSPACE_README_SEED_PATH } from '@/features/workspace-fs/workspaceFs';

const WORKSPACE_README_SOURCE_PATH = `workspace:${WORKSPACE_README_SEED_PATH}`
const WORKSPACE_README_SOURCE_ID = `ws:${hashStringToHex(WORKSPACE_README_SOURCE_PATH)}`
const TEST_VALIDATION_SOURCE_REL_PATH = readEnvString(
  'VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH',
  'sandbox/test-data/knowgrph-rich-media-generation-demo.md',
)
const TEST_VALIDATION_WORKSPACE_PATH = normalizeWorkspacePath(TEST_VALIDATION_SOURCE_REL_PATH)
const TEST_VALIDATION_SOURCE_PATH = `workspace:${TEST_VALIDATION_WORKSPACE_PATH}`
const TEST_VALIDATION_SOURCE_ID = `ws:${hashStringToHex(TEST_VALIDATION_SOURCE_PATH)}`
const TEST_VALIDATION_SOURCE_FILE: SourceFile = {
  id: TEST_VALIDATION_SOURCE_ID,
  name: workspaceBasename(TEST_VALIDATION_WORKSPACE_PATH) || 'test-validation.md',
  text: '',
  enabled: false,
  status: 'idle',
  source: { kind: 'local', path: TEST_VALIDATION_SOURCE_PATH },
}
const WORKSPACE_README_SOURCE_FILE: SourceFile = {
  id: WORKSPACE_README_SOURCE_ID,
  name: workspaceBasename(WORKSPACE_README_SEED_PATH) || 'README.md',
  text: '',
  enabled: true,
  status: 'idle',
  source: { kind: 'local', path: WORKSPACE_README_SOURCE_PATH },
}

const hasSourceFilePatchDiff = (file: SourceFile, updates: Partial<SourceFile>): boolean => {
  for (const [key, value] of Object.entries(updates) as Array<[keyof SourceFile, SourceFile[keyof SourceFile]]>) {
    if (!Object.is(file[key], value)) return true;
  }
  return false;
};

export const createSourceFilesSlice: StateCreator<GraphState, [], [], {
  sourceFiles: SourceFile[];
  setSourceFiles: (files: SourceFile[]) => void;
  addSourceFile: (file: SourceFile) => void;
  updateSourceFile: (id: string, updates: Partial<SourceFile>) => void;
  removeSourceFile: (id: string) => void;
  toggleSourceFile: (id: string) => void;
  setSourceFileName: (id: string, name: string) => void;
  setSourceFileGeoLayerEnabled: (id: string, enabled: boolean) => void;
  setSourceFileStatus: (id: string, status: SourceFile['status'], error?: string) => void;
  reorderSourceFiles: (sourceId: string, targetId: string) => void;
  clearSourceFiles: () => void;
}> = (set) => ({
  sourceFiles: [WORKSPACE_README_SOURCE_FILE, TEST_VALIDATION_SOURCE_FILE],
  setSourceFiles: (files) => set(() => ({ sourceFiles: Array.isArray(files) ? files : [] })),
  addSourceFile: (file) => set((state) => ({ sourceFiles: [...state.sourceFiles, file] })),
  updateSourceFile: (id, updates) => set((state) => {
    let changed = false;
    const sourceFiles = state.sourceFiles.map((f) => {
      if (f.id !== id) return f;
      if (!hasSourceFilePatchDiff(f, updates)) return f;
      changed = true;
      return { ...f, ...updates };
    });
    return changed ? { sourceFiles } : state;
  }),
  removeSourceFile: (id) => set((state) => ({ sourceFiles: state.sourceFiles.filter((f) => f.id !== id) })),
  toggleSourceFile: (id) => set((state) => ({
    sourceFiles: state.sourceFiles.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)),
  })),
  setSourceFileName: (id, name) => set((state) => {
    let changed = false;
    const sourceFiles = state.sourceFiles.map((f) => {
      if (f.id !== id) return f;
      if (Object.is(f.name, name)) return f;
      changed = true;
      return { ...f, name };
    });
    return changed ? { sourceFiles } : state;
  }),
  setSourceFileGeoLayerEnabled: (id, enabled) => set((state) => {
    let changed = false;
    const sourceFiles = state.sourceFiles.map((f) => {
      if (f.id !== id) return f;
      if (Object.is(f.geoLayerEnabled, enabled)) return f;
      changed = true;
      return { ...f, geoLayerEnabled: enabled };
    });
    return changed ? { sourceFiles } : state;
  }),
  setSourceFileStatus: (id, status, error) => set((state) => {
    let changed = false;
    const sourceFiles = state.sourceFiles.map((f) => {
      if (f.id !== id) return f;
      if (Object.is(f.status, status) && Object.is(f.error, error)) return f;
      changed = true;
      return { ...f, status, error };
    });
    return changed ? { sourceFiles } : state;
  }),
  reorderSourceFiles: (sourceId, targetId) => set((state) => {
    const fromIndex = state.sourceFiles.findIndex((f) => f.id === sourceId);
    const toIndex = state.sourceFiles.findIndex((f) => f.id === targetId);
    return { sourceFiles: reorderList(state.sourceFiles, fromIndex, toIndex) };
  }),
  clearSourceFiles: () => set(() => ({ sourceFiles: [] })),
});
