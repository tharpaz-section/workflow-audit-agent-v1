import {
  adminSummarySchema,
  interviewTurnResponseSchema,
  workflowAuditResultSchema,
} from '@/lib/contracts';

describe('contracts', () => {
  it('parses a structured interview turn', () => {
    const turn = interviewTurnResponseSchema.parse({
      assistantMessage: 'Tell me about the workflow.',
      card: {
        id: 'task-selection',
        kind: 'multi_select',
        title: 'Pick a workflow',
        options: [{ id: 'forecasting', label: 'Forecasting' }],
        suggestions: ['Forecasting'],
      },
      extracted: {
        frictionSummary: 'Manual reporting is slow.',
      },
      progress: 30,
      stageLabel: 'Mapping tasks',
      isComplete: false,
    });

    expect(turn.card?.kind).toBe('multi_select');
    expect(turn.extracted.frictionSummary).toBe('Manual reporting is slow.');
  });

  it('rejects an invalid workflow result', () => {
    expect(() =>
      workflowAuditResultSchema.parse({
        runId: 'run-1',
        completedAt: new Date().toISOString(),
        topOpportunities: [],
      heroPrompt: {
          title: 'Prompt',
          instructions: 'Do the work',
          suggestedModel: 'gpt-5.4-mini',
          recommendedSurface: 'single_prompt',
          surfaceRationale: 'Use a prompt first.',
          setupChecklist: ['Save the prompt.'],
        },
        roleImpact: {
          summary: 'This is the best place to start.',
          personalOpportunities: ['Use AI for the first draft'],
          skillsToBuild: ['Prompt iteration'],
          message: 'Start narrow and keep the review layer with you.',
        },
        nextStep: 'Start somewhere',
        workflowConnections: [],
        teamPatterns: [],
      }),
    ).not.toThrow();
  });

  it('fills role impact defaults for older workflow results', () => {
    const result = workflowAuditResultSchema.parse({
      runId: 'run-legacy',
      completedAt: new Date().toISOString(),
      topOpportunities: [],
      heroPrompt: {
        title: 'Prompt',
        instructions: 'Do the work',
        suggestedModel: 'gpt-5.4-mini',
        recommendedSurface: 'single_prompt',
        surfaceRationale: 'Use a prompt first.',
        setupChecklist: ['Try it on one workflow.'],
        notes: [],
      },
      nextStep: 'Start somewhere',
      workflowConnections: [],
      teamPatterns: [],
    });

    expect(result.roleImpact.summary).toContain('role');
    expect(result.roleImpact.skillsToBuild.length).toBeGreaterThan(0);
  });

  it('parses the admin summary shape', () => {
    const summary = adminSummarySchema.parse({
      completion: {
        totalRuns: 2,
        completedRuns: 1,
        teamsCovered: 1,
      },
      heatmap: [
        {
          team: 'RevOps',
          category: 'reporting',
          score: 72,
          count: 2,
        },
      ],
      topOpportunities: [],
      connections: [],
      teamPatterns: [],
      coverage: {
        totalRespondents: 1,
        teams: [
          {
            team: 'RevOps',
            respondentCount: 1,
            roles: ['Manager'],
            confidence: 0.45,
            status: 'light',
          },
        ],
        lightCoverageTeams: ['RevOps'],
      },
      criticalGaps: [],
      unilateralConnections: [],
      contradictions: [],
      modelHealth: {
        overallConfidence: 0.45,
        summary: 'Signals are still early.',
        notes: ['Coverage is light.'],
      },
    });

    expect(summary.heatmap[0].score).toBe(72);
  });

  it('fills workflow intelligence defaults for older admin payloads', () => {
    const summary = adminSummarySchema.parse({
      completion: {
        totalRuns: 1,
        completedRuns: 1,
        teamsCovered: 1,
      },
      heatmap: [],
      topOpportunities: [],
      connections: [],
      teamPatterns: [],
    });

    expect(summary.coverage.totalRespondents).toBe(0);
    expect(summary.criticalGaps).toEqual([]);
    expect(summary.modelHealth.summary).toContain('building');
  });
});
