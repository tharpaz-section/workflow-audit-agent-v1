import {
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  OrgIntelligence,
  TeamPattern,
  WorkflowAuditResult,
  WorkflowAuditState,
  WorkflowConnection,
} from '../../lib/contracts';

export const workflowAuditRunsTable = pgTable('workflow_audit_runs', {
  id: uuid('id').primaryKey(),
  company_name: text('company_name').notNull(),
  department: text('department').notNull(),
  team: text('team').notNull(),
  role_title: text('role_title').notNull(),
  generation_mode: text('generation_mode').notNull().default('mock'),
  status: text('status').notNull().default('in_progress'),
  progress: integer('progress').notNull().default(0),
  state: jsonb('state').$type<WorkflowAuditState>().notNull().default({} as WorkflowAuditState),
  prior_patterns: jsonb('prior_patterns').$type<TeamPattern[]>().notNull().default([]),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
});

export const workflowAuditMessagesTable = pgTable('workflow_audit_messages', {
  id: uuid('id').primaryKey(),
  run_id: uuid('run_id')
    .references(() => workflowAuditRunsTable.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(),
  card_kind: text('card_kind'),
  content: text('content').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workflowAuditTasksTable = pgTable('workflow_audit_tasks', {
  id: uuid('id').primaryKey(),
  run_id: uuid('run_id')
    .references(() => workflowAuditRunsTable.id, { onDelete: 'cascade' })
    .notNull(),
  task_name: text('task_name').notNull(),
  summary: text('summary'),
  tools: jsonb('tools').$type<string[]>().notNull().default([]),
  collaborators: jsonb('collaborators').$type<string[]>().notNull().default([]),
  pain_level: integer('pain_level'),
  estimated_hours_per_week: numeric('estimated_hours_per_week'),
  category: text('category'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workflowAuditConnectionsTable = pgTable('workflow_audit_connections', {
  id: uuid('id').primaryKey(),
  run_id: uuid('run_id')
    .references(() => workflowAuditRunsTable.id, { onDelete: 'cascade' })
    .notNull(),
  source_task: text('source_task').notNull(),
  target_team: text('target_team').notNull(),
  target_label: text('target_label').notNull(),
  connection_type: text('connection_type').notNull(),
  description: text('description'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workflowAuditResultsTable = pgTable('workflow_audit_results', {
  run_id: uuid('run_id')
    .references(() => workflowAuditRunsTable.id, { onDelete: 'cascade' })
    .primaryKey(),
  result: jsonb('result').$type<WorkflowAuditResult>().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workflowAuditOrgIntelligenceTable = pgTable('workflow_audit_org_intelligence', {
  company_name: text('company_name').primaryKey(),
  intelligence: jsonb('intelligence').$type<OrgIntelligence>().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type WorkflowAuditRunRow = typeof workflowAuditRunsTable.$inferSelect;
export type WorkflowAuditMessageRow = typeof workflowAuditMessagesTable.$inferSelect;
export type WorkflowAuditTaskRow = typeof workflowAuditTasksTable.$inferSelect;
export type WorkflowAuditConnectionRow = typeof workflowAuditConnectionsTable.$inferSelect;
export type WorkflowAuditResultRow = typeof workflowAuditResultsTable.$inferSelect;
export type WorkflowAuditOrgIntelligenceRow = typeof workflowAuditOrgIntelligenceTable.$inferSelect;
