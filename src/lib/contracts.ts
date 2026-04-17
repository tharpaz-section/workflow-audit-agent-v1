import { z } from 'zod';

export const questionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string().optional(),
});

export const questionVariantSchema = z.enum([
  'single_select',
  'multi_select',
  'chips',
  'text',
  'slider',
]);

export const interviewQuestionCardSchema = z.object({
  id: z.string(),
  kind: questionVariantSchema,
  title: z.string(),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  maxSelections: z.number().optional(),
  options: z.array(questionOptionSchema).default([]),
  suggestions: z.array(z.string()).default([]),
});

export const taskDetailSchema = z.object({
  name: z.string(),
  summary: z.string().default(''),
  tools: z.array(z.string()).default([]),
  collaborators: z.array(z.string()).default([]),
  painLevel: z.number().min(1).max(5).optional(),
  automationWish: z.string().default(''),
  estimatedHoursPerWeek: z.number().nonnegative().optional(),
  category: z.string().default('workflow'),
});

export const runProfileSchema = z.object({
  companyName: z.string().min(1),
  department: z.string().min(1),
  team: z.string().min(1),
  roleTitle: z.string().min(1),
});

export const generationModeSchema = z.enum(['mock', 'live']);

export const interviewBriefSchema = z.object({
  summary: z.string().default(''),
  likelyWorkflows: z.array(z.string()).default([]),
  priorityGaps: z.array(z.string()).default([]),
  probableConnections: z.array(z.string()).default([]),
  confidenceNotes: z.array(z.string()).default([]),
});

export const orgSignalsSchema = z.object({
  confirmedPatterns: z.array(z.string()).default([]),
  lightCoverageAreas: z.array(z.string()).default([]),
  oneSidedHandoffs: z.array(z.string()).default([]),
});

export const modelConfidenceSchema = z.object({
  overall: z.number().min(0).max(1).default(0.5),
  label: z.string().default('Building'),
  notes: z.array(z.string()).default([]),
});

export const interviewStateSchema = z.object({
  profile: runProfileSchema,
  generationMode: generationModeSchema.default('mock'),
  currentCard: interviewQuestionCardSchema.nullable(),
  selectedTasks: z.array(z.string()).default([]),
  frictionSummary: z.string().default(''),
  aiToolUsage: z.string().default(''),
  aspirationalFocus: z.string().default(''),
  teamPatternsAcknowledged: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  taskDetails: z.array(taskDetailSchema).default([]),
  stageLabel: z.string().default('Getting started'),
  currentTaskIndex: z.number().min(0).default(0),
  progress: z.number().min(0).max(100).default(0),
  isComplete: z.boolean().default(false),
  interviewBrief: interviewBriefSchema.default({}),
  orgSignals: orgSignalsSchema.default({}),
  modelConfidence: modelConfidenceSchema.default({}),
});

export const extractedPatchSchema = z.object({
  frictionSummary: z.string().optional(),
  aiToolUsage: z.string().optional(),
  aspirationalFocus: z.string().optional(),
  selectedTasks: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
  currentTaskIndex: z.number().optional(),
  taskDetails: z.array(taskDetailSchema).optional(),
  teamPatternsAcknowledged: z.array(z.string()).optional(),
});

export const interviewTurnResponseSchema = z.object({
  assistantMessage: z.string(),
  card: interviewQuestionCardSchema.nullable(),
  extracted: extractedPatchSchema.default({}),
  progress: z.number().min(0).max(100),
  stageLabel: z.string(),
  isComplete: z.boolean(),
});

export const workflowOpportunitySchema = z.object({
  title: z.string(),
  type: z.string(),
  affectedTeams: z.array(z.string()),
  estimatedHoursSaved: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  promptReady: z.boolean(),
  rationale: z.string(),
  category: z.string().default('workflow'),
});

export const promptSurfaceSchema = z.enum([
  'single_prompt',
  'chatgpt_project',
  'custom_gpt',
  'scheduled_task',
]);

export const promptArtifactSchema = z.object({
  title: z.string(),
  instructions: z.string(),
  suggestedModel: z.string(),
  recommendedSurface: promptSurfaceSchema.default('single_prompt'),
  surfaceRationale: z.string().default(''),
  setupChecklist: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});

export const workflowConnectionSchema = z.object({
  sourceTask: z.string(),
  targetTeam: z.string(),
  targetLabel: z.string(),
  connectionType: z.string(),
  description: z.string(),
});

export const teamPatternSchema = z.object({
  team: z.string(),
  summary: z.string(),
  recurringTasks: z.array(z.string()).default([]),
  commonTools: z.array(z.string()).default([]),
  commonPainPoints: z.array(z.string()).default([]),
  respondentCount: z.number().default(0),
});

export const roleImpactSchema = z.object({
  summary: z.string(),
  personalOpportunities: z.array(z.string()).default([]),
  skillsToBuild: z.array(z.string()).default([]),
  message: z.string(),
});

export const coverageTeamSchema = z.object({
  team: z.string(),
  respondentCount: z.number().nonnegative(),
  roles: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  status: z.enum(['light', 'building', 'strong']),
});

export const coverageSummarySchema = z.object({
  totalRespondents: z.number().nonnegative(),
  teams: z.array(coverageTeamSchema).default([]),
  lightCoverageTeams: z.array(z.string()).default([]),
});

export const criticalGapSchema = z.object({
  title: z.string(),
  detail: z.string(),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const contradictionSchema = z.object({
  title: z.string(),
  detail: z.string(),
  teams: z.array(z.string()).default([]),
});

export const modelHealthSchema = z.object({
  overallConfidence: z.number().min(0).max(1),
  summary: z.string(),
  notes: z.array(z.string()).default([]),
});

export const orgIntelligenceSchema = z.object({
  companyName: z.string(),
  generatedAt: z.string(),
  summary: z.string(),
  likelyWorkflows: z.array(z.string()).default([]),
  probableConnections: z.array(z.string()).default([]),
  coverage: coverageSummarySchema,
  criticalGaps: z.array(criticalGapSchema).default([]),
  unilateralConnections: z.array(workflowConnectionSchema).default([]),
  contradictions: z.array(contradictionSchema).default([]),
  modelHealth: modelHealthSchema,
});

export const workflowAuditResultSchema = z.object({
  runId: z.string(),
  completedAt: z.string(),
  topOpportunities: z.array(workflowOpportunitySchema),
  heroPrompt: promptArtifactSchema,
  roleImpact: roleImpactSchema.default({
    summary: 'This workflow is a practical place to start for your role.',
    personalOpportunities: ['Use AI to reduce the first-draft and cleanup work.'],
    skillsToBuild: ['Prompt iteration', 'Workflow review'],
    message: 'Start narrow, keep the review layer with you, and expand once the workflow is stable.',
  }),
  humanStrengths: z.array(z.string()).default([]),
  nextStep: z.string(),
  workflowConnections: z.array(workflowConnectionSchema).default([]),
  teamPatterns: z.array(teamPatternSchema).default([]),
});

export const workflowSpecialistOutputSchema = z.object({
  extracted: extractedPatchSchema.default({}),
  opportunities: z.array(workflowOpportunitySchema).default([]),
  connections: z.array(workflowConnectionSchema).default([]),
});

export const adminHeatmapCellSchema = z.object({
  team: z.string(),
  category: z.string(),
  score: z.number().min(0).max(100),
  count: z.number().nonnegative(),
});

export const adminSummarySchema = z.object({
  completion: z.object({
    totalRuns: z.number().nonnegative(),
    completedRuns: z.number().nonnegative(),
    teamsCovered: z.number().nonnegative(),
  }),
  heatmap: z.array(adminHeatmapCellSchema).default([]),
  topOpportunities: z.array(workflowOpportunitySchema).default([]),
  connections: z.array(workflowConnectionSchema).default([]),
  teamPatterns: z.array(teamPatternSchema).default([]),
  coverage: coverageSummarySchema.default({
    totalRespondents: 0,
    teams: [],
    lightCoverageTeams: [],
  }),
  criticalGaps: z.array(criticalGapSchema).default([]),
  unilateralConnections: z.array(workflowConnectionSchema).default([]),
  contradictions: z.array(contradictionSchema).default([]),
  modelHealth: modelHealthSchema.default({
    overallConfidence: 0.32,
    summary: 'Signals are still building.',
    notes: [],
  }),
});

export const createRunRequestSchema = runProfileSchema.extend({
  focusArea: z.string().optional().default(''),
  generationMode: generationModeSchema.default('mock'),
});

export const createRunResponseSchema = z.object({
  runId: z.string(),
  initialState: interviewStateSchema,
  priorPatterns: z.array(teamPatternSchema),
});

export const runMessageSchema = z.object({
  id: z.string(),
  runId: z.string(),
  role: z.enum(['assistant', 'user', 'system']),
  cardKind: z.string().nullable().optional(),
  content: z.string(),
  payload: z.record(z.unknown()),
  createdAt: z.string(),
});

export const runViewSchema = z.object({
  run: z.object({
    id: z.string(),
    companyName: z.string(),
    department: z.string(),
    team: z.string(),
    roleTitle: z.string(),
    status: z.enum(['in_progress', 'interview_complete', 'processing', 'complete']),
    progress: z.number().min(0).max(100),
    state: interviewStateSchema,
    generationMode: generationModeSchema,
    priorPatterns: z.array(teamPatternSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
    completedAt: z.string().nullable().optional(),
  }),
  messages: z.array(runMessageSchema),
});

export const answerPayloadSchema = z.object({
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export type InterviewQuestionCard = z.infer<typeof interviewQuestionCardSchema>;
export type InterviewTurnResponse = z.infer<typeof interviewTurnResponseSchema>;
export type WorkflowAuditState = z.infer<typeof interviewStateSchema>;
export type WorkflowOpportunity = z.infer<typeof workflowOpportunitySchema>;
export type PromptArtifact = z.infer<typeof promptArtifactSchema>;
export type PromptSurface = z.infer<typeof promptSurfaceSchema>;
export type WorkflowConnection = z.infer<typeof workflowConnectionSchema>;
export type TeamPattern = z.infer<typeof teamPatternSchema>;
export type InterviewBrief = z.infer<typeof interviewBriefSchema>;
export type OrgSignals = z.infer<typeof orgSignalsSchema>;
export type ModelConfidence = z.infer<typeof modelConfidenceSchema>;
export type RoleImpact = z.infer<typeof roleImpactSchema>;
export type CoverageTeam = z.infer<typeof coverageTeamSchema>;
export type CoverageSummary = z.infer<typeof coverageSummarySchema>;
export type CriticalGap = z.infer<typeof criticalGapSchema>;
export type Contradiction = z.infer<typeof contradictionSchema>;
export type ModelHealth = z.infer<typeof modelHealthSchema>;
export type OrgIntelligence = z.infer<typeof orgIntelligenceSchema>;
export type WorkflowAuditResult = z.infer<typeof workflowAuditResultSchema>;
export type WorkflowSpecialistOutput = z.infer<typeof workflowSpecialistOutputSchema>;
export type AdminSummary = z.infer<typeof adminSummarySchema>;
export type RunProfile = z.infer<typeof runProfileSchema>;
export type RunView = z.infer<typeof runViewSchema>;
export type GenerationMode = z.infer<typeof generationModeSchema>;
