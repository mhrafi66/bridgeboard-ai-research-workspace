export const PORTFOLIO_DEMO = !import.meta.env.VITE_API_URL

export function buildDemoContext() {
  return {
    language: { code: 'en', score: 0.99 },
    entities: [
      { text: 'Dataset A', type: 'OTHER', score: 0.96 },
      { text: 'Dataset B', type: 'OTHER', score: 0.96 },
      { text: 'Architecture A', type: 'OTHER', score: 0.92 },
      { text: 'Architecture B', type: 'OTHER', score: 0.92 },
    ],
    keyPhrases: [
      { text: 'geographic concentration', score: 0.96 },
      { text: 'distribution shift', score: 0.95 },
      { text: 'model architecture', score: 0.93 },
      { text: 'matched evaluation', score: 0.90 },
    ],
    warning: 'Portfolio demo mode uses precomputed synthetic output. The original hackathon deployment used Amazon Comprehend.',
    generatedBy: 'Portfolio demo · original deployment: Amazon Comprehend',
  }
}

export function buildDemoAnalysis(entries = []) {
  const normalized = entries.filter((entry) => entry?.text?.trim())
  const speakers = normalized.map((entry) => entry.speaker || 'Researcher')
  const contributions = normalized.map((entry, index) => ({
    speaker: entry.speaker || `Researcher ${index + 1}`,
    type: index === 2 ? 'criticism' : 'hypothesis',
    claim: entry.text,
    topics: index === 2
      ? ['architecture', 'alternative explanation']
      : ['data distribution', 'generalization'],
  }))

  return {
    researchQuestion: 'Is the observed performance gap driven primarily by geographic distribution shift, model architecture, or an interaction between the two?',
    contributions,
    positions: [
      {
        label: 'Distribution-shift hypothesis',
        claim: 'Dataset B may generalize poorly because its training coverage is geographically concentrated.',
        supporters: speakers.slice(0, 2),
        supportingEvidence: [
          'Dataset B is described as covering fewer training locations than Dataset A.',
        ],
      },
      {
        label: 'Architecture hypothesis',
        claim: 'Architecture B may contribute independently to the performance gap.',
        supporters: speakers.slice(2, 3),
        supportingEvidence: [
          'Architecture B is reported to underperform Architecture A even on the same dataset.',
        ],
      },
    ],
    agreements: [
      {
        researchers: speakers.slice(0, 2),
        summary: 'Training-data coverage is a plausible contributor that should be isolated experimentally.',
      },
    ],
    disagreements: [
      {
        researchers: [speakers[0] || 'Researcher 1', speakers[2] || 'Researcher 3'],
        summary: 'The discussion does not yet isolate data distribution from architecture as the dominant cause.',
        status: 'unresolved',
      },
    ],
    openQuestions: [
      'Does Architecture B still underperform when both models are trained on the same geographically diverse data?',
      'How much of the gap remains after matching sample counts across datasets?',
    ],
    recommendedExperiment: {
      title: 'Matched-factor ablation',
      goal: 'Separate the effects of architecture and geographic coverage.',
      control: 'Hold dataset size, train/validation split, optimizer, and evaluation regions fixed.',
      variable: 'Model architecture and training-region coverage.',
      metric: 'Per-region accuracy and the cross-region performance variance.',
      procedure: [
        'Train both architectures on the same matched subset of Dataset A.',
        'Repeat with a geographically restricted subset matched to Dataset B.',
        'Evaluate both models on the same held-out regions.',
        'Compare overall performance and region-wise variance.',
      ],
      interpretation: 'If the architecture gap remains under matched data, architecture contributes independently; if regional variance grows mainly under restricted coverage, the data distribution is a primary driver.',
    },
    facilitatorNote: 'The discussion contains two plausible explanations. A matched-factor ablation is the clearest next step because it can distinguish them without requiring consensus first.',
    generatedBy: 'Portfolio demo · original deployment: Amazon Bedrock Converse',
  }
}

export function buildDemoCritic() {
  return {
    summary: 'The reasoning identifies plausible competing explanations, but the current evidence does not yet quantify the independent effects of architecture, sample size, and geographic coverage.',
    strengths: [
      'The discussion preserves competing hypotheses instead of forcing agreement.',
      'The proposed comparison naturally supports a controlled ablation.',
    ],
    concerns: [
      {
        category: 'confounder',
        severity: 'high',
        target: 'The claim that geographic concentration is the main cause.',
        problem: 'Dataset size and geographic coverage may vary together.',
        whyItMatters: 'A performance gap could be attributed to geography when it is partly caused by sample count.',
        suggestedCheck: 'Match sample counts and training regions independently before comparing models.',
      },
      {
        category: 'insufficient-evidence',
        severity: 'medium',
        target: 'The architecture explanation.',
        problem: 'One same-dataset comparison is not enough to estimate the architecture effect robustly.',
        whyItMatters: 'The result may depend on a particular split or random seed.',
        suggestedCheck: 'Repeat matched experiments across multiple seeds and report confidence intervals.',
      },
    ],
    missingEvidence: [
      'Repeated runs across seeds.',
      'A matched-sample comparison.',
      'Per-region uncertainty estimates.',
    ],
    recommendedControls: [
      'Equal training sample counts.',
      'Identical optimization settings.',
      'Identical evaluation regions and metrics.',
    ],
    alternativeExplanations: [
      'Sample-size imbalance.',
      'Different regional feature distributions unrelated to geography itself.',
    ],
    followUpQuestions: [
      'Which factor explains the largest share of regional variance?',
      'Does the conclusion persist across seeds?',
    ],
    criticNote: 'Treat the current discussion as hypothesis formation; run the matched ablation before making a causal claim.',
    generatedBy: 'Portfolio demo · original deployment: Amazon Bedrock scientific-critic prompt',
  }
}

export function buildDemoFacilitator() {
  return {
    roomStatus: 'contested',
    priorityIssue: 'The team has not yet separated architecture effects from data-distribution effects.',
    overlookedContribution: {
      speaker: 'Chen',
      summary: 'The same-dataset architecture comparison is important because it challenges a data-only explanation.',
    },
    unresolvedConflict: 'Whether geographic coverage or architecture is the dominant source of the performance gap.',
    evidenceGap: 'A matched-factor experiment that controls sample count and training coverage.',
    nextAction: {
      type: 'experiment',
      title: 'Run the matched architecture × coverage ablation',
      rationale: 'It directly tests both hypotheses with one controlled experiment and can quantify their independent contributions.',
    },
    facilitatorMessage: 'Keep both hypotheses active. Run the matched ablation before treating either explanation as settled.',
    generatedBy: 'Portfolio demo · original deployment: Amazon Bedrock AgentCore facilitator',
  }
}
