import { StateCreator } from 'zustand';
import type { GraphState, SourceFile } from './types';
import { reorderList } from '@/lib/reorder';
import {
  areSourceFileRecordsEqual,
  normalizeSourceFileRecord,
  normalizeSourceFiles,
} from '@/features/source-files/sourceFileParsedState';

const hasSourceFilePatchDiff = (file: SourceFile, updates: Partial<SourceFile>): boolean => {
  for (const [key, value] of Object.entries(updates) as Array<[keyof SourceFile, SourceFile[keyof SourceFile]]>) {
    if (!Object.is(file[key], value)) return true;
  }
  return false;
};

const areSourceFileListsEqual = (left: SourceFile[], right: SourceFile[]): boolean => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (!areSourceFileRecordsEqual(left[i], right[i])) return false;
  }
  return true;
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
  sourceFiles: [],
  setSourceFiles: (files) => set((state) => {
    const sourceFiles = normalizeSourceFiles(files);
    return areSourceFileListsEqual(state.sourceFiles, sourceFiles) ? state : { sourceFiles };
  }),
  addSourceFile: (file) => set((state) => ({ sourceFiles: [...state.sourceFiles, normalizeSourceFileRecord(file)] })),
  updateSourceFile: (id, updates) => set((state) => {
    let changed = false;
    const sourceFiles = state.sourceFiles.map((f) => {
      if (f.id !== id) return f;
      if (!hasSourceFilePatchDiff(f, updates)) return f;
      changed = true;
      return normalizeSourceFileRecord({ ...f, ...updates });
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
      return normalizeSourceFileRecord({ ...f, status, error });
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
