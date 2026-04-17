import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import type {
  InterviewQuestionCard,
  OrgIntelligence,
  InterviewTurnResponse,
  PromptSurface,
  TeamPattern,
  WorkflowAuditResult,
  WorkflowAuditState,
} from '../../lib/contracts.js';
import {
  interviewTurnResponseSchema,
  roleImpactSchema,
  taskDetailSchema,
  workflowAuditResultSchema,
  workflowConnectionSchema,
  workflowSpecialistOutputSchema,
} from '../../lib/contracts.js';
import { getServerEnv } from '../env.js';
import {
  buildInitialAssistantMessage,
  buildInterviewSystemPrompt,
  buildRecommendationPrompt,
  buildSpecialistPrompt,
  getRoleTemplate,
} from './prompts.js';
import type { StoredMessage } from '../repositories/types.js';
import { buildRoleImpact } from '../services/org-intelligence.js';

const openAiQuestionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string().nullable(),
});

const openAiQuestionCardSchema = z.object({
  id: z.string(),
  kind: z.enum(['single_select', 'multi_select', 'chips', 'text', 'slider']),
  title: z.string(),
  description: z.string().nullable(),
  placeholder: z.string().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  step: z.number().nullable(),
  maxSelections: z.number().nullable(),
  options: z.array(openAiQuestionOptionSchema),
  suggestions: z.array(z.string()),
});

const openAiTaskDetailSchema = z.object({
  name: z.string(),
  summary: z.string(),
  tools: z.array(z.string()),
  collaborators: z.array(z.string()),
  painLevel: z.number().nullable(),
  automationWish: z.string(),
  estimatedHoursPerWeek: z.number().nullable(),
  category: z.string(),
});

const openAiExtractedPatchSchema = z.object({
  frictionSummary: z.string().nullable(),
  aiToolUsage: z.string().nullable(),
  aspirationalFocus: z.string().nullable(),
  selectedTasks: z.array(z.string()).nullable(),
  notes: z.array(z.string()).nullable(),
  currentTaskIndex: z.number().nullable(),
  taskDetails: z.array(openAiTaskDetailSchema).nullable(),
  teamPatternsAcknowledged: z.array(z.string()).nullable(),
});

const openAiInterviewTurnSchema = z.object({
  assistantMessage: z.string(),
  card: openAiQuestionCardSchema.nullable(),
  extracted: openAiExtractedPatchSchema,
  progress: z.number().min(0).max(100),
  stageLabel: z.string(),
  isComplete: z.boolean(),
});

const openAiInterviewEnhancementSchema = z.object({
  assistantMessage: z.string().nullable(),
  frictionSummary: z.string().nullable(),
  workflowSummary: z.string().nullable(),
  inferredTasks: z.array(z.string()),
  inferredTools: z.array(z.string()),
  inferredCollaborators: z.array(z.string()),
  automationWish: z.string().nullable(),
});

const openAiWorkflowOpportunitySchema = z.object({
  title: z.string(),
  type: z.string(),
  affectedTeams: z.array(z.string()),
  estimatedHoursSaved: z.number(),
  confidence: z.number(),
  promptReady: z.boolean(),
  rationale: z.string(),
  category: z.string(),
});

const openAiWorkflowConnectionSchema = z.object({
  sourceTask: z.string(),
  targetTeam: z.string(),
  targetLabel: z.string(),
  connectionType: z.string(),
  description: z.string(),
});

const openAiWorkflowSpecialistOutputSchema = z.object({
  extracted: openAiExtractedPatchSchema,
  opportunities: z.array(openAiWorkflowOpportunitySchema),
  connections: z.array(openAiWorkflowConnectionSchema),
});

const openAiPromptArtifactSchema = z.object({
  title: z.string(),
  instructions: z.string(),
  suggestedModel: z.string(),
  recommendedSurface: z.enum(['single_prompt', 'chatgpt_project', 'custom_gpt', 'scheduled_task']),
  surfaceRationale: z.string(),
  setupChecklist: z.array(z.string()),
  notes: z.array(z.string()),
});

const openAiWorkflowResultSchema = z.object({
  runId: z.string(),
  completedAt: z.string(),
  topOpportunities: z.array(openAiWorkflowOpportunitySchema),
  heroPrompt: openAiPromptArtifactSchema,
  roleImpact: z.object({
    summary: z.string(),
    personalOpportunities: z.array(z.string()),
    skillsToBuild: z.array(z.string()),
    message: z.string(),
  }),
  humanStrengths: z.array(z.string()),
  nextStep: z.string(),
  workflowConnections: z.array(openAiWorkflowConnectionSchema),
  teamPatterns: z.array(
    z.object({
      team: z.string(),
      summary: z.string(),
      recurringTasks: z.array(z.string()),
      commonTools: z.array(z.string()),
      commonPainPoints: z.array(z.string()),
      respondentCount: z.number(),
    }),
  ),
});

let client: OpenAI | null = null;

function getClient() {
  const { apiKey } = getServerEnv();
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

function shouldUseMock(state: WorkflowAuditState) {
  return state.generationMode !== 'live';
}

function requireLiveClient(state: WorkflowAuditState) {
  const client = getClient();
  if (shouldUseMock(state)) return null;
  if (!client) {
    throw new Error('Live OpenAI mode is selected, but OPENAI_API_KEY is missing.');
  }
  return client;
}

const knownTools = [
  'ChatGPT',
  'Claude',
  'Copilot',
  'Gemini',
  'Salesforce',
  'Slack',
  'Google Sheets',
  'Sheets',
  'Excel',
  'Jira',
  'Docs',
  'Slides',
  'Email',
];

function detectTools(text: string) {
  const lower = text.toLowerCase();
  return knownTools.filter((tool) => lower.includes(tool.toLowerCase()));
}

function detectCollaborators(text: string) {
  const candidateWords = [
    'finance',
    'sales',
    'marketing',
    'operations',
    'engineering',
    'customer success',
    'leadership',
    'manager',
    'team lead',
  ];
  const lower = text.toLowerCase();
  return candidateWords.filter((candidate) => lower.includes(candidate));
}

function estimateCategory(taskName: string) {
  const lower = taskName.toLowerCase();
  if (lower.includes('report') || lower.includes('forecast')) return 'reporting';
  if (lower.includes('handoff') || lower.includes('coordination')) return 'coordination';
  if (lower.includes('qa') || lower.includes('cleanup')) return 'operations';
  return 'workflow';
}

function nextTaskDetailCard(taskName: string, state: WorkflowAuditState): InterviewQuestionCard {
  const patternHint =
    state.interviewBrief.likelyWorkflows.length > 0
      ? `We already have a starting hypothesis around ${state.interviewBrief.likelyWorkflows.slice(0, 2).join(' and ')}. `
      : state.teamPatternsAcknowledged.length > 0
        ? `Your team already mentioned ${state.teamPatternsAcknowledged.slice(0, 2).join(' and ')}. `
      : '';

  return {
    id: `task-detail-${state.currentTaskIndex}`,
    kind: 'text',
    title: `Walk me through "${taskName}"`,
    description: `${patternHint}In 3-4 sentences, tell me what starts this workflow, what source you pull from first, what you need to produce, and where it slows down.`,
    placeholder: 'Cover the trigger, source material, output, tools or people involved, and where the rework shows up.',
    options: [],
    suggestions: [
      'What kicks it off',
      'Where you pull from first',
      'What you need to produce',
      'Where it gets messy',
    ],
  };
}

function nextTaskPainCard(taskName: string, index: number): InterviewQuestionCard {
  return {
    id: `task-pain-${index}`,
    kind: 'slider',
    title: `How painful is "${taskName}" right now?`,
    description: '1 is a mild annoyance. 5 is a weekly drain on your time.',
    min: 1,
    max: 5,
    step: 1,
    options: [],
    suggestions: [],
  };
}

function buildTaskSelectionCard(state: WorkflowAuditState, priorPatterns: TeamPattern[]) {
  const template = getRoleTemplate(state.profile.roleTitle);
  const taskOptions = [
    ...state.interviewBrief.likelyWorkflows,
    ...priorPatterns.flatMap((pattern) => pattern.recurringTasks),
    ...template.tasks,
  ];

  const uniqueTasks = [...new Set(taskOptions)].slice(0, 6);

  return {
    id: 'task-selection',
    kind: 'multi_select',
    title: 'Which recurring workflows sound most like your week?',
    description: 'Pick 2-4 to start. You can add your own if the list misses something important.',
    maxSelections: 4,
    options: uniqueTasks.map((task) => ({ id: task, label: task })),
    suggestions: uniqueTasks,
  } satisfies InterviewQuestionCard;
}

function buildPrimaryTaskCard(selectedTasks: string[]) {
  return {
    id: 'primary-task',
    kind: 'single_select',
    title: 'Which workflow should we focus on first?',
    description: 'We will go deep on one workflow, then use the others as supporting context for the final output.',
    options: selectedTasks.map((task) => ({
      id: task,
      label: task,
      hint: 'Use this as the primary workflow for the audit',
    })),
    suggestions: [],
  } satisfies InterviewQuestionCard;
}

function buildSourceSelectionCard(task: { summary: string; tools: string[] }) {
  const options = [
    { id: 'pm_tool', label: 'PM tool', hint: 'Jira, Linear, Aha, Productboard' },
    { id: 'doc_or_deck', label: 'Doc or deck', hint: 'Plan, brief, roadmap slide' },
    { id: 'spreadsheet', label: 'Spreadsheet', hint: 'Manual tracker or status sheet' },
    { id: 'slack_or_email', label: 'Slack or email', hint: 'Scattered updates from threads' },
    { id: 'meetings', label: 'Meetings', hint: 'Notes from review or planning' },
    { id: 'other', label: 'It depends', hint: 'Varies by cycle or request' },
  ];

  if (task.tools.some((tool) => /jira|linear|aha|productboard/i.test(tool))) {
    options[0] = { id: 'pm_tool', label: 'PM tool', hint: task.tools.filter((tool) => /jira|linear|aha|productboard/i.test(tool)).join(', ') };
  }

  return {
    id: 'starting-source',
    kind: 'single_select',
    title: 'Starting source',
    description: 'Choose the main source you pull from first.',
    options,
    suggestions: [],
  } satisfies InterviewQuestionCard;
}

function buildOutputCard(taskName: string) {
  return {
    id: 'main-output',
    kind: 'single_select',
    title: 'Main output',
    description: `What does "${taskName}" usually need to produce by the end?`,
    options: [
      { id: 'status_update', label: 'Status update', hint: 'Written update or summary for stakeholders' },
      { id: 'deck_or_readout', label: 'Deck or readout', hint: 'Slide, readout, or review artifact' },
      { id: 'tracker_update', label: 'Tracker update', hint: 'Sheet, plan, or system update' },
      { id: 'decision_note', label: 'Decision note', hint: 'Recommendation, decision, or prioritization' },
      { id: 'follow_up', label: 'Follow-up or handoff', hint: 'Message, action list, or next-step packet' },
    ],
    suggestions: [],
  } satisfies InterviewQuestionCard;
}

function buildReworkCard(task: { tools: string[]; collaborators: string[] }) {
  const dynamicOption = task.tools[0]
    ? { id: task.tools[0].toLowerCase(), label: task.tools[0], hint: 'This source often creates cleanup or mismatches' }
    : null;

  const options = [
    dynamicOption,
    { id: 'outdated_source', label: 'Outdated source', hint: 'The starting point is stale or incomplete' },
    { id: 'conflicting_versions', label: 'Conflicting versions', hint: 'Multiple places disagree with each other' },
    { id: 'missing_inputs', label: 'Missing inputs', hint: 'You have to chase details before you can finish' },
    { id: 'manual_reformatting', label: 'Manual reformatting', hint: 'You keep translating the same content across formats' },
    { id: 'late_reviews', label: 'Late review or approval', hint: 'A handoff slows the final pass' },
  ].filter(Boolean) as { id: string; label: string; hint: string }[];

  return {
    id: 'rework-source',
    kind: 'single_select',
    title: 'Biggest source of rework',
    description: 'Pick the place where outdated, partial, or conflicting info most often starts the cleanup.',
    options,
    suggestions: [],
  } satisfies InterviewQuestionCard;
}

function buildToolSelectionCard(state: WorkflowAuditState) {
  const template = getRoleTemplate(state.profile.roleTitle);
  const existingTools = state.taskDetails[state.currentTaskIndex]?.tools || [];
  const common = ['Docs', 'Sheets', 'Slack', 'Email', 'Jira', 'Slides', 'Salesforce', 'ChatGPT'];
  const uniqueTools = [...new Set([...existingTools, ...template.tools, ...common])].slice(0, 8);
  return {
    id: 'task-tools',
    kind: 'chips',
    title: 'Which tools show up most in this workflow?',
    description: 'Pick all that matter. We will use this to make the recommendation more concrete.',
    options: uniqueTools.map((tool) => ({ id: tool, label: tool })),
    suggestions: [],
  } satisfies InterviewQuestionCard;
}

function buildCollaboratorCard(state: WorkflowAuditState) {
  const options = ['Manager', 'Finance', 'Sales', 'Marketing', 'Operations', 'Leadership', 'Customer success'];
  return {
    id: 'task-collaborators',
    kind: 'chips',
    title: 'Who else is usually involved in this workflow?',
    description: 'Pick the people or teams that create handoffs, approvals, or follow-up work.',
    options: options.map((label) => ({ id: label, label })),
    suggestions: [],
  } satisfies InterviewQuestionCard;
}

function buildSynthesisCard() {
  const options = ['Priorities', 'Timeline framing', 'Risks or dependencies', 'Level of detail', 'Stakeholder concerns'];
  return {
    id: 'workflow-synthesis',
    kind: 'multi_select',
    title: 'What changes most from one version of this workflow to another?',
    description: 'Pick the few factors that create the most extra work.',
    maxSelections: 3,
    options: options.map((label) => ({ id: label, label })),
    suggestions: options,
  } satisfies InterviewQuestionCard;
}

function buildAutomationWishCard(taskName: string) {
  return {
    id: 'workflow-automation-wish',
    kind: 'text',
    title: `Which slice of "${taskName}" would you hand to AI first?`,
    description: 'Keep it narrow: the part that creates the most rework, cleanup, or back-and-forth.',
    placeholder: 'Example: reconcile changes, draft the first pass, or prepare follow-up actions.',
    options: [],
    suggestions: [],
  } satisfies InterviewQuestionCard;
}

function normalizeOpenAiCard(card: z.infer<typeof openAiQuestionCardSchema> | null): InterviewQuestionCard | null {
  if (!card) return null;
  return interviewTurnResponseSchema.shape.card.unwrap().parse({
    ...card,
    description: card.description ?? undefined,
    placeholder: card.placeholder ?? undefined,
    min: card.min ?? undefined,
    max: card.max ?? undefined,
    step: card.step ?? undefined,
    maxSelections: card.maxSelections ?? undefined,
    options: card.options.map((option) => ({
      ...option,
      hint: option.hint ?? undefined,
    })),
  });
}

function normalizeOpenAiExtracted(extracted: z.infer<typeof openAiExtractedPatchSchema>) {
  return {
    ...(extracted.frictionSummary !== null ? { frictionSummary: extracted.frictionSummary } : {}),
    ...(extracted.aiToolUsage !== null ? { aiToolUsage: extracted.aiToolUsage } : {}),
    ...(extracted.aspirationalFocus !== null ? { aspirationalFocus: extracted.aspirationalFocus } : {}),
    ...(extracted.selectedTasks !== null ? { selectedTasks: extracted.selectedTasks } : {}),
    ...(extracted.notes !== null ? { notes: extracted.notes } : {}),
    ...(extracted.currentTaskIndex !== null ? { currentTaskIndex: extracted.currentTaskIndex } : {}),
    ...(extracted.taskDetails !== null
      ? {
          taskDetails: extracted.taskDetails.map((task) =>
            taskDetailSchema.parse({
              ...task,
              painLevel:
                task.painLevel === null ? undefined : Math.max(1, Math.min(5, Math.round(task.painLevel))),
              estimatedHoursPerWeek: task.estimatedHoursPerWeek ?? undefined,
            }),
          ),
        }
      : {}),
    ...(extracted.teamPatternsAcknowledged !== null
      ? { teamPatternsAcknowledged: extracted.teamPatternsAcknowledged }
      : {}),
  };
}

function normalizeOpenAiTurn(turn: z.infer<typeof openAiInterviewTurnSchema>): InterviewTurnResponse {
  return interviewTurnResponseSchema.parse({
    ...turn,
    card: normalizeOpenAiCard(turn.card),
    extracted: normalizeOpenAiExtracted(turn.extracted),
  });
}

function normalizeText(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(
          (token) =>
            token.length > 2 &&
            ![
              'what',
              'which',
              'that',
              'this',
              'with',
              'from',
              'your',
              'most',
              'main',
              'usually',
              'where',
              'when',
              'does',
              'into',
              'them',
              'they',
              'have',
              'about',
            ].includes(token),
        ),
    ),
  );
}

function detectQuestionIntent(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes('tool')) return 'tools';
  if (lower.includes('who else') || lower.includes('collaborator') || lower.includes('handoff')) return 'collaborators';
  if (lower.includes('pain') || lower.includes('score') || lower.includes('drain')) return 'pain';
  if (lower.includes('what changes') || lower.includes('changes most')) return 'variation';
  if (lower.includes('source') || lower.includes('pull from first') || lower.includes('start from')) return 'source';
  if (lower.includes('trigger') || lower.includes('starts this workflow') || lower.includes('kick off')) return 'trigger';
  if (lower.includes('output') || lower.includes('final artifact')) return 'output';
  if (lower.includes('hardest part') || lower.includes('slows down') || lower.includes('bottleneck')) return 'bottleneck';
  if (lower.includes('hand to ai') || lower.includes('own first')) return 'automation_slice';
  return 'general';
}

function similarityScore(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0;
  const overlap = left.filter((token) => right.includes(token)).length;
  return overlap / Math.max(left.length, right.length);
}

function isLoopingQuestion(card: InterviewQuestionCard | null, recentMessages: StoredMessage[]) {
  if (!card) return false;
  const candidateText = `${card.title} ${card.description || ''}`;
  const candidate = normalizeText(candidateText);
  if (candidate.length === 0) return false;

  return recentMessages
    .filter((message) => message.role === 'assistant')
    .slice(-2)
    .some((message) => {
      const prior = normalizeText(message.content);
      if (prior.length === 0) return false;
      const score = similarityScore(candidate, prior);
      const sameIntent = detectQuestionIntent(candidateText) === detectQuestionIntent(message.content);
      return score >= 0.78 || (sameIntent && score >= 0.62);
    });
}

function buildLoopBreakerTurn(state: WorkflowAuditState): InterviewTurnResponse {
  const activeTask = state.taskDetails[state.currentTaskIndex];
  const activeTaskName = activeTask?.name || state.selectedTasks[state.currentTaskIndex] || 'this workflow';

  if (activeTask?.summary && !activeTask?.automationWish) {
    return {
      assistantMessage:
        'I have the workflow shape. Let’s make it more actionable by choosing the slice you would want AI to take first.',
      card: buildAutomationWishCard(activeTaskName),
      extracted: {},
      progress: Math.min(90, state.progress + 6),
      stageLabel: state.stageLabel,
      isComplete: false,
    };
  }

  if (!activeTask?.tools?.length) {
    return {
      assistantMessage: 'I have enough context on the friction. Which tools are actually in the loop here?',
      card: buildToolSelectionCard(state),
      extracted: {},
      progress: Math.min(91, state.progress + 6),
      stageLabel: state.stageLabel,
      isComplete: false,
    };
  }

  if (!activeTask?.collaborators?.length) {
    return {
      assistantMessage: 'One more concrete detail: who tends to create handoffs or approvals in this workflow?',
      card: buildCollaboratorCard(state),
      extracted: {},
      progress: Math.min(93, state.progress + 6),
      stageLabel: state.stageLabel,
      isComplete: false,
    };
  }

  if (!activeTask?.painLevel) {
    return {
      assistantMessage: 'I have the shape of the work. Give me a quick pain score so I can rank it correctly.',
      card: nextTaskPainCard(activeTaskName, state.currentTaskIndex),
      extracted: {},
      progress: Math.min(95, state.progress + 5),
      stageLabel: state.stageLabel,
      isComplete: false,
    };
  }

  if (state.currentTaskIndex < state.selectedTasks.length - 1) {
    const nextIndex = state.currentTaskIndex + 1;
    const nextTaskName = state.selectedTasks[nextIndex];
    return {
      assistantMessage: `I have enough on "${activeTaskName}". Let’s move to "${nextTaskName}" next.`,
      card: nextTaskDetailCard(nextTaskName, { ...state, currentTaskIndex: nextIndex }),
      extracted: { currentTaskIndex: nextIndex },
      progress: Math.min(97, state.progress + 5),
      stageLabel: state.stageLabel,
      isComplete: false,
    };
  }

  return {
    assistantMessage: 'I have enough detail now. One last question so I can tailor the output to where you want time back.',
    card: {
      id: 'aspirational-focus',
      kind: 'text',
      title: 'If AI gave you 10 hours back, where would you want to spend that time?',
      description: 'This helps make the recommendation feel useful, not generic.',
      placeholder: 'More strategy, more customer time, fewer rewrites...',
      options: [],
      suggestions: [],
    },
    extracted: {},
    progress: 98,
    stageLabel: 'Wrapping up',
    isComplete: false,
  };
}

function buildMockInterviewTurn(
  state: WorkflowAuditState,
  answer: string | number | string[],
  priorPatterns: TeamPattern[],
): InterviewTurnResponse {
  const cardId = state.currentCard?.id || 'unknown';
  const nextState = structuredClone(state);
  const currentTask = nextState.taskDetails[nextState.currentTaskIndex];

  if (cardId === 'intro-friction') {
    nextState.frictionSummary = String(answer);
    nextState.currentCard = buildTaskSelectionCard(nextState, priorPatterns);
    nextState.stageLabel = 'Mapping tasks';
    nextState.progress = 16;
    return {
      assistantMessage:
        priorPatterns.length > 0
          ? `That lines up with what we're hearing from ${state.profile.team}. Let’s lock in the workflows that matter most for this audit.`
          : 'Good starting point. Let’s lock in the workflows that matter most for this audit.',
      card: nextState.currentCard,
      extracted: { frictionSummary: nextState.frictionSummary },
      progress: nextState.progress,
      stageLabel: nextState.stageLabel,
      isComplete: false,
    };
  }

  if (cardId === 'task-selection') {
    const selectedTasks =
      Array.isArray(answer) && answer.length > 0
        ? answer
        : getRoleTemplate(state.profile.roleTitle).tasks.slice(0, 3);
    nextState.selectedTasks = selectedTasks;
    nextState.teamPatternsAcknowledged = priorPatterns.flatMap((pattern) => pattern.recurringTasks);
    nextState.currentTaskIndex = 0;
    nextState.taskDetails = selectedTasks.map((taskName, index) =>
      taskDetailSchema.parse(
        nextState.taskDetails[index] || {
          name: taskName,
          summary: '',
          tools: [],
          collaborators: [],
          automationWish: '',
          category: estimateCategory(taskName),
        },
      ),
    );
    nextState.currentCard =
      selectedTasks.length > 1 ? buildPrimaryTaskCard(selectedTasks) : nextTaskDetailCard(selectedTasks[0], nextState);
    nextState.stageLabel = 'Choosing focus';
    nextState.progress = 28;
    return {
      assistantMessage:
        selectedTasks.length > 1
          ? 'Great. Pick the workflow you want to go deepest on first.'
          : `Great. We'll focus on "${selectedTasks[0]}" first.`,
      card: nextState.currentCard,
      extracted: {
        selectedTasks,
        taskDetails: nextState.taskDetails,
        teamPatternsAcknowledged: nextState.teamPatternsAcknowledged,
        currentTaskIndex: 0,
      },
      progress: nextState.progress,
      stageLabel: nextState.stageLabel,
      isComplete: false,
    };
  }

  if (cardId === 'primary-task') {
    const selectedTask = String(answer || nextState.selectedTasks[0] || '');
    const nextIndex = Math.max(0, nextState.selectedTasks.findIndex((task) => task === selectedTask));
    nextState.currentTaskIndex = nextIndex;
    nextState.currentCard = nextTaskDetailCard(nextState.selectedTasks[nextIndex], nextState);
    nextState.stageLabel = 'Understanding the workflow';
    nextState.progress = 38;
    return {
      assistantMessage: `Perfect. Walk me through "${nextState.selectedTasks[nextIndex]}" in a few sentences so I have the full shape before we narrow in.`,
      card: nextState.currentCard,
      extracted: {
        currentTaskIndex: nextIndex,
      },
      progress: nextState.progress,
      stageLabel: nextState.stageLabel,
      isComplete: false,
    };
  }

  if (cardId.startsWith('task-detail-')) {
    const taskName = nextState.selectedTasks[nextState.currentTaskIndex];
    const task = nextState.taskDetails[nextState.currentTaskIndex] || {
      name: taskName,
      summary: '',
      tools: [],
      collaborators: [],
      automationWish: '',
      category: estimateCategory(taskName),
    };

    task.summary = String(answer);
    task.tools = [...new Set([...task.tools, ...detectTools(String(answer))])];
    task.collaborators = [...new Set([...task.collaborators, ...detectCollaborators(String(answer))])];
    nextState.taskDetails[nextState.currentTaskIndex] = taskDetailSchema.parse(task);
    nextState.currentCard = buildSourceSelectionCard(task);
    nextState.stageLabel = 'Understanding the workflow';
    nextState.progress = 46;

    return {
      assistantMessage: `Helpful. What do you usually start from when "${taskName}" kicks off?`,
      card: nextState.currentCard,
      extracted: { taskDetails: nextState.taskDetails },
      progress: nextState.progress,
      stageLabel: nextState.stageLabel,
      isComplete: false,
    };
  }

  if (cardId === 'starting-source') {
    if (currentTask) {
      currentTask.summary = `${currentTask.summary}\nStarting source: ${String(answer)}.`;
      nextState.taskDetails[nextState.currentTaskIndex] = taskDetailSchema.parse(currentTask);
    }
    nextState.currentCard = buildOutputCard(nextState.selectedTasks[nextState.currentTaskIndex]);
    nextState.progress = 54;
    return {
      assistantMessage: 'What does this workflow usually need to produce by the end?',
      card: nextState.currentCard,
      extracted: { taskDetails: nextState.taskDetails },
      progress: nextState.progress,
      stageLabel: 'Understanding the workflow',
      isComplete: false,
    };
  }

  if (cardId === 'main-output') {
    if (currentTask) {
      currentTask.summary = `${currentTask.summary}\nMain output: ${String(answer)}.`;
      nextState.taskDetails[nextState.currentTaskIndex] = taskDetailSchema.parse(currentTask);
    }
    nextState.currentCard = buildReworkCard(currentTask || { tools: [], collaborators: [] });
    nextState.progress = 62;
    return {
      assistantMessage: 'Where does the cleanup or rework usually start?',
      card: nextState.currentCard,
      extracted: { taskDetails: nextState.taskDetails },
      progress: nextState.progress,
      stageLabel: 'Pinpointing friction',
      isComplete: false,
    };
  }

  if (cardId === 'rework-source') {
    if (currentTask) {
      currentTask.summary = `${currentTask.summary}\nBiggest source of rework: ${String(answer)}.`;
      nextState.taskDetails[nextState.currentTaskIndex] = taskDetailSchema.parse(currentTask);
    }
    nextState.currentCard = buildToolSelectionCard(nextState);
    nextState.progress = 70;
    return {
      assistantMessage: 'Which tools are actually in the loop when this workflow happens?',
      card: nextState.currentCard,
      extracted: { taskDetails: nextState.taskDetails },
      progress: nextState.progress,
      stageLabel: 'Pinpointing friction',
      isComplete: false,
    };
  }

  if (cardId === 'task-tools') {
    if (currentTask) {
      currentTask.tools = Array.isArray(answer) ? answer : [String(answer)];
      nextState.taskDetails[nextState.currentTaskIndex] = taskDetailSchema.parse(currentTask);
    }
    nextState.currentCard = buildCollaboratorCard(nextState);
    nextState.progress = 78;
    return {
      assistantMessage: 'Who else usually creates handoffs, approvals, or follow-up work in this process?',
      card: nextState.currentCard,
      extracted: { taskDetails: nextState.taskDetails },
      progress: nextState.progress,
      stageLabel: 'Mapping handoffs',
      isComplete: false,
    };
  }

  if (cardId === 'task-collaborators') {
    if (currentTask) {
      currentTask.collaborators = Array.isArray(answer) ? answer : [String(answer)];
      nextState.taskDetails[nextState.currentTaskIndex] = taskDetailSchema.parse(currentTask);
    }
    nextState.currentCard = nextTaskPainCard(nextState.selectedTasks[nextState.currentTaskIndex], nextState.currentTaskIndex);
    nextState.progress = 86;
    return {
      assistantMessage: 'Now give me a quick pain score so I can rank this correctly.',
      card: nextState.currentCard,
      extracted: { taskDetails: nextState.taskDetails },
      progress: nextState.progress,
      stageLabel: 'Ranking impact',
      isComplete: false,
    };
  }

  if (cardId.startsWith('task-pain-')) {
    const task = nextState.taskDetails[nextState.currentTaskIndex];
    if (task) {
      const pain = Math.max(1, Math.min(5, Math.round(Number(answer) || 3)));
      task.painLevel = pain;
      task.estimatedHoursPerWeek = Math.max(1, pain + 1);
      nextState.taskDetails[nextState.currentTaskIndex] = taskDetailSchema.parse(task);
    }
    nextState.currentCard = buildAutomationWishCard(nextState.selectedTasks[nextState.currentTaskIndex]);
    nextState.progress = 92;
    return {
      assistantMessage: 'If you could hand one slice of this workflow to AI first, which slice would you choose?',
      card: nextState.currentCard,
      extracted: { taskDetails: nextState.taskDetails },
      progress: nextState.progress,
      stageLabel: 'Shaping the recommendation',
      isComplete: false,
    };
  }

  if (cardId === 'workflow-automation-wish') {
    if (currentTask) {
      currentTask.automationWish = String(answer);
      nextState.taskDetails[nextState.currentTaskIndex] = taskDetailSchema.parse(currentTask);
    }
    nextState.currentCard = {
      id: 'aspirational-focus',
      kind: 'text',
      title: 'If this workflow got easier, where would you want the time back?',
      description: 'Keep it short. This helps tailor the final recommendation to the payoff you care about.',
      placeholder: 'More strategy, more customer time, faster decisions, fewer status updates...',
      options: [],
      suggestions: [],
    };
    nextState.stageLabel = 'Wrapping up';
    nextState.progress = 97;

    return {
      assistantMessage: 'Last question. If this workflow got easier, where would you want that time back?',
      card: nextState.currentCard,
      extracted: { taskDetails: nextState.taskDetails },
      progress: nextState.progress,
      stageLabel: nextState.stageLabel,
      isComplete: false,
    };
  }

  if (cardId === 'aspirational-focus') {
    nextState.aspirationalFocus = String(answer);
    nextState.currentCard = null;
    nextState.stageLabel = 'Interview complete';
    nextState.progress = 100;
    nextState.isComplete = true;
    return {
      assistantMessage:
        'Perfect. I have what I need to rank the opportunities and build your starter setup.',
      card: null,
      extracted: { aspirationalFocus: nextState.aspirationalFocus },
      progress: nextState.progress,
      stageLabel: nextState.stageLabel,
      isComplete: true,
    };
  }

  return {
    assistantMessage: 'Let’s keep going.',
    card: null,
    extracted: {},
    progress: nextState.progress,
    stageLabel: nextState.stageLabel,
    isComplete: nextState.isComplete,
  };
}

function mergeInterviewEnhancement(
  state: WorkflowAuditState,
  baseline: InterviewTurnResponse,
  enhancement: z.infer<typeof openAiInterviewEnhancementSchema>,
) {
  const cardId = state.currentCard?.id || '';
  const extracted = { ...baseline.extracted };
  let card = baseline.card;

  if (cardId === 'intro-friction' && enhancement.frictionSummary) {
    extracted.frictionSummary = enhancement.frictionSummary;
  }

  if (cardId === 'intro-friction' && card?.id === 'task-selection') {
    const templateTasks = getRoleTemplate(state.profile.roleTitle).tasks;
    const priorTasks = state.teamPatternsAcknowledged;
    const liveTasks = enhancement.inferredTasks.filter(Boolean);
    const seededTasks = [...new Set([...liveTasks, ...priorTasks, ...templateTasks])].slice(0, 6);

    if (seededTasks.length > 0) {
      card = {
        ...card,
        title: 'Which parts of this workflow should we include in the audit?',
        description: 'Pick the workflows or sub-workflows that matter most here. You can choose more than one.',
        options: seededTasks.map((task) => ({
          id: task,
          label: task,
          hint: liveTasks.includes(task) ? 'Pulled from your answer' : undefined,
        })),
        suggestions: seededTasks,
      };
    }
  }

  if (cardId.startsWith('task-detail-') || cardId === 'workflow-automation-wish') {
    const taskDetails = baseline.extracted.taskDetails ? [...baseline.extracted.taskDetails] : [...state.taskDetails];
    const taskIndex = state.currentTaskIndex;
    const currentTask = taskDetails[taskIndex];

    if (currentTask) {
      if (enhancement.workflowSummary && cardId.startsWith('task-detail-')) {
        currentTask.summary = enhancement.workflowSummary;
      }
      if (enhancement.automationWish && cardId === 'workflow-automation-wish') {
        currentTask.automationWish = enhancement.automationWish;
      }
      currentTask.tools = [...new Set([...(currentTask.tools || []), ...enhancement.inferredTools])];
      currentTask.collaborators = [
        ...new Set([...(currentTask.collaborators || []), ...enhancement.inferredCollaborators]),
      ];
      taskDetails[taskIndex] = taskDetailSchema.parse(currentTask);
      extracted.taskDetails = taskDetails;
    }
  }

  return interviewTurnResponseSchema.parse({
    ...baseline,
    card,
    assistantMessage: enhancement.assistantMessage || baseline.assistantMessage,
    extracted,
  });
}

function chooseRecommendedSurface(task: WorkflowAuditState['taskDetails'][number]) {
  const summary = `${task.name} ${task.summary} ${task.automationWish}`.toLowerCase();
  const recurring = /(daily|weekly|monthly|every|monday|friday|forecast|report|reporting|review)/.test(summary);
  const consistentOutput = /(deck|brief|summary|update|email|draft|packet|report|notes|follow up|follow-up)/.test(summary);
  const crossFunctional = task.collaborators.length >= 2 || /(finance|leadership|stakeholder|approval|handoff)/.test(summary);

  if (recurring && consistentOutput) {
    return {
      surface: 'scheduled_task' as PromptSurface,
      model: 'gpt-5.4-mini',
      rationale: 'This work repeats on a cadence and produces a stable output, so it is a strong fit for a scheduled run.',
      checklist: [
        'Create a recurring task on the day this workflow usually starts.',
        'Attach the export, notes, or links the run should use each time.',
        'Have it draft the first version, then review before sending or publishing.',
      ],
    };
  }

  if (crossFunctional) {
    return {
      surface: 'chatgpt_project' as PromptSurface,
      model: 'gpt-5.4',
      rationale: 'This workflow pulls in messy context from multiple people and tools, so a project is the best place to keep files, instructions, and iteration together.',
      checklist: [
        'Create a project for this workflow and pin the core files inside it.',
        'Set this prompt as a project instruction so each run starts from the same playbook.',
        'Keep one thread per cycle or decision moment so the context stays clean.',
      ],
    };
  }

  if (consistentOutput) {
    return {
      surface: 'custom_gpt' as PromptSurface,
      model: 'gpt-5.4-mini',
      rationale: 'The workflow has a repeatable transformation pattern, which makes it a good fit for a reusable custom GPT.',
      checklist: [
        'Turn this prompt into a custom GPT with the output format locked in.',
        'Add one or two strong example inputs and outputs for consistency.',
        'Use conversation starters for the most common workflow variants.',
      ],
    };
  }

  return {
    surface: 'single_prompt' as PromptSurface,
    model: 'gpt-5.4',
    rationale: 'This work looks more ad hoc and judgment-heavy, so starting with a strong reusable prompt is the fastest path.',
    checklist: [
      'Save this prompt in a reusable snippet or project note.',
      'Paste the freshest source context each time you run it.',
      'Refine the prompt after two or three real uses before automating further.',
    ],
  };
}

function formatSurfaceLabel(surface: PromptSurface) {
  switch (surface) {
    case 'chatgpt_project':
      return 'ChatGPT Project';
    case 'custom_gpt':
      return 'Custom GPT';
    case 'scheduled_task':
      return 'Scheduled task';
    case 'single_prompt':
    default:
      return 'Single prompt';
  }
}

function buildPromptInstructions(state: WorkflowAuditState, task: WorkflowAuditState['taskDetails'][number]) {
  const collaborators = task.collaborators.length > 0 ? task.collaborators.join(', ') : 'the relevant stakeholders';
  const tools = task.tools.length > 0 ? task.tools.join(', ') : 'the current workflow tools';
  const timeBackGoal = state.aspirationalFocus || 'higher-value work';

  return [
    `You are my workflow copilot for ${task.name}.`,
    '',
    'Context',
    `- Role: ${state.profile.roleTitle}`,
    `- Team: ${state.profile.team}`,
    `- Core friction: ${state.frictionSummary || task.summary}`,
    `- Current workflow: ${task.summary}`,
    `- Tools involved: ${tools}`,
    `- Collaborators or handoffs: ${collaborators}`,
    `- Success looks like: save time for ${timeBackGoal}`,
    '',
    'What to do when I give you notes, exports, or rough context',
    '1. Summarize what changed and what matters most.',
    '2. Identify missing information, blockers, or risky assumptions.',
    '3. Draft the exact artifact I need next in a format I can use immediately.',
    `4. Call out follow-ups or decisions that still need to go back to ${collaborators}.`,
    '',
    'Output format',
    '- Snapshot of what matters now',
    '- Key changes or risks',
    '- Drafted artifact or next-step output',
    '- Follow-ups and open questions',
    '',
    'Style',
    '- Be concise, practical, and specific.',
    '- Optimize for saving time this week, not writing a perfect memo.',
    '- Keep judgment calls visible instead of pretending uncertain inputs are settled.',
  ].join('\n');
}

function getRecentAssistantIntents(recentMessages: StoredMessage[]) {
  return Array.from(
    new Set(
      recentMessages
        .filter((message) => message.role === 'assistant')
        .slice(-4)
        .map((message) => detectQuestionIntent(message.content)),
    ),
  );
}

async function repairRepeatedInterviewTurn(
  client: OpenAI,
  state: WorkflowAuditState,
  answer: string | number | string[],
  priorPatterns: TeamPattern[],
  recentMessages: StoredMessage[],
  repeatedTurn: z.infer<typeof openAiInterviewTurnSchema>,
) {
  const { interviewModel } = getServerEnv();
  const repeatedIntent = repeatedTurn.card ? detectQuestionIntent(`${repeatedTurn.card.title} ${repeatedTurn.card.description || ''}`) : 'general';
  const bannedIntents = Array.from(new Set([...getRecentAssistantIntents(recentMessages), repeatedIntent]));

  const completion = await client.beta.chat.completions.parse({
    model: interviewModel,
    response_format: zodResponseFormat(openAiInterviewTurnSchema, 'workflow_audit_turn_repair'),
    messages: [
      {
        role: 'system',
        content: [
          buildInterviewSystemPrompt(
            state,
            priorPatterns,
            Array.isArray(answer) ? answer.join(', ') : String(answer),
            recentMessages,
          ),
          `The previous proposed question repeated one of these dimensions: ${bannedIntents.join(', ')}.`,
          'Return a different next step that advances the interview.',
          'Do not ask about any banned dimension again unless the user explicitly contradicts earlier information.',
          'Prefer asking for a different missing dimension, moving to the next workflow, or asking what part they would hand to AI first.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Answer payload: ${JSON.stringify(answer)}`,
      },
    ],
  });

  return openAiInterviewTurnSchema.parse(completion.choices[0]?.message.parsed);
}

function buildMockResult(state: WorkflowAuditState, runId: string, priorPatterns: TeamPattern[]) {
  const fallbackTask = {
    name: 'Weekly workflow coordination',
    summary: state.frictionSummary || 'Manual coordination and status gathering are slowing the week down.',
    tools: ['ChatGPT', 'Docs', 'Slack'],
    collaborators: ['Team stakeholders'],
    painLevel: 3,
    automationWish: 'Reduce manual workflow coordination.',
    estimatedHoursPerWeek: 3,
    category: 'workflow',
  };
  const topOpportunities = state.taskDetails
    .map((task) => ({
      title: task.automationWish || `Automate ${task.name.toLowerCase()}`,
      type: task.category === 'reporting' ? 'report-generation' : 'workflow-automation',
      affectedTeams: [state.profile.team, ...task.collaborators.slice(0, 2)],
      estimatedHoursSaved: Math.max(4, Math.round((task.painLevel || 3) * 3 + (task.estimatedHoursPerWeek || 0))),
      confidence: Math.min(0.95, 0.55 + (task.painLevel || 3) * 0.08),
      promptReady: true,
      rationale:
        task.summary
          ? `${task.summary} This is specific enough to turn into a repeatable AI-assisted workflow.`
          : `${task.name} is repetitive enough that a structured prompt or agent can reduce the cleanup work.`,
      category: task.category || 'workflow',
    }))
    .sort((a, b) => b.estimatedHoursSaved - a.estimatedHoursSaved)
    .slice(0, 5);

  const topTask = topOpportunities[0]
    ? state.taskDetails.find((task) => (task.automationWish || `Automate ${task.name.toLowerCase()}`) === topOpportunities[0]?.title) ||
      state.taskDetails[0] ||
      fallbackTask
    : state.taskDetails[0] || fallbackTask;
  const setup = chooseRecommendedSurface(topTask);
  const heroPrompt = {
    title: `${topTask.name} Workflow Prompt`,
    suggestedModel: setup.model,
    recommendedSurface: setup.surface,
    surfaceRationale: setup.rationale,
    setupChecklist: setup.checklist,
    instructions: buildPromptInstructions(state, topTask),
    notes: [
      `Best setup: ${formatSurfaceLabel(setup.surface)}.`,
      `Use this against ${topTask.tools.slice(0, 3).join(', ') || 'your current workflow tools'}.`,
      `Aim to reclaim time for: ${state.aspirationalFocus || 'higher-value work'}.`,
    ],
  } satisfies WorkflowAuditResult['heroPrompt'];
  const workflowConnections = topTask.collaborators.map((collaborator) =>
    workflowConnectionSchema.parse({
      sourceTask: topTask.name,
      targetTeam: collaborator,
      targetLabel: collaborator,
      connectionType: 'shared-pain',
      description: `${topTask.name} depends on coordination with ${collaborator}.`,
    }),
  );

  return workflowAuditResultSchema.parse({
    runId,
    completedAt: new Date().toISOString(),
    topOpportunities,
    heroPrompt,
    roleImpact: buildRoleImpact(state, {
      heroPrompt,
      topOpportunities,
      nextStep: `Start with ${topTask.name.toLowerCase()} as a ${formatSurfaceLabel(setup.surface).toLowerCase()}.`,
    }),
    humanStrengths: [
      'The call on tone, stakeholder tradeoffs, and escalation still belongs with you.',
      'AI should remove grunt work, not replace the judgment layer of the workflow.',
    ],
    nextStep: `Start with ${topTask.name.toLowerCase()} as a ${formatSurfaceLabel(setup.surface).toLowerCase()}. It has the strongest combination of pain, repeatability, and readiness in your audit.`,
    workflowConnections,
    teamPatterns: priorPatterns,
  });
}

export async function runInterviewAgent(
  state: WorkflowAuditState,
  answer: string | number | string[],
  priorPatterns: TeamPattern[],
  recentMessages: StoredMessage[],
) {
  const baseline = buildMockInterviewTurn(state, answer, priorPatterns);
  const client = requireLiveClient(state);
  if (!client) {
    return baseline;
  }

  const { interviewModel } = getServerEnv();
  const answerText = Array.isArray(answer) ? answer.join(', ') : String(answer);
  const completion = await client.beta.chat.completions.parse({
    model: interviewModel,
    response_format: zodResponseFormat(openAiInterviewEnhancementSchema, 'workflow_audit_turn_enhancement'),
    messages: [
      {
        role: 'system',
        content: [
          'You are helping a workflow audit agent run a fixed interview sequence.',
          'Do not choose the next step. The next card is already decided.',
          'Rewrite the baseline assistant message so it sounds natural and connected to the user answer.',
          'Extract any useful workflow details from the answer.',
          'Infer 2-5 likely workflow names or workflow slices from the answer. Keep them short and specific.',
          'If a field is unclear, return null for strings and [] for arrays.',
          `Current card id: ${state.currentCard?.id || 'unknown'}`,
          `Current workflow focus: ${state.selectedTasks[state.currentTaskIndex] || 'not selected yet'}`,
          `Recent transcript: ${JSON.stringify(
            recentMessages.slice(-6).map((message) => ({
              role: message.role,
              content: message.content,
            })),
          )}`,
          `Baseline next message: ${baseline.assistantMessage}`,
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Answer payload: ${JSON.stringify(answer)}\nAnswer as text: ${answerText}`,
      },
    ],
  });

  const enhancement = openAiInterviewEnhancementSchema.parse(completion.choices[0]?.message.parsed);
  return mergeInterviewEnhancement(state, baseline, enhancement);
}

export async function runWorkflowSpecialist(state: WorkflowAuditState) {
  const client = requireLiveClient(state);
  if (!client) {
    return workflowSpecialistOutputSchema.parse({
      extracted: {
        taskDetails: state.taskDetails,
      },
      opportunities: buildMockResult(state, randomUUID(), []).topOpportunities,
      connections: state.taskDetails.flatMap((task) =>
        task.collaborators.map((collaborator) => ({
          sourceTask: task.name,
          targetTeam: collaborator,
          targetLabel: collaborator,
          connectionType: 'shared-pain',
          description: `${task.name} depends on coordination with ${collaborator}.`,
        })),
      ),
    });
  }

  const { specialistModel } = getServerEnv();
  try {
    const completion = await client.beta.chat.completions.parse({
      model: specialistModel,
      response_format: zodResponseFormat(openAiWorkflowSpecialistOutputSchema, 'workflow_audit_specialist'),
      messages: [
        { role: 'system', content: buildSpecialistPrompt(state) },
        { role: 'user', content: 'Normalize the workflow data into ranked opportunities.' },
      ],
    });

    const parsed = openAiWorkflowSpecialistOutputSchema.parse(completion.choices[0]?.message.parsed);
    return workflowSpecialistOutputSchema.parse({
      extracted: normalizeOpenAiExtracted(parsed.extracted),
      opportunities: parsed.opportunities,
      connections: parsed.connections,
    });
  } catch {
    return workflowSpecialistOutputSchema.parse({
      extracted: {
        taskDetails: state.taskDetails,
      },
      opportunities: buildMockResult(state, randomUUID(), []).topOpportunities,
      connections: state.taskDetails.flatMap((task) =>
        task.collaborators.map((collaborator) => ({
          sourceTask: task.name,
          targetTeam: collaborator,
          targetLabel: collaborator,
          connectionType: 'shared-pain',
          description: `${task.name} depends on coordination with ${collaborator}.`,
        })),
      ),
    });
  }
}

export async function runRecommendationAgent(
  state: WorkflowAuditState,
  specialistOutput: unknown,
  orgIntelligence: OrgIntelligence | null,
  runId: string,
  priorPatterns: TeamPattern[],
): Promise<WorkflowAuditResult> {
  const client = requireLiveClient(state);
  if (!client) {
    return buildMockResult(state, runId, priorPatterns);
  }

  const { recommendationModel } = getServerEnv();
  try {
    const completion = await client.beta.chat.completions.parse({
      model: recommendationModel,
      response_format: zodResponseFormat(openAiWorkflowResultSchema, 'workflow_audit_result'),
      messages: [
        { role: 'system', content: buildRecommendationPrompt(state, specialistOutput, orgIntelligence) },
        { role: 'user', content: `Return the final result for run ${runId}.` },
      ],
    });

    const parsed = openAiWorkflowResultSchema.parse(completion.choices[0]?.message.parsed);
    return workflowAuditResultSchema.parse({
      completedAt: new Date().toISOString(),
      teamPatterns: priorPatterns,
      roleImpact: roleImpactSchema.parse(parsed.roleImpact),
      ...parsed,
      runId,
    });
  } catch {
    return buildMockResult(state, runId, priorPatterns);
  }
}

export function buildInitialState(
  profile: WorkflowAuditState['profile'],
  priorPatterns: TeamPattern[],
  interviewBrief: WorkflowAuditState['interviewBrief'],
  orgSignals: WorkflowAuditState['orgSignals'],
  modelConfidence: WorkflowAuditState['modelConfidence'],
  generationMode: WorkflowAuditState['generationMode'],
) {
  return {
    profile,
    generationMode,
    currentCard: {
      id: 'intro-friction',
      kind: 'text',
      title: 'What recurring workflow would you most want help with right now?',
      description:
        priorPatterns.length > 0
          ? `Start with the workflow you’d most want to make easier this week. In 3-4 sentences, include what kicks it off, where you pull from first, what you need to produce, and where it gets messy.`
          : `In 3-4 sentences, describe the workflow you’d most want to make easier this week: what kicks it off, where you pull from first, what you need to produce, and where it gets messy.`,
      placeholder: 'Describe one recurring workflow, what starts it, the main source you use, the output you need, and where the friction shows up.',
      options: [],
      suggestions: [],
    },
    selectedTasks: [],
    frictionSummary: '',
    aiToolUsage: '',
    aspirationalFocus: '',
    teamPatternsAcknowledged: priorPatterns.flatMap((pattern) => pattern.recurringTasks).slice(0, 3),
    notes: [buildInitialAssistantMessage(profile, priorPatterns, interviewBrief)],
    taskDetails: [],
    stageLabel: 'Getting started',
    currentTaskIndex: 0,
    progress: 8,
    isComplete: false,
    interviewBrief,
    orgSignals,
    modelConfidence,
  } satisfies WorkflowAuditState;
}
