export function getServerEnv() {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    databaseUrl: process.env.WORKFLOW_AUDIT_DATABASE_URL || process.env.DATABASE_URL || '',
    baseModel: process.env.WORKFLOW_AUDIT_OPENAI_MODEL || 'gpt-5.4',
    interviewModel: process.env.WORKFLOW_AUDIT_INTERVIEW_MODEL || process.env.WORKFLOW_AUDIT_OPENAI_MODEL || 'gpt-5.4',
    specialistModel: process.env.WORKFLOW_AUDIT_SPECIALIST_MODEL || process.env.WORKFLOW_AUDIT_OPENAI_MODEL || 'gpt-5.4-mini',
    recommendationModel:
      process.env.WORKFLOW_AUDIT_RECOMMENDATION_MODEL ||
      process.env.WORKFLOW_AUDIT_OPENAI_MODEL ||
      'gpt-5.4',
  };
}
