import { createRun } from '../../src/server/services/run-service.js';
import { createRunRequestSchema } from '../../src/lib/contracts.js';
import { allowMethods, handleApiError, parseJsonBody, sendJson } from '../_utils.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const payload = createRunRequestSchema.parse(parseJsonBody(req));
    const result = await createRun(payload);
    return sendJson(res, 200, result);
  } catch (error) {
    return handleApiError(res, error);
  }
}
