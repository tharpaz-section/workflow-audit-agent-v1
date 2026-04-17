import type { WorkflowConnection } from '@/lib/contracts';

export function SankeyChart({ connections }: { connections: WorkflowConnection[] }) {
  const items = connections.slice(0, 5);

  if (items.length === 0) {
    return <div className="empty-state">No workflow connections yet.</div>;
  }

  return (
    <div className="sankey-chart">
      <div className="sankey-column">
        <span className="sankey-label">Source workflow</span>
        {items.map((connection, index) => (
          <div key={`${connection.sourceTask}-${index}`} className="sankey-node sankey-node-source">
            {connection.sourceTask}
          </div>
        ))}
      </div>

      <div className="sankey-flows" aria-hidden="true">
        {items.map((connection, index) => (
          <div key={`${connection.sourceTask}-${connection.targetTeam}-${index}`} className="sankey-flow-row">
            <div
              className="sankey-flow-line"
              style={{ opacity: Math.max(0.35, 0.9 - index * 0.1) }}
            />
            <span className="sankey-flow-chip">{connection.connectionType}</span>
          </div>
        ))}
      </div>

      <div className="sankey-column">
        <span className="sankey-label">Receiving team</span>
        {items.map((connection, index) => (
          <div key={`${connection.targetTeam}-${index}`} className="sankey-node sankey-node-target">
            <strong>{connection.targetTeam}</strong>
            <span>{connection.targetLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
