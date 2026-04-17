import { and, asc, desc, eq } from 'drizzle-orm';
import type { OrgIntelligence, WorkflowAuditResult } from '../../lib/contracts';
import { getDb } from '../db/client';
import {
  workflowAuditConnectionsTable,
  workflowAuditMessagesTable,
  workflowAuditOrgIntelligenceTable,
  workflowAuditResultsTable,
  workflowAuditRunsTable,
  workflowAuditTasksTable,
} from '../db/schema';
import type {
  StoredConnection,
  StoredMessage,
  StoredRun,
  StoredTask,
  WorkflowAuditRepository,
} from './types';

function requireDb() {
  const db = getDb();
  if (!db) throw new Error('No database configured for workflow audit app');
  return db;
}

function toStoredRun(row: typeof workflowAuditRunsTable.$inferSelect): StoredRun {
  return {
    id: row.id,
    companyName: row.company_name,
    department: row.department,
    team: row.team,
    roleTitle: row.role_title,
    generationMode: row.generation_mode as StoredRun['generationMode'],
    status: row.status as StoredRun['status'],
    progress: row.progress,
    state: row.state,
    priorPatterns: row.prior_patterns,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    completedAt: row.completed_at?.toISOString() || null,
  };
}

function toStoredMessage(row: typeof workflowAuditMessagesTable.$inferSelect): StoredMessage {
  return {
    id: row.id,
    runId: row.run_id,
    role: row.role as StoredMessage['role'],
    cardKind: row.card_kind,
    content: row.content,
    payload: row.payload,
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresWorkflowAuditRepository implements WorkflowAuditRepository {
  async createRun(run: StoredRun) {
    const db = requireDb();
    await db.insert(workflowAuditRunsTable).values({
      id: run.id,
      company_name: run.companyName,
      department: run.department,
      team: run.team,
      role_title: run.roleTitle,
      generation_mode: run.generationMode,
      status: run.status,
      progress: run.progress,
      state: run.state,
      prior_patterns: run.priorPatterns,
      created_at: new Date(run.createdAt),
      updated_at: new Date(run.updatedAt),
      completed_at: run.completedAt ? new Date(run.completedAt) : null,
    });
  }

  async updateRun(runId: string, patch: Partial<StoredRun>) {
    const db = requireDb();
    await db
      .update(workflowAuditRunsTable)
      .set({
        company_name: patch.companyName,
        department: patch.department,
        team: patch.team,
        role_title: patch.roleTitle,
        generation_mode: patch.generationMode,
        status: patch.status,
        progress: patch.progress,
        state: patch.state,
        prior_patterns: patch.priorPatterns,
        completed_at: patch.completedAt ? new Date(patch.completedAt) : undefined,
        updated_at: new Date(),
      })
      .where(eq(workflowAuditRunsTable.id, runId));

    const run = await this.getRun(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    return run;
  }

  async getRun(runId: string) {
    const db = requireDb();
    const row = await db.query.workflowAuditRunsTable.findFirst({
      where: eq(workflowAuditRunsTable.id, runId),
    });
    return row ? toStoredRun(row) : null;
  }

  async listRuns() {
    const db = requireDb();
    const rows = await db.query.workflowAuditRunsTable.findMany({
      orderBy: [desc(workflowAuditRunsTable.created_at)],
    });
    return rows.map(toStoredRun);
  }

  async getOrgIntelligence(companyName: string) {
    const db = requireDb();
    const row = await db.query.workflowAuditOrgIntelligenceTable.findFirst({
      where: eq(workflowAuditOrgIntelligenceTable.company_name, companyName),
    });
    return row?.intelligence || null;
  }

  async saveOrgIntelligence(companyName: string, intelligence: OrgIntelligence) {
    const db = requireDb();
    const existing = await db.query.workflowAuditOrgIntelligenceTable.findFirst({
      where: eq(workflowAuditOrgIntelligenceTable.company_name, companyName),
    });

    if (existing) {
      await db
        .update(workflowAuditOrgIntelligenceTable)
        .set({
          intelligence,
          updated_at: new Date(),
        })
        .where(eq(workflowAuditOrgIntelligenceTable.company_name, companyName));
      return;
    }

    await db.insert(workflowAuditOrgIntelligenceTable).values({
      company_name: companyName,
      intelligence,
    });
  }

  async appendMessage(message: StoredMessage) {
    const db = requireDb();
    await db.insert(workflowAuditMessagesTable).values({
      id: message.id,
      run_id: message.runId,
      role: message.role,
      card_kind: message.cardKind ?? null,
      content: message.content,
      payload: message.payload,
      created_at: new Date(message.createdAt),
    });
  }

  async listMessages(runId: string) {
    const db = requireDb();
    const rows = await db.query.workflowAuditMessagesTable.findMany({
      where: eq(workflowAuditMessagesTable.run_id, runId),
      orderBy: [asc(workflowAuditMessagesTable.created_at)],
    });
    return rows.map(toStoredMessage);
  }

  async replaceTasks(runId: string, tasks: StoredTask[]) {
    const db = requireDb();
    await db.delete(workflowAuditTasksTable).where(eq(workflowAuditTasksTable.run_id, runId));
    if (!tasks.length) return;
    await db.insert(workflowAuditTasksTable).values(
      tasks.map((task) => ({
        id: task.id,
        run_id: runId,
        task_name: task.taskName,
        summary: task.summary,
        tools: task.tools,
        collaborators: task.collaborators,
        pain_level: task.painLevel,
        estimated_hours_per_week: task.estimatedHoursPerWeek?.toString(),
        category: task.category,
        updated_at: new Date(),
      })),
    );
  }

  async listTasks(runId: string) {
    const db = requireDb();
    const rows = await db.query.workflowAuditTasksTable.findMany({
      where: eq(workflowAuditTasksTable.run_id, runId),
      orderBy: [asc(workflowAuditTasksTable.created_at)],
    });
    return rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      taskName: row.task_name,
      summary: row.summary || '',
      tools: row.tools,
      collaborators: row.collaborators,
      painLevel: row.pain_level ?? undefined,
      estimatedHoursPerWeek: row.estimated_hours_per_week
        ? Number(row.estimated_hours_per_week)
        : undefined,
      category: row.category ?? undefined,
    }));
  }

  async replaceConnections(runId: string, connections: StoredConnection[]) {
    const db = requireDb();
    await db
      .delete(workflowAuditConnectionsTable)
      .where(eq(workflowAuditConnectionsTable.run_id, runId));
    if (!connections.length) return;
    await db.insert(workflowAuditConnectionsTable).values(
      connections.map((connection) => ({
        id: connection.id,
        run_id: runId,
        source_task: connection.sourceTask,
        target_team: connection.targetTeam,
        target_label: connection.targetLabel,
        connection_type: connection.connectionType,
        description: connection.description,
      })),
    );
  }

  async listConnections(runId: string) {
    const db = requireDb();
    const rows = await db.query.workflowAuditConnectionsTable.findMany({
      where: eq(workflowAuditConnectionsTable.run_id, runId),
      orderBy: [asc(workflowAuditConnectionsTable.created_at)],
    });
    return rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      sourceTask: row.source_task,
      targetTeam: row.target_team,
      targetLabel: row.target_label,
      connectionType: row.connection_type,
      description: row.description || '',
    }));
  }

  async saveResult(runId: string, result: WorkflowAuditResult) {
    const db = requireDb();
    const existing = await db.query.workflowAuditResultsTable.findFirst({
      where: eq(workflowAuditResultsTable.run_id, runId),
    });
    if (existing) {
      await db
        .update(workflowAuditResultsTable)
        .set({ result, updated_at: new Date() })
        .where(eq(workflowAuditResultsTable.run_id, runId));
      return;
    }

    await db.insert(workflowAuditResultsTable).values({
      run_id: runId,
      result,
    });
  }

  async getResult(runId: string) {
    const db = requireDb();
    const row = await db.query.workflowAuditResultsTable.findFirst({
      where: eq(workflowAuditResultsTable.run_id, runId),
    });
    return row?.result || null;
  }

  async reset() {
    const db = requireDb();
    await db.delete(workflowAuditOrgIntelligenceTable);
    await db.delete(workflowAuditResultsTable);
    await db.delete(workflowAuditConnectionsTable);
    await db.delete(workflowAuditTasksTable);
    await db.delete(workflowAuditMessagesTable);
    await db.delete(workflowAuditRunsTable);
  }
}
