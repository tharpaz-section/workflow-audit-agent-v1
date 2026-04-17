type ApiRequest = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(payload: unknown): void;
};

export function allowMethods(res: ApiResponse, methods: string[]) {
  res.setHeader('Allow', methods.join(', '));
}

export function sendJson(res: ApiResponse, status: number, payload: unknown) {
  return res.status(status).json(payload);
}

export function getQueryParam(req: ApiRequest, key: string) {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseJsonBody<T = unknown>(req: ApiRequest): T {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body) as T;
  }
  return (req.body || {}) as T;
}

export function handleApiError(res: ApiResponse, error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'ZodError' &&
    'message' in error
  ) {
    return sendJson(res, 400, { error: String(error.message) });
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error';
  return sendJson(res, 500, { error: message });
}
