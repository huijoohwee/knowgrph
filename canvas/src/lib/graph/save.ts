import { LS_KEYS } from '@/lib/config';
import { lsJson, lsSetJson } from '@/lib/persistence';

export interface SaveFilePickerHandle {
  createWritable(): Promise<{ write(blob: Blob): Promise<void>; close(): Promise<void> }>;
  name?: string;
}

interface WindowWithPicker extends Window {
  showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<SaveFilePickerHandle>;
}

const errorName = (err: unknown): string | null => {
  if (!err || typeof err !== 'object') return null;
  if (!('name' in err)) return null;
  const name = (err as { name?: unknown }).name;
  return typeof name === 'string' ? name : null;
};

export async function saveBlobWithPicker(blob: Blob, suggestedName: string, options: { description: string; accept: Record<string, string[]> }) {
  try {
    const w = window as unknown as WindowWithPicker;
    const showPicker = typeof w.showSaveFilePicker === 'function';
    if (!showPicker || !w.showSaveFilePicker) return null;
    const handle = await w.showSaveFilePicker({
      suggestedName,
      types: [{ description: options.description, accept: options.accept }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return handle.name || suggestedName;
  } catch (err) {
    const name = errorName(err);
    if (name === 'AbortError') return '';
    return null;
  }
}

export async function openSaveFilePickerHandle(suggestedName: string, options: { description: string; accept: Record<string, string[]> }) {
  try {
    const w = window as unknown as WindowWithPicker;
    const showPicker = typeof w.showSaveFilePicker === 'function';
    if (!showPicker || !w.showSaveFilePicker) return null;
    const handle = await w.showSaveFilePicker({
      suggestedName,
      types: [{ description: options.description, accept: options.accept }],
    });
    return handle;
  } catch (err) {
    const name = errorName(err);
    if (name === 'AbortError') return '';
    return null;
  }
}

export async function writeBlobToFileHandle(handle: SaveFilePickerHandle, blob: Blob): Promise<boolean> {
  try {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

const BLOB_DOWNLOAD_REVOKE_DELAY_MS = 1000;

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const doc = typeof window !== 'undefined' ? window.document : null;
  if (!doc) {
    URL.revokeObjectURL(url);
    return;
  }
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, BLOB_DOWNLOAD_REVOKE_DELAY_MS);
}
export function readExportPrefs(): Record<string, unknown> {
  return lsJson<Record<string, unknown>>(LS_KEYS.exportPrefs, {}, raw => {
    if (!raw || typeof raw !== 'object') return null;
    return raw as Record<string, unknown>;
  });
}

export function writeExportPrefs(prefs: Record<string, unknown>) {
  lsSetJson(LS_KEYS.exportPrefs, prefs);
}
