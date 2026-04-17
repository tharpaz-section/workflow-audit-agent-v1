import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function apiPlugin() {
  let moduleCache: Promise<{
    runService: Record<string, any>;
    contracts: Record<string, any>;
  }> | null = null;

  return {
    name: 'workflow-audit-dev-api',
    configureServer(server: {
      middlewares: {
        use: (
          fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>,
        ) => void;
      };
      ssrLoadModule: (url: string) => Promise<Record<string, any>>;
    }) {
      server.middlewares.use(async (req, res, next) => {
        const method = req.method || 'GET';
        const pathname = req.url ? new URL(req.url, 'http://localhost').pathname : '';

        try {
          if (!moduleCache) {
            moduleCache = Promise.all([
              server.ssrLoadModule('/src/server/services/run-service.ts'),
              server.ssrLoadModule('/src/lib/contracts.ts'),
            ]).then(([runService, contracts]) => ({ runService, contracts }));
          }
          const { runService, contracts } = await moduleCache;

          if (method === 'POST' && pathname === '/api/runs') {
            const payload = contracts.createRunRequestSchema.parse(await readJsonBody(req));
            return sendJson(res, 200, await runService.createRun(payload));
          }

          const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
          if (method === 'GET' && runMatch) {
            const result = await runService.getRunView(runMatch[1]);
            if (!result) return sendJson(res, 404, { error: 'Run not found' });
            return sendJson(res, 200, result);
          }

          const turnMatch = pathname.match(/^\/api\/runs\/([^/]+)\/turn$/);
          if (method === 'POST' && turnMatch) {
            const payload = contracts.answerPayloadSchema.parse(await readJsonBody(req));
            return sendJson(res, 200, await runService.submitAnswer(turnMatch[1], payload));
          }

          const completeMatch = pathname.match(/^\/api\/runs\/([^/]+)\/complete$/);
          if (method === 'POST' && completeMatch) {
            return sendJson(res, 200, await runService.completeRun(completeMatch[1]));
          }

          const resultsMatch = pathname.match(/^\/api\/runs\/([^/]+)\/results$/);
          if (method === 'GET' && resultsMatch) {
            const result = await runService.getResult(resultsMatch[1]);
            if (!result) return sendJson(res, 202, { status: 'processing' });
            return sendJson(res, 200, result);
          }

          if (method === 'GET' && pathname === '/api/admin/summary') {
            return sendJson(res, 200, await runService.getAdmin());
          }

          if (method === 'POST' && pathname === '/api/demo/reset') {
            await runService.resetDemo();
            return sendJson(res, 200, await runService.getAdmin());
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unexpected server error';
          return sendJson(res, 500, { error: message });
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [react(), apiPlugin()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      port: 4173,
    },
  };
});
