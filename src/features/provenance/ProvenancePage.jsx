import { useState, useEffect } from 'react'
import { listExperiments, createExperiment, deleteExperiment } from '../../lib/api'
import './ProvenancePage.css'

/* ── Synthetic Data ──────────────────────────── */

const RUNS = [
  {
    id: 'RUN-2024-0847',
    status: 'completed',
    time: '12 min ago',
    timestamp: '2024-09-17 14:32 UTC',
    pipeline: 'geographic-eval v2.1',
    pipelineDesc: 'Regional performance evaluation across all 7 geographic zones',
    model: 'climate-resnet-v4 (ep_200)',
    modelFile: 'ep_200_v4.pt',
    dataset: 'Dataset A v3.2',
    datasetVersion: 'v3.2',
    triggeredBy: { name: 'Mumtahin Chen', initials: 'MC', color: 'coral' },
    paper: 'Geographic Bias in Neural Climate Models',
    outputs: 4,
    figures: 3,
    commit: 'a3f7b2c',
    branch: 'feature/regional-eval',
    duration: '47m 23s',
    gpu: 'A100 x2',
    peakMemory: '31.4 GB',
    metrics: { rmse: '0.0342', r2: '0.9214', mae: '0.0187' },
  },
  {
    id: 'RUN-2024-0846',
    status: 'completed',
    time: '1.5 hr ago',
    timestamp: '2024-09-17 13:02 UTC',
    pipeline: 'ablation-matched v1.3',
    pipelineDesc: 'Architecture B trained on 7-region Dataset A with matched sample sizes',
    model: 'arch-b-ablation (ep_150)',
    modelFile: 'arch_b_ablation_ep150.pt',
    dataset: 'Training Subset A-matched v1.0',
    datasetVersion: 'v1.0',
    triggeredBy: { name: 'Jordan Ellis', initials: 'JE', color: 'blue' },
    paper: 'Architecture-Independent Distribution Shift Detection',
    outputs: 2,
    figures: 2,
    commit: 'e91c4d8',
    branch: 'experiment/ablation-matched',
    duration: '2h 11m',
    gpu: 'A100 x4',
    peakMemory: '58.2 GB',
    metrics: { rmse: '0.0518', r2: '0.8743', mae: '0.0291' },
  },
  {
    id: 'RUN-2024-0845',
    status: 'running',
    time: '2 hr ago',
    timestamp: '2024-09-17 12:30 UTC',
    pipeline: 'distribution-shift-detect v3.0',
    pipelineDesc: 'Cross-domain distribution shift detection with KL divergence metrics',
    model: 'shift-detector-v3 (ep_80)',
    modelFile: 'shift_det_v3_ep80.pt',
    dataset: 'Dataset A v3.2 + Dataset B v2.1',
    datasetVersion: 'v3.2 / v2.1',
    triggeredBy: { name: 'Mumtahin Chen', initials: 'MC', color: 'coral' },
    paper: null,
    outputs: 0,
    figures: 0,
    commit: 'b7d2f1a',
    branch: 'feature/shift-detection',
    duration: 'running (est. 1h 20m left)',
    gpu: 'A100 x2',
    peakMemory: '27.8 GB',
    metrics: null,
  },
  {
    id: 'RUN-2024-0844',
    status: 'completed',
    time: '5 hr ago',
    timestamp: '2024-09-17 09:15 UTC',
    pipeline: 'sample-size-sensitivity v1.1',
    pipelineDesc: 'Sample size sensitivity analysis with bootstrapped confidence intervals',
    model: 'climate-resnet-v4 (ep_200)',
    modelFile: 'ep_200_v4.pt',
    dataset: 'Dataset B v2.1',
    datasetVersion: 'v2.1',
    triggeredBy: { name: 'Ari Singh', initials: 'AS', color: 'gold' },
    paper: 'Sample Size Effects on Regional Generalization',
    outputs: 3,
    figures: 2,
    commit: 'c4e8a93',
    branch: 'analysis/sample-sensitivity',
    duration: '33m 07s',
    gpu: 'A100 x1',
    peakMemory: '14.1 GB',
    metrics: { rmse: '0.0621', r2: '0.8102', mae: '0.0388' },
  },
  {
    id: 'RUN-2024-0843',
    status: 'failed',
    time: '6 hr ago',
    timestamp: '2024-09-17 08:44 UTC',
    pipeline: 'geographic-eval v2.1',
    pipelineDesc: 'Regional evaluation with extended tropical zone coverage',
    model: 'climate-resnet-v4 (ep_180)',
    modelFile: 'ep_180_v4.pt',
    dataset: 'Dataset A v3.1',
    datasetVersion: 'v3.1 (deprecated)',
    triggeredBy: { name: 'Jordan Ellis', initials: 'JE', color: 'blue' },
    paper: null,
    outputs: 0,
    figures: 0,
    commit: 'd2a1b7e',
    branch: 'feature/regional-eval',
    duration: '4m 52s (error)',
    gpu: 'A100 x2',
    peakMemory: '2.3 GB',
    metrics: null,
    error: 'CUDA OOM on region 6 (tropical-pacific). Batch size exceeded GPU memory. Suggested fix: reduce batch_size from 256 to 128.',
  },
  {
    id: 'RUN-2024-0842',
    status: 'completed',
    time: '9 hr ago',
    timestamp: '2024-09-17 05:30 UTC',
    pipeline: 'metadata-enrichment v1.0',
    pipelineDesc: 'Climate metadata feature extraction and enrichment for training augmentation',
    model: 'feature-extractor-v2 (ep_50)',
    modelFile: 'feat_ext_v2_ep50.pt',
    dataset: 'Climate Metadata v1.4',
    datasetVersion: 'v1.4',
    triggeredBy: { name: 'Priya Nair', initials: 'PN', color: 'teal' },
    paper: 'Geographic Bias in Neural Climate Models',
    outputs: 1,
    figures: 1,
    commit: 'f8c3d21',
    branch: 'data/metadata-pipeline',
    duration: '18m 44s',
    gpu: 'A100 x1',
    peakMemory: '8.7 GB',
    metrics: { coverage: '98.2%', nullRate: '0.3%' },
  },
  {
    id: 'RUN-2024-0841',
    status: 'completed',
    time: '14 hr ago',
    timestamp: '2024-09-16 22:10 UTC',
    pipeline: 'geographic-eval v2.0',
    pipelineDesc: 'Baseline geographic evaluation before pipeline v2.1 upgrade',
    model: 'climate-resnet-v3 (ep_200)',
    modelFile: 'ep_200_v3.pt',
    dataset: 'Dataset A v3.2',
    datasetVersion: 'v3.2',
    triggeredBy: { name: 'Mumtahin Chen', initials: 'MC', color: 'coral' },
    paper: 'Geographic Bias in Neural Climate Models',
    outputs: 4,
    figures: 3,
    commit: '9a2e4bc',
    branch: 'main',
    duration: '52m 11s',
    gpu: 'A100 x2',
    peakMemory: '29.8 GB',
    metrics: { rmse: '0.0398', r2: '0.9041', mae: '0.0215' },
  },
]

const PAPERS = [
  {
    id: 'paper-1',
    title: 'Geographic Bias in Neural Climate Models',
    venue: 'Nature Climate Change',
    stage: 'submitted',
    stageLabel: 'Submitted',
    runs: 12,
    figures: 8,
    datasets: 3,
    lastRun: '12 min ago',
    chain: [
      { type: 'figure', icon: '\u{1F4CA}', label: 'Figure 3', detail: 'Heatmap' },
      { type: 'run', icon: '▶', label: 'RUN-0847', detail: 'geographic-eval' },
      { type: 'dataset', icon: '\u{1F4BE}', label: 'Dataset A', detail: 'v3.2' },
      { type: 'model', icon: '⚙', label: 'Checkpoint', detail: 'ep_200_v4.pt' },
      { type: 'commit', icon: '\u{1F517}', label: 'Commit', detail: 'a3f7b2c' },
    ],
  },
  {
    id: 'paper-2',
    title: 'Architecture-Independent Distribution Shift Detection',
    venue: 'ICML 2025 (target)',
    stage: 'draft',
    stageLabel: 'Draft',
    runs: 8,
    figures: 5,
    datasets: 2,
    lastRun: '1.5 hr ago',
    chain: [
      { type: 'figure', icon: '\u{1F4CA}', label: 'Figure 1', detail: 'Shift plot' },
      { type: 'run', icon: '▶', label: 'RUN-0846', detail: 'ablation-matched' },
      { type: 'dataset', icon: '\u{1F4BE}', label: 'Subset A', detail: 'v1.0' },
      { type: 'model', icon: '⚙', label: 'Checkpoint', detail: 'arch_b_ablation' },
      { type: 'commit', icon: '\u{1F517}', label: 'Commit', detail: 'e91c4d8' },
    ],
  },
  {
    id: 'paper-3',
    title: 'Sample Size Effects on Regional Generalization',
    venue: 'Internal review',
    stage: 'review',
    stageLabel: 'Internal Review',
    runs: 6,
    figures: 3,
    datasets: 2,
    lastRun: '5 hr ago',
    chain: [
      { type: 'figure', icon: '\u{1F4CA}', label: 'Figure 2', detail: 'CI bands' },
      { type: 'run', icon: '▶', label: 'RUN-0844', detail: 'sample-sensitivity' },
      { type: 'dataset', icon: '\u{1F4BE}', label: 'Dataset B', detail: 'v2.1' },
      { type: 'model', icon: '⚙', label: 'Checkpoint', detail: 'ep_200_v4.pt' },
      { type: 'commit', icon: '\u{1F517}', label: 'Commit', detail: 'c4e8a93' },
    ],
  },
]

const DATASETS = [
  {
    name: 'Regional Climate Observations (Dataset A)',
    version: 'v3.2',
    regions: 7,
    samples: '142,340',
    size: '2.3 GB',
    lastUsed: '12 min ago',
    status: 'active',
  },
  {
    name: 'Urban Station Readings (Dataset B)',
    version: 'v2.1',
    regions: 2,
    samples: '23,108',
    size: '384 MB',
    lastUsed: '5 hr ago',
    status: 'active',
  },
  {
    name: 'Climate Metadata Catalog',
    version: 'v1.4',
    regions: 7,
    samples: 'auxiliary',
    size: '156 MB',
    lastUsed: '9 hr ago',
    status: 'active',
  },
  {
    name: 'Training Subset A-matched',
    version: 'v1.0',
    regions: 7,
    samples: '23,108',
    size: '372 MB',
    lastUsed: '1.5 hr ago',
    status: 'derived',
  },
]

const CHAIN_STEPS = [
  { type: 'figure', icon: '\u{1F4CA}', label: 'Figure 3', detail: 'Regional Performance Heatmap', sublabel: 'Paper Fig. 3' },
  { type: 'run', icon: '▶', label: 'RUN-2024-0847', detail: 'geographic-eval v2.1', sublabel: '47m 23s' },
  { type: 'dataset', icon: '\u{1F4BE}', label: 'Dataset A', detail: 'v3.2 -- 142K samples', sublabel: '7 regions' },
  { type: 'model', icon: '⚙', label: 'Model Checkpoint', detail: 'ep_200_v4.pt', sublabel: 'climate-resnet-v4' },
  { type: 'commit', icon: '\u{1F517}', label: 'Git Commit', detail: 'a3f7b2c', sublabel: 'feature/regional-eval' },
  { type: 'pipeline', icon: '\u{1F504}', label: 'Pipeline Config', detail: 'geographic-eval v2.1', sublabel: 'YAML locked' },
]

const EXPORT_ITEMS = [
  { icon: '\u{1F4BE}', label: 'All linked datasets (version-locked)' },
  { icon: '⚙', label: 'Model checkpoints' },
  { icon: '\u{1F4CB}', label: 'Pipeline configurations' },
  { icon: '\u{1F4C4}', label: 'Run logs and outputs' },
  { icon: '\u{1F517}', label: 'Git diff from base' },
  { icon: '\u{1F4E6}', label: 'Environment specification (conda + pip)' },
]

const EXPERIMENTS = [
  {
    id: 'EXP-001',
    title: 'Geographic Bias Ablation Study',
    description: 'Testing if geographic distribution in training data causes performance degradation in unseen regions',
    status: 'completed',
    lead: { name: 'Mumtahin Chen', initials: 'MC', color: 'coral' },
    startDate: 'Aug 12, 2024',
    endDate: 'Sep 14, 2024',
    runs: 12,
    hypothesis: 'Models trained on geographically concentrated data will show >15% performance drop on unseen regions',
    result: 'Confirmed - 18% average drop across 5 unseen regions',
    datasets: ['Dataset A v3.2', 'Dataset B v2.1'],
    papers: ['Geographic Bias in Neural Climate Models'],
    tags: ['bias', 'distribution-shift', 'geographic'],
  },
  {
    id: 'EXP-002',
    title: 'Architecture-Independent Evaluation',
    description: 'Comparing Architecture A vs B performance when controlling for dataset distribution',
    status: 'completed',
    lead: { name: 'Jordan Ellis', initials: 'JE', color: 'blue' },
    startDate: 'Aug 28, 2024',
    endDate: 'Sep 16, 2024',
    runs: 8,
    hypothesis: 'Architecture differences account for <5% of performance variance after controlling for data distribution',
    result: 'Partially confirmed - architecture accounts for 7.2% variance',
    datasets: ['Training Subset A-matched v1.0'],
    papers: ['Architecture-Independent Distribution Shift Detection'],
    tags: ['architecture', 'evaluation', 'controlled'],
  },
  {
    id: 'EXP-003',
    title: 'Sample Size Confounding Analysis',
    description: 'Testing whether Dataset B underperformance is due to 3x fewer samples per region rather than geographic concentration',
    status: 'running',
    lead: { name: 'Mumtahin Chen', initials: 'MC', color: 'coral' },
    startDate: 'Sep 10, 2024',
    endDate: null,
    runs: 3,
    hypothesis: 'Downsampling Dataset A to match Dataset B sample counts will reproduce the performance gap',
    result: null,
    datasets: ['Dataset A v3.2', 'Dataset B v2.1', 'Training Subset A-matched v1.0'],
    papers: [],
    tags: ['confounders', 'sample-size', 'methodology'],
    progress: 45,
  },
  {
    id: 'EXP-004',
    title: 'Cross-Domain Distribution Shift Detection',
    description: 'Building a detection pipeline that flags when inference data diverges from training distribution',
    status: 'running',
    lead: { name: 'Maria Lopez', initials: 'ML', color: 'teal' },
    startDate: 'Sep 5, 2024',
    endDate: null,
    runs: 5,
    hypothesis: 'KL divergence threshold of 0.3 reliably detects distribution shift with <5% false positive rate',
    result: null,
    datasets: ['Dataset A v3.2', 'Climate Metadata Catalog v1.4'],
    papers: [],
    tags: ['detection', 'distribution-shift', 'monitoring'],
    progress: 68,
  },
  {
    id: 'EXP-005',
    title: 'Federated Learning Convergence Study',
    description: 'Testing convergence behavior of federated learning across 3 geographically distributed sites',
    status: 'planned',
    lead: { name: 'Chen Wei', initials: 'CW', color: 'purple' },
    startDate: null,
    endDate: null,
    runs: 0,
    hypothesis: 'Federated training achieves within 2% of centralized performance with 5x less data transfer',
    result: null,
    datasets: ['Dataset A v3.2'],
    papers: [],
    tags: ['federated', 'distributed', 'privacy'],
  },
  {
    id: 'EXP-006',
    title: 'Climate Feature Importance Analysis',
    description: 'Identifying which climate variables most influence model predictions across different regions',
    status: 'planned',
    lead: { name: 'Ari Singh', initials: 'AS', color: 'gold' },
    startDate: null,
    endDate: null,
    runs: 0,
    hypothesis: 'Temperature and precipitation features dominate in coastal regions while elevation drives inland predictions',
    result: null,
    datasets: ['Climate Metadata Catalog v1.4'],
    papers: [],
    tags: ['interpretability', 'features', 'regional'],
  },
  {
    id: 'EXP-007',
    title: 'Temporal Stability of Geographic Bias',
    description: 'Measuring whether geographic performance gaps widen or narrow over time as new data arrives',
    status: 'failed',
    lead: { name: 'Jordan Ellis', initials: 'JE', color: 'blue' },
    startDate: 'Jul 20, 2024',
    endDate: 'Aug 5, 2024',
    runs: 4,
    hypothesis: 'Performance gap narrows by >10% when adding 6 months of new regional data',
    result: 'Inconclusive - data quality issues in 3 of 7 regions invalidated results. Need to re-run with cleaned data.',
    datasets: ['Dataset A v3.2'],
    papers: [],
    tags: ['temporal', 'longitudinal', 'data-quality'],
  },
  {
    id: 'EXP-008',
    title: 'Causal Inference for Environmental Health',
    description: 'Applying causal inference methods to identify environmental health impacts across geographic regions',
    status: 'completed',
    lead: { name: 'Maria Lopez', initials: 'ML', color: 'teal' },
    startDate: 'Jul 1, 2024',
    endDate: 'Sep 1, 2024',
    runs: 15,
    hypothesis: 'Instrumental variable approach isolates environmental exposure effects with p<0.05',
    result: 'Confirmed - IV estimates show significant causal effect (p=0.003) after controlling for socioeconomic confounders',
    datasets: ['Dataset A v3.2', 'Climate Metadata Catalog v1.4'],
    papers: ['Causal Inference in Geographic Neural Networks'],
    tags: ['causal', 'health', 'environment'],
  },
]

const AUTO_TRACKED_RUNS = new Set(['RUN-2024-0846', 'RUN-2024-0844', 'RUN-2024-0842'])

const PIPELINE_OPTIONS = [
  'geographic-eval',
  'architecture-compare',
  'ablation-study',
  'data-preprocessing',
]

/* ── Component ───────────────────────────────── */

export default function ProvenancePage() {
  const [activeTab, setActiveTab] = useState('timeline')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedRun, setExpandedRun] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [showLogRunModal, setShowLogRunModal] = useState(false)
  const [customRuns, setCustomRuns] = useState([])
  const [apiExperiments, setApiExperiments] = useState([])
  const [logRunForm, setLogRunForm] = useState({
    pipelineName: 'geographic-eval',
    datasetVersion: '',
    modelCheckpoint: '',
    gitCommitHash: '',
    description: '',
  })

  useEffect(() => {
    listExperiments()
      .then((entries) => setApiExperiments(entries))
      .catch(() => {})
  }, [])

  const allExperiments = [
    ...apiExperiments.map((e) => ({
      id: e.sk,
      title: e.title,
      description: e.hypothesis || '',
      status: e.status || 'planned',
      lead: e.contributor
        ? { name: e.contributor.name || 'Unknown', initials: (e.contributor.name || 'U').slice(0, 2).toUpperCase(), color: 'blue' }
        : { name: 'Unknown', initials: 'UN', color: 'blue' },
      startDate: e.startDate || null,
      endDate: e.endDate || null,
      runs: 0,
      hypothesis: e.hypothesis || '',
      result: e.result || null,
      datasets: [],
      papers: [],
      tags: e.tags || [],
      progress: e.progress || 0,
      sk: e.sk,
    })),
    ...EXPERIMENTS,
  ]

  const allRuns = [...customRuns, ...RUNS]

  const filteredRuns =
    statusFilter === 'all'
      ? allRuns
      : allRuns.filter((r) => r.status === statusFilter)

  const handleExport = () => {
    setExporting(true)
    setExported(false)
    setTimeout(() => {
      setExporting(false)
      setExported(true)
    }, 2200)
  }

  const toggleExpand = (runId) => {
    setExpandedRun(expandedRun === runId ? null : runId)
  }

  const handleLogRunSubmit = (e) => {
    e.preventDefault()
    const now = new Date()
    const ts = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
    const newRun = {
      id: `RUN-2024-${String(848 + customRuns.length).padStart(4, '0')}`,
      status: 'running',
      time: 'just now',
      timestamp: ts,
      pipeline: logRunForm.pipelineName,
      pipelineDesc: logRunForm.description || 'Manually logged run',
      model: logRunForm.modelCheckpoint || 'custom-checkpoint',
      modelFile: logRunForm.modelCheckpoint || 'custom.pt',
      dataset: logRunForm.datasetVersion
        ? DATASETS.find((d) => d.version === logRunForm.datasetVersion)?.name +
          ' ' +
          logRunForm.datasetVersion
        : 'Custom dataset',
      datasetVersion: logRunForm.datasetVersion || 'custom',
      triggeredBy: { name: 'You', initials: 'YO', color: 'gold' },
      paper: null,
      outputs: 0,
      figures: 0,
      commit: logRunForm.gitCommitHash || 'HEAD',
      branch: 'manual',
      duration: 'running',
      gpu: 'A100 x1',
      peakMemory: '--',
      metrics: null,
    }
    setCustomRuns((prev) => [newRun, ...prev])
    createExperiment({
      title: logRunForm.pipelineName,
      pipeline: logRunForm.pipelineName,
      description: logRunForm.description || 'Manually logged run',
      model: logRunForm.modelCheckpoint || 'custom-checkpoint',
      dataset: logRunForm.datasetVersion || 'custom',
      gitCommit: logRunForm.gitCommitHash || 'HEAD',
      status: 'running',
    }).catch(() => {})
    setShowLogRunModal(false)
    setLogRunForm({
      pipelineName: 'geographic-eval',
      datasetVersion: '',
      modelCheckpoint: '',
      gitCommitHash: '',
      description: '',
    })
  }

  const updateFormField = (field, value) => {
    setLogRunForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="prov-page">
      {/* ── Header ─────────────────────────────── */}
      <header className="prov-header">
        <div className="prov-kicker">
          <span className="prov-kicker-dot" />
          REPRODUCIBILITY &amp; PROVENANCE
        </div>
        <h1 className="prov-title">
          Trace every result{' '}
          <em>to its source.</em>
        </h1>
        <p className="prov-subtitle">
          Every experimental run is version-locked and linked to papers,
          datasets, model checkpoints, and git commits. Any published figure
          can be traced back through the exact pipeline that produced it,
          and exported as a FAIR-compliant reproducibility package.
        </p>
        <div className="prov-header-actions">
          <button
            className="prov-log-run-btn"
            onClick={() => setShowLogRunModal(true)}
          >
            + Log Run
          </button>
        </div>
      </header>

      {/* ── Stats Row ──────────────────────────── */}
      <div className="prov-stats">
        <div className="prov-stat-card">
          <span className="prov-stat-label">Total Runs</span>
          <div className="prov-stat-value">
            <span className="prov-stat-number">47</span>
            <span className="prov-stat-unit">this month</span>
          </div>
          <div className="prov-stat-bar">
            <span className="fill-purple" style={{ width: '72%' }} />
          </div>
        </div>
        <div className="prov-stat-card">
          <span className="prov-stat-label">Papers Linked</span>
          <div className="prov-stat-value">
            <span className="prov-stat-number">6</span>
            <span className="prov-stat-unit">active</span>
          </div>
          <div className="prov-stat-bar">
            <span className="fill-coral" style={{ width: '50%' }} />
          </div>
        </div>
        <div className="prov-stat-card">
          <span className="prov-stat-label">Datasets Versioned</span>
          <div className="prov-stat-value">
            <span className="prov-stat-number">12</span>
            <span className="prov-stat-unit">across 4 projects</span>
          </div>
          <div className="prov-stat-bar">
            <span className="fill-blue" style={{ width: '65%' }} />
          </div>
        </div>
        <div className="prov-stat-card">
          <span className="prov-stat-label">Reproducibility Score</span>
          <div className="prov-stat-value">
            <span className="prov-stat-number">94%</span>
            <span className="prov-stat-unit" style={{ color: '#1d8102' }}>
              +3% this week
            </span>
          </div>
          <div className="prov-stat-bar">
            <span className="fill-green" style={{ width: '94%' }} />
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────── */}
      <div className="prov-tabs">
        {['timeline', 'papers', 'datasets', 'experiments'].map((tab) => (
          <button
            key={tab}
            className={
              'prov-tab' + (activeTab === tab ? ' active' : '')
            }
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'timeline' && '⏱ Timeline'}
            {tab === 'papers' && '\u{1F4C4} Papers'}
            {tab === 'datasets' && '\u{1F4BE} Datasets'}
            {tab === 'experiments' && '⚗ Experiments'}
          </button>
        ))}
      </div>

      {/* ── Timeline View ──────────────────────── */}
      {activeTab === 'timeline' && (
        <>
          {/* Auto-tracking banner */}
          <div className="prov-timeline-banner">
            <span className="prov-timeline-banner-icon">{'✦'}</span>
            Runs are automatically tracked when you use{' '}
            <strong>/analyze</strong>, <strong>/ask</strong>, or{' '}
            <strong>/search</strong> commands in the Research Hub.
          </div>

          <div className="prov-filter-bar">
            <div className="prov-filter-left">
              <span className="prov-filter-label">Filter by status:</span>
              <select
                className="prov-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Runs</option>
                <option value="completed">Completed</option>
                <option value="running">Running</option>
                <option value="failed">Failed</option>
                <option value="queued">Queued</option>
              </select>
            </div>
            <span className="prov-run-count">
              Showing {filteredRuns.length} of {allRuns.length} runs
            </span>
          </div>

          <div className="prov-timeline">
            {filteredRuns.map((run) => (
              <div className="prov-run-card" key={run.id}>
                <div className="prov-run-dot-wrap">
                  <div
                    className={
                      'prov-run-dot ' + run.status
                    }
                  />
                </div>
                <div
                  className="prov-run-body"
                  onClick={() => toggleExpand(run.id)}
                >
                  <div className="prov-run-top">
                    <span className="prov-run-id">{run.id}</span>
                    <span
                      className={
                        'prov-status-pill ' + run.status
                      }
                    >
                      {run.status}
                    </span>
                    {AUTO_TRACKED_RUNS.has(run.id) && (
                      <span className="prov-auto-tracked-badge">
                        {'✦'} Linked from Research Hub
                      </span>
                    )}
                    <span className="prov-run-time">
                      {run.time}
                    </span>
                  </div>

                  <div className="prov-run-pipeline">
                    <strong>{run.pipeline}</strong>
                    {' -- '}
                    {run.pipelineDesc}
                  </div>

                  <div className="prov-run-details">
                    <span className="prov-detail-chip">
                      <span className="chip-icon">{'⚙'}</span>
                      {run.model}
                    </span>
                    <span className="prov-detail-chip">
                      <span className="chip-icon">{'\u{1F4BE}'}</span>
                      {run.dataset}
                    </span>
                    <span className="prov-detail-chip">
                      <span className="chip-icon">{'\u{1F517}'}</span>
                      <code>{run.commit}</code>
                    </span>
                    {run.outputs > 0 && (
                      <span className="prov-detail-chip">
                        <span className="chip-icon">{'\u{1F4CA}'}</span>
                        {run.figures} figures, {run.outputs} outputs
                      </span>
                    )}
                  </div>

                  <div className="prov-run-footer">
                    <div
                      className={
                        'prov-run-avatar ' +
                        run.triggeredBy.color
                      }
                    >
                      {run.triggeredBy.initials}
                    </div>
                    <span className="prov-run-who">
                      <strong>{run.triggeredBy.name}</strong>
                    </span>
                    {run.paper && (
                      <span className="prov-run-paper-link">
                        {'\u{1F4C4}'} {run.paper.length > 35
                          ? run.paper.slice(0, 35) + '...'
                          : run.paper}
                      </span>
                    )}
                  </div>

                  {/* ── Expanded Details ──────── */}
                  {expandedRun === run.id && (
                    <div className="prov-run-expanded">
                      <div className="prov-run-expanded-title">
                        Run Details
                      </div>
                      <div className="prov-expanded-grid">
                        <div className="prov-expanded-item">
                          <label>Timestamp</label>
                          <span>{run.timestamp}</span>
                        </div>
                        <div className="prov-expanded-item">
                          <label>Duration</label>
                          <span>{run.duration}</span>
                        </div>
                        <div className="prov-expanded-item">
                          <label>GPU</label>
                          <span>{run.gpu}</span>
                        </div>
                        <div className="prov-expanded-item">
                          <label>Peak Memory</label>
                          <span>{run.peakMemory}</span>
                        </div>
                        <div className="prov-expanded-item">
                          <label>Branch</label>
                          <code>{run.branch}</code>
                        </div>
                        <div className="prov-expanded-item">
                          <label>Model Checkpoint</label>
                          <code>{run.modelFile}</code>
                        </div>
                        {run.metrics && (
                          <div className="prov-expanded-item">
                            <label>Metrics</label>
                            <span>
                              {Object.entries(run.metrics)
                                .map(
                                  ([k, v]) =>
                                    k.toUpperCase() + ': ' + v
                                )
                                .join(' | ')}
                            </span>
                          </div>
                        )}
                        {run.error && (
                          <div
                            className="prov-expanded-item"
                            style={{ gridColumn: '1 / -1' }}
                          >
                            <label style={{ color: '#d13212' }}>
                              Error
                            </label>
                            <span style={{ color: '#d13212' }}>
                              {run.error}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Papers View ────────────────────────── */}
      {activeTab === 'papers' && (
        <>
          <div className="prov-section-header">
            <h2>Paper-Run Linkage</h2>
            <span className="prov-run-count">
              {PAPERS.length} papers tracked
            </span>
          </div>
          <div className="prov-papers">
            {PAPERS.map((paper) => (
              <div className="prov-paper-card" key={paper.id}>
                <div className="prov-paper-top">
                  <h3 className="prov-paper-title">
                    {paper.title}
                  </h3>
                  <span
                    className={
                      'prov-paper-stage ' + paper.stage
                    }
                  >
                    {paper.stageLabel}
                  </span>
                </div>
                <div className="prov-paper-venue">
                  {paper.venue}
                </div>
                <div className="prov-paper-metrics">
                  <div className="prov-paper-metric">
                    <span className="prov-paper-metric-label">
                      Linked Runs
                    </span>
                    <span className="prov-paper-metric-value">
                      {paper.runs}
                    </span>
                  </div>
                  <div className="prov-paper-metric">
                    <span className="prov-paper-metric-label">
                      Figures
                    </span>
                    <span className="prov-paper-metric-value">
                      {paper.figures}
                    </span>
                  </div>
                  <div className="prov-paper-metric">
                    <span className="prov-paper-metric-label">
                      Datasets
                    </span>
                    <span className="prov-paper-metric-value">
                      {paper.datasets}
                    </span>
                  </div>
                  <div className="prov-paper-metric">
                    <span className="prov-paper-metric-label">
                      Last Run
                    </span>
                    <span className="prov-paper-metric-value" style={{ fontSize: 12 }}>
                      {paper.lastRun}
                    </span>
                  </div>
                </div>

                {/* Mini provenance chain */}
                <div className="prov-chain-mini">
                  {paper.chain.map((node, idx) => (
                    <span key={idx} style={{ display: 'contents' }}>
                      <span className="prov-chain-node">
                        <span className="node-icon">
                          {node.icon}
                        </span>
                        <strong>{node.label}</strong>
                        <span style={{ color: '#d5dbdb', fontSize: 9 }}>
                          {node.detail}
                        </span>
                      </span>
                      {idx < paper.chain.length - 1 && (
                        <span className="prov-chain-arrow">
                          {'→'}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Datasets View ──────────────────────── */}
      {activeTab === 'datasets' && (
        <>
          <div className="prov-section-header">
            <h2>Dataset Registry</h2>
            <span className="prov-run-count">
              {DATASETS.length} versioned datasets
            </span>
          </div>
          <div className="prov-dataset-head">
            <span>Dataset</span>
            <span>Version</span>
            <span>Coverage</span>
            <span>Last Used</span>
            <span />
          </div>
          <div className="prov-datasets">
            {DATASETS.map((ds, idx) => (
              <div className="prov-dataset-row" key={idx}>
                <div className="prov-dataset-name">
                  <strong>{ds.name}</strong>
                  <small>
                    {ds.samples} samples{' '}
                    {ds.status === 'derived'
                      ? '(downsampled)'
                      : ''}{' '}
                    &middot; {ds.size}
                  </small>
                </div>
                <div>
                  <span className="prov-dataset-version">
                    {ds.version}
                  </span>
                </div>
                <div className="prov-dataset-meta">
                  {typeof ds.regions === 'number'
                    ? ds.regions + ' regions'
                    : ds.regions}
                </div>
                <div className="prov-dataset-time">
                  {ds.lastUsed}
                </div>
                <div className="prov-dataset-actions">
                  <button className="prov-dataset-btn">
                    View History
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'experiments' && (
        <>
          {/* Summary stats */}
          <div className="prov-stats-grid">
            <div className="prov-stat-card">
              <span className="prov-stat-label">Total Experiments</span>
              <span className="prov-stat-number">{allExperiments.length}</span>
              <div className="prov-stat-bar"><div className="prov-stat-bar-fill" style={{ width: '100%', background: '#0073bb' }} /></div>
            </div>
            <div className="prov-stat-card">
              <span className="prov-stat-label">Completed</span>
              <span className="prov-stat-number">{allExperiments.filter(e => e.status === 'completed').length}</span>
              <div className="prov-stat-bar"><div className="prov-stat-bar-fill" style={{ width: `${(allExperiments.filter(e => e.status === 'completed').length / allExperiments.length) * 100}%`, background: '#1d8102' }} /></div>
            </div>
            <div className="prov-stat-card">
              <span className="prov-stat-label">In Progress</span>
              <span className="prov-stat-number" style={{ color: '#ff9900' }}>{allExperiments.filter(e => e.status === 'running').length}</span>
              <div className="prov-stat-bar"><div className="prov-stat-bar-fill" style={{ width: `${(allExperiments.filter(e => e.status === 'running').length / allExperiments.length) * 100}%`, background: '#ff9900' }} /></div>
            </div>
            <div className="prov-stat-card">
              <span className="prov-stat-label">Planned</span>
              <span className="prov-stat-number" style={{ color: '#879596' }}>{allExperiments.filter(e => e.status === 'planned').length}</span>
              <div className="prov-stat-bar"><div className="prov-stat-bar-fill" style={{ width: `${(allExperiments.filter(e => e.status === 'planned').length / allExperiments.length) * 100}%`, background: '#d5dbdb' }} /></div>
            </div>
          </div>

          {/* Experiment cards */}
          <div className="prov-experiments-list">
            {allExperiments.map((exp) => (
              <div key={exp.id} className={`prov-experiment-card status-${exp.status}`}>
                <div className="prov-experiment-header">
                  <div className="prov-experiment-id-row">
                    <span className="prov-experiment-id">{exp.id}</span>
                    <span className={`prov-experiment-status ${exp.status}`}>
                      <span className={`prov-experiment-status-dot ${exp.status}`} />
                      {exp.status === 'completed' ? 'Completed' : exp.status === 'running' ? 'In Progress' : exp.status === 'planned' ? 'Planned' : 'Failed'}
                    </span>
                  </div>
                  <h3 className="prov-experiment-title">{exp.title}</h3>
                  <p className="prov-experiment-desc">{exp.description}</p>
                </div>

                <div className="prov-experiment-body">
                  <div className="prov-experiment-meta-row">
                    <div className="prov-experiment-lead">
                      <div className={`prov-avatar ${exp.lead.color}`}>{exp.lead.initials}</div>
                      <span>{exp.lead.name}</span>
                    </div>
                    <div className="prov-experiment-dates">
                      {exp.startDate ? `${exp.startDate}` : 'Not started'}
                      {exp.endDate ? ` → ${exp.endDate}` : exp.startDate ? ' → ongoing' : ''}
                    </div>
                    <div className="prov-experiment-runs">
                      {exp.runs} run{exp.runs !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Progress bar for running experiments */}
                  {exp.status === 'running' && exp.progress && (
                    <div className="prov-experiment-progress">
                      <div className="prov-experiment-progress-track">
                        <div className="prov-experiment-progress-fill" style={{ width: `${exp.progress}%` }} />
                      </div>
                      <span className="prov-experiment-progress-pct">{exp.progress}%</span>
                    </div>
                  )}

                  <div className="prov-experiment-hypothesis">
                    <span className="prov-experiment-field-label">Hypothesis</span>
                    <span className="prov-experiment-field-value">{exp.hypothesis}</span>
                  </div>

                  {exp.result && (
                    <div className={`prov-experiment-result ${exp.status}`}>
                      <span className="prov-experiment-field-label">Result</span>
                      <span className="prov-experiment-field-value">{exp.result}</span>
                    </div>
                  )}

                  <div className="prov-experiment-footer">
                    <div className="prov-experiment-tags">
                      {exp.tags.map((tag) => (
                        <span key={tag} className="prov-experiment-tag">{tag}</span>
                      ))}
                    </div>
                    <div className="prov-experiment-links">
                      {exp.datasets.length > 0 && (
                        <span className="prov-experiment-link-count">{exp.datasets.length} dataset{exp.datasets.length > 1 ? 's' : ''}</span>
                      )}
                      {exp.papers.length > 0 && (
                        <span className="prov-experiment-link-count">{exp.papers.length} paper{exp.papers.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Provenance Chain Visualization ──────── */}
      <hr className="prov-section-divider" />
      <div className="prov-chain-section">
        <div className="prov-chain-section-header">
          <div className="prov-chain-section-kicker">
            Full Provenance Chain
          </div>
          <h3>
            Figure 3: Regional Performance Heatmap
          </h3>
          <div className="prov-chain-figure-label">
            from "Geographic Bias in Neural Climate Models"
          </div>
        </div>

        <div className="prov-chain-viz">
          <div className="prov-chain-track">
            {CHAIN_STEPS.map((step, idx) => (
              <span key={idx} style={{ display: 'contents' }}>
                <div className="prov-chain-step">
                  <div
                    className={
                      'prov-chain-step-icon ' + step.type
                    }
                  >
                    {step.icon}
                  </div>
                  <div className="prov-chain-step-label">
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </div>
                </div>
                {idx < CHAIN_STEPS.length - 1 && (
                  <div className="prov-chain-connector" />
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Export Reproducibility Package ──────── */}
      <div className="prov-export-section">
        <div className="prov-export-card">
          <div className="prov-export-kicker">
            <span className="prov-export-spark">
              {'✦'}
            </span>
            EXPORT PACKAGE
          </div>
          <h3>Reproducibility Package</h3>
          <p>
            Bundle everything needed to reproduce any linked
            figure or result. The package includes
            version-locked datasets, model checkpoints, full
            pipeline configs, and an environment specification
            -- ready for journal submission.
          </p>

          <div className="prov-export-items">
            {EXPORT_ITEMS.map((item, idx) => (
              <span className="prov-export-item" key={idx}>
                <span className="item-icon">{item.icon}</span>
                {item.label}
              </span>
            ))}
          </div>

          <div className="prov-export-bottom">
            <button
              className="prov-export-btn"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting
                ? 'Packaging...'
                : exported
                  ? 'Package Ready'
                  : 'Export Package'}
              <span>
                {exporting
                  ? '⏳'
                  : exported
                    ? '✓'
                    : '→'}
              </span>
            </button>
            <div className="prov-export-format">
              <strong>FAIR-compliant archive (.zip)</strong>
              <br />
              Ready for journal submission. Includes SHA-256
              checksums for all artifacts.
            </div>
          </div>
        </div>
      </div>

      {/* ── Log Run Modal ──────────────────────── */}
      {showLogRunModal && (
        <div
          className="prov-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogRunModal(false)
          }}
        >
          <div className="prov-modal">
            <div className="prov-modal-header">
              <h3>Log New Run</h3>
              <button
                className="prov-modal-close"
                onClick={() => setShowLogRunModal(false)}
              >
                {'✕'}
              </button>
            </div>
            <form className="prov-modal-form" onSubmit={handleLogRunSubmit}>
              <div className="prov-modal-field">
                <label>Pipeline Name</label>
                <select
                  value={logRunForm.pipelineName}
                  onChange={(e) =>
                    updateFormField('pipelineName', e.target.value)
                  }
                >
                  {PIPELINE_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="prov-modal-field">
                <label>Dataset Version</label>
                <select
                  value={logRunForm.datasetVersion}
                  onChange={(e) =>
                    updateFormField('datasetVersion', e.target.value)
                  }
                >
                  <option value="">Select a dataset...</option>
                  {DATASETS.map((ds) => (
                    <option key={ds.version} value={ds.version}>
                      {ds.name} ({ds.version})
                    </option>
                  ))}
                </select>
              </div>
              <div className="prov-modal-field">
                <label>Model Checkpoint</label>
                <input
                  type="text"
                  placeholder="e.g. ep_200_v4.pt"
                  value={logRunForm.modelCheckpoint}
                  onChange={(e) =>
                    updateFormField('modelCheckpoint', e.target.value)
                  }
                />
              </div>
              <div className="prov-modal-field">
                <label>Git Commit Hash</label>
                <input
                  type="text"
                  placeholder="e.g. a3f7b2c"
                  value={logRunForm.gitCommitHash}
                  onChange={(e) =>
                    updateFormField('gitCommitHash', e.target.value)
                  }
                />
              </div>
              <div className="prov-modal-field">
                <label>Description</label>
                <textarea
                  placeholder="Describe the purpose of this run..."
                  value={logRunForm.description}
                  onChange={(e) =>
                    updateFormField('description', e.target.value)
                  }
                />
              </div>
              <button type="submit" className="prov-modal-submit">
                Log Run
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
