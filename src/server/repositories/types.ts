import type {
  GenerationMode,
  OrgIntelligence,
  TeamPattern,
  WorkflowAuditResult,
  WorkflowAuditState,
} from '@/lib/contracts';

export type StoredRun = {
  id: string;
  companyName: string;
  department: string;
  team: string;
  roleTitle: string;
  generationMode: GenerationMode;
  status: 'in_progress' | 'interview_complete' | 'processing' | 'complete';
  progress: number;
  state: WorkflowAuditState;
  priorPatterns: TeamPattern[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

export type StoredMessage = {
  id: string;
  runId: string;
  role: 'assistant' | 'user' | 'system';
  cardKind?: string | null;
  content: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type StoredTask = {
  id: string;
  runId: string;
  taskName: string;
  summary: string;
  tools: string[];
  collaborators: string[];
  painLevel?: number;
  estimatedHoursPerWeek?: number;
  category?: string;
};

export type StoredConnection = {
  id: string;
  runId: string;
  sourceTask: string;
  targetTeam: string;
  targetLabel: string;
  connectionType: string;
  description: string;
};

export interface WorkflowAuditRepository {
  createRun(run: StoredRun): Promise<void>;
  updateRun(runId: string, patch: Partial<StoredRun>): Promise<StoredRun>;
  getRun(runId: string): Promise<StoredRun | null>;
  listRuns(): Promise<StoredRun[]>;
  getOrgIntelligence(companyName: string): Promise<OrgIntelligence | null>;
  saveOrgIntelligence(companyName: string, intelligence: OrgIntelligence): Promise<void>;
  appendMessage(message: StoredMessage): Promise<void>;
  listMessages(runId: string): Promise<StoredMessage[]>;
  replaceTasks(runId: string, tasks: StoredTask[]): Promise<void>;
  listTasks(runId: string): Promise<StoredTask[]>;
  replaceConnections(runId: string, connections: StoredConnection[]): Promise<void>;
  listConnections(runId: string): Promise<StoredConnection[]>;
  saveResult(runId: string, result: WorkflowAuditResult): Promise<void>;
  getResult(runId: string): Promise<WorkflowAuditResult | null>;
  reset(): Promise<void>;
}
