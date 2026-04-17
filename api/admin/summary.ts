import { getAdmin } from '../../src/server/services/run-service.js';
import { allowMethods, handleApiError, sendJson } from '../_utils.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const summary = await getAdmin();
    return sendJson(res, 200, summary);
  } catch (error) {
    return handleApiError(res, error);
  }
}
