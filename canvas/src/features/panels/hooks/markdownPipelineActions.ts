import { useGraphStore } from '@/hooks/useGraphStore';
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader';
import { parseSchemaText } from '@/features/schema/io';
import { openBottomPanel } from '@/features/bottom-panel/open';
import {
  CODEBASE_INDEX_PIPELINE_GRAPH_REL_PATH,
  CODEBASE_INDEX_PIPELINE_SCHEMA_REL_PATH,
  CODEBASE_INDEX_PIPELINE_ORCHESTRATOR_REL_PATH,
  PIPELINE_COMMAND_FALLBACK_STATUS_TEXT,
  PIPELINE_COMMAND_LOADED_STATUS_TEXT,
  PIPELINE_COMMAND_RUNNING_STATUS_TEXT,
  UI_COPY,
} from '@/lib/config';
import { importGraphRagWorkflowFromText } from '@/features/panels/hooks/workflowJsonLdActions';

type MarkdownPipelineRunnerWindow = Window & {
  knowgrphRunMarkdownPipeline?: () => Promise<void> | void;
};

function initMarkdownPipelineRunnerDevHook(): void {
  if (typeof window === 'undefined') return;
  if (typeof import.meta === 'undefined') return;
  const meta = import.meta as unknown as { env?: Record<string, unknown> };
  const env = meta.env;
  const isDev = !!(env && (env.DEV as unknown));
  if (!isDev) return;
  const anyWindow = window as unknown as MarkdownPipelineRunnerWindow;
  if (typeof anyWindow.knowgrphRunMarkdownPipeline === 'function') return;
  anyWindow.knowgrphRunMarkdownPipeline = async () => {
    try {
      const res = await fetch('/__run_markdown_pipeline', {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      await res.text();
    } catch {
      void 0;
    }
  };
}

initMarkdownPipelineRunnerDevHook();

export function getCodebaseRootFromEnv(): string {
  if (typeof import.meta === 'undefined') return '';
  const meta = import.meta as unknown as { env?: Record<string, unknown> };
  const env = meta.env;
  const raw = env && env.VITE_CODEBASE_ROOT;
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return trimmed;
}

export function buildFsUrlForRelPath(relPath: string): string | null {
  const rel = typeof relPath === 'string' ? relPath.trim() : '';
  if (!rel) return null;
  const rootRaw = getCodebaseRootFromEnv();
  const root = rootRaw.trim();
  const rootTrimmed = root.replace(/\/+$/, '');
  const cleanRel = rel.replace(/^\/+/, '');
  const abs = rootTrimmed ? `${rootTrimmed}/${cleanRel}` : `/${cleanRel}`;
  const absNormalized = abs.startsWith('/') ? abs : `/${abs}`;
  return `/@fs${absNormalized}`;
}

async function maybeRunMarkdownPipeline(): Promise<void> {
  if (typeof window === 'undefined') return;
  const anyWindow = window as unknown as MarkdownPipelineRunnerWindow;
  const fn = anyWindow.knowgrphRunMarkdownPipeline;
  if (typeof fn !== 'function') return;
  try {
    const result = fn();
    if (result && typeof (result as Promise<void>).then === 'function') {
      await result;
    }
  } catch {
    void 0;
  }
}

async function fetchTextFromRelPath(relPath: string): Promise<string> {
  const url = buildFsUrlForRelPath(relPath);
  if (!url) {
    throw new Error(UI_COPY.missingPathError);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(UI_COPY.requestFailedStatus(res.status));
  }
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(UI_COPY.emptyResponseError);
  }
  return text;
}

export async function runMarkdownPipelineAndLoadArtifacts(): Promise<boolean> {
  try {
    await maybeRunMarkdownPipeline();
  } catch {
    void 0;
  }
  try {
    const [graphText, schemaText, orchText] = await Promise.all([
      fetchTextFromRelPath(CODEBASE_INDEX_PIPELINE_GRAPH_REL_PATH),
      fetchTextFromRelPath(CODEBASE_INDEX_PIPELINE_SCHEMA_REL_PATH),
      fetchTextFromRelPath(CODEBASE_INDEX_PIPELINE_ORCHESTRATOR_REL_PATH),
    ]);

    await loadGraphDataFromTextViaParser(CODEBASE_INDEX_PIPELINE_GRAPH_REL_PATH, graphText);

    try {
      const schema = parseSchemaText(schemaText);
      const store = useGraphStore.getState();
      try {
        store.clearSchemaLintSummary();
      } catch {
        void 0;
      }
      try {
        store.setSchema(schema);
      } catch {
        void 0;
      }
      try {
        store.setSchemaImportLabel(CODEBASE_INDEX_PIPELINE_SCHEMA_REL_PATH);
      } catch {
        void 0;
      }
      try {
        store.setSchemaLastExportSnapshot(null);
      } catch {
        void 0;
      }
      try {
        store.setSchemaOpStatus(true, `Import OK: ${CODEBASE_INDEX_PIPELINE_SCHEMA_REL_PATH}`);
      } catch {
        void 0;
      }
    } catch {
      void 0;
    }

    try {
      importGraphRagWorkflowFromText(
        {
          markExported: () => void 0,
          setTransientExportStatus: () => void 0,
        },
        CODEBASE_INDEX_PIPELINE_ORCHESTRATOR_REL_PATH,
        orchText,
      );
    } catch {
      void 0;
    }

    try {
      openBottomPanel('data');
    } catch {
      void 0;
    }
    try {
      openBottomPanel('schema');
    } catch {
      void 0;
    }
    try {
      openBottomPanel('orchestrator');
    } catch {
      void 0;
    }

    return true;
  } catch {
    return false;
  }
}

export async function runMarkdownPipelineWithStatus(
  setStatus: (status: string | null) => void,
): Promise<void> {
  try {
    setStatus(PIPELINE_COMMAND_RUNNING_STATUS_TEXT);
  } catch {
    void 0;
  }
  let ok = false;
  try {
    ok = await runMarkdownPipelineAndLoadArtifacts();
  } catch {
    ok = false;
  }
  try {
    setStatus(ok ? PIPELINE_COMMAND_LOADED_STATUS_TEXT : PIPELINE_COMMAND_FALLBACK_STATUS_TEXT);
  } catch {
    void 0;
  }
}
