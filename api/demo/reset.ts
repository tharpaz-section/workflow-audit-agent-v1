import { getAdmin, resetDemo } from '../../src/server/services/run-service.js';
import { allowMethods, handleApiError, sendJson } from '../_utils.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    await resetDemo();
    const summary = await getAdmin();
    return sendJson(res, 200, summary);
  } catch (error) {
    return handleApiError(res, error);
  }
}
