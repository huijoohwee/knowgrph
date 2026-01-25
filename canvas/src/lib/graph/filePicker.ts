interface OpenFilePickerOptions {
  excludeAcceptAllOption?: boolean;
  multiple?: boolean;
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
}

interface WindowWithOpenPicker extends Window {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<Array<{ getFile(): Promise<File> }>>;
}

export async function pickFile(): Promise<File | null> {
  try {
    const w = window as unknown as WindowWithOpenPicker;
    const canPicker = typeof w.showOpenFilePicker === 'function';
    if (canPicker) {
      const picker = w.showOpenFilePicker!;
      const [fileHandle] = await picker({ excludeAcceptAllOption: false, multiple: false });
      return await fileHandle.getFile();
    }
    return await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '';
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.top = '0';
      input.style.opacity = '0';
      document.body.appendChild(input);
      let settled = false;
      const cleanup = () => {
        try {
          window.removeEventListener('focus', onFocus, true);
        } catch {
          void 0;
        }
        try {
          input.remove();
        } catch {
          void 0;
        }
      };
      const resolveOnce = (f: File | null) => {
        if (settled) return;
        settled = true;
        resolve(f);
        cleanup();
      };
      const onFocus = () => {
        setTimeout(() => {
          if (!settled) resolveOnce(null);
        }, 0);
      };
      input.onchange = () => {
        const f = input.files && input.files[0] ? input.files[0] : null;
        resolveOnce(f);
      };
      try {
        window.addEventListener('focus', onFocus, true);
      } catch {
        void 0;
      }
      input.click();
    });
  } catch {
    return null;
  }
}

export async function pickFilesWithExtensions(
  exts: string[],
  multiple: boolean = false
): Promise<File[]> {
  try {
    const w = window as unknown as WindowWithOpenPicker;
    const canPicker = typeof w.showOpenFilePicker === 'function';
    const normalized = (exts || []).map((e) => (e.startsWith('.') ? e : `.${e}`));
    if (canPicker) {
      const jsonLdExts = normalized.filter((e) => e === '.jsonld' || e === '.json-ld');
      const picker = w.showOpenFilePicker!;
      const fileHandles = await picker({
        multiple,
        excludeAcceptAllOption: false,
        types: [
          {
            description: 'Files',
            accept: {
              'text/plain': normalized,
              'application/json': normalized.filter((e) => e === '.json'),
              'application/ld+json': jsonLdExts,
              'text/csv': normalized.filter((e) => e === '.csv'),
            },
          },
        ],
      });
      return await Promise.all(fileHandles.map(h => h.getFile()));
    }
    return await new Promise<File[]>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = multiple;
      input.accept = normalized.join(',');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.top = '0';
      input.style.opacity = '0';
      document.body.appendChild(input);
      let settled = false;
      const cleanup = () => {
        try {
          window.removeEventListener('focus', onFocus, true);
        } catch {
          void 0;
        }
        try {
          input.remove();
        } catch {
          void 0;
        }
      };
      const resolveOnce = (files: File[]) => {
        if (settled) return;
        settled = true;
        resolve(files);
        cleanup();
      };
      const onFocus = () => {
        setTimeout(() => {
          if (!settled) resolveOnce([]);
        }, 0);
      };
      input.onchange = () => {
        const files = input.files ? Array.from(input.files) : [];
        resolveOnce(files);
      };
      try {
        window.addEventListener('focus', onFocus, true);
      } catch {
        void 0;
      }
      input.click();
    });
  } catch {
    return [];
  }
}

export async function pickFileWithExtensions(exts: string[]): Promise<File | null> {
  const files = await pickFilesWithExtensions(exts, false);
  return files[0] || null;
}

export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  try {
    const file = await pickFile();
    if (!file) return null;
    const text = await file.text();
    const name = file.name || '';
    return { name, text };
  } catch {
    return null;
  }
}

export async function pickTextFilesWithExtensions(
  exts: string[],
): Promise<Array<{ name: string; text: string }>> {
  try {
    const files = await pickFilesWithExtensions(exts, true);
    return Promise.all(files.map(async f => ({
      name: f.name || '',
      text: await f.text()
    })));
  } catch {
    return [];
  }
}

export async function pickTextFileWithExtensions(
  exts: string[],
): Promise<{ name: string; text: string } | null> {
  try {
    const file = await pickFileWithExtensions(exts);
    if (!file) return null;
    const text = await file.text();
    const name = file.name || '';
    return { name, text };
  } catch {
    return null;
  }
}
