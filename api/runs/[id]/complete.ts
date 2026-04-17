import { completeRun } from '../../../src/server/services/run-service.js';
import { getQueryParam, allowMethods, handleApiError, sendJson } from '../../_utils.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const runId = getQueryParam(req, 'id');
    if (!runId) return sendJson(res, 400, { error: 'Missing run id' });
    const result = await completeRun(runId);
    return sendJson(res, 200, result);
  } catch (error) {
    return handleApiError(res, error);
  }
}
