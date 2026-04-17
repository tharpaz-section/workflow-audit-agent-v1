import type { StoredRun } from '@/server/repositories/types';
import { buildTeamPatternsFromRuns } from '@/server/services/patterns';

function makeRun(id: string, taskName: string, tool: string, painLevel: number): StoredRun {
  return {
    id,
    companyName: 'Section Demo Co',
    department: 'Revenue',
    team: 'RevOps',
    roleTitle: 'Revenue Operations Manager',
    generationMode: 'mock',
    status: 'complete',
    progress: 100,
    priorPatterns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    state: {
      profile: {
        companyName: 'Section Demo Co',
        department: 'Revenue',
        team: 'RevOps',
        roleTitle: 'Revenue Operations Manager',
      },
      generationMode: 'mock',
      currentCard: null,
      selectedTasks: [taskName],
      frictionSummary: 'Manual work is slow.',
      aiToolUsage: '',
      aspirationalFocus: '',
      teamPatternsAcknowledged: [],
      notes: [],
      currentTaskIndex: 0,
      progress: 100,
      isComplete: true,
      stageLabel: 'Complete',
      taskDetails: [
        {
          name: taskName,
          summary: `Doing ${taskName} takes too long.`,
          tools: [tool],
          collaborators: ['Finance'],
          painLevel,
          automationWish: '',
          estimatedHoursPerWeek: 4,
          category: 'workflow',
        },
      ],
    },
  };
}

describe('buildTeamPatternsFromRuns', () => {
  it('aggregates recurring tasks, tools, and pain points by team', () => {
    const patterns = buildTeamPatternsFromRuns([
      makeRun('run-1', 'Forecast reporting', 'Salesforce', 5),
      makeRun('run-2', 'Pipeline QA', 'Slack', 4),
    ]);

    expect(patterns).toHaveLength(1);
    expect(patterns[0].recurringTasks).toEqual(expect.arrayContaining(['Forecast reporting', 'Pipeline QA']));
    expect(patterns[0].commonTools).toEqual(expect.arrayContaining(['Salesforce', 'Slack']));
    expect(patterns[0].commonPainPoints).toEqual(
      expect.arrayContaining(['Forecast reporting feels high-friction', 'Pipeline QA feels high-friction']),
    );
  });
});
