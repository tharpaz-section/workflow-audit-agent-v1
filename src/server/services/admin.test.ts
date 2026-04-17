import { MemoryWorkflowAuditRepository } from '@/server/repositories/memory';
import { buildAdminSummary } from '@/server/services/admin';
import { seedDemoRepository } from '@/server/services/demo';

describe('buildAdminSummary', () => {
  it('summarizes seeded runs into heatmap and completion metrics', async () => {
    const repository = new MemoryWorkflowAuditRepository();
    await seedDemoRepository(repository);

    const summary = await buildAdminSummary(repository);

    expect(summary.completion.totalRuns).toBe(1);
    expect(summary.completion.completedRuns).toBe(1);
    expect(summary.heatmap.length).toBeGreaterThan(0);
    expect(summary.topOpportunities[0]?.title).toContain('forecast');
    expect(summary.coverage.teams[0]?.team).toBe('RevOps');
    expect(summary.modelHealth.overallConfidence).toBeGreaterThan(0);
  });
});
