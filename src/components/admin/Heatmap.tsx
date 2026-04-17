import type { AdminSummary } from '@/lib/contracts';

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .join(' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scoreStyle(score: number) {
  const alpha = Math.max(0.12, Math.min(0.92, score / 100));
  return {
    background: `rgba(61, 76, 240, ${alpha})`,
    color: score > 58 ? 'white' : 'var(--ink)',
  };
}

export function Heatmap({ heatmap }: { heatmap: AdminSummary['heatmap'] }) {
  if (heatmap.length === 0) {
    return <div className="empty-state">No completed audits yet. Run the seeded demo to populate the heat map.</div>;
  }

  const teams = [...new Set(heatmap.map((cell) => cell.team))];
  const categories = [...new Set(heatmap.map((cell) => cell.category))];

  return (
    <div className="heatmap-scroll">
      <div className="heatmap" style={{ ['--columns' as string]: categories.length }}>
      <div className="heatmap-header">
        <span className="heatmap-label">Team</span>
        {categories.map((category) => (
          <span key={category} className="heatmap-label">
            {formatCategoryLabel(category)}
          </span>
        ))}
      </div>

      {teams.map((team) => (
        <div key={team} className="heatmap-row">
          <span className="heatmap-label">{team}</span>
          {categories.map((category) => {
            const cell = heatmap.find((entry) => entry.team === team && entry.category === category);
            if (!cell) {
              return (
                <div key={`${team}-${category}`} className="heatmap-cell" style={{ background: 'rgba(18, 19, 19, 0.04)' }}>
                  <span className="heatmap-label">-</span>
                </div>
              );
            }
            return (
              <div key={`${team}-${category}`} className="heatmap-cell" style={scoreStyle(cell.score)}>
                <div>
                  <strong>{cell.score}</strong>
                  <span>{cell.count} workflows</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      </div>
    </div>
  );
}
