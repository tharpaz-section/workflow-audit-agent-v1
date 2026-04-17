import { buildInterviewBrief, buildOrgIntelligenceSnapshot, buildRoleImpact } from '@/server/services/org-intelligence';
import { seedDemoRepository } from '@/server/services/demo';
import { MemoryWorkflowAuditRepository } from '@/server/repositories/memory';

describe('org workflow expert helpers', () => {
  it('builds briefing context from prior runs and org intelligence', async () => {
    const repository = new MemoryWorkflowAuditRepository();
    await seedDemoRepository(repository);

    const runs = await repository.listRuns();
    const results = (await Promise.all(runs.map((run) => repository.getResult(run.id)))).filter(Boolean);
    const intelligence = buildOrgIntelligenceSnapshot('Section Demo Co', runs, results);
    const briefing = buildInterviewBrief(
      {
        companyName: 'Section Demo Co',
        department: 'Revenue',
        team: 'RevOps',
        roleTitle: 'Revenue Operations Manager',
      },
      runs[0]?.priorPatterns || [],
      intelligence,
    );

    expect(briefing.interviewBrief.likelyWorkflows.length).toBeGreaterThan(0);
    expect(briefing.orgSignals.lightCoverageAreas).toContain('RevOps');
    expect(briefing.modelConfidence.overall).toBeGreaterThan(0);
  });

  it('produces org intelligence coverage, gaps, and role impact', async () => {
    const repository = new MemoryWorkflowAuditRepository();
    await seedDemoRepository(repository);

    const runs = await repository.listRuns();
    const results = (await Promise.all(runs.map((run) => repository.getResult(run.id)))).filter(Boolean);
    const intelligence = buildOrgIntelligenceSnapshot('Section Demo Co', runs, results);

    expect(intelligence.coverage.teams[0]?.team).toBe('RevOps');
    expect(intelligence.criticalGaps.length).toBeGreaterThan(0);
    expect(intelligence.modelHealth.overallConfidence).toBeGreaterThan(0);

    const roleImpact = buildRoleImpact(runs[0].state, {
      heroPrompt: results[0].heroPrompt,
      topOpportunities: results[0].topOpportunities,
      nextStep: results[0].nextStep,
    });

    expect(roleImpact.personalOpportunities.length).toBeGreaterThan(0);
    expect(roleImpact.skillsToBuild.length).toBeGreaterThan(0);
  });
});
