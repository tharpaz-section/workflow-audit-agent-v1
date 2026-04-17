import {
  completeRun,
  createRun,
  getAdmin,
  getResult,
  getRunView,
  submitAnswer,
} from '@/server/services/run-service';
import { getRepository } from '@/server/services/repository';
import { resetRepositoryForTests } from '@/server/services/repository';

describe('workflow audit run service', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = '';
    process.env.WORKFLOW_AUDIT_DATABASE_URL = '';
    process.env.DATABASE_URL = '';
    resetRepositoryForTests();
  });

  it('runs a team-aware interview end to end and updates admin aggregates', async () => {
    const created = await createRun({
      companyName: 'Section Demo Co',
      department: 'Revenue',
      team: 'RevOps',
      roleTitle: 'Revenue Operations Manager',
      focusArea: 'Forecast reporting',
    });

    expect(created.priorPatterns.length).toBeGreaterThan(0);
    expect(created.initialState.notes[0]).toContain('starting point');
    expect(created.initialState.interviewBrief.likelyWorkflows.length).toBeGreaterThan(0);
    expect(created.initialState.modelConfidence.overall).toBeGreaterThan(0);

    await submitAnswer(created.runId, { value: 'Forecast prep and CRM cleanup are the biggest drag.' });
    await submitAnswer(created.runId, { value: ['Renewal forecast updates', 'Pipeline QA'] });
    await submitAnswer(created.runId, { value: 'Renewal forecast updates' });
    await submitAnswer(
      created.runId,
      { value: 'I rebuild the renewal forecast in Google Sheets using Salesforce data and chase Finance for changes.' },
    );
    await submitAnswer(created.runId, { value: 'spreadsheet' });
    await submitAnswer(created.runId, { value: 'deck_or_readout' });
    await submitAnswer(created.runId, { value: 'missing_inputs' });
    await submitAnswer(created.runId, { value: ['Salesforce', 'Sheets', 'Slides'] });
    await submitAnswer(created.runId, { value: ['Finance', 'Sales'] });
    await submitAnswer(created.runId, { value: 5 });
    await submitAnswer(created.runId, { value: 'Draft the first forecast pack and highlight missing inputs before I review it.' });
    await submitAnswer(created.runId, { value: 'I want more time for strategy and weekly forecast prep.' });

    const view = await getRunView(created.runId);
    expect(view?.run.state.isComplete).toBe(true);

    const completion = await completeRun(created.runId);
    expect(completion.status).toBe('complete');

    const result = await getResult(created.runId);
    expect(result?.topOpportunities.length).toBeGreaterThan(0);
    expect(result?.heroPrompt.instructions).toContain('workflow copilot');
    expect(result?.heroPrompt.suggestedModel).toMatch(/^gpt-5\.4/);
    expect(result?.roleImpact.summary).toContain('role');

    const admin = await getAdmin();
    expect(admin.completion.completedRuns).toBe(2);
    expect(admin.teamPatterns[0]?.team).toBe('RevOps');
    expect(admin.coverage.teams[0]?.team).toBe('RevOps');
  });

  it('hydrates older stored results that do not yet have role impact', async () => {
    const created = await createRun({
      companyName: 'Section Demo Co',
      department: 'Revenue',
      team: 'RevOps',
      roleTitle: 'Revenue Operations Manager',
      focusArea: 'Forecast reporting',
    });

    const repository = await getRepository();
    await repository.saveResult(
      created.runId,
      {
        runId: created.runId,
        completedAt: new Date().toISOString(),
        topOpportunities: [
          {
            title: 'Automate forecast reporting',
            type: 'report-generation',
            affectedTeams: ['RevOps'],
            estimatedHoursSaved: 8,
            confidence: 0.8,
            promptReady: true,
            rationale: 'It repeats weekly.',
            category: 'reporting',
          },
        ],
        heroPrompt: {
          title: 'Forecast Prompt',
          instructions: 'You are my forecast copilot.',
          suggestedModel: 'gpt-5.4-mini',
          recommendedSurface: 'scheduled_task',
          surfaceRationale: 'It repeats on a cadence.',
          setupChecklist: ['Run it every Monday.'],
          notes: ['Review the draft before sharing.'],
        },
        humanStrengths: ['Judgment still matters.'],
        nextStep: 'Start with forecast reporting.',
        workflowConnections: [],
        teamPatterns: [],
      } as any,
    );

    const completion = await completeRun(created.runId);
    const result = await getResult(created.runId);

    expect(completion.result?.roleImpact.summary).toContain('role');
    expect(result?.roleImpact.message).toContain('Start narrow');
  });
});
