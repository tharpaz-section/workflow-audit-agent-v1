import { getRunView } from '../../../src/server/services/run-service.js';
import { getQueryParam, allowMethods, handleApiError, sendJson } from '../../_utils.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const runId = getQueryParam(req, 'id');
    if (!runId) return sendJson(res, 400, { error: 'Missing run id' });
    const result = await getRunView(runId);
    if (!result) return sendJson(res, 404, { error: 'Run not found' });
    return sendJson(res, 200, result);
  } catch (error) {
    return handleApiError(res, error);
  }
}
