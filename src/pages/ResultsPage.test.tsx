import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResultsPage } from '@/pages/ResultsPage';

const runView = {
  run: {
    id: 'run-1',
    companyName: 'Section Demo Co',
    department: 'Revenue',
    team: 'RevOps',
    roleTitle: 'Revenue Operations Manager',
    generationMode: 'mock',
    status: 'interview_complete',
    progress: 100,
    priorPatterns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    state: {
      profile: {
        companyName: 'Section Demo Co',
        department: 'Revenue',
        team: 'RevOps',
        roleTitle: 'Revenue Operations Manager',
      },
      generationMode: 'mock',
      currentCard: null,
      selectedTasks: ['Forecast reporting'],
      frictionSummary: 'Manual reporting is slow.',
      aiToolUsage: '',
      aspirationalFocus: 'More strategic work',
      teamPatternsAcknowledged: [],
      notes: [],
      taskDetails: [],
      stageLabel: 'Interview complete',
      currentTaskIndex: 0,
      progress: 100,
      isComplete: true,
      interviewBrief: {
        summary: 'RevOps already shows a reporting pattern.',
        likelyWorkflows: ['Forecast reporting'],
        priorityGaps: [],
        probableConnections: [],
        confidenceNotes: [],
      },
      orgSignals: {
        confirmedPatterns: ['Forecast reporting'],
        lightCoverageAreas: ['RevOps'],
        oneSidedHandoffs: [],
      },
      modelConfidence: {
        overall: 0.46,
        label: 'Building',
        notes: ['Coverage is still light.'],
      },
    },
  },
  messages: [],
};

const result = {
  runId: 'run-1',
  completedAt: new Date().toISOString(),
  topOpportunities: [
    {
      title: 'Automate weekly forecast reporting',
      type: 'report-generation',
      affectedTeams: ['RevOps', 'Finance'],
      estimatedHoursSaved: 12,
      confidence: 0.88,
      promptReady: true,
      rationale: 'It is repetitive and cross-functional.',
      category: 'reporting',
    },
  ],
  heroPrompt: {
    title: 'Forecast Reporting Copilot Prompt',
    instructions: 'You are my forecast copilot.',
    suggestedModel: 'gpt-5.4-mini',
    recommendedSurface: 'scheduled_task',
    surfaceRationale: 'This should run on a schedule.',
    setupChecklist: ['Schedule it every Monday.'],
    notes: ['Use the weekly export.'],
  },
  roleImpact: {
    summary: 'Automate weekly forecast reporting is the clearest place to start in your role.',
    personalOpportunities: ['Redirect saved time toward more strategic work'],
    skillsToBuild: ['Reviewing AI first passes'],
    message: 'Start narrow and keep the review layer with you.',
  },
  humanStrengths: ['Judgment still matters.'],
  nextStep: 'Start with forecast reporting.',
  workflowConnections: [],
  teamPatterns: [],
};

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/runs/run-1')) {
        return new Response(JSON.stringify(runView), { status: 200 });
      }
      if (url.endsWith('/api/runs/run-1/complete')) {
        return new Response(JSON.stringify({ status: 'complete', result }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${url} ${init?.method || 'GET'}`);
    }) as unknown as typeof fetch);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders ranked opportunities and the hero prompt artifact', async () => {
    render(
      <MemoryRouter initialEntries={['/results/run-1']}>
        <Routes>
          <Route path="/results/:runId" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
    expect(screen.getByRole('heading', { name: /Automate weekly forecast reporting/i })).toBeInTheDocument();
  });

  expect(screen.getByText('Forecast Reporting Copilot Prompt')).toBeInTheDocument();
  expect(screen.getByText('You are my forecast copilot.')).toBeInTheDocument();
  expect(screen.getByText(/Recommended format: Scheduled task/i)).toBeInTheDocument();
  expect(screen.getByText(/How to apply this in your day-to-day/i)).toBeInTheDocument();
  });
});
