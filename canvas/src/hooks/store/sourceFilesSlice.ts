import { StateCreator } from 'zustand';
import type { GraphState, SourceFile } from './types';
import { reorderList } from '@/lib/reorder';

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
  setSourceFiles: (files) => set(() => ({ sourceFiles: Array.isArray(files) ? files : [] })),
  addSourceFile: (file) => set((state) => ({ sourceFiles: [...state.sourceFiles, file] })),
  updateSourceFile: (id, updates) => set((state) => ({
    sourceFiles: state.sourceFiles.map((f) => (f.id === id ? { ...f, ...updates } : f)),
  })),
  removeSourceFile: (id) => set((state) => ({ sourceFiles: state.sourceFiles.filter((f) => f.id !== id) })),
  toggleSourceFile: (id) => set((state) => ({
    sourceFiles: state.sourceFiles.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)),
  })),
  setSourceFileName: (id, name) => set((state) => ({
    sourceFiles: state.sourceFiles.map((f) => (f.id === id ? { ...f, name } : f)),
  })),
  setSourceFileGeoLayerEnabled: (id, enabled) => set((state) => ({
    sourceFiles: state.sourceFiles.map((f) => (f.id === id ? { ...f, geoLayerEnabled: enabled } : f)),
  })),
  setSourceFileStatus: (id, status, error) => set((state) => ({
    sourceFiles: state.sourceFiles.map((f) => (f.id === id ? { ...f, status, error } : f)),
  })),
  reorderSourceFiles: (sourceId, targetId) => set((state) => {
    const fromIndex = state.sourceFiles.findIndex((f) => f.id === sourceId);
    const toIndex = state.sourceFiles.findIndex((f) => f.id === targetId);
    return { sourceFiles: reorderList(state.sourceFiles, fromIndex, toIndex) };
  }),
  clearSourceFiles: () => set(() => ({ sourceFiles: [] })),
});
