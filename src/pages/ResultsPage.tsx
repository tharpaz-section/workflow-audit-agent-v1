import { ArrowRight, Copy, Network, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Button, ButtonAnchor, ButtonLink } from '@/components/ui/Button';
import { ExperienceRail, ExperienceRailButton, ExperienceRailLink, ExperienceRailSection } from '@/components/ui/ExperienceRail';
import { ExperienceShell } from '@/components/ui/ExperienceShell';
import { PageLayout } from '@/components/ui/PageLayout';
import { SideSheet } from '@/components/ui/SideSheet';
import { completeRun, getResult, getRunView } from '@/lib/api';
import { processingStages } from '@/lib/demo';
import type { RunView, WorkflowAuditResult } from '@/lib/contracts';

function inferStageIndex(tick: number, result: WorkflowAuditResult | null) {
  if (result) return processingStages.length - 1;
  return Math.min(processingStages.length - 1, Math.floor(tick / 2));
}

function formatSurfaceLabel(surface: WorkflowAuditResult['heroPrompt']['recommendedSurface']) {
  switch (surface) {
    case 'chatgpt_project':
      return 'ChatGPT Project';
    case 'custom_gpt':
      return 'Custom GPT';
    case 'scheduled_task':
      return 'Scheduled task';
    case 'single_prompt':
    default:
      return 'Single prompt';
  }
}

type ActiveSheet =
  | { type: 'prompt' }
  | { type: 'opportunity'; index: number }
  | { type: 'role-impact' }
  | { type: 'connections' }
  | { type: 'human' }
  | null;

export function ResultsPage() {
  const { runId = '' } = useParams();
  const location = useLocation();
  const prefetchedResult = (location.state as { prefetchedResult?: WorkflowAuditResult } | null)?.prefetchedResult || null;
  const [runView, setRunView] = useState<RunView | null>(null);
  const [result, setResult] = useState<WorkflowAuditResult | null>(prefetchedResult);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [promptCopied, setPromptCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    let active = true;

    getRunView(runId)
      .then((view) => {
        if (!active) return;
        setRunView(view);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load run context.');
      });

    return () => {
      active = false;
    };
  }, [runId]);

  useEffect(() => {
    if (prefetchedResult) return;
    if (requestedRef.current) return;
    requestedRef.current = true;

    let active = true;
    let pollIntervalId: number | null = null;
    let progressIntervalId: number | null = null;

    async function start() {
      try {
        const poll = async () => {
          try {
            const response = await getResult(runId);
            if (!active) return;
            if (response.status === 'complete' && response.result) {
              setResult(response.result);
              if (pollIntervalId) window.clearInterval(pollIntervalId);
              if (progressIntervalId) window.clearInterval(progressIntervalId);
              return;
            }
          } catch (err) {
            if (!active) return;
            setError(err instanceof Error ? err.message : 'Unable to load results.');
            if (pollIntervalId) window.clearInterval(pollIntervalId);
            if (progressIntervalId) window.clearInterval(progressIntervalId);
          }
        };

        void completeRun(runId)
          .then((completion) => {
            if (!active) return;
            if (completion.result) {
              setResult(completion.result);
              if (pollIntervalId) window.clearInterval(pollIntervalId);
              if (progressIntervalId) window.clearInterval(progressIntervalId);
            }
          })
          .catch((err) => {
            if (!active) return;
            setError(err instanceof Error ? err.message : 'Unable to process the workflow audit.');
            if (pollIntervalId) window.clearInterval(pollIntervalId);
            if (progressIntervalId) window.clearInterval(progressIntervalId);
          });

        await poll();
        pollIntervalId = window.setInterval(poll, 1200);
        progressIntervalId = window.setInterval(() => {
          setTick((current) => Math.min(current + 1, processingStages.length * 2 - 1));
        }, 900);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to process the workflow audit.');
      }
    }

    void start();

    return () => {
      active = false;
      if (pollIntervalId) window.clearInterval(pollIntervalId);
      if (progressIntervalId) window.clearInterval(progressIntervalId);
    };
  }, [prefetchedResult, runId]);

  const stageIndex = inferStageIndex(tick, result);
  const isTakingLongerThanExpected = tick >= processingStages.length * 2 - 1 && !result;

  async function retryResults() {
    setIsRetrying(true);
    setError('');
    try {
      const completion = await completeRun(runId);
      if (completion.result) {
        setResult(completion.result);
      } else {
        const response = await getResult(runId);
        if (response.status === 'complete' && response.result) {
          setResult(response.result);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh the results.');
    } finally {
      setIsRetrying(false);
    }
  }

  async function copyPrompt() {
    if (!result) return;
    await navigator.clipboard.writeText(result.heroPrompt.instructions);
    setPromptCopied(true);
  }

  function chatGptPromptUrl(prompt: string) {
    const url = new URL('https://chatgpt.com/');
    url.searchParams.set('q', prompt);
    return url.toString();
  }

  const rail = (
    <ExperienceRail>
      <ExperienceRailSection>
        <ExperienceRailLink to="/">
          <span>Go home</span>
          <ArrowRight size={14} />
        </ExperienceRailLink>
      </ExperienceRailSection>

      <ExperienceRailSection
        label={runView ? `${runView.run.companyName} / ${runView.run.team}` : 'Workflow output'}
        title={result ? 'Ready to review' : 'Building the output'}
        description={
          result
            ? 'Start with the recommendation, then open deeper details only where you need them.'
            : 'The interview is complete. We are packaging the workflow into ranked opportunities and a starter setup.'
        }
      >
        {result ? (
          <div className="rail-meta-list">
            <div className="rail-meta-row">
              <span className="rail-meta-kicker">Best first move</span>
              <span className="rail-copy">{formatSurfaceLabel(result.heroPrompt.recommendedSurface)}</span>
            </div>
          </div>
        ) : null}
      </ExperienceRailSection>

      {!result ? (
        <ExperienceRailSection label="Processing">
          <div className="rail-step-list">
            {processingStages.map((stage, index) => {
              const status = index < stageIndex ? 'complete' : index === stageIndex ? 'active' : 'upcoming';
              return (
                <div
                  key={stage}
                  className={`rail-step-item ${status === 'complete' ? 'is-complete' : status === 'active' ? 'is-active' : ''}`}
                >
                  <span className="rail-step-icon">
                    {status === 'complete' ? <Sparkles size={14} /> : <Network size={14} />}
                  </span>
                  <span>{stage}</span>
                </div>
              );
            })}
          </div>
        </ExperienceRailSection>
      ) : (
        <>
          <ExperienceRailSection label="Review next">
            <div className="rail-nav-list">
              <ExperienceRailButton active={activeSheet?.type === 'prompt'} onClick={() => setActiveSheet({ type: 'prompt' })}>
                <span>Starter setup</span>
                <ArrowRight size={14} />
              </ExperienceRailButton>
              <ExperienceRailButton active={activeSheet?.type === 'role-impact'} onClick={() => setActiveSheet({ type: 'role-impact' })}>
                <span>What this means for your role</span>
                <ArrowRight size={14} />
              </ExperienceRailButton>
              {result.topOpportunities.slice(0, 3).map((opportunity, index) => (
                <ExperienceRailButton
                  key={`${opportunity.title}-${index}`}
                  active={activeSheet?.type === 'opportunity' && activeSheet.index === index}
                  onClick={() => setActiveSheet({ type: 'opportunity', index })}
                >
                  <span>Insight {index + 1}</span>
                  <ArrowRight size={14} />
                </ExperienceRailButton>
              ))}
              <ExperienceRailButton active={activeSheet?.type === 'connections'} onClick={() => setActiveSheet({ type: 'connections' })}>
                <span>Workflow map</span>
                <ArrowRight size={14} />
              </ExperienceRailButton>
              <ExperienceRailButton active={activeSheet?.type === 'human'} onClick={() => setActiveSheet({ type: 'human' })}>
                <span>Human judgment</span>
                <ArrowRight size={14} />
              </ExperienceRailButton>
            </div>
          </ExperienceRailSection>
          <div className="rail-spacer" />
        </>
      )}
    </ExperienceRail>
  );

  const promptPreview = result
    ? result.heroPrompt.instructions
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(' ')
    : '';

  const activeOpportunity =
    result && activeSheet?.type === 'opportunity' ? result.topOpportunities[activeSheet.index] : null;

  if (!runView && !result && error) {
    return (
      <PageLayout eyebrow="Workflow results" title="Could not load this run" subtitle={error}>
        <ButtonLink to="/" variant="secondary">
          Back to start
        </ButtonLink>
      </PageLayout>
    );
  }

  return (
    <>
      <ExperienceShell
        rail={rail}
        eyebrow={runView ? `${runView.run.companyName} / ${runView.run.team}` : 'Workflow results'}
        title={result ? 'Your workflow audit output' : 'Generating your workflow output'}
        subtitle={
          result
            ? 'Start from the recommended setup, review the strongest opportunities, and open deeper details only when they help.'
            : 'We are mapping the workflow, ranking the opportunities, and packaging the first setup.'
        }
        headerActions={
          <ButtonLink to="/admin" variant="secondary" size="sm">
            Admin view
          </ButtonLink>
        }
      >
        <div className="workspace-surface">
          {!result ? (
            <div className="results-loading-layout">
              <div className="workspace-intro">
                <p className="workspace-label">Output in progress</p>
                <h2 className="workspace-heading">Turning the interview into something you can use.</h2>
                <p className="workspace-copy">
                  This usually takes a moment while the workflow is normalized, ranked, and shaped into a starter setup.
                </p>
              </div>

              <div className="results-loading-card">
                <div className="processing-list">
                  {processingStages.map((stage, index) => (
                    <div
                      key={stage}
                      className="processing-item"
                      data-active={index === stageIndex}
                      data-complete={index < stageIndex}
                    >
                      <span className="processing-dot" />
                      <span>{stage}</span>
                    </div>
                  ))}
                </div>

                {isTakingLongerThanExpected ? (
                  <p className="helper-text" style={{ marginTop: 16 }}>
                    This is taking longer than expected. You can retry or go back to the start.
                  </p>
                ) : null}

                {error ? (
                  <p className="helper-text" style={{ color: 'var(--danger)', marginTop: 16 }}>
                    {error}
                  </p>
                ) : null}

                {(isTakingLongerThanExpected || error) ? (
                  <div className="button-row" style={{ marginTop: 18 }}>
                    <Button variant="secondary" size="sm" onClick={retryResults} disabled={isRetrying}>
                      {isRetrying ? 'Retrying...' : 'Retry'}
                    </Button>
                    <ButtonLink to="/" variant="ghost" size="sm">
                      Home
                    </ButtonLink>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="stack">
              <div className="result-hero-card">
                <div className="result-hero-copy">
                  <p className="workspace-label">Best first move</p>
                  <h2 className="workspace-heading">{formatSurfaceLabel(result.heroPrompt.recommendedSurface)}</h2>
                  <p className="workspace-copy">{result.heroPrompt.surfaceRationale}</p>
                </div>
                <div className="stack" style={{ gap: 12, justifyItems: 'start' }}>
                  <p className="result-hero-meta">Recommended with {result.heroPrompt.suggestedModel}</p>
                  <Button onClick={() => setActiveSheet({ type: 'prompt' })}>
                    Review starter setup
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </div>

              <div className="asset-grid">
                <button
                  type="button"
                  className="asset-card asset-card-primary"
                  onClick={() => setActiveSheet({ type: 'prompt' })}
                >
                  <p className="asset-eyebrow">Starter setup</p>
                  <h3 className="asset-title">{result.heroPrompt.title}</h3>
                  <p className="asset-copy">{promptPreview}</p>
                  <div className="asset-meta">
                    <p className="asset-meta-line">Recommended format: {formatSurfaceLabel(result.heroPrompt.recommendedSurface)}</p>
                  </div>
                </button>

                {result.topOpportunities.slice(0, 3).map((opportunity, index) => (
                  <button
                    key={`${opportunity.title}-${index}`}
                    type="button"
                    className="asset-card"
                    onClick={() => setActiveSheet({ type: 'opportunity', index })}
                  >
                    <p className="asset-eyebrow">Insight {index + 1}</p>
                    <h3 className="asset-title">{opportunity.title}</h3>
                    <p className="asset-copy">{opportunity.rationale}</p>
                    <div className="asset-meta">
                      <p className="asset-meta-line">
                        {opportunity.estimatedHoursSaved} hrs / week saved · {(opportunity.confidence * 100).toFixed(0)}% confidence
                      </p>
                    </div>
                  </button>
                ))}

                <button
                  type="button"
                  className="asset-card"
                  onClick={() => setActiveSheet({ type: 'role-impact' })}
                >
                  <p className="asset-eyebrow">For your role</p>
                  <h3 className="asset-title">How to apply this in your day-to-day</h3>
                  <p className="asset-copy">{result.roleImpact.summary}</p>
                  <div className="asset-meta">
                    <p className="asset-meta-line">{result.roleImpact.personalOpportunities.slice(0, 2).join(' · ')}</p>
                  </div>
                </button>

                <button
                  type="button"
                  className="asset-card"
                  onClick={() => setActiveSheet({ type: 'connections' })}
                >
                  <p className="asset-eyebrow">Workflow map</p>
                  <h3 className="asset-title">Cross-team handoffs</h3>
                  <p className="asset-copy">
                    {result.workflowConnections.length} connection
                    {result.workflowConnections.length === 1 ? '' : 's'} shaping how this work moves today.
                  </p>
                  <div className="asset-meta">
                    <p className="asset-meta-line">See the handoffs and dependency details</p>
                  </div>
                </button>

                <button type="button" className="asset-card" onClick={() => setActiveSheet({ type: 'human' })}>
                  <p className="asset-eyebrow">Human judgment</p>
                  <h3 className="asset-title">What should stay with you</h3>
                  <p className="asset-copy">{result.humanStrengths[0] || 'Open the panel to review where your context still matters most.'}</p>
                  <div className="asset-meta">
                    <p className="asset-meta-line">Review the calls that should stay with you</p>
                  </div>
                </button>
              </div>

              <div className="result-next-step">
                <p className="workspace-label">Recommended next step</p>
                <p className="workspace-copy">{result.nextStep}</p>
              </div>
            </div>
          )}
        </div>
      </ExperienceShell>

      {result ? (
        <SideSheet
          open={activeSheet !== null}
          onClose={() => setActiveSheet(null)}
          title={
            activeSheet?.type === 'prompt'
              ? result.heroPrompt.title
              : activeSheet?.type === 'opportunity' && activeOpportunity
                ? activeOpportunity.title
                : activeSheet?.type === 'role-impact'
                  ? 'What this means for your role'
                : activeSheet?.type === 'connections'
                  ? 'Workflow connections'
                  : 'Where your judgment still matters'
          }
          description={
            activeSheet?.type === 'prompt'
              ? 'A focused setup you can use right away for the top workflow.'
              : activeSheet?.type === 'opportunity' && activeOpportunity
                ? 'Why this opportunity ranked highly and where the time savings are likely to come from.'
                : activeSheet?.type === 'role-impact'
                  ? 'A compact read on how to use this workflow recommendation in your day-to-day work.'
                : activeSheet?.type === 'connections'
                  ? 'The handoffs and dependencies shaping the workflow today.'
                  : 'The decisions, tradeoffs, and context that should stay with the human owner.'
          }
          actions={
            activeSheet?.type === 'prompt' ? (
              <>
                <ButtonAnchor
                  href={chatGptPromptUrl(result.heroPrompt.instructions)}
                  target="_blank"
                  rel="noreferrer"
                  variant="primary"
                  size="sm"
                >
                  Open in ChatGPT
                </ButtonAnchor>
                <Button variant="secondary" size="sm" onClick={copyPrompt}>
                  <Copy size={15} />
                  {promptCopied ? 'Copied' : 'Copy prompt'}
                </Button>
                <ButtonLink to="/" variant="ghost" size="sm">
                  Start another audit
                </ButtonLink>
              </>
            ) : (
              <ButtonLink to="/" variant="primary" size="sm">
                Start another audit
              </ButtonLink>
            )
          }
        >
          {activeSheet?.type === 'prompt' ? (
            <div className="stack">
              <div className="stack" style={{ gap: 10 }}>
                <div className="meta-line">
                  <span className="meta-label">Recommended format</span>
                  <span className="meta-copy">{formatSurfaceLabel(result.heroPrompt.recommendedSurface)}</span>
                </div>
                <div className="meta-line">
                  <span className="meta-label">Suggested model</span>
                  <span className="meta-copy">{result.heroPrompt.suggestedModel}</span>
                </div>
              </div>
              <ul className="notes-list">
                {result.heroPrompt.setupChecklist.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <pre className="prompt-panel">{result.heroPrompt.instructions}</pre>
              <ul className="notes-list">
                {result.heroPrompt.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {activeSheet?.type === 'opportunity' && activeOpportunity ? (
            <div className="stack">
              <div className="stack" style={{ gap: 10 }}>
                <div className="meta-line">
                  <span className="meta-label">Type</span>
                  <span className="meta-copy">{activeOpportunity.type}</span>
                </div>
                <div className="meta-line">
                  <span className="meta-label">Confidence</span>
                  <span className="meta-copy">{(activeOpportunity.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="meta-line">
                  <span className="meta-label">Estimated time back</span>
                  <span className="meta-copy">{activeOpportunity.estimatedHoursSaved} hrs / week</span>
                </div>
              </div>
              <p className="sheet-copy">{activeOpportunity.rationale}</p>
              <div className="meta-line">
                <span className="meta-label">Affected teams</span>
                <span className="meta-copy">{activeOpportunity.affectedTeams.join(' · ')}</span>
              </div>
              <div className="meta-line">
                <span className="meta-label">Category</span>
                <span className="meta-copy">{activeOpportunity.category}</span>
              </div>
            </div>
          ) : null}

          {activeSheet?.type === 'role-impact' ? (
            <div className="stack">
              <p className="sheet-copy">{result.roleImpact.message}</p>
              <div className="meta-line">
                <span className="meta-label">Summary</span>
                <span className="meta-copy">{result.roleImpact.summary}</span>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <span className="meta-label">Where you can get leverage first</span>
                <ul className="notes-list">
                  {result.roleImpact.personalOpportunities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <span className="meta-label">AI-ready habits to build</span>
                <ul className="notes-list">
                  {result.roleImpact.skillsToBuild.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {activeSheet?.type === 'connections' ? (
            <div className="connections-grid">
              {result.workflowConnections.map((connection) => (
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
          ) : null}

          {activeSheet?.type === 'human' ? (
            <div className="stack">
              <ul className="notes-list">
                {result.humanStrengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="sheet-copy">{result.nextStep}</p>
            </div>
          ) : null}
        </SideSheet>
      ) : null}
    </>
  );
}
