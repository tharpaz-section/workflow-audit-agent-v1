import type {
  AdminSummary,
  CoverageSummary,
  ModelHealth,
  OrgIntelligence,
  WorkflowAuditResult,
  WorkflowOpportunity,
} from '@/lib/contracts';
import { adminSummarySchema } from '@/lib/contracts';
import type { WorkflowAuditRepository } from '@/server/repositories/types';
import { buildOrgIntelligenceSnapshot } from './org-intelligence';
import { buildTeamPatternsFromRuns } from './patterns';

function toHeatScore(opportunity: WorkflowOpportunity) {
  return Math.max(15, Math.min(100, Math.round(opportunity.estimatedHoursSaved * 4)));
}

export async function buildAdminSummary(
  repository: WorkflowAuditRepository,
): Promise<AdminSummary> {
  const runs = await repository.listRuns();
  const completedRuns = runs.filter((run) => run.status === 'complete');

  const results = (
    await Promise.all(completedRuns.map((run) => repository.getResult(run.id)))
  ).filter(Boolean) as WorkflowAuditResult[];

  const heatmapMap = new Map<string, { team: string; category: string; score: number; count: number }>();
  const topOpportunities = results
    .flatMap((result) => result.topOpportunities)
    .sort((a, b) => b.estimatedHoursSaved - a.estimatedHoursSaved)
    .slice(0, 6);

  const companyNames = [...new Set(completedRuns.map((run) => run.companyName))];
  const intelligences = (
    await Promise.all(
      companyNames.map(async (companyName) => {
        const existing = await repository.getOrgIntelligence(companyName);
        if (existing) return existing;
        const companyRuns = completedRuns.filter((run) => run.companyName === companyName);
        const companyResults = results.filter((result) =>
          companyRuns.some((run) => run.id === result.runId),
        );
        return buildOrgIntelligenceSnapshot(companyName, companyRuns, companyResults);
      }),
    )
  ).filter(Boolean) as OrgIntelligence[];

  for (const run of completedRuns) {
    const result = await repository.getResult(run.id);
    if (!result) continue;
    for (const opportunity of result.topOpportunities) {
      const key = `${run.team}::${opportunity.category}`;
      const current = heatmapMap.get(key);
      const score = toHeatScore(opportunity);
      if (!current) {
        heatmapMap.set(key, {
          team: run.team,
          category: opportunity.category,
          score,
          count: 1,
        });
        continue;
      }
      current.score = Math.round((current.score * current.count + score) / (current.count + 1));
      current.count += 1;
    }
  }

  const mergedCoverage = intelligences.reduce<CoverageSummary>(
    (accumulator, intelligence) => ({
      totalRespondents: accumulator.totalRespondents + intelligence.coverage.totalRespondents,
      teams: [...accumulator.teams, ...intelligence.coverage.teams],
      lightCoverageTeams: [...new Set([...accumulator.lightCoverageTeams, ...intelligence.coverage.lightCoverageTeams])],
    }),
    {
      totalRespondents: 0,
      teams: [],
      lightCoverageTeams: [],
    },
  );

  const overallConfidence =
    intelligences.length > 0
      ? intelligences.reduce((sum, intelligence) => sum + intelligence.modelHealth.overallConfidence, 0) /
        intelligences.length
      : 0.32;

  const modelHealth: ModelHealth = {
    overallConfidence,
    summary:
      intelligences[0]?.modelHealth.summary ||
      'Signals are still building. More completed audits will strengthen coverage and confidence.',
    notes: [...new Set(intelligences.flatMap((intelligence) => intelligence.modelHealth.notes))].slice(0, 4),
  };

  return adminSummarySchema.parse({
    completion: {
      totalRuns: runs.length,
      completedRuns: completedRuns.length,
      teamsCovered: new Set(completedRuns.map((run) => run.team)).size,
    },
    heatmap: [...heatmapMap.values()].sort((a, b) => b.score - a.score),
    topOpportunities,
    connections: results.flatMap((result) => result.workflowConnections).slice(0, 12),
    teamPatterns: buildTeamPatternsFromRuns(completedRuns),
    coverage: mergedCoverage,
    criticalGaps: intelligences.flatMap((intelligence) => intelligence.criticalGaps).slice(0, 8),
    unilateralConnections: intelligences.flatMap((intelligence) => intelligence.unilateralConnections).slice(0, 8),
    contradictions: intelligences.flatMap((intelligence) => intelligence.contradictions).slice(0, 6),
    modelHealth,
  });
}
