import { ArrowRight, Check, Circle, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QuestionComposer } from '@/components/interview/QuestionComposer';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ExperienceRail, ExperienceRailLink, ExperienceRailSection } from '@/components/ui/ExperienceRail';
import { ExperienceShell } from '@/components/ui/ExperienceShell';
import { PageLayout } from '@/components/ui/PageLayout';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { completeRun, getRunView, submitAnswer } from '@/lib/api';
import { interviewStages } from '@/lib/demo';
import type { RunView, WorkflowAuditResult } from '@/lib/contracts';

function inferInterviewStageIndex(progress: number) {
  if (progress < 25) return 0;
  if (progress < 50) return 1;
  if (progress < 72) return 2;
  if (progress < 94) return 3;
  return 4;
}

export function AuditPage() {
  const navigate = useNavigate();
  const { runId = '' } = useParams();
  const [view, setView] = useState<RunView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const threadRef = useRef<HTMLDivElement | null>(null);
  const questionCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError('');

    getRunView(runId)
      .then((result) => {
        if (!active) return;
        setView(result);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load the workflow audit.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [runId]);

  useEffect(() => {
    const thread = threadRef.current;
    const questionCard = questionCardRef.current;
    if (!thread || !questionCard) return;

    const top = Math.max(0, questionCard.offsetTop - 24);
    thread.scrollTo({
      top,
      behavior: 'smooth',
    });
  }, [view?.messages.length, view?.run.state.currentCard?.id, view?.run.state.isComplete]);

  async function refreshView() {
    const next = await getRunView(runId);
    setView(next);
  }

  async function handleSubmit(value: string | number | string[]) {
    setIsSaving(true);
    setError('');
    try {
      await submitAnswer(runId, value);
      await refreshView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the answer.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerateResult() {
    setIsGenerating(true);
    setError('');
    try {
      const completion = await completeRun(runId);
      if (completion.result) {
        navigate(`/results/${runId}`, {
          state: {
            prefetchedResult: completion.result satisfies WorkflowAuditResult,
          },
        });
        return;
      }

      navigate(`/results/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build your workflow output.');
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <PageLayout eyebrow="Workflow Audit" title="Loading interview..." subtitle="Pulling the current workflow state and prior team context.">
        <Card title="One moment" description="The audit state is loading." />
      </PageLayout>
    );
  }

  if (error && !view) {
    return (
      <PageLayout eyebrow="Workflow Audit" title="Could not load this run" subtitle={error}>
        <ButtonLink to="/" variant="secondary">
          Back to start
        </ButtonLink>
      </PageLayout>
    );
  }

  if (!view) return null;

  const { run, messages } = view;
  const { state } = run;
  const stageIndex = inferInterviewStageIndex(state.progress);
  const focusedTask =
    state.selectedTasks.length > 0 && stageIndex >= 1
      ? state.selectedTasks[state.currentTaskIndex] || state.selectedTasks[0]
      : null;
  const visibleTaskChips = focusedTask ? [focusedTask] : state.selectedTasks;

  const rail = (
    <ExperienceRail>
      <ExperienceRailSection>
        <ExperienceRailLink to="/">
          <span>Go home</span>
          <ArrowRight size={14} />
        </ExperienceRailLink>
      </ExperienceRailSection>

      <ExperienceRailSection
        label={`${run.companyName} / ${run.team}`}
        title={run.roleTitle}
      />

      <ExperienceRailSection label="Progress">
        <ProgressBar progress={state.progress} label={state.stageLabel} />
        <div className="rail-step-list">
          {interviewStages.map((stage, index) => {
            const status = index < stageIndex ? 'complete' : index === stageIndex ? 'active' : 'upcoming';
            return (
              <div
                key={stage}
                className={`rail-step-item ${status === 'complete' ? 'is-complete' : status === 'active' ? 'is-active' : ''}`}
              >
                <span className="rail-step-icon">
                  {status === 'complete' ? <Check size={14} /> : <Circle size={12} />}
                </span>
                <span>{stage}</span>
              </div>
            );
          })}
        </div>
      </ExperienceRailSection>

    </ExperienceRail>
  );

  return (
    <ExperienceShell
      rail={rail}
      eyebrow={`${run.companyName} / ${run.team}`}
      title="Workflow audit"
      subtitle="Describe the work the way it actually happens. The audit will keep the structure tight and turn it into something you can use."
      headerActions={
        <ButtonLink to="/admin" variant="secondary" size="sm">
          Admin view
        </ButtonLink>
      }
    >
      <div className="workspace-surface">
        <div className="workspace-intro">
          <p className="workspace-label">Conversation</p>
          <h2 className="workspace-heading">
            {state.isComplete ? 'You have enough signal to generate the output.' : 'Keep the workflow concrete as you answer.'}
          </h2>
          <p className="workspace-copy">
            {state.isComplete
              ? 'The interview is done. Generate the ranked opportunities and starter setup when you are ready.'
              : 'Focus on what triggers the work, what source material you pull from first, what you need to produce, and where the cleanup begins.'}
          </p>
          {visibleTaskChips.length > 0 ? (
            <div className="tag-list">
              {visibleTaskChips.map((task) => (
                <span key={task} className="tag" data-tone="info">
                  {task}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div ref={threadRef} className="workspace-scroll">
          <div className="message-list audit-thread">
            {messages.map((message) => (
              <div key={message.id} className="message" data-role={message.role}>
                <span className="message-role">{message.role === 'assistant' ? 'Agent' : 'You'}</span>
                <div className="message-bubble">{message.content}</div>
              </div>
            ))}
          </div>

          <div
            key={state.currentCard?.id || (state.isComplete ? 'complete' : 'no-card')}
            ref={questionCardRef}
            className="workspace-question-card"
          >
            {state.isComplete ? (
              <div className="stack">
                <p className="helper-text">Everything needed is mapped. The next screen turns it into ranked opportunities and a starter setup.</p>
                <div className="button-row">
                  <Button onClick={handleGenerateResult} disabled={isGenerating}>
                    {isGenerating ? (
                      <>
                        <LoaderCircle size={16} className="button-spinner" />
                        Building your output...
                      </>
                    ) : (
                      <>
                        See your workflow output
                        <ArrowRight size={16} />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : state.currentCard ? (
              <QuestionComposer
                card={state.currentCard}
                disabled={isSaving}
                isSubmitting={isSaving}
                onSubmit={handleSubmit}
              />
            ) : (
              <div className="empty-state">There is no active question card right now.</div>
            )}
            {error ? (
              <p className="helper-text" style={{ color: 'var(--danger)', marginTop: 16 }}>
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </ExperienceShell>
  );
}
