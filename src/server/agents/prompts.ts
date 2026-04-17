import type { InterviewBrief, RunProfile, TeamPattern, WorkflowAuditState } from '../../lib/contracts';
import type { StoredMessage } from '../repositories/types';

export function getRoleTemplate(roleTitle: string) {
  const role = roleTitle.toLowerCase();

  if (role.includes('product')) {
    return {
      tasks: [
        'Sprint planning and backlog grooming',
        'Stakeholder update synthesis',
        'User research synthesis',
        'Roadmap prioritization',
      ],
      tools: ['Jira', 'Docs', 'Slack', 'Sheets'],
    };
  }

  if (role.includes('marketing')) {
    return {
      tasks: [
        'Campaign reporting',
        'Content repurposing',
        'Asset review coordination',
        'Weekly performance updates',
      ],
      tools: ['Docs', 'Sheets', 'HubSpot', 'Slack'],
    };
  }

  if (role.includes('finance') || role.includes('accounting')) {
    return {
      tasks: [
        'Variance commentary',
        'Monthly close prep',
        'Forecast consolidation',
        'Approval packet assembly',
      ],
      tools: ['Excel', 'Sheets', 'ERP', 'Email'],
    };
  }

  if (role.includes('operations') || role.includes('revops')) {
    return {
      tasks: [
        'Forecast reporting',
        'CRM hygiene',
        'Pipeline QA',
        'Leadership review prep',
      ],
      tools: ['Salesforce', 'Sheets', 'Slides', 'Slack'],
    };
  }

  if (role.includes('sales')) {
    return {
      tasks: [
        'Account research',
        'Follow-up drafting',
        'Deal inspection',
        'Handoff notes',
      ],
      tools: ['Salesforce', 'Slack', 'Docs', 'Email'],
    };
  }

  return {
    tasks: [
      'Weekly reporting',
      'Cross-team coordination',
      'Status update preparation',
      'Information gathering',
    ],
    tools: ['Docs', 'Sheets', 'Slack', 'Email'],
  };
}

export function buildInitialAssistantMessage(
  profile: RunProfile,
  priorPatterns: TeamPattern[],
  interviewBrief?: InterviewBrief,
) {
  if (interviewBrief?.summary) {
    return `${interviewBrief.summary} I’ll use that as a starting point, and you can correct me anywhere your workflow is different.`;
  }

  if (priorPatterns.length > 0) {
    const pattern = priorPatterns[0];
    return `${pattern.respondentCount} teammate${pattern.respondentCount === 1 ? '' : 's'} on ${profile.team} mentioned ${pattern.recurringTasks.slice(0, 2).join(' and ')}. I’ll use that as a starting point, and you can correct me where your workflow is different.`;
  }

  return `We’ll focus on the work that eats time in your ${profile.roleTitle} role and turn it into something useful you can try right away.`;
}

export function buildInterviewSystemPrompt(
  state: WorkflowAuditState,
  priorPatterns: TeamPattern[],
  latestAnswer: string,
  recentMessages: StoredMessage[],
) {
  return [
    'You are the Interview Agent for a workflow audit.',
    'Return compact, actionable JSON only.',
    'Use the prior team patterns when they are relevant, but do not sound creepy or supervisory.',
    'Keep the next question short, concrete, and useful.',
    'Target a deeper but still bounded interview: usually 6-9 substantive turns after the opener.',
    'Use the early text questions to gather a richer base. Ask the user for 3-4 sentences when you need context, especially around the main workflow.',
    'Prefer mixed UI: alternate between short freeform answers and structured cards instead of running a pure pick-one flow.',
    'Do not ask the same conceptual question twice, even if you can phrase it differently.',
    'If the user gives multiple items, do not open a new branch for every item. Ask for a synthesis, dominant pattern, or highest-friction example instead.',
    'For the primary workflow, capture enough specificity to produce a strong recommendation: what triggers it, what output it creates, where it slows down, and either tools or collaborators.',
    'After that, go one click deeper where useful: ask for exceptions, rework, approvals, or the slice they would hand to AI first.',
    'Use multi_select when several factors genuinely matter together. Use chips for tools or collaborators. Use text when nuance matters. Use slider only after you have enough context to rank pain.',
    'If the user already answered what changes, why it takes longer, or what makes it hard, extract that and advance instead of re-asking.',
    'If two recent assistant questions are probing the same dimension, summarize what you learned and switch dimensions or switch workflows.',
    'Do not branch into a tree. Collapse multiple selected items into a single follow-up about the biggest source of rework or the most important shared pattern.',
    'Good deeper follow-ups: what input starts the workflow, what final artifact it needs to produce, what changes most across versions, where the exception path shows up, and what they would want AI to own first.',
    'Before asking a narrower follow-up, check whether the transcript already covers that dimension. If yes, move forward instead of paraphrasing the same question.',
    `Current profile: ${state.profile.roleTitle} on ${state.profile.team} in ${state.profile.department} at ${state.profile.companyName}.`,
    `Interview brief: ${JSON.stringify(state.interviewBrief)}`,
    `Org signals: ${JSON.stringify(state.orgSignals)}`,
    `Model confidence: ${JSON.stringify(state.modelConfidence)}`,
    `Prior team patterns: ${JSON.stringify(priorPatterns)}`,
    `Current state: ${JSON.stringify(state)}`,
    `Recent transcript: ${JSON.stringify(
      recentMessages.map((message) => ({
        role: message.role,
        content: message.content,
        cardKind: message.cardKind,
      })),
    )}`,
    `Latest answer: ${latestAnswer}`,
  ].join('\n');
}

export function buildSpecialistPrompt(state: WorkflowAuditState) {
  return [
    'You are the Workflow Specialist.',
    'Normalize the interview data into opportunities, workflow connections, and time-saving estimates.',
    'Work backward from the most painful recurring workflows.',
    `State: ${JSON.stringify(state)}`,
  ].join('\n');
}

export function buildRecommendationPrompt(
  state: WorkflowAuditState,
  specialistOutput: unknown,
  orgIntelligence: unknown,
) {
  return [
    'You are the Recommendation Agent.',
    'Take the specialist output and create a user-facing ranked opportunity list plus a ready-to-use prompt artifact.',
    'The artifact should feel specific enough to use today, not like a generic template.',
    'Choose the best delivery surface for the top workflow from: single_prompt, chatgpt_project, custom_gpt, scheduled_task.',
    'Choose the suggested model from the GPT-5.4 family only. Prefer gpt-5.4 for multi-step reasoning, messy synthesis, or cross-functional workflows. Prefer gpt-5.4-mini for lighter recurring drafting, cleanup, or scheduled runs.',
    'Explain why that surface fits, and include a short setup checklist the user can follow immediately.',
    'Make the prompt instructions concrete about inputs, outputs, constraints, and follow-ups.',
    'Include a compact roleImpact object that explains what this means for the user’s role, where they personally can get leverage, which AI-ready habits or skills are worth building, and one grounded message they can act on.',
    `State: ${JSON.stringify(state)}`,
    `Specialist output: ${JSON.stringify(specialistOutput)}`,
    `Org workflow expert output: ${JSON.stringify(orgIntelligence)}`,
  ].join('\n');
}
