export function ProgressBar({
  progress,
  label,
  detail,
}: {
  progress: number;
  label: string;
  detail?: string;
}) {
  return (
    <div className="progress-shell">
      <div className="progress-row">
        <span>{label}</span>
        <span>{detail || `${progress}%`}</span>
      </div>
      <div className="progress-bar" aria-hidden>
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
