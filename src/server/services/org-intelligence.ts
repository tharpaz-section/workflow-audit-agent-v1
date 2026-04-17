import type {
  CoverageSummary,
  CriticalGap,
  InterviewBrief,
  ModelConfidence,
  OrgIntelligence,
  OrgSignals,
  RoleImpact,
  TeamPattern,
  WorkflowAuditResult,
  WorkflowAuditState,
  WorkflowConnection,
} from '../../lib/contracts';
import {
  coverageSummarySchema,
  criticalGapSchema,
  interviewBriefSchema,
  modelConfidenceSchema,
  modelHealthSchema,
  orgIntelligenceSchema,
  orgSignalsSchema,
  roleImpactSchema,
} from '../../lib/contracts';
import { getRoleTemplate } from '../agents/prompts';
import type { StoredRun } from '../repositories/types';

function uniq(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeTaskName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildCoverageSummary(companyRuns: StoredRun[]): CoverageSummary {
  const teamGroups = new Map<string, StoredRun[]>();

  for (const run of companyRuns) {
    const group = teamGroups.get(run.team) || [];
    group.push(run);
    teamGroups.set(run.team, group);
  }

  const teams = [...teamGroups.entries()]
    .map(([team, runs]) => {
      const respondentCount = runs.length;
      const roles = uniq(runs.map((run) => run.roleTitle));
      const confidence = Math.max(0.25, Math.min(0.96, 0.28 + respondentCount * 0.22 + roles.length * 0.08));
      return {
        team,
        respondentCount,
        roles,
        confidence,
        status: respondentCount >= 3 ? 'strong' : respondentCount >= 2 ? 'building' : 'light',
      } as const;
    })
    .sort((left, right) => right.respondentCount - left.respondentCount || left.team.localeCompare(right.team));

  return coverageSummarySchema.parse({
    totalRespondents: companyRuns.length,
    teams,
    lightCoverageTeams: teams.filter((team) => team.status === 'light').map((team) => team.team),
  });
}

function buildLikelyWorkflows(companyRuns: StoredRun[]) {
  const counts = new Map<string, { label: string; count: number }>();

  for (const run of companyRuns) {
    for (const task of run.state.taskDetails) {
      const key = normalizeTaskName(task.name);
      const current = counts.get(key) || { label: task.name, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 8)
    .map((entry) => entry.label);
}

function buildProbableConnections(connections: WorkflowConnection[]) {
  const counts = new Map<string, { label: string; count: number }>();

  for (const connection of connections) {
    const label = `${connection.sourceTask} -> ${connection.targetTeam}`;
    const current = counts.get(label) || { label, count: 0 };
    current.count += 1;
    counts.set(label, current);
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 6)
    .map((entry) => entry.label);
}

function buildUnilateralConnections(companyRuns: StoredRun[], connections: WorkflowConnection[]) {
  const coveredTeams = new Set(companyRuns.map((run) => run.team.toLowerCase()));
  const connectionCounts = new Map<string, number>();

  for (const connection of connections) {
    const key = `${normalizeTaskName(connection.sourceTask)}::${connection.targetTeam.toLowerCase()}::${connection.connectionType.toLowerCase()}`;
    connectionCounts.set(key, (connectionCounts.get(key) || 0) + 1);
  }

  return connections
    .filter((connection) => {
      const key = `${normalizeTaskName(connection.sourceTask)}::${connection.targetTeam.toLowerCase()}::${connection.connectionType.toLowerCase()}`;
      return !coveredTeams.has(connection.targetTeam.toLowerCase()) || (connectionCounts.get(key) || 0) === 1;
    })
    .slice(0, 6);
}

function buildContradictions(companyRuns: StoredRun[]) {
  const grouped = new Map<
    string,
    { label: string; categories: Set<string>; tools: Set<string>; teams: Set<string>; count: number }
  >();

  for (const run of companyRuns) {
    for (const task of run.state.taskDetails) {
      const key = normalizeTaskName(task.name);
      const current = grouped.get(key) || {
        label: task.name,
        categories: new Set<string>(),
        tools: new Set<string>(),
        teams: new Set<string>(),
        count: 0,
      };
      current.count += 1;
      current.categories.add(task.category || 'workflow');
      current.teams.add(run.team);
      task.tools.forEach((tool) => current.tools.add(tool));
      grouped.set(key, current);
    }
  }

  return [...grouped.values()]
    .filter((entry) => entry.count >= 2 && (entry.categories.size > 1 || entry.tools.size >= 6))
    .slice(0, 4)
    .map((entry) => ({
      title: `${entry.label} is still modeled inconsistently`,
      detail:
        entry.categories.size > 1
          ? `Completed audits disagree on whether this is primarily ${[...entry.categories].join(', ')} work.`
          : `Teams are using a wide spread of tools for this workflow, which lowers confidence in one shared playbook.`,
      teams: [...entry.teams].slice(0, 4),
    }));
}

function buildCriticalGaps(
  coverage: CoverageSummary,
  unilateralConnections: WorkflowConnection[],
  contradictions: ReturnType<typeof buildContradictions>,
): CriticalGap[] {
  const gaps: CriticalGap[] = [];

  if (coverage.teams.length <= 1) {
    gaps.push({
      title: 'Cross-team coverage is still thin',
      detail: 'Only one team has completed enough audits to confirm where the major handoffs break down.',
      severity: 'high',
    });
  }

  for (const team of coverage.lightCoverageTeams.slice(0, 3)) {
    gaps.push({
      title: `Coverage is still light in ${team}`,
      detail: `${team} has only one completed audit, so patterns there should still be treated as provisional.`,
      severity: 'medium',
    });
  }

  for (const connection of unilateralConnections.slice(0, 2)) {
    gaps.push({
      title: `${connection.targetTeam} side of the handoff is still missing`,
      detail: `"${connection.sourceTask}" points to ${connection.targetTeam}, but that handoff is still confirmed by one side only.`,
      severity: 'high',
    });
  }

  for (const contradiction of contradictions.slice(0, 2)) {
    gaps.push({
      title: contradiction.title,
      detail: contradiction.detail,
      severity: 'medium',
    });
  }

  return gaps.map((gap) => criticalGapSchema.parse(gap)).slice(0, 6);
}

function buildModelConfidence(
  coverage: CoverageSummary,
  unilateralConnections: WorkflowConnection[],
  contradictions: ReturnType<typeof buildContradictions>,
): ModelConfidence {
  const rawScore =
    0.32 +
    coverage.totalRespondents * 0.12 +
    coverage.teams.length * 0.08 -
    unilateralConnections.length * 0.04 -
    contradictions.length * 0.05;
  const overall = Math.max(0.24, Math.min(0.96, rawScore));
  const label = overall >= 0.78 ? 'Strong' : overall >= 0.58 ? 'Building' : 'Early';

  return modelConfidenceSchema.parse({
    overall,
    label,
    notes: [
      coverage.lightCoverageTeams.length > 0
        ? `Coverage is still light in ${coverage.lightCoverageTeams.slice(0, 3).join(', ')}.`
        : 'Team coverage is broad enough to trust the main pattern clusters.',
      unilateralConnections.length > 0
        ? `${unilateralConnections.length} handoff${unilateralConnections.length === 1 ? '' : 's'} are still confirmed by one side only.`
        : 'Cross-team handoffs are showing up in more than one place.',
    ],
  });
}

export function buildOrgIntelligenceSnapshot(
  companyName: string,
  companyRuns: StoredRun[],
  results: WorkflowAuditResult[],
): OrgIntelligence {
  const coverage = buildCoverageSummary(companyRuns);
  const connections = results.flatMap((result) => result.workflowConnections);
  const unilateralConnections = buildUnilateralConnections(companyRuns, connections);
  const contradictions = buildContradictions(companyRuns);
  const criticalGaps = buildCriticalGaps(coverage, unilateralConnections, contradictions);
  const modelConfidence = buildModelConfidence(coverage, unilateralConnections, contradictions);
  const likelyWorkflows = buildLikelyWorkflows(companyRuns);
  const probableConnections = buildProbableConnections(connections);

  return orgIntelligenceSchema.parse({
    companyName,
    generatedAt: new Date().toISOString(),
    summary:
      likelyWorkflows.length > 0
        ? `Signals are clustering around ${likelyWorkflows.slice(0, 3).join(', ')}.`
        : 'Signals are still early, but the audit is starting to map where workflow pain clusters.',
    likelyWorkflows,
    probableConnections,
    coverage,
    criticalGaps,
    unilateralConnections,
    contradictions,
    modelHealth: modelHealthSchema.parse({
      overallConfidence: modelConfidence.overall,
      summary:
        modelConfidence.overall >= 0.78
          ? 'The workflow map is strong enough to support broader recommendations.'
          : modelConfidence.overall >= 0.58
            ? 'The workflow map is directionally useful, but a few teams still need more coverage.'
            : 'Treat this as an early signal layer until more audits confirm the handoffs.',
      notes: modelConfidence.notes,
    }),
  });
}

export function buildInterviewBrief(
  profile: WorkflowAuditState['profile'],
  priorPatterns: TeamPattern[],
  orgIntelligence: OrgIntelligence | null,
): {
  interviewBrief: InterviewBrief;
  orgSignals: OrgSignals;
  modelConfidence: ModelConfidence;
} {
  const template = getRoleTemplate(profile.roleTitle);
  const likelyWorkflows = uniq([
    ...priorPatterns.flatMap((pattern) => pattern.recurringTasks),
    ...(orgIntelligence?.likelyWorkflows || []),
    ...template.tasks,
  ]).slice(0, 6);

  const probableConnections = uniq([
    ...(orgIntelligence?.probableConnections || []),
    ...priorPatterns.flatMap((pattern) => pattern.commonPainPoints.map((pain) => `${pattern.team}: ${pain}`)),
  ]).slice(0, 4);

  const interviewBrief = interviewBriefSchema.parse({
    summary:
      priorPatterns.length > 0
        ? `${profile.team} already shows patterns around ${priorPatterns[0].recurringTasks.slice(0, 2).join(' and ')}.`
        : orgIntelligence?.summary ||
          `We are starting fresh for ${profile.team}, so the audit will use your workflow as the first strong signal.`,
    likelyWorkflows,
    priorityGaps: (orgIntelligence?.criticalGaps || []).map((gap) => gap.title).slice(0, 3),
    probableConnections,
    confidenceNotes: orgIntelligence?.modelHealth.notes.slice(0, 3) || ['Signals are still early, so your answers will help define the baseline.'],
  });

  const orgSignals = orgSignalsSchema.parse({
    confirmedPatterns: likelyWorkflows.slice(0, 4),
    lightCoverageAreas:
      orgIntelligence?.coverage.lightCoverageTeams.length
        ? orgIntelligence.coverage.lightCoverageTeams
        : priorPatterns.length === 0
          ? [profile.team]
          : [],
    oneSidedHandoffs: (orgIntelligence?.unilateralConnections || [])
      .slice(0, 3)
      .map((connection) => `${connection.sourceTask} -> ${connection.targetTeam}`),
  });

  const modelConfidence = modelConfidenceSchema.parse({
    overall: orgIntelligence?.modelHealth.overallConfidence ?? (priorPatterns.length > 0 ? 0.56 : 0.32),
    label:
      orgIntelligence?.modelHealth.overallConfidence && orgIntelligence.modelHealth.overallConfidence >= 0.78
        ? 'Strong'
        : orgIntelligence?.modelHealth.overallConfidence && orgIntelligence.modelHealth.overallConfidence >= 0.58
          ? 'Building'
          : priorPatterns.length > 0
            ? 'Building'
            : 'Early',
    notes: interviewBrief.confidenceNotes,
  });

  return {
    interviewBrief,
    orgSignals,
    modelConfidence,
  };
}

function buildRoleSkills(surface: WorkflowAuditResult['heroPrompt']['recommendedSurface']) {
  switch (surface) {
    case 'scheduled_task':
      return ['Keeping source inputs clean', 'Reviewing AI-generated first passes', 'Escalating exceptions quickly'];
    case 'chatgpt_project':
      return ['Maintaining shared context', 'Structuring messy source material', 'Steering cross-functional synthesis'];
    case 'custom_gpt':
      return ['Instruction tuning', 'Curating strong examples', 'Quality-checking repeated outputs'];
    case 'single_prompt':
    default:
      return ['Prompt iteration', 'Checking assumptions', 'Deciding when the work is ready to automate'];
  }
}

export function buildRoleImpact(
  state: WorkflowAuditState,
  result: Pick<WorkflowAuditResult, 'heroPrompt' | 'topOpportunities' | 'nextStep'>,
): RoleImpact {
  const topOpportunity = result.topOpportunities[0];
  const teamSignal =
    state.interviewBrief.likelyWorkflows.length > 0
      ? `Signals nearby point to ${state.interviewBrief.likelyWorkflows.slice(0, 2).join(' and ')} as repeatable workflow clusters.`
      : 'This audit is creating one of the first strong workflow signals for your role.';

  return roleImpactSchema.parse({
    summary: topOpportunity
      ? `${topOpportunity.title} is the clearest place to give time back in your ${state.profile.roleTitle} role.`
      : `The audit points to one narrow workflow where AI can support your ${state.profile.roleTitle} role first.`,
    personalOpportunities: uniq([
      state.aspirationalFocus ? `Redirect saved time toward ${state.aspirationalFocus}` : '',
      ...result.topOpportunities.slice(0, 3).map((opportunity) => opportunity.title),
    ]).slice(0, 4),
    skillsToBuild: buildRoleSkills(result.heroPrompt.recommendedSurface),
    message: `${teamSignal} Start narrow, keep the review layer with you, and use the first setup to create a repeatable habit instead of a one-off experiment.`,
  });
}
