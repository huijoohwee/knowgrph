import { StateCreator } from 'zustand';
import type { GraphState, SourceFile } from './types';

export const createSourceFilesSlice: StateCreator<GraphState, [], [], {
  sourceFiles: SourceFile[];
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
    const list = [...state.sourceFiles];
    const fromIndex = list.findIndex((f) => f.id === sourceId);
    const toIndex = list.findIndex((f) => f.id === targetId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return { sourceFiles: list };
    const [item] = list.splice(fromIndex, 1);
    if (!item) return { sourceFiles: list };
    list.splice(toIndex, 0, item);
    return { sourceFiles: list };
  }),
  clearSourceFiles: () => set(() => ({ sourceFiles: [] })),
});
