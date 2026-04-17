import { RefreshCcw, Users2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ExperienceRail, ExperienceRailAnchor, ExperienceRailLink, ExperienceRailSection } from '@/components/ui/ExperienceRail';
import { ExperienceShell } from '@/components/ui/ExperienceShell';
import { Heatmap } from '@/components/admin/Heatmap';
import { getAdminSummary, resetDemoData } from '@/lib/api';
import type { AdminSummary } from '@/lib/contracts';

function joinCompact(values: string[], fallback = 'None yet') {
  return values.length > 0 ? values.join(' · ') : fallback;
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function buildAdminRecommendation(summary: AdminSummary) {
  const topOpportunity = summary.topOpportunities[0];
  const topPattern = summary.teamPatterns[0];
  if (!topOpportunity) return null;

  return {
    title: topOpportunity.title,
    whyNow: `${topOpportunity.estimatedHoursSaved} hours of likely weekly savings with ${(topOpportunity.confidence * 100).toFixed(0)}% confidence.`,
    teams: topOpportunity.affectedTeams.slice(0, 3),
    evidence: [
      topPattern
        ? `${topPattern.team} already has ${topPattern.respondentCount} completed audit${topPattern.respondentCount === 1 ? '' : 's'} pointing in a similar direction.`
        : null,
      `${summary.completion.completedRuns} completed audit${summary.completion.completedRuns === 1 ? '' : 's'} are already contributing signal.`,
      topOpportunity.rationale,
    ].filter(Boolean) as string[],
  };
}

export function AdminPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');

  async function loadSummary() {
    setIsLoading(true);
    setError('');
    try {
      setSummary(await getAdminSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin summary.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  async function handleReset() {
    setIsResetting(true);
    setError('');
    try {
      setSummary(await resetDemoData());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset the demo data.');
    } finally {
      setIsResetting(false);
    }
  }

  if (isLoading && !summary) {
    return (
      <Card title="Loading dashboard" description="Aggregating workflow runs, opportunities, and team patterns." />
    );
  }

  if (error && !summary) {
    return <Card title="Could not load the admin view" description={error} />;
  }

  const recommendation = summary ? buildAdminRecommendation(summary) : null;

  const rail = (
    <ExperienceRail>
      <ExperienceRailSection>
        <ExperienceRailLink to="/">
          <span>Back to audit</span>
          <span aria-hidden>↗</span>
        </ExperienceRailLink>
      </ExperienceRailSection>

      <ExperienceRailSection
        label="Admin / Head of AI"
        title="Workflow signal"
        description="A compact view of where automation is clustering and which workflow should move first."
      >
        {summary ? (
          <div className="rail-meta-list">
            <div className="rail-meta-row">
              <span className="rail-meta-kicker">Completed</span>
              <span className="rail-meta-value">{summary.completion.completedRuns}</span>
              <span className="rail-copy">audits</span>
            </div>
            <div className="rail-meta-row">
              <span className="rail-meta-kicker">Teams</span>
              <span className="rail-meta-value">{summary.completion.teamsCovered}</span>
              <span className="rail-copy">represented</span>
            </div>
            <div className="rail-meta-row">
              <span className="rail-meta-kicker">Confidence</span>
              <span className="rail-meta-value">{formatConfidence(summary.modelHealth.overallConfidence)}</span>
              <span className="rail-copy">{summary.coverage.lightCoverageTeams.length > 0 ? 'still building' : 'steady'}</span>
            </div>
          </div>
        ) : null}
      </ExperienceRailSection>

      <ExperienceRailSection label="Jump to">
        <div className="rail-nav-list">
          <ExperienceRailAnchor href="#admin-recommendation">What to automate first</ExperienceRailAnchor>
          <ExperienceRailAnchor href="#admin-signals">Signals from completed audits</ExperienceRailAnchor>
          <ExperienceRailAnchor href="#admin-heatmap">Opportunity heat map</ExperienceRailAnchor>
          <ExperienceRailAnchor href="#admin-opportunities">Top opportunities</ExperienceRailAnchor>
          <ExperienceRailAnchor href="#admin-patterns">Learned team patterns</ExperienceRailAnchor>
        </div>
      </ExperienceRailSection>

      <div className="rail-spacer" />

      <ExperienceRailSection label="Sample data">
        <Button variant="secondary" size="sm" onClick={handleReset} disabled={isResetting}>
          <RefreshCcw size={15} />
          {isResetting ? 'Resetting...' : 'Reset sample data'}
        </Button>
      </ExperienceRailSection>
    </ExperienceRail>
  );

  return (
    <ExperienceShell
      rail={rail}
      eyebrow="Admin / Head of AI view"
      title="Where workflow automation is clustering"
      subtitle="Use this to understand where recurring workflow pain is clustering, what to automate first, and which teams are starting to show repeatable patterns."
      headerActions={
        <ButtonLink to="/" variant="secondary" size="sm">
          Workflow audit
        </ButtonLink>
      }
    >
      {summary ? (
        <div className="workspace-surface">
          <div className="workspace-intro">
            <p className="workspace-label">Admin overview</p>
            <h2 className="workspace-heading">Move from individual workflow pain to a shared automation roadmap.</h2>
            <p className="workspace-copy">
              This view stays aggregate on purpose. It should help an admin decide what deserves standardization next, not just replay individual interviews.
            </p>
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <p className="metric-value">{summary.completion.totalRuns}</p>
              <p className="metric-label">Total runs captured</p>
            </div>
            <div className="metric-card">
              <p className="metric-value">{summary.completion.completedRuns}</p>
              <p className="metric-label">Completed audits</p>
            </div>
            <div className="metric-card">
              <p className="metric-value">{summary.completion.teamsCovered}</p>
              <p className="metric-label">Teams represented</p>
            </div>
            <div className="metric-card">
              <p className="metric-value">{formatConfidence(summary.modelHealth.overallConfidence)}</p>
              <p className="metric-label">Workflow map confidence</p>
            </div>
          </div>

          {recommendation ? (
            <div id="admin-recommendation" className="result-hero-card">
              <div className="result-hero-copy">
                <p className="workspace-label">What to automate first</p>
                <h2 className="workspace-heading">{recommendation.title}</h2>
                <p className="workspace-copy">{recommendation.whyNow}</p>
              </div>
              <div className="stack" style={{ gap: 12, justifyItems: 'start' }}>
                <div className="tag-list">
                  {recommendation.teams.map((team) => (
                    <span key={team} className="tag" data-tone="info">
                      {team}
                    </span>
                  ))}
                </div>
                <ul className="notes-list" style={{ margin: 0 }}>
                  {recommendation.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="dashboard-grid">
            <div className="stack">
              <Card
                title="Signals from completed audits"
                description="Coverage, gaps, and confidence for the workflow map that is taking shape."
                aside={<Users2 size={18} />}
              >
                <div id="admin-signals" className="stack compact-scroll" style={{ gap: 16 }}>
                  <div className="stack" style={{ gap: 10 }}>
                    <div className="meta-line">
                      <span className="meta-label">Coverage</span>
                      <span className="meta-copy">{summary.coverage.totalRespondents} respondents across {summary.coverage.teams.length} teams</span>
                    </div>
                    <div className="meta-line">
                      <span className="meta-label">Model health</span>
                      <span className="meta-copy">{summary.modelHealth.summary}</span>
                    </div>
                    <div className="tag-list">
                      {summary.coverage.teams.map((team) => (
                        <span key={team.team} className="tag" data-tone={team.status === 'strong' ? 'success' : team.status === 'building' ? 'info' : 'warning'}>
                          {team.team} · {team.respondentCount}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="stack" style={{ gap: 10 }}>
                    <p className="workspace-label">Priority gaps</p>
                    <div className="stack" style={{ gap: 10 }}>
                      {summary.criticalGaps.length > 0 ? (
                        summary.criticalGaps.slice(0, 4).map((gap) => (
                          <div key={gap.title} className="opportunity-item">
                            <div className="opportunity-header">
                              <div>
                                <h3 className="opportunity-title">{gap.title}</h3>
                                <p className="opportunity-copy">{gap.detail}</p>
                              </div>
                              <span className="tag" data-tone={gap.severity === 'high' ? 'warning' : gap.severity === 'medium' ? 'info' : 'success'}>
                                {gap.severity}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="helper-text">Coverage is broad enough that no major workflow gaps are standing out right now.</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <Card
                title="Opportunity heat map"
                description="Where opportunity is clustering by team and workflow type."
              >
                <div id="admin-heatmap">
                  <Heatmap heatmap={summary.heatmap} />
                </div>
              </Card>

              <Card title="Top automation opportunities" description="What should move onto the automation roadmap first.">
                <div id="admin-opportunities" className="opportunity-list compact-scroll">
                  {summary.topOpportunities.map((opportunity, index) => (
                    <div key={`${opportunity.title}-${index}`} className="opportunity-item">
                      <div className="opportunity-header">
                        <div>
                          <h3 className="opportunity-title">{opportunity.title}</h3>
                          <p className="opportunity-copy">{opportunity.rationale}</p>
                        </div>
                        <div className="score">{opportunity.estimatedHoursSaved} hrs</div>
                      </div>
                      <div className="meta-line">
                        <span className="meta-pill" data-tone="info">{opportunity.category}</span>
                        <span className="meta-copy">{joinCompact(opportunity.affectedTeams)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="stack">
              <Card title="Workflow map confidence" description="Where the map is still one-sided or still building." tone="soft">
                <div className="stack compact-scroll" style={{ gap: 16 }}>
                  <div className="stack" style={{ gap: 10 }}>
                    <p className="workspace-label">One-sided handoffs</p>
                    {summary.unilateralConnections.length > 0 ? (
                      <div className="connections-grid" style={{ maxHeight: 'none' }}>
                        {summary.unilateralConnections.slice(0, 4).map((connection) => (
                          <div
                            key={`${connection.sourceTask}-${connection.targetTeam}-${connection.connectionType}-gap`}
                            className="connection-item"
                          >
                            <div className="connection-header">
                              <h3 className="connection-title">{connection.sourceTask}</h3>
                              <span className="tag" data-tone="warning">One side only</span>
                            </div>
                            <p className="connection-copy">{connection.description}</p>
                            <div className="meta-line">
                              <span className="meta-pill" data-tone="info">{connection.targetTeam}</span>
                              <span className="meta-copy">{connection.targetLabel}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="helper-text">No one-sided handoffs are standing out right now.</p>
                    )}
                  </div>

                  <div className="stack" style={{ gap: 10 }}>
                    <p className="workspace-label">Low-confidence edges</p>
                    {summary.contradictions.length > 0 ? (
                      summary.contradictions.slice(0, 3).map((contradiction) => (
                        <div key={contradiction.title} className="pattern-item">
                          <h3 className="pattern-title">{contradiction.title}</h3>
                          <p className="pattern-copy">{contradiction.detail}</p>
                          <div className="meta-line">
                            <span className="meta-label">Teams</span>
                            <span className="meta-copy">{joinCompact(contradiction.teams, 'Mixed signal')}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="helper-text">The workflow map is internally consistent so far.</p>
                    )}
                  </div>
                </div>
              </Card>

              <Card title="Cross-team workflow connections" description="The strongest handoffs and dependencies showing up across completed audits.">
                <div className="connections-grid compact-scroll">
                  {summary.connections.slice(0, 4).map((connection) => (
                    <div
                      key={`${connection.sourceTask}-${connection.targetTeam}-${connection.connectionType}`}
                      className="connection-item"
                    >
                      <div className="connection-header">
                        <h3 className="connection-title">{connection.sourceTask}</h3>
                        <span className="tag" data-tone="warning">{connection.connectionType}</span>
                      </div>
                      <p className="connection-copy">{connection.description}</p>
                      <div className="meta-line">
                        <span className="meta-pill" data-tone="info">{connection.targetTeam}</span>
                        <span className="meta-copy">{connection.targetLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card
                title="Learned team patterns"
                description="Visible proof that the audit gets smarter as more employees on a team participate."
                aside={<Users2 size={18} />}
                tone="soft"
              >
                <div id="admin-patterns" className="pattern-grid compact-scroll">
                  {summary.teamPatterns.map((pattern) => (
                    <div key={`${pattern.team}-${pattern.summary}`} className="pattern-item">
                      <h3 className="pattern-title">
                        {pattern.team} ({pattern.respondentCount} respondents)
                      </h3>
                      <p className="pattern-copy">{pattern.summary}</p>
                      <div className="pattern-summary">
                        <div className="meta-line">
                          <span className="meta-label">Recurring</span>
                          <span className="meta-copy">{joinCompact(pattern.recurringTasks.slice(0, 4))}</span>
                        </div>
                        <div className="meta-line">
                          <span className="meta-label">Pain points</span>
                          <span className="meta-copy">{joinCompact(pattern.commonPainPoints.slice(0, 3))}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {error ? <p className="helper-text" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        </div>
      ) : null}
    </ExperienceShell>
  );
}
