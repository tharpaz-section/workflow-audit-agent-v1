import { randomUUID } from 'node:crypto';
import type {
  OrgIntelligence,
  PromptArtifact,
  TeamPattern,
  WorkflowAuditResult,
  WorkflowAuditState,
  WorkflowConnection,
  WorkflowOpportunity,
} from '../../lib/contracts.js';
import type { WorkflowAuditRepository } from '../repositories/types.js';
import { buildInterviewBrief, buildRoleImpact } from './org-intelligence.js';

const DEMO_COMPANY = 'Section Demo Co';
const DEMO_TEAM = 'RevOps';

function buildSeedState(priorPatterns: TeamPattern[]): WorkflowAuditState {
  const briefing = buildInterviewBrief(
    {
      companyName: DEMO_COMPANY,
      department: 'Revenue',
      team: DEMO_TEAM,
      roleTitle: 'Revenue Operations Manager',
    },
    priorPatterns,
    null,
  );

  return {
    profile: {
      companyName: DEMO_COMPANY,
      department: 'Revenue',
      team: DEMO_TEAM,
      roleTitle: 'Revenue Operations Manager',
    },
    generationMode: 'mock',
    currentCard: null,
    selectedTasks: ['Renewal forecast updates', 'Pipeline QA'],
    frictionSummary: 'Manual forecasting updates and CRM cleanup eat up the team’s Mondays.',
    aiToolUsage: 'ChatGPT for spreadsheet formulas and email drafting.',
    aspirationalFocus: 'Spend more time on forecasting strategy and less on data cleanup.',
    teamPatternsAcknowledged: ['Forecast reporting', 'CRM hygiene'],
    notes: ['Seeded demo respondent'],
    currentTaskIndex: 0,
    progress: 100,
    isComplete: true,
    stageLabel: 'Complete',
    taskDetails: [
      {
        name: 'Renewal forecast updates',
        summary:
          'Pull numbers from Salesforce, reconcile with finance, and rebuild the weekly forecast deck.',
        tools: ['Salesforce', 'Google Sheets', 'Slides'],
        collaborators: ['Finance', 'Sales managers'],
        painLevel: 5,
        automationWish: 'Auto-refresh the forecast and highlight changes before Monday meetings.',
        estimatedHoursPerWeek: 6,
        category: 'reporting',
      },
      {
        name: 'Pipeline QA',
        summary:
          'Check stage hygiene, missing close dates, and handoff notes before leadership reviews.',
        tools: ['Salesforce', 'Slack'],
        collaborators: ['Account executives', 'Sales leadership'],
        painLevel: 4,
        automationWish: 'Surface risky records automatically and draft nudges for owners.',
        estimatedHoursPerWeek: 3,
        category: 'operations',
      },
    ],
    interviewBrief: briefing.interviewBrief,
    orgSignals: briefing.orgSignals,
    modelConfidence: briefing.modelConfidence,
  };
}

function buildSeedPatterns(): TeamPattern[] {
  return [
    {
      team: DEMO_TEAM,
      summary:
        'RevOps interviews consistently mention forecast assembly, CRM hygiene, and cross-functional handoffs into finance.',
      recurringTasks: ['Renewal forecast updates', 'Pipeline QA', 'Quarterly business review prep'],
      commonTools: ['Salesforce', 'Google Sheets', 'Slack'],
      commonPainPoints: [
        'Manual reconciliations',
        'Executive reporting bottlenecks',
        'Missing handoff data',
      ],
      respondentCount: 1,
    },
  ];
}

function buildSeedResult(runId: string, teamPatterns: TeamPattern[]): WorkflowAuditResult {
  const topOpportunities: WorkflowOpportunity[] = [
    {
      title: 'Automate the weekly renewal forecast pack',
      type: 'report-generation',
      affectedTeams: ['RevOps', 'Finance', 'Sales leadership'],
      estimatedHoursSaved: 18,
      confidence: 0.92,
      promptReady: true,
      rationale:
        'This workflow is repeated every week, depends on multiple spreadsheets, and drives leadership decisions.',
      category: 'reporting',
    },
    {
      title: 'Flag risky pipeline records before leadership review',
      type: 'data-lookup',
      affectedTeams: ['RevOps', 'Account executives'],
      estimatedHoursSaved: 11,
      confidence: 0.84,
      promptReady: true,
      rationale:
        'Most of the work is hunting for missing fields and inconsistencies across the CRM.',
      category: 'operations',
    },
    {
      title: 'Draft handoff nudges for missing finance inputs',
      type: 'dependency-delay',
      affectedTeams: ['RevOps', 'Finance'],
      estimatedHoursSaved: 6,
      confidence: 0.71,
      promptReady: false,
      rationale:
        'Cross-team follow-up is small but frequent, and it directly slows Monday reporting.',
      category: 'coordination',
    },
  ];

  const heroPrompt: PromptArtifact = {
    title: 'Weekly Renewal Forecast Copilot Prompt',
    suggestedModel: 'gpt-5.4-mini',
    recommendedSurface: 'scheduled_task',
    surfaceRationale:
      'The forecast pack repeats on a clear weekly cadence and produces a stable output, so it is a strong fit for a scheduled run.',
    setupChecklist: [
      'Create a recurring task every Monday before the renewal review starts.',
      'Attach the Salesforce export, finance notes, and the prior deck to the same run.',
      'Have it draft the first pass, then review before sharing with leadership.',
    ],
    instructions: `You are my RevOps forecast copilot.\n\nInputs:\n- Salesforce renewal export\n- finance variance notes\n- last week's forecast deck\n\nTasks:\n1. Reconcile changes between this week's export and last week's deck.\n2. Flag the top 5 changes leadership should know about.\n3. Draft a concise update for Monday's renewal forecast review.\n4. List missing data or owner follow-ups before I present.\n\nOutput format:\n- Executive summary\n- Top changes\n- Risks and missing data\n- Suggested follow-up message`,
    notes: [
      'Best setup: Scheduled task.',
      'Pair this with a recurring export from Salesforce.',
      'Use the same output format each Monday so the deck is easy to update.',
    ],
  };

  const workflowConnections: WorkflowConnection[] = [
    {
      sourceTask: 'Renewal forecast updates',
      targetTeam: 'Finance',
      targetLabel: 'Finance analyst',
      connectionType: 'input',
      description: 'Finance provides actuals and variance notes before the forecast is finalized.',
    },
    {
      sourceTask: 'Pipeline QA',
      targetTeam: 'Sales',
      targetLabel: 'Account executive',
      connectionType: 'output',
      description: 'RevOps sends owners a cleanup list before the leadership review.',
    },
  ];

  return {
    runId,
    completedAt: new Date().toISOString(),
    topOpportunities,
    heroPrompt,
    roleImpact: buildRoleImpact(buildSeedState(teamPatterns), {
      heroPrompt,
      topOpportunities,
      nextStep:
        'Start with the weekly renewal forecast pack. It is the clearest quick win and already has the strongest team-level signal.',
    }),
    humanStrengths: [
      'Leadership narration still benefits from your judgment and stakeholder context.',
      'Escalation calls still need human prioritization and relationship awareness.',
    ],
    nextStep:
      'Start with the weekly renewal forecast pack. It is the clearest quick win and already has the strongest team-level signal.',
    workflowConnections,
    teamPatterns,
  };
}

function buildSeedOrgIntelligence(result: WorkflowAuditResult): OrgIntelligence {
  return {
    companyName: DEMO_COMPANY,
    generatedAt: new Date().toISOString(),
    summary: 'Signals are clustering around renewal forecast updates, pipeline QA, and finance handoffs.',
    likelyWorkflows: ['Renewal forecast updates', 'Pipeline QA', 'Quarterly business review prep'],
    probableConnections: ['Renewal forecast updates -> Finance', 'Pipeline QA -> Sales'],
    coverage: {
      totalRespondents: 1,
      teams: [
        {
          team: DEMO_TEAM,
          respondentCount: 1,
          roles: ['Revenue Operations Manager'],
          confidence: 0.46,
          status: 'light',
        },
      ],
      lightCoverageTeams: [DEMO_TEAM],
    },
    criticalGaps: [
      {
        title: 'Coverage is still light in RevOps',
        detail: 'One completed audit is enough to seed the model, but not enough to lock in every handoff.',
        severity: 'medium',
      },
      {
        title: 'Finance side of the handoff is still missing',
        detail: '"Renewal forecast updates" points to Finance, but that handoff is still confirmed by one side only.',
        severity: 'high',
      },
    ],
    unilateralConnections: result.workflowConnections.slice(0, 1),
    contradictions: [],
    modelHealth: {
      overallConfidence: 0.46,
      summary: 'Signals are directional, but more completed audits will make the workflow map sturdier.',
      notes: ['Coverage is still light in RevOps.', 'Finance handoffs are still confirmed by one side only.'],
    },
  };
}

export async function seedDemoRepository(repository: WorkflowAuditRepository) {
  await repository.reset();

  const runId = randomUUID();
  const priorPatterns = buildSeedPatterns();
  const state = buildSeedState(priorPatterns);
  const result = buildSeedResult(runId, priorPatterns);
  const orgIntelligence = buildSeedOrgIntelligence(result);

  await repository.createRun({
    id: runId,
    companyName: DEMO_COMPANY,
    department: 'Revenue',
    team: DEMO_TEAM,
    roleTitle: 'Revenue Operations Manager',
    generationMode: 'mock',
    status: 'complete',
    progress: 100,
    state,
    priorPatterns,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  });

  await repository.appendMessage({
    id: randomUUID(),
    runId,
    role: 'assistant',
    cardKind: 'text',
    content:
      'Thanks for walking through your workflow. I can already see forecast reporting and CRM cleanup are your biggest automation opportunities.',
    payload: {},
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  });

  await repository.replaceTasks(
    runId,
    state.taskDetails.map((task) => ({
      id: randomUUID(),
      runId,
      taskName: task.name,
      summary: task.summary,
      tools: task.tools,
      collaborators: task.collaborators,
      painLevel: task.painLevel,
      estimatedHoursPerWeek: task.estimatedHoursPerWeek,
      category: task.category,
    })),
  );

  await repository.replaceConnections(
    runId,
    result.workflowConnections.map((connection) => ({
      id: randomUUID(),
      runId,
      sourceTask: connection.sourceTask,
      targetTeam: connection.targetTeam,
      targetLabel: connection.targetLabel,
      connectionType: connection.connectionType,
      description: connection.description,
    })),
  );

  await repository.saveResult(runId, result);
  await repository.saveOrgIntelligence(DEMO_COMPANY, orgIntelligence);
}
