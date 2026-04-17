import { submitAnswer } from '../../../src/server/services/run-service';
import { answerPayloadSchema } from '../../../src/lib/contracts';
import { getQueryParam, allowMethods, handleApiError, parseJsonBody, sendJson } from '../../_utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const runId = getQueryParam(req, 'id');
    if (!runId) return sendJson(res, 400, { error: 'Missing run id' });
    const payload = answerPayloadSchema.parse(parseJsonBody(req));
    const result = await submitAnswer(runId, payload);
    return sendJson(res, 200, result);
  } catch (error) {
    return handleApiError(res, error);
  }
}
