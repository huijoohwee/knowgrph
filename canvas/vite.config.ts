import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { CODEBASE_INDEX_PIPELINE_COMMAND } from './src/lib/config-copy/tooltips'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function runMarkdownPipelineOnce(): Promise<void> {
  const parts = CODEBASE_INDEX_PIPELINE_COMMAND.split(/\s+/).filter(Boolean)
  const cmd = parts[0]
  const args = parts.slice(1)
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      stdio: 'inherit',
    })
    child.on('error', error => {
      reject(error)
    })
    child.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Markdown pipeline exited with code ${code}`))
      }
    })
  })
}

const markdownPipelineDevPlugin = {
  name: 'knowgrph-markdown-pipeline-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/__run_markdown_pipeline', async (req, res, next) => {
      if (req.method !== 'POST') {
        next()
        return
      }
      try {
        await runMarkdownPipelineOnce()
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch (error) {
        let message = 'Failed to run markdown pipeline'
        if (error && typeof error === 'object' && 'message' in error) {
          const candidate = (error as { message?: unknown }).message
          if (typeof candidate === 'string' && candidate.trim()) {
            message = candidate
          }
        }
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: message }))
      }
    })
  },
}

export default defineConfig(({ command }) => ({
  build: {
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          d3: ['d3'],
          three: ['three', '@react-three/fiber'],
          ui: ['lucide-react', 'zustand'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, '..')]
    }
  },
  plugins: [
    react({
      babel: {
        plugins: ['react-dev-locator'],
      },
    }),
    ...(command === 'build'
      ? []
      : [
          traeBadgePlugin({
            variant: 'dark',
            position: 'bottom-right',
            prodOnly: true,
            clickable: true,
            clickUrl: process.env.VITE_TRAE_BADGE_URL || 'https://www.trae.ai/solo?showJoin=1',
            autoTheme: true,
            autoThemeTarget: '#root',
          }),
          markdownPipelineDevPlugin,
        ]),
    tsconfigPaths(),
  ],
}))
