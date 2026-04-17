import { randomUUID } from 'node:crypto';
import type {
  AdminSummary,
  GenerationMode,
  InterviewTurnResponse,
  RunProfile,
  TeamPattern,
  WorkflowAuditResult,
  WorkflowAuditState,
} from '../../lib/contracts.js';
import {
  answerPayloadSchema,
  createRunResponseSchema,
  interviewStateSchema,
} from '../../lib/contracts.js';
import { buildAdminSummary } from './admin.js';
import { seedDemoRepository } from './demo.js';
import { runInterviewAgent, runRecommendationAgent, runWorkflowSpecialist, buildInitialState } from '../agents/openai.js';
import { buildInterviewBrief, buildOrgIntelligenceSnapshot, buildRoleImpact } from './org-intelligence.js';
import { getPriorPatterns } from './patterns.js';
import { getRepository } from './repository.js';

function nowIso() {
  return new Date().toISOString();
}

function hydrateStoredResult(run: { state: WorkflowAuditState }, result: WorkflowAuditResult) {
  if (result.roleImpact) {
    return result;
  }

  return {
    ...result,
    roleImpact: buildRoleImpact(run.state, {
      heroPrompt: result.heroPrompt,
      topOpportunities: result.topOpportunities,
      nextStep: result.nextStep,
    }),
  } satisfies WorkflowAuditResult;
}

export async function createRun(profile: RunProfile & { focusArea?: string; generationMode?: GenerationMode }) {
  const repository = await getRepository();
  const priorPatterns = await getPriorPatterns(repository, profile.companyName, profile.team);
  const orgIntelligence = await repository.getOrgIntelligence(profile.companyName);
  const generationMode = profile.generationMode ?? 'mock';
  const briefing = buildInterviewBrief(profile, priorPatterns, orgIntelligence);
  const initialState = interviewStateSchema.parse(
    buildInitialState(
      profile,
      priorPatterns,
      briefing.interviewBrief,
      briefing.orgSignals,
      briefing.modelConfidence,
      generationMode,
    ),
  );
  const runId = randomUUID();

  await repository.createRun({
    id: runId,
    companyName: profile.companyName,
    department: profile.department,
    team: profile.team,
    roleTitle: profile.roleTitle,
    generationMode,
    status: 'in_progress',
    progress: initialState.progress,
    state: initialState,
    priorPatterns,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
  });

  await repository.appendMessage({
    id: randomUUID(),
    runId,
    role: 'assistant',
    cardKind: initialState.currentCard?.kind,
    content: initialState.notes[0],
    payload: { cardId: initialState.currentCard?.id },
    createdAt: nowIso(),
  });

  return createRunResponseSchema.parse({
    runId,
    initialState,
    priorPatterns,
  });
}

export async function getRunView(runId: string) {
  const repository = await getRepository();
  const run = await repository.getRun(runId);
  if (!run) return null;
  const messages = await repository.listMessages(runId);
  return {
    run,
    messages,
  };
}

export async function submitAnswer(
  runId: string,
  rawAnswer: unknown,
): Promise<InterviewTurnResponse> {
  const repository = await getRepository();
  const run = await repository.getRun(runId);
  if (!run) throw new Error(`Run ${runId} not found`);

  const answer = answerPayloadSchema.parse(rawAnswer);
  const answerText = Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value);

  await repository.appendMessage({
    id: randomUUID(),
    runId,
    role: 'user',
    cardKind: run.state.currentCard?.kind,
    content: answerText,
    payload: { value: answer.value, cardId: run.state.currentCard?.id },
    createdAt: nowIso(),
  });

  const recentMessages = await repository.listMessages(runId);
  const turn = await runInterviewAgent(run.state, answer.value, run.priorPatterns, recentMessages);
  const nextState: WorkflowAuditState = interviewStateSchema.parse({
    ...run.state,
    ...turn.extracted,
    progress: turn.progress,
    stageLabel: turn.stageLabel,
    isComplete: turn.isComplete,
    currentCard: turn.card,
  });

  await repository.updateRun(runId, {
    progress: turn.progress,
    status: turn.isComplete ? 'interview_complete' : run.status,
    state: nextState,
  });

  await repository.appendMessage({
    id: randomUUID(),
    runId,
    role: 'assistant',
    cardKind: turn.card?.kind,
    content: turn.assistantMessage,
    payload: { cardId: turn.card?.id, isComplete: turn.isComplete },
    createdAt: nowIso(),
  });

  return turn;
}

export async function completeRun(
  runId: string,
): Promise<{ status: 'processing' | 'complete'; result: WorkflowAuditResult | null }> {
  const repository = await getRepository();
  const run = await repository.getRun(runId);
  if (!run) throw new Error(`Run ${runId} not found`);

  const existing = await repository.getResult(runId);
  if (existing) return { status: 'complete', result: hydrateStoredResult(run, existing) };

  await repository.updateRun(runId, { status: 'processing' });
  const orgIntelligence = await repository.getOrgIntelligence(run.companyName);
  const specialist = await runWorkflowSpecialist(run.state);
  const generatedResult = await runRecommendationAgent(run.state, specialist, orgIntelligence, runId, run.priorPatterns);
  const result = hydrateStoredResult(run, generatedResult);

  await repository.replaceTasks(
    runId,
    run.state.taskDetails.map((task) => ({
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
  const completedRuns = (await repository.listRuns()).filter(
    (candidate) =>
      candidate.status === 'complete' && candidate.companyName.toLowerCase() === run.companyName.toLowerCase(),
  );
  const completedResults = (
    await Promise.all(completedRuns.map((candidate) => repository.getResult(candidate.id)))
  ).filter(Boolean) as WorkflowAuditResult[];
  const finalOrgIntelligence = buildOrgIntelligenceSnapshot(run.companyName, [...completedRuns, {
    ...run,
    status: 'complete',
  }], [...completedResults, result]);
  await repository.saveOrgIntelligence(run.companyName, finalOrgIntelligence);
  await repository.updateRun(runId, {
    status: 'complete',
    progress: 100,
    completedAt: result.completedAt,
    state: interviewStateSchema.parse({
      ...run.state,
      modelConfidence: {
        overall: finalOrgIntelligence.modelHealth.overallConfidence,
        label:
          finalOrgIntelligence.modelHealth.overallConfidence >= 0.78
            ? 'Strong'
            : finalOrgIntelligence.modelHealth.overallConfidence >= 0.58
              ? 'Building'
              : 'Early',
        notes: finalOrgIntelligence.modelHealth.notes,
      },
      orgSignals: {
        ...run.state.orgSignals,
        lightCoverageAreas: finalOrgIntelligence.coverage.lightCoverageTeams,
        oneSidedHandoffs: finalOrgIntelligence.unilateralConnections
          .slice(0, 3)
          .map((connection) => `${connection.sourceTask} -> ${connection.targetTeam}`),
      },
    }),
  });

  return { status: 'complete', result };
}

export async function getResult(runId: string): Promise<WorkflowAuditResult | null> {
  const repository = await getRepository();
  const [run, result] = await Promise.all([repository.getRun(runId), repository.getResult(runId)]);
  if (!result || !run) return result;
  return hydrateStoredResult(run, result);
}

export async function getAdmin(): Promise<AdminSummary> {
  const repository = await getRepository();
  return buildAdminSummary(repository);
}

export async function resetDemo() {
  const repository = await getRepository();
  await seedDemoRepository(repository);
}
