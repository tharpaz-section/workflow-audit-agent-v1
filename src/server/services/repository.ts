import { MemoryWorkflowAuditRepository } from '../repositories/memory.js';
import { PostgresWorkflowAuditRepository } from '../repositories/postgres.js';
import type { WorkflowAuditRepository } from '../repositories/types.js';
import { getServerEnv } from '../env.js';
import { seedDemoRepository } from './demo.js';

let memoryRepository: WorkflowAuditRepository | null = null;
let seeded = false;

export async function getRepository() {
  const { databaseUrl } = getServerEnv();
  const repository: WorkflowAuditRepository = databaseUrl
    ? new PostgresWorkflowAuditRepository()
    : memoryRepository || (memoryRepository = new MemoryWorkflowAuditRepository());

  if (!seeded) {
    const runs = await repository.listRuns();
    if (runs.length === 0) {
      await seedDemoRepository(repository);
    }
    seeded = true;
  }

  return repository;
}

export function resetRepositoryForTests() {
  memoryRepository = null;
  seeded = false;
}
