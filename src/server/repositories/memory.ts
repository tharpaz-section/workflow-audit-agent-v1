import { randomUUID } from 'node:crypto';
import type { OrgIntelligence, WorkflowAuditResult } from '@/lib/contracts';
import type {
  StoredConnection,
  StoredMessage,
  StoredRun,
  StoredTask,
  WorkflowAuditRepository,
} from './types';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryWorkflowAuditRepository implements WorkflowAuditRepository {
  private runs = new Map<string, StoredRun>();
  private messages = new Map<string, StoredMessage[]>();
  private tasks = new Map<string, StoredTask[]>();
  private connections = new Map<string, StoredConnection[]>();
  private results = new Map<string, WorkflowAuditResult>();
  private orgIntelligence = new Map<string, OrgIntelligence>();

  async createRun(run: StoredRun) {
    this.runs.set(run.id, clone(run));
    this.messages.set(run.id, []);
    this.tasks.set(run.id, []);
    this.connections.set(run.id, []);
  }

  async updateRun(runId: string, patch: Partial<StoredRun>) {
    const existing = this.runs.get(runId);
    if (!existing) throw new Error(`Run ${runId} not found`);
    const next = clone({
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    this.runs.set(runId, next);
    return next;
  }

  async getRun(runId: string) {
    const run = this.runs.get(runId);
    return run ? clone(run) : null;
  }

  async listRuns() {
    return [...this.runs.values()].map(clone);
  }

  async getOrgIntelligence(companyName: string) {
    const intelligence = this.orgIntelligence.get(companyName.toLowerCase());
    return intelligence ? clone(intelligence) : null;
  }

  async saveOrgIntelligence(companyName: string, intelligence: OrgIntelligence) {
    this.orgIntelligence.set(companyName.toLowerCase(), clone(intelligence));
  }

  async appendMessage(message: StoredMessage) {
    const list = this.messages.get(message.runId) || [];
    list.push(clone(message));
    this.messages.set(message.runId, list);
  }

  async listMessages(runId: string) {
    return (this.messages.get(runId) || []).map(clone);
  }

  async replaceTasks(runId: string, tasks: StoredTask[]) {
    this.tasks.set(
      runId,
      tasks.map((task) => ({
        ...task,
        id: task.id || randomUUID(),
      })),
    );
  }

  async listTasks(runId: string) {
    return (this.tasks.get(runId) || []).map(clone);
  }

  async replaceConnections(runId: string, connections: StoredConnection[]) {
    this.connections.set(
      runId,
      connections.map((connection) => ({
        ...connection,
        id: connection.id || randomUUID(),
      })),
    );
  }

  async listConnections(runId: string) {
    return (this.connections.get(runId) || []).map(clone);
  }

  async saveResult(runId: string, result: WorkflowAuditResult) {
    this.results.set(runId, clone(result));
  }

  async getResult(runId: string) {
    const result = this.results.get(runId);
    return result ? clone(result) : null;
  }

  async reset() {
    this.runs.clear();
    this.messages.clear();
    this.tasks.clear();
    this.connections.clear();
    this.results.clear();
    this.orgIntelligence.clear();
  }
}
