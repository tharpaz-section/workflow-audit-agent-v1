import {
  adminSummarySchema,
  createRunResponseSchema,
  interviewTurnResponseSchema,
  runViewSchema,
  workflowAuditResultSchema,
} from '@/lib/contracts';

type JsonRequestOptions = RequestInit & {
  body?: unknown;
};

async function request<T>(
  url: string,
  schema: { parse: (value: unknown) => T },
  options?: JsonRequestOptions,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options?.headers || {}),
    },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {
      // Ignore JSON parsing failures for error responses.
    }
    throw new Error(message);
  }

  return schema.parse(await response.json());
}

export function startRun(payload: {
  companyName: string;
  department: string;
  team: string;
  roleTitle: string;
  focusArea?: string;
  generationMode?: 'mock' | 'live';
}) {
  return request('/api/runs', createRunResponseSchema, {
    method: 'POST',
    body: payload,
  });
}

export function getRunView(runId: string) {
  return request(`/api/runs/${runId}`, runViewSchema);
}

export function submitAnswer(runId: string, value: string | number | string[]) {
  return request(`/api/runs/${runId}/turn`, interviewTurnResponseSchema, {
    method: 'POST',
    body: { value },
  });
}

export async function completeRun(runId: string) {
  const response = await fetch(`/api/runs/${runId}/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Unable to process run ${runId}`);
  }
  const payload = await response.json();
  return {
    status: payload.status as 'processing' | 'complete',
    result: payload.result ? workflowAuditResultSchema.parse(payload.result) : null,
  };
}

export async function getResult(runId: string) {
  const response = await fetch(`/api/runs/${runId}/results`);
  if (response.status === 202) {
    return { status: 'processing' as const, result: null };
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Unable to load results for ${runId}`);
  }

  return {
    status: 'complete' as const,
    result: workflowAuditResultSchema.parse(await response.json()),
  };
}

export function getAdminSummary() {
  return request('/api/admin/summary', adminSummarySchema);
}

export function resetDemoData() {
  return request('/api/demo/reset', adminSummarySchema, {
    method: 'POST',
  });
}
