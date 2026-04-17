import type { TeamPattern, WorkflowAuditState } from '../../lib/contracts.js';
import type { StoredRun, WorkflowAuditRepository } from '../repositories/types.js';

function normalize(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function summarizeTasks(state: WorkflowAuditState) {
  return normalize(state.taskDetails.map((task) => task.name));
}

function summarizeTools(state: WorkflowAuditState) {
  return normalize(state.taskDetails.flatMap((task) => task.tools));
}

function summarizePain(state: WorkflowAuditState) {
  return normalize(
    state.taskDetails
      .filter((task) => task.painLevel && task.painLevel >= 4)
      .map((task) => `${task.name} feels high-friction`),
  );
}

export function buildTeamPatternsFromRuns(runs: StoredRun[]): TeamPattern[] {
  const groups = new Map<string, StoredRun[]>();

  for (const run of runs) {
    const key = `${run.companyName}::${run.team}`;
    const group = groups.get(key) || [];
    group.push(run);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([, teamRuns]) => {
    const state = teamRuns[teamRuns.length - 1].state;
    const recurringTasks = normalize(teamRuns.flatMap((run) => summarizeTasks(run.state)));
    const commonTools = normalize(teamRuns.flatMap((run) => summarizeTools(run.state)));
    const commonPainPoints = normalize(teamRuns.flatMap((run) => summarizePain(run.state)));

    return {
      team: teamRuns[0].team,
      summary:
        recurringTasks.length > 0
          ? `${teamRuns[0].team} repeatedly mentions ${recurringTasks.slice(0, 3).join(', ')}.`
          : `${teamRuns[0].team} has started building a workflow pattern library.`,
      recurringTasks: recurringTasks.slice(0, 6),
      commonTools: commonTools.slice(0, 6),
      commonPainPoints: commonPainPoints.slice(0, 6),
      respondentCount: teamRuns.length,
    };
  });
}

export async function getPriorPatterns(
  repository: WorkflowAuditRepository,
  companyName: string,
  team: string,
) {
  const runs = await repository.listRuns();
  const relevant = runs.filter(
    (run) =>
      run.status === 'complete' &&
      run.companyName.toLowerCase() === companyName.toLowerCase() &&
      run.team.toLowerCase() === team.toLowerCase(),
  );

  return buildTeamPatternsFromRuns(relevant);
}
