import { ensureExt, readExportPrefsMeta } from '@/lib/graph/file';
import { downloadBlob, saveBlobWithPicker, writeExportPrefs } from '@/lib/graph/save';
import { pickFileWithExtensions, pickTextFileWithExtensions } from '@/lib/graph/filePicker';
import { settingsRegistry } from '@/features/settings/registry';
import { useGraphStore } from '@/hooks/useGraphStore';
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy';
import {
  applySettingsValuesToRegistry,
  buildGraphFieldSettingsJsonLdDocument,
  buildGraphRagWorkflowJsonLdDocument,
  buildHistoryJsonLdDocument,
  buildSettingsJsonLdDocument,
  parseGraphFieldSettingsDocument,
  parseHistoryDocument,
  parseSettingsDocumentToValues,
  validateGraphRagWorkflowJsonLdObject,
} from '@/features/panels/utils/workflowJsonLd';
import { parseGraphragCliConfigYamlToJsonLd } from '@/features/panels/utils/graphragConfig';

export type WorkflowJsonLdDeps = {
  markExported: () => void;
  setTransientExportStatus: (msg: string) => void;
};

type ImportJsonResult = {
  ok: boolean;
  doc: unknown | null;
  reason?: 'cancel' | 'invalid';
};

async function importJsonDocument(): Promise<ImportJsonResult> {
  const file = await pickFileWithExtensions(['.jsonld', '.json-ld', '.json']);
  if (!file) return { ok: false, doc: null, reason: 'cancel' };
  try {
    return { ok: true, doc: JSON.parse(await file.text()) };
  } catch {
    return { ok: false, doc: null, reason: 'invalid' };
  }
}

type ExportJsonLdBlobOpts = {
  format:
    | 'settings-jsonld'
    | 'history-jsonld'
    | 'graph-field-settings-jsonld'
    | 'graphrag-workflow-jsonld';
  defaultName: string;
  blob: Blob;
  okMsg: string;
  failedMsg: string;
};

async function exportJsonLdBlob(
  deps: WorkflowJsonLdDeps,
  opts: ExportJsonLdBlobOpts,
): Promise<void> {
  try {
    const prefs = readExportPrefsMeta();
    const pref =
      prefs.format === opts.format && prefs.filename ? prefs.filename : opts.defaultName;
    const name = ensureExt(pref, ['.jsonld'], opts.defaultName);
    const saved = await saveBlobWithPicker(opts.blob, name, {
      description: 'JSON-LD Files',
      accept: { 'application/ld+json': ['.jsonld'] },
    });
    if (saved === '') {
      deps.setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.saveCancelled);
      return;
    }
    if (saved) {
      writeExportPrefs({ format: opts.format, filename: saved });
    } else {
      downloadBlob(opts.blob, name);
      writeExportPrefs({ format: opts.format, filename: name });
    }
    deps.markExported();
    deps.setTransientExportStatus(opts.okMsg);
    try {
      const state = useGraphStore.getState();
      if (opts.format === 'graph-field-settings-jsonld') {
        state.setGraphFieldsOpStatus(true, opts.okMsg);
      } else if (opts.format === 'graphrag-workflow-jsonld') {
        state.setOrchestratorOpStatus(true, opts.okMsg);
      }
    } catch {
      void 0;
    }
  } catch {
    deps.setTransientExportStatus(opts.failedMsg);
    try {
      const state = useGraphStore.getState();
      if (opts.format === 'graph-field-settings-jsonld') {
        state.setGraphFieldsOpStatus(false, opts.failedMsg);
      } else if (opts.format === 'graphrag-workflow-jsonld') {
        state.setOrchestratorOpStatus(false, opts.failedMsg);
      }
    } catch {
      void 0;
    }
  }
}

export async function exportSettingsJsonLd(deps: WorkflowJsonLdDeps): Promise<void> {
  try {
    const doc = buildSettingsJsonLdDocument(settingsRegistry);
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: 'application/ld+json;charset=utf-8',
    });
    await exportJsonLdBlob(deps, {
      format: 'settings-jsonld',
      defaultName: 'settings.jsonld',
      blob,
      okMsg: IMPORT_EXPORT_STATUS_COPY.settingsJsonLdExported,
      failedMsg: IMPORT_EXPORT_STATUS_COPY.settingsJsonLdExportFailed,
    });
  } catch {
    deps.setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.settingsJsonLdExportFailed);
  }
}

export async function exportGraphFieldSettingsJsonLd(
  deps: WorkflowJsonLdDeps,
): Promise<void> {
  try {
    const { graphId, graphFieldSettingsById } = useGraphStore.getState();
    const doc = buildGraphFieldSettingsJsonLdDocument(graphId, graphFieldSettingsById);
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: 'application/ld+json;charset=utf-8',
    });
    await exportJsonLdBlob(deps, {
      format: 'graph-field-settings-jsonld',
      defaultName: 'graph-field-settings.jsonld',
      blob,
      okMsg: IMPORT_EXPORT_STATUS_COPY.graphFieldSettingsJsonLdExported,
      failedMsg: IMPORT_EXPORT_STATUS_COPY.graphFieldSettingsJsonLdExportFailed,
    });
  } catch {
    deps.setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.graphFieldSettingsJsonLdExportFailed);
  }
}

export async function exportGraphRagWorkflowJsonLd(
  deps: WorkflowJsonLdDeps,
): Promise<void> {
  try {
    const { graphId, graphRagWorkflowJsonText } = useGraphStore.getState();
    const trimmed =
      typeof graphRagWorkflowJsonText === 'string' ? graphRagWorkflowJsonText.trim() : '';

    const doc = (() => {
      if (!trimmed) return buildGraphRagWorkflowJsonLdDocument(graphId);
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const res = validateGraphRagWorkflowJsonLdObject(parsed);
        if (!res.ok) {
          const first = res.errors[0] || IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowJsonLdInvalid;
          deps.setTransientExportStatus(first);
          try {
            const state = useGraphStore.getState();
            state.setOrchestratorOpStatus(false, first);
          } catch {
            void 0;
          }
          return null;
        }
        return parsed;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err || '');
        const msg = IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowJsonLdInvalidJson(message);
        deps.setTransientExportStatus(msg);
        try {
          const state = useGraphStore.getState();
          state.setOrchestratorOpStatus(false, msg);
        } catch {
          void 0;
        }
        return null;
      }
    })();

    if (!doc) return;

    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: 'application/ld+json;charset=utf-8',
    });
    await exportJsonLdBlob(deps, {
      format: 'graphrag-workflow-jsonld',
      defaultName: 'graphrag-workflow.jsonld',
      blob,
      okMsg: IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowJsonLdExported,
      failedMsg: IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowJsonLdExportFailed,
    });
  } catch {
    deps.setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowJsonLdExportFailed);
  }
}

export async function exportHistoryJsonLd(deps: WorkflowJsonLdDeps): Promise<void> {
  try {
    const { history, historyIndex } = useGraphStore.getState();
    if (!Array.isArray(history) || history.length === 0) {
      deps.setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.historyNoHistoryToExport);
      return;
    }
    const doc = buildHistoryJsonLdDocument(history, historyIndex);
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: 'application/ld+json;charset=utf-8',
    });
    await exportJsonLdBlob(deps, {
      format: 'history-jsonld',
      defaultName: 'history.jsonld',
      blob,
      okMsg: IMPORT_EXPORT_STATUS_COPY.historyJsonLdExported,
      failedMsg: IMPORT_EXPORT_STATUS_COPY.historyJsonLdExportFailed,
    });
  } catch {
    deps.setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.historyJsonLdExportFailed);
  }
}

export async function importSettingsJsonLd(deps: WorkflowJsonLdDeps): Promise<void> {
  try {
    const loaded = await importJsonDocument();
    if (!loaded.ok) {
      deps.setTransientExportStatus(
        loaded.reason === 'cancel'
          ? IMPORT_EXPORT_STATUS_COPY.importCancelled
          : IMPORT_EXPORT_STATUS_COPY.invalidJsonFile,
      );
      return;
    }
    const values = parseSettingsDocumentToValues(loaded.doc);
    if (!values) {
      deps.setTransientExportStatus(
        IMPORT_EXPORT_STATUS_COPY.settingsImportUnrecognizedJsonLd,
      );
      return;
    }
    const { wrote, skipped } = applySettingsValuesToRegistry(values, settingsRegistry);
    if (wrote > 0) {
      deps.setTransientExportStatus(
        skipped > 0
          ? IMPORT_EXPORT_STATUS_COPY.settingsImportAppliedWithSkipped(wrote, skipped)
          : IMPORT_EXPORT_STATUS_COPY.settingsImportApplied(wrote),
      );
      return;
    }
    deps.setTransientExportStatus(
      IMPORT_EXPORT_STATUS_COPY.settingsImportNoWritableKeys,
    );
  } catch {
    deps.setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.settingsImportFailed);
  }
}

export async function importGraphFieldSettingsJsonLd(
  deps: WorkflowJsonLdDeps,
): Promise<void> {
  try {
    const loaded = await importJsonDocument();
    if (!loaded.ok) {
      const msg =
        loaded.reason === 'cancel'
          ? IMPORT_EXPORT_STATUS_COPY.importCancelled
          : IMPORT_EXPORT_STATUS_COPY.invalidJsonFile;
      deps.setTransientExportStatus(msg);
      try {
        const state = useGraphStore.getState();
        state.setGraphFieldsOpStatus(loaded.reason === 'cancel' ? null : false, msg);
      } catch {
        void 0;
      }
      return;
    }
    const parsed = parseGraphFieldSettingsDocument(loaded.doc);
    if (!parsed) {
      const msg =
        IMPORT_EXPORT_STATUS_COPY.graphFieldSettingsImportUnrecognizedJsonLd;
      deps.setTransientExportStatus(msg);
      try {
        const state = useGraphStore.getState();
        state.setGraphFieldsOpStatus(false, msg);
      } catch {
        void 0;
      }
      return;
    }
    const state = useGraphStore.getState();
    const current = state.graphFieldSettingsById || {};
    state.setGraphFieldSettingsById({ ...current, ...parsed.settingsById });
    const count = Object.keys(parsed.settingsById).length;
    const msg = IMPORT_EXPORT_STATUS_COPY.graphFieldSettingsImported(count);
    deps.setTransientExportStatus(msg);
    try {
      state.setGraphFieldsOpStatus(count > 0 ? true : null, msg);
    } catch {
      void 0;
    }
  } catch {
    const msg = IMPORT_EXPORT_STATUS_COPY.graphFieldSettingsImportFailed;
    deps.setTransientExportStatus(msg);
    try {
      const state = useGraphStore.getState();
      state.setGraphFieldsOpStatus(false, msg);
    } catch {
      void 0;
    }
  }
}

export async function importHistoryJsonLd(deps: WorkflowJsonLdDeps): Promise<void> {
  try {
    const loaded = await importJsonDocument();
    if (!loaded.ok) {
      deps.setTransientExportStatus(
        loaded.reason === 'cancel'
          ? IMPORT_EXPORT_STATUS_COPY.importCancelled
          : IMPORT_EXPORT_STATUS_COPY.invalidJsonFile,
      );
      return;
    }
    const parsed = parseHistoryDocument(loaded.doc);
    if (!parsed) {
      deps.setTransientExportStatus(
        IMPORT_EXPORT_STATUS_COPY.historyImportUnrecognizedJsonLd,
      );
      return;
    }
    useGraphStore.getState().replaceHistoryState(parsed.history, parsed.historyIndex);
    deps.setTransientExportStatus(
      IMPORT_EXPORT_STATUS_COPY.historyImported(parsed.history.length),
    );
  } catch {
    deps.setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.historyImportFailed);
  }
}



export function importGraphRagWorkflowFromText(
  deps: WorkflowJsonLdDeps,
  nameRaw: string | null | undefined,
  textRaw: string | null | undefined,
): void {
  const state = useGraphStore.getState();
  const name = typeof nameRaw === 'string' ? nameRaw : '';
  const text = typeof textRaw === 'string' ? textRaw : '';
  const trimmed = text.trim();
  if (!trimmed) {
    const msg = IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowImportEmpty;
    deps.setTransientExportStatus(msg);
    try {
      state.setOrchestratorOpStatus(false, msg);
      state.setRenderOpStatus(false, msg);
    } catch {
      void 0;
    }
    return;
  }
  const lowerName = name.toLowerCase();
  const graphId = state.graphId;
  let doc: unknown;
  if (lowerName.endsWith('.yaml') || lowerName.endsWith('.yml')) {
    const yamlDoc = parseGraphragCliConfigYamlToJsonLd(trimmed, graphId);
    if (!yamlDoc) {
      const msg = IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowImportUnrecognizedYaml;
      deps.setTransientExportStatus(msg);
      try {
        state.setOrchestratorOpStatus(false, msg);
        state.setRenderOpStatus(false, msg);
      } catch {
        void 0;
      }
      return;
    }
    doc = yamlDoc;
  } else {
    try {
      doc = JSON.parse(trimmed) as unknown;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err || '');
      const msg = IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowJsonLdInvalidJson(message);
      deps.setTransientExportStatus(msg);
      try {
        state.setOrchestratorOpStatus(false, msg);
        state.setRenderOpStatus(false, msg);
      } catch {
        void 0;
      }
      return;
    }
  }
  const res = validateGraphRagWorkflowJsonLdObject(doc);
  if (!res.ok) {
    const first = res.errors[0] || IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowJsonLdInvalid;
    deps.setTransientExportStatus(first);
    try {
      state.setOrchestratorOpStatus(false, first);
      state.setRenderOpStatus(false, first);
    } catch {
      void 0;
    }
    return;
  }
  const jsonText = JSON.stringify(doc, null, 2);
  state.setGraphRagWorkflowJsonText(jsonText);
  const msg = IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowImported(name);
  deps.setTransientExportStatus(msg);
  try {
    state.setOrchestratorOpStatus(true, msg);
    state.setRenderOpStatus(true, msg);
  } catch {
    void 0;
  }
}

export async function importGraphRagWorkflowJsonLd(
  deps: WorkflowJsonLdDeps,
): Promise<void> {
  try {
    const picked = await pickTextFileWithExtensions([
      '.jsonld',
      '.json',
      '.json-ld',
      '.yaml',
      '.yml',
    ]);
    if (!picked) {
      const msg = IMPORT_EXPORT_STATUS_COPY.importCancelled;
      deps.setTransientExportStatus(msg);
      try {
        const state = useGraphStore.getState();
        state.setOrchestratorOpStatus(null, msg);
        state.setRenderOpStatus(null, msg);
      } catch {
        void 0;
      }
      return;
    }
    importGraphRagWorkflowFromText(deps, picked.name || '', picked.text || '');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err || '');
    const msg = IMPORT_EXPORT_STATUS_COPY.graphRagWorkflowImportFailed(message);
    deps.setTransientExportStatus(msg);
    try {
      const state = useGraphStore.getState();
      state.setOrchestratorOpStatus(false, msg);
      state.setRenderOpStatus(false, msg);
    } catch {
      void 0;
    }
  }
}
