import type { WorkflowOpportunity } from '@/lib/contracts';

export function BarChart({ opportunities }: { opportunities: WorkflowOpportunity[] }) {
  const top = opportunities.slice(0, 5);
  const maxValue = Math.max(...top.map((item) => item.estimatedHoursSaved), 1);

  if (top.length === 0) {
    return <div className="empty-state">No ranked opportunities yet.</div>;
  }

  return (
    <div className="chart-stack">
      {top.map((item) => (
        <div key={item.title} className="bar-chart-row">
          <div className="bar-chart-copy">
            <span className="bar-chart-label">{item.title}</span>
            <span className="bar-chart-value">{item.estimatedHoursSaved} hrs</span>
          </div>
          <div className="bar-chart-track">
            <div
              className="bar-chart-fill"
              style={{ width: `${Math.max(18, (item.estimatedHoursSaved / maxValue) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
