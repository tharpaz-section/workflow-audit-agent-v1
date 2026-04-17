import type { AdminSummary } from '@/lib/contracts';

const COLORS = ['#5563f3', '#7fa0ff', '#f1c554', '#5f8f74', '#8d78f0', '#ff9f7b'];

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
}

export function DonutChart({ coverage }: { coverage: AdminSummary['coverage'] }) {
  const teams = coverage.teams.slice(0, 6);
  const total = Math.max(teams.reduce((sum, team) => sum + team.respondentCount, 0), 1);
  let angle = 0;

  if (teams.length === 0) {
    return <div className="empty-state">No coverage data yet.</div>;
  }

  return (
    <div className="donut-chart-layout">
      <svg viewBox="0 0 120 120" className="donut-chart" aria-hidden="true">
        <circle cx="60" cy="60" r="36" fill="none" stroke="rgba(18, 19, 19, 0.08)" strokeWidth="18" />
        {teams.map((team, index) => {
          const slice = (team.respondentCount / total) * 360;
          const path = describeArc(60, 60, 36, angle, angle + slice);
          angle += slice;
          return (
            <path
              key={team.team}
              d={path}
              fill="none"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth="18"
              strokeLinecap="round"
            />
          );
        })}
        <circle cx="60" cy="60" r="26" fill="white" />
        <text x="60" y="56" textAnchor="middle" className="donut-chart-total">
          {coverage.totalRespondents}
        </text>
        <text x="60" y="69" textAnchor="middle" className="donut-chart-subtitle">
          audits
        </text>
      </svg>

      <div className="chart-legend">
        {teams.map((team, index) => (
          <div key={team.team} className="chart-legend-row">
            <span className="chart-legend-dot" style={{ background: COLORS[index % COLORS.length] }} />
            <span className="chart-legend-label">{team.team}</span>
            <span className="chart-legend-value">{team.respondentCount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
