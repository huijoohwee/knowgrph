import { StateCreator } from 'zustand';
import type { GraphState, SourceFile } from './types';

export const createSourceFilesSlice: StateCreator<GraphState, [], [], {
  sourceFiles: SourceFile[];
  addSourceFile: (file: SourceFile) => void;
  removeSourceFile: (id: string) => void;
  toggleSourceFile: (id: string) => void;
  setSourceFileStatus: (id: string, status: SourceFile['status'], error?: string) => void;
}> = (set) => ({
  sourceFiles: [],
  addSourceFile: (file) => set((state) => ({ sourceFiles: [...state.sourceFiles, file] })),
  removeSourceFile: (id) => set((state) => ({ sourceFiles: state.sourceFiles.filter((f) => f.id !== id) })),
  toggleSourceFile: (id) => set((state) => ({
    sourceFiles: state.sourceFiles.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)),
  })),
  setSourceFileStatus: (id, status, error) => set((state) => ({
    sourceFiles: state.sourceFiles.map((f) => (f.id === id ? { ...f, status, error } : f)),
  })),
});
