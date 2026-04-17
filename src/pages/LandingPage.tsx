import { ArrowRight, Clock3, GitBranch, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { startRun } from '@/lib/api';
import { seededDemoProfile } from '@/lib/demo';
import type { GenerationMode } from '@/lib/contracts';

const MODE_STORAGE_KEY = 'workflow-audit-generation-mode';

export function LandingPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(seededDemoProfile);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('mock');
  const [showSplash, setShowSplash] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (savedMode === 'mock' || savedMode === 'live') {
      setGenerationMode(savedMode);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MODE_STORAGE_KEY, generationMode);
  }, [generationMode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await startRun({ ...form, generationMode });
      navigate(`/audit/${response.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start the workflow audit.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const splashPoints = [
    {
      icon: Clock3,
      title: 'Takes about 10 minutes',
      copy: 'You will map one recurring workflow in plain language, not fill out a long survey.',
    },
    {
      icon: GitBranch,
      title: 'Turns work into structure',
      copy: 'The audit maps the workflow, finds the friction, and ranks the strongest automation opportunities.',
    },
    {
      icon: Sparkles,
      title: 'Leaves you with something usable',
      copy: 'You will end with a starter setup and prompt you can try right away.',
    },
  ];

  function handleContinue() {
    setShowSplash(false);
  }

  return (
    <div className="landing-shell">
      <div className="landing-topbar">
        <img src="/images/section-black.png" alt="Section" className="experience-brand-mark" />
        <ButtonLink to="/admin" variant="secondary" size="sm">
          Admin view
        </ButtonLink>
      </div>

      {showSplash ? (
        <div className="splash-shell">
          <div className="splash-layout">
            <div className="splash-hero">
              <div className="landing-hero-header">
                <div className="eyebrow">Workflow Audit</div>
                <h1 className="page-title">Turn messy day-to-day work into a concrete AI starting point.</h1>
                <p className="page-subtitle">
                  We will ask about one real workflow, map how it actually happens, and hand back a clear place to start with AI.
                </p>
              </div>

              <Card title="Before you begin" description="Think about one workflow you would most want to make easier this week: what kicks it off, where you pull from first, what you need to produce, and where it gets messy." tone="soft" />

              <div className="button-row">
                <Button size="lg" onClick={handleContinue}>
                  Continue
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>

            <div className="splash-stack">
              {splashPoints.map((point) => {
                const Icon = point.icon;
                return (
                  <Card key={point.title} tone="soft">
                    <div className="splash-feature-row">
                      <div className="splash-feature-icon">
                        <Icon size={18} />
                      </div>
                      <div className="stack" style={{ gap: 8 }}>
                        <h2 className="card-title">{point.title}</h2>
                        <p className="card-description">{point.copy}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="landing-hero-header">
            <div className="eyebrow">Workflow Audit</div>
            <h1 className="page-title">Start the audit</h1>
            <p className="page-subtitle">
              Enter the core context for the person taking the audit. The interview will take it from there.
            </p>
          </div>

          <div className="landing-form-shell">
            <Card
              title="Profile"
              description="Use the seeded profile to move quickly, or replace it with your own details."
              tone="highlight"
            >
              <form className="stack" onSubmit={handleSubmit}>
                <div className="field">
                  <label>Mode</label>
                  <div className="tag-list">
                    <button
                      type="button"
                      className="option-card"
                      data-selected={generationMode === 'mock'}
                      onClick={() => setGenerationMode('mock')}
                      style={{ width: 'auto', minWidth: 180 }}
                    >
                      <span className="option-label">Mock</span>
                      <p className="option-hint">Fast, deterministic, no API key required.</p>
                    </button>
                    <button
                      type="button"
                      className="option-card"
                      data-selected={generationMode === 'live'}
                      onClick={() => setGenerationMode('live')}
                      style={{ width: 'auto', minWidth: 180 }}
                    >
                      <span className="option-label">Live OpenAI</span>
                      <p className="option-hint">Uses your local API key and GPT-5.4 family models.</p>
                    </button>
                  </div>
                  <p className="helper-text">
                    Current mode: <strong>{generationMode === 'live' ? 'Live OpenAI' : 'Mock'}</strong>
                  </p>
                </div>

                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="company-name">Company</label>
                    <input
                      id="company-name"
                      value={form.companyName}
                      onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="department-name">Department</label>
                    <input
                      id="department-name"
                      value={form.department}
                      onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="team-name">Team</label>
                    <input
                      id="team-name"
                      value={form.team}
                      onChange={(event) => setForm((current) => ({ ...current, team: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="role-title">Role title</label>
                    <input
                      id="role-title"
                      value={form.roleTitle}
                      onChange={(event) => setForm((current) => ({ ...current, roleTitle: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="focus-area">Optional focus area</label>
                  <input
                    id="focus-area"
                    value={form.focusArea}
                    placeholder="Forecast reporting, campaign reporting, roadmap synthesis..."
                    onChange={(event) => setForm((current) => ({ ...current, focusArea: event.target.value }))}
                  />
                </div>

                <p className="helper-text">Keep the seeded profile if you want to move through the demo quickly.</p>

                {error ? <p className="helper-text" style={{ color: 'var(--danger)' }}>{error}</p> : null}

                <div className="button-row">
                  <Button type="submit" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? 'Starting...' : 'Start workflow audit'}
                    <ArrowRight size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setForm(seededDemoProfile);
                      setGenerationMode(seededDemoProfile.generationMode);
                    }}
                    disabled={isSubmitting}
                  >
                    Reset fields
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
