import { useState, useEffect, useRef } from 'react'
import { listLabMemory, createLabMemoryEntry, executeAgentCommand } from '../../lib/api'
import './LabMemoryPage.css'

/* ------------------------------------------------------------------ */
/*  Synthetic data                                                     */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  'All',
  'Decisions',
  'Failed Experiments',
  'Protocols',
  'Conventions',
  'Equipment Quirks',
  'Data Sources',
  'Methods',
  'Onboarding',
]

const CATEGORY_MAP = {
  decision:        { label: 'Decision',         css: 'decision',   filter: 'Decisions' },
  failed:          { label: 'Failed Experiment', css: 'failed',     filter: 'Failed Experiments' },
  protocol:        { label: 'Protocol',          css: 'protocol',   filter: 'Protocols' },
  convention:      { label: 'Convention',        css: 'convention', filter: 'Conventions' },
  equipment:       { label: 'Equipment Quirk',   css: 'equipment',  filter: 'Equipment Quirks' },
  method:          { label: 'Method',            css: 'method',     filter: 'Methods' },
  datasource:      { label: 'Data Source',       css: 'datasource', filter: 'Data Sources' },
  onboarding:      { label: 'Onboarding',        css: 'onboarding', filter: 'Onboarding' },
  general:         { label: 'General',           css: 'convention', filter: 'All' },
  finding:         { label: 'Finding',           css: 'decision',   filter: 'Decisions' },
  troubleshooting: { label: 'Troubleshooting',   css: 'failed',     filter: 'Failed Experiments' },
  resource:        { label: 'Resource',          css: 'datasource', filter: 'Data Sources' },
  'meeting-note':  { label: 'Meeting Note',      css: 'onboarding', filter: 'Onboarding' },
}

const INITIAL_ENTRIES = [
  {
    id: 1,
    category: 'decision',
    title: 'Why we switched from TensorFlow to PyTorch',
    summary: 'In early 2023 the lab hit repeated pain points with TensorFlow\'s static graph model when handling variable-size geographic inputs. PyTorch\'s eager execution simplified debugging and the climate-ML community had largely converged on it, making collaboration easier.',
    detail: 'The migration took roughly three weeks. Key blockers were the custom data loaders (geographic tiling) and the TensorBoard integration. We kept a thin TF wrapper for legacy models in the archive repo but all new work is PyTorch-first. See also: "Standard dropout for spatial data" entry for a related architectural note.',
    contributor: { name: 'Dr. Sarah Kim', initials: 'SK', color: 'purple' },
    date: 'Jan 2023',
    tags: ['pytorch', 'tensorflow', 'migration'],
    upvotes: 47,
    fromRemember: true,
  },
  {
    id: 2,
    category: 'failed',
    title: 'Batch normalization breaks geographic features',
    summary: 'Adding batch norm layers to our regional climate encoder collapsed per-region variance to near zero. The normalizer treated geographic variation as noise and washed it out during training, reducing regional F1 by 23%.',
    detail: 'We tried Group Normalization (groups=8) and Instance Normalization as alternatives. Group norm preserved regional variance while still stabilizing training. Instance norm worked but slowed convergence by 40%. Final recommendation: use GroupNorm with groups=8 for all spatial encoders.',
    contributor: { name: 'Jordan Ellis', initials: 'JE', color: 'blue' },
    date: 'Mar 2023',
    tags: ['batch-norm', 'spatial', 'encoder'],
    upvotes: 31,
  },
  {
    id: 3,
    category: 'protocol',
    title: 'MRI scanner warm-up procedure for Building 4 Siemens 3T',
    summary: 'The Siemens Prisma 3T in Building 4 requires a 45-minute gradient warm-up before diffusion sequences. Skipping this causes ghost artifacts in the phase-encode direction that corrupt downstream tractography.',
    detail: 'Procedure: (1) Power on at least 60 min before first scan. (2) Run the vendor phantom QA sequence. (3) Verify SNR > 120 on the QA report. (4) If SNR is below threshold, run the "GradientCalibration" protocol from the service menu (password in the lab wiki). The warm-up drift has been reported to Siemens but they consider it within spec.',
    contributor: { name: 'Maria Lopez', initials: 'ML', color: 'teal' },
    date: 'Feb 2023',
    tags: ['mri', 'siemens', 'building-4', 'qa'],
    upvotes: 58,
  },
  {
    id: 4,
    category: 'convention',
    title: 'Dataset naming convention: {project}_{region}_{version}_{date}',
    summary: 'All shared datasets follow the pattern project_region_vN_YYYYMMDD. This prevents duplicate names across projects and makes S3 lifecycle policies straightforward. Regions use ISO 3166-2 codes.',
    detail: 'Examples: climsense_US-CA_v3_20230815, geohealth_BR-SP_v1_20230622. The version number increments when preprocessing changes; the date is the snapshot date of the source data, not the processing date. For multi-region datasets use "MULTI" as the region code.',
    contributor: { name: 'Chen Wei', initials: 'CW', color: 'green' },
    date: 'Apr 2023',
    tags: ['naming', 'datasets', 's3', 'conventions'],
    upvotes: 42,
  },
  {
    id: 5,
    category: 'equipment',
    title: 'The Building 4 GPU cluster drops CUDA contexts after 72h',
    summary: 'Long-running jobs on the A100 nodes in Building 4 silently lose their CUDA context around the 72-hour mark. The process keeps running on CPU, so metrics look fine until you check GPU utilization.',
    detail: 'Root cause is a known driver bug in NVIDIA 525.x. The workaround is to checkpoint every 8 hours and wrap the training loop in a CUDA context check (see lab wiki snippet). Upgrading to driver 535+ is blocked by the HPC team\'s compatibility matrix. Add CUDA_LAUNCH_BLOCKING=1 for debugging but remove it for production runs (10x slowdown).',
    contributor: { name: 'Jordan Ellis', initials: 'JE', color: 'blue' },
    date: 'May 2023',
    tags: ['gpu', 'cuda', 'cluster', 'building-4'],
    upvotes: 63,
    fromRemember: true,
  },
  {
    id: 6,
    category: 'decision',
    title: 'Why we use 5-fold instead of 10-fold cross-validation',
    summary: 'Geographic datasets have strong spatial autocorrelation. 10-fold CV on spatially correlated data gives optimistically biased estimates. 5-fold with spatial blocking better approximates true generalization error and cuts compute by half.',
    detail: 'We tested 5-, 10-, and leave-one-region-out CV on the 2022 benchmark. 10-fold overestimated accuracy by 4-7 percentage points compared to held-out region evaluation. 5-fold with spatial blocks matched held-out performance within 1.2 pp. See Roberts et al. 2017 for theoretical justification.',
    contributor: { name: 'Dr. Anderson', initials: 'DA', color: 'gold' },
    date: 'Jun 2023',
    tags: ['cross-validation', 'spatial', 'evaluation'],
    upvotes: 29,
  },
  {
    id: 7,
    category: 'failed',
    title: 'Transfer learning from ImageNet hurts climate feature extraction',
    summary: 'Pre-trained ImageNet weights biased the early convolutional filters toward texture and object edges. Climate raster data is dominated by smooth gradients and large-scale spatial patterns that these filters actively suppress.',
    detail: 'We compared four initialization strategies: (A) ImageNet pretrained, (B) random init, (C) pretrained on ERA5 reanalysis, (D) pretrained on Sentinel-2 land cover. Results: C > D > B > A on all three climate benchmarks. The takeaway: domain-specific pretraining matters more than "more data" pretraining for geospatial tasks.',
    contributor: { name: 'Mumtahin Chen', initials: 'MC', color: 'coral' },
    date: 'Jul 2023',
    tags: ['transfer-learning', 'imagenet', 'climate'],
    upvotes: 35,
  },
  {
    id: 8,
    category: 'method',
    title: 'Why we don\'t use standard dropout for spatial data',
    summary: 'Standard dropout randomly zeroes individual activations, but neighboring spatial features are highly correlated. The network trivially reconstructs dropped values from neighbors, making dropout ineffective as a regularizer.',
    detail: 'We use Spatial Dropout (dropping entire feature maps) or DropBlock (dropping contiguous regions). On the RegionNet benchmark, standard dropout had no measurable regularization effect. Spatial Dropout reduced overfitting gap by 38% and DropBlock by 45%. Recommended: DropBlock with block_size=7 for 64x64 inputs.',
    contributor: { name: 'Ari Singh', initials: 'AS', color: 'gold' },
    date: 'Aug 2023',
    tags: ['dropout', 'spatial', 'regularization'],
    upvotes: 41,
  },
  {
    id: 9,
    category: 'datasource',
    title: 'NOAA climate reanalysis data access and preprocessing',
    summary: 'ERA5 via the NOAA NCEI portal is our primary climate reanalysis source. The THREDDS server has strict rate limits (3 concurrent connections); always use the batch download script in lab-tools/noaa/ to avoid IP bans.',
    detail: 'Processing pipeline: (1) Download GRIB2 files via lab-tools/noaa/batch_download.py. (2) Convert to NetCDF4 with cfgrib. (3) Regrid to 0.25-degree resolution with xesmf. (4) Apply the lab standard QC mask (lab-tools/noaa/qc_mask.py) to flag missing values and known sensor gaps. Full pipeline takes roughly 4 hours for a global annual dataset.',
    contributor: { name: 'Maria Lopez', initials: 'ML', color: 'teal' },
    date: 'Sep 2023',
    tags: ['noaa', 'era5', 'climate', 'preprocessing'],
    upvotes: 52,
    fromRemember: true,
  },
  {
    id: 10,
    category: 'protocol',
    title: 'How to request IRB approval for geographic health data',
    summary: 'Any project linking geographic location to health outcomes requires IRB review, even if using only county-level aggregates. The university classifies ZIP-code-level health data as identifiable. Start the application at least 8 weeks before you need the data.',
    detail: 'Steps: (1) Complete CITI Human Subjects training (2 modules, about 4 hours). (2) Draft a data management plan using the template in lab-docs/irb/. (3) Submit through IRBNet; PI (Dr. Anderson) must co-sign. (4) If using Census tract or finer resolution, add the "small-cell suppression" appendix. Typical turnaround: 4-6 weeks for expedited review.',
    contributor: { name: 'Dr. Sarah Kim', initials: 'SK', color: 'purple' },
    date: 'Oct 2023',
    tags: ['irb', 'health-data', 'compliance'],
    upvotes: 38,
  },
  {
    id: 11,
    category: 'onboarding',
    title: 'New student first-week checklist',
    summary: 'A structured guide for the first five days: accounts and access on Day 1, codebase orientation on Day 2, dataset walkthrough on Day 3, first mini-experiment on Day 4, and a mentor sync on Day 5.',
    detail: 'Day 1: GitHub org invite, AWS SSO setup, Slack channels, building access card. Day 2: Clone lab-core and lab-tools, run the smoke tests, read the architecture README. Day 3: Download the tutorial dataset (climsense_TUTORIAL_v1), run the preprocessing pipeline end-to-end. Day 4: Modify one hyperparameter in the tutorial model, train, compare results. Day 5: 30-min sync with your assigned mentor to review questions and set first-month goals.',
    contributor: { name: 'Dr. Anderson', initials: 'DA', color: 'gold' },
    date: 'Nov 2023',
    tags: ['onboarding', 'checklist', 'new-students'],
    upvotes: 71,
  },
  {
    id: 12,
    category: 'convention',
    title: 'Git branch naming: feature/{issue-num}-{short-desc}',
    summary: 'All feature branches follow the format feature/123-add-spatial-dropout. Bug fixes use fix/456-cuda-checkpoint. This enables automated issue linking in GitHub and makes the branch list scannable.',
    detail: 'Additional conventions: use "experiment/" prefix for throwaway experiment branches that won\'t be merged. Use "data/" prefix for branches that only change data pipeline configs. Always squash-merge into main. Delete remote branches after merge (automated via repo settings).',
    contributor: { name: 'Chen Wei', initials: 'CW', color: 'green' },
    date: 'Dec 2023',
    tags: ['git', 'branching', 'conventions'],
    upvotes: 26,
  },
  {
    id: 13,
    category: 'equipment',
    title: 'Textract fails silently on PDFs with embedded CMYK images',
    summary: 'AWS Textract returns empty text blocks (no error) when a PDF page contains CMYK-colorspace images. The fix is to convert to RGB before upload using Ghostscript or the lab preprocessing script.',
    detail: 'Affected documents: most scanned journal articles from the pre-2010 archive and anything exported from Adobe InDesign in CMYK mode. The lab-tools/pdf/preprocess.sh script handles conversion automatically. Always check Textract response for empty Blocks arrays as a canary. Filed AWS support case #4829173; they acknowledged it as a known limitation.',
    contributor: { name: 'Jordan Ellis', initials: 'JE', color: 'blue' },
    date: 'Jan 2024',
    tags: ['textract', 'pdf', 'cmyk', 'aws'],
    upvotes: 44,
  },
  {
    id: 14,
    category: 'failed',
    title: 'Region-weighted loss made convergence 10x slower',
    summary: 'Weighting the loss function by inverse region frequency seemed theoretically sound for balancing under-represented areas, but it created extreme gradient magnitudes for rare regions that destabilized training.',
    detail: 'We tried three mitigation strategies: gradient clipping (helped but still 4x slower), square-root weighting (2x slower, slightly worse final accuracy), and focal loss with region-aware gamma (best results, only 1.3x slower). Final recommendation: use focal loss with gamma=2.0 and region-aware alpha instead of direct inverse-frequency weighting.',
    contributor: { name: 'Mumtahin Chen', initials: 'MC', color: 'coral' },
    date: 'Feb 2024',
    tags: ['loss-function', 'weighted', 'convergence'],
    upvotes: 33,
  },
]

const RECENT_ENTRIES = [
  { title: 'Lambda cold start workaround for large model inference', contributor: 'Jordan Ellis', initials: 'JE', color: 'blue', time: '2 hours ago' },
  { title: 'Why we pin NumPy to 1.x for spatial operations', contributor: 'Chen Wei', initials: 'CW', color: 'green', time: 'Yesterday' },
  { title: 'Building 4 printer: use Tray 2 for poster paper', contributor: 'Maria Lopez', initials: 'ML', color: 'teal', time: '2 days ago' },
  { title: 'Conference submission timeline and checklist', contributor: 'Dr. Anderson', initials: 'DA', color: 'gold', time: '3 days ago' },
]

const GRAPH_NODES = [
  { label: 'Geographic Bias', count: 8, css: 'n1' },
  { label: 'GPU Cluster', count: 3, css: 'n2' },
  { label: 'Dataset Conv.', count: 5, css: 'n3' },
  { label: 'Spatial ML', count: 6, css: 'n4' },
  { label: 'Onboarding', count: 4, css: 'n5' },
]

const CHAT_MESSAGES = [
  { role: 'ai', text: 'Welcome to the Anderson Lab! I\'m your onboarding assistant, grounded in 143 entries of lab knowledge. Ask me anything about how we work, what tools we use, and lessons the team has learned.' },
  { role: 'user', text: 'What framework does the lab use for deep learning?' },
  { role: 'ai', text: 'The lab uses PyTorch (switched from TensorFlow in 2023). Key reasons: better debugging with eager execution, dynamic graphs for our variable-size geographic inputs, and wider adoption in the climate ML community. See: ', ref: 'Why we switched from TensorFlow to PyTorch' },
  { role: 'user', text: 'Any gotchas with the GPU cluster?' },
  { role: 'ai', text: 'Yes - the A100 nodes in Building 4 silently drop CUDA contexts after ~72 hours. Your job keeps running on CPU so metrics look normal, but GPU utilization drops to zero. Workaround: checkpoint every 8 hours and add a CUDA context health check to your training loop. See: ', ref: 'The Building 4 GPU cluster drops CUDA contexts after 72h' },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LabMemoryPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [expandedId, setExpandedId] = useState(null)
  const [activeTab, setActiveTab] = useState('knowledge')
  const [entries, setEntries] = useState(INITIAL_ENTRIES)
  const [saving, setSaving] = useState(false)

  /* onboarding chat state */
  const [chatMessages, setChatMessages] = useState([
    ...CHAT_MESSAGES,
    { role: 'user', text: 'How do I name my datasets?' },
    { role: 'ai', text: 'All shared datasets follow the pattern project_{region}_{version}_{date}. For example: climsense_US-CA_v3_20230815. Regions use ISO 3166-2 codes. For multi-region datasets use "MULTI" as the region code.', ref: 'Dataset naming convention' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  const handleChatSend = async () => {
    const q = chatInput.trim()
    if (!q || chatLoading) return
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: q }])
    setChatLoading(true)
    try {
      const data = await executeAgentCommand('ask', [], q)
      const msg = data.message || data
      const ar = msg.agentResult || {}
      const answer = ar.answer || ar.summary || msg.text || 'No answer returned.'
      const sources = ar.ragSources || []
      const firstRef = sources.find(s => s.label)
      setChatMessages(prev => [...prev, {
        role: 'ai',
        text: answer,
        ref: firstRef ? firstRef.label.replace('Knowledge Base: ', '').replace('Discussion message by ', '') : undefined,
        sources,
      }])
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'ai',
        text: 'Sorry, I could not reach the knowledge base right now. Please try again.',
      }])
    } finally {
      setChatLoading(false)
    }
  }

  /* modal state */
  const [showModal, setShowModal] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalCategory, setModalCategory] = useState('decision')
  const [modalContent, setModalContent] = useState('')
  const [modalTags, setModalTags] = useState('')

  /* ---------- load entries from API ---------- */
  useEffect(() => {
    let cancelled = false
    listLabMemory()
      .then((apiEntries) => {
        if (cancelled) return
        if (apiEntries.length > 0) {
          const mapped = apiEntries.map((e) => ({
            id: e.sk,
            category: e.category || 'general',
            title: e.title || 'Untitled',
            summary: e.content || '',
            detail: '',
            contributor: e.contributor?.name
              ? e.contributor
              : { name: e.source === 'agent-command' ? 'BridgeBoard AI' : 'Lab Member', initials: e.source === 'agent-command' ? 'AI' : 'LM', color: e.source === 'agent-command' ? 'purple' : 'blue' },
            date: e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown',
            tags: e.tags || [],
            upvotes: 0,
            fromApi: true,
          }))
          setEntries((prev) => [...mapped, ...prev.filter((e) => !e.fromApi)])
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  /* ---------- add entry handler ---------- */
  const handleAddEntry = async () => {
    if (!modalTitle.trim() || !modalContent.trim()) return
    const tags = modalTags.split(',').map((t) => t.trim()).filter(Boolean)

    setSaving(true)
    try {
      const saved = await createLabMemoryEntry({
        title: modalTitle.trim(),
        category: modalCategory,
        content: modalContent.trim(),
        tags,
      })
      const newEntry = {
        id: saved.sk || Date.now(),
        category: saved.category || modalCategory,
        title: saved.title || modalTitle.trim(),
        summary: saved.content || modalContent.trim(),
        detail: '',
        contributor: saved.contributor?.name
          ? saved.contributor
          : { name: 'You', initials: 'YO', color: 'blue' },
        date: 'Just now',
        tags: saved.tags || tags,
        upvotes: 0,
        fromApi: true,
      }
      setEntries((prev) => [newEntry, ...prev])
    } catch {
      const newEntry = {
        id: Date.now(),
        category: modalCategory,
        title: modalTitle.trim(),
        summary: modalContent.trim(),
        detail: '',
        contributor: { name: 'You', initials: 'YO', color: 'blue' },
        date: 'Just now',
        tags,
        upvotes: 0,
      }
      setEntries((prev) => [newEntry, ...prev])
    } finally {
      setSaving(false)
    }
    setShowModal(false)
    setModalTitle('')
    setModalCategory('decision')
    setModalContent('')
    setModalTags('')
  }

  /* ---------- filtering ---------- */
  const filtered = entries.filter((entry) => {
    const catMatch =
      activeCategory === 'All' ||
      CATEGORY_MAP[entry.category]?.filter === activeCategory
    const searchLower = search.toLowerCase()
    const textMatch =
      !search ||
      entry.title.toLowerCase().includes(searchLower) ||
      entry.summary.toLowerCase().includes(searchLower) ||
      entry.tags.some((t) => t.toLowerCase().includes(searchLower)) ||
      entry.contributor.name.toLowerCase().includes(searchLower)
    return catMatch && textMatch
  })

  /* ---------- render ---------- */
  return (
    <div className="labmem-page">
      {/* ---- Header ---- */}
      <header className="labmem-header">
        <div className="labmem-header-row">
          <div>
            <div className="labmem-kicker">
              <span className="labmem-kicker-dot" />
              LAB MEMORY &amp; ONBOARDING
            </div>
            <h1 className="labmem-title">
              Knowledge that survives <em>graduation.</em>
            </h1>
            <p className="labmem-subtitle">
              Every decision, failed experiment, and hard-won protocol -- captured
              once, available forever. New students onboard in days instead of weeks,
              grounded in real lab history.
            </p>
          </div>
          <button className="labmem-add-btn" onClick={() => setShowModal(true)}>
            <span className="labmem-add-btn-icon">+</span> Add Knowledge
          </button>
        </div>
      </header>

      {/* ---- Stats ---- */}
      <div className="labmem-stats">
        <div className="labmem-stat-card">
          <span className="labmem-stat-label">Knowledge Entries</span>
          <span className="labmem-stat-value">143</span>
          <span className="labmem-stat-note neutral">across all categories</span>
        </div>
        <div className="labmem-stat-card">
          <span className="labmem-stat-label">Categories</span>
          <span className="labmem-stat-value">8</span>
          <span className="labmem-stat-note neutral">organized topics</span>
        </div>
        <div className="labmem-stat-card">
          <span className="labmem-stat-label">Contributors</span>
          <span className="labmem-stat-value">12</span>
          <span className="labmem-stat-note neutral">lab members</span>
        </div>
        <div className="labmem-stat-card">
          <span className="labmem-stat-label">Avg. Onboarding Time</span>
          <span className="labmem-stat-value">2.3<small style={{ fontSize: '16px', letterSpacing: 0, marginLeft: 3 }}>days</small></span>
          <span className="labmem-stat-note">down from 3 weeks</span>
        </div>
      </div>

      {/* ---- Tabs ---- */}
      <div className="labmem-tabs">
        <button
          className={`labmem-tab${activeTab === 'knowledge' ? ' active' : ''}`}
          onClick={() => setActiveTab('knowledge')}
        >
          Knowledge Base
        </button>
        <button
          className={`labmem-tab${activeTab === 'onboarding' ? ' active' : ''}`}
          onClick={() => setActiveTab('onboarding')}
        >
          Onboarding
        </button>
      </div>

      {/* ================================================================ */}
      {/*  KNOWLEDGE BASE TAB                                              */}
      {/* ================================================================ */}
      {activeTab === 'knowledge' && (
        <>
          {/* ---- Search ---- */}
          <div className="labmem-search-section">
            <div className="labmem-search-bar">
              <span className="labmem-search-icon">&#x2315;</span>
              <input
                type="text"
                placeholder="Search knowledge entries, tags, or contributors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="labmem-search-count">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="labmem-chips">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`labmem-chip${activeCategory === cat ? ' active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            {/* /remember banner */}
            <div className="labmem-remember-banner">
              <span>Use <code>/remember</code> in the Research Hub to save knowledge entries directly from conversations.</span>
            </div>
          </div>

          {/* ---- Two-column body ---- */}
          <div className="labmem-body">
            {/* -- Main entries column -- */}
            <div className="labmem-entries">
              {filtered.length === 0 && (
                <div className="labmem-empty">
                  <span className="labmem-empty-icon">&#x2727;</span>
                  No entries match your search. Try a different term or category.
                </div>
              )}
              {filtered.map((entry) => {
                const cat = CATEGORY_MAP[entry.category]
                const isExpanded = expandedId === entry.id
                return (
                  <article
                    key={entry.id}
                    className="labmem-entry"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <div className="labmem-entry-top">
                      <span className={`labmem-badge ${cat.css}`}>{cat.label}</span>
                      {entry.fromRemember && (
                        <span className="labmem-remember-tag">
                          Saved from <code>/remember</code>
                        </span>
                      )}
                      <span className="labmem-entry-date">{entry.date}</span>
                    </div>
                    <h3 className="labmem-entry-title">{entry.title}</h3>
                    <p className="labmem-entry-summary">{entry.summary}</p>
                    {isExpanded && (
                      <div className="labmem-entry-detail">
                        <p>{entry.detail}</p>
                      </div>
                    )}
                    <div className="labmem-entry-footer">
                      <div className="labmem-contributor">
                        <span className={`labmem-avatar ${entry.contributor.color}`}>
                          {entry.contributor.initials}
                        </span>
                        <span className="labmem-contributor-name">{entry.contributor.name}</span>
                      </div>
                      <span className="labmem-upvotes">
                        <i className="labmem-upvote-icon">&#9650;</i> {entry.upvotes}
                      </span>
                    </div>
                    <div className="labmem-tags">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="labmem-tag">{tag}</span>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>

            {/* -- Sidebar column -- */}
            <div className="labmem-sidebar">
              {/* AI Onboarding Assistant */}
              <div className="labmem-ai-panel">
                <div className="labmem-ai-label">
                  <span className="labmem-ai-spark">&#x2726;</span>
                  ONBOARDING ASSISTANT
                </div>
                <h3 className="labmem-ai-title">Ask anything about how the lab works.</h3>
                <div className="labmem-chat">
                  {chatMessages.slice(-6).map((msg, i) => (
                    <div key={i} className={`labmem-chat-msg ${msg.role}`}>
                      <span className="labmem-chat-sender">
                        {msg.role === 'ai' ? 'Lab Memory AI' : 'You'}
                      </span>
                      {msg.text.length > 200 ? msg.text.slice(0, 200) + '...' : msg.text}
                      {msg.ref && <span className="labmem-chat-ref">&ldquo;{msg.ref}&rdquo;</span>}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="labmem-chat-msg ai">
                      <span className="labmem-chat-sender">Lab Memory AI</span>
                      <span className="labmem-typing">Thinking...</span>
                    </div>
                  )}
                </div>
                <div className="labmem-chat-input-row">
                  <input
                    type="text"
                    className="labmem-chat-input"
                    placeholder="Ask about the lab..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                    disabled={chatLoading}
                  />
                  <button
                    className="labmem-chat-send"
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || chatLoading}
                  >&#x27A4;</button>
                </div>
              </div>

              {/* Recently Added */}
              <div className="labmem-recent-panel">
                <h4 className="labmem-recent-heading">Recently Added</h4>
                <div className="labmem-recent-list">
                  {RECENT_ENTRIES.map((item, i) => (
                    <div key={i} className="labmem-recent-item">
                      <span className={`labmem-avatar ${item.color}`}>{item.initials}</span>
                      <div className="labmem-recent-info">
                        <div className="labmem-recent-title">{item.title}</div>
                        <div className="labmem-recent-meta">
                          {item.contributor} &middot; <span className="labmem-recent-time">{item.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Knowledge Graph Preview */}
              <div className="labmem-graph-panel">
                <h4 className="labmem-graph-heading">Knowledge Graph</h4>
                <div className="labmem-graph">
                  {/* connection lines */}
                  <div className="labmem-graph-line l1" />
                  <div className="labmem-graph-line l2" />
                  <div className="labmem-graph-line l3" />
                  <div className="labmem-graph-line l4" />
                  <div className="labmem-graph-line l5" />
                  {/* hub node */}
                  <div className="labmem-node hub">
                    Lab<br />Memory
                    <span className="labmem-node-count">143</span>
                  </div>
                  {/* topic nodes */}
                  {GRAPH_NODES.map((node) => (
                    <div key={node.css} className={`labmem-node ${node.css}`}>
                      {node.label}
                      <span className="labmem-node-count">{node.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/*  ONBOARDING TAB                                                  */}
      {/* ================================================================ */}
      {activeTab === 'onboarding' && (
        <div className="labmem-onboarding">
          {/* intro banner */}
          <div className="labmem-onboarding-intro">
            <h3>Welcome to the Anderson Lab</h3>
            <p>
              Your AI-powered onboarding experience is grounded in 143 entries
              of real lab knowledge -- past decisions, failed experiments,
              equipment quirks, and coding conventions. Everything a new student
              needs, surfaced in context.
            </p>
          </div>

          {/* step cards */}
          <div className="labmem-onboarding-grid">
            <div className="labmem-onboarding-card">
              <span className="labmem-ob-step-num">1</span>
              <h4>Accounts &amp; Access</h4>
              <p>
                GitHub org invite, AWS SSO setup, Slack channels (#lab-general,
                #lab-papers, #lab-compute), building access card, and printer
                registration. Typically completed by end of Day 1.
              </p>
            </div>
            <div className="labmem-onboarding-card">
              <span className="labmem-ob-step-num">2</span>
              <h4>Codebase Orientation</h4>
              <p>
                Clone lab-core and lab-tools repos. Run the smoke test suite to
                verify your environment. Read the architecture README and the
                &quot;Git branch naming&quot; convention entry.
              </p>
            </div>
            <div className="labmem-onboarding-card">
              <span className="labmem-ob-step-num">3</span>
              <h4>Dataset Walkthrough</h4>
              <p>
                Download the tutorial dataset (climsense_TUTORIAL_v1). Run the
                full preprocessing pipeline. Learn the naming convention and QC
                mask workflow from the NOAA data entry.
              </p>
            </div>
            <div className="labmem-onboarding-card">
              <span className="labmem-ob-step-num">4</span>
              <h4>First Experiment</h4>
              <p>
                Modify one hyperparameter in the tutorial model, train it on
                the tutorial dataset, and compare your results. Present findings
                in your Day 5 mentor sync.
              </p>
            </div>
          </div>

          {/* live chat */}
          <div className="labmem-full-chat">
            <div className="labmem-full-chat-label">
              <span className="labmem-ai-spark">&#x2726;</span>
              LIVE ONBOARDING CONVERSATION
            </div>
            {chatMessages.map((msg, i) => (
              <div key={i} className={`labmem-chat-msg ${msg.role}`}>
                <span className="labmem-chat-sender">
                  {msg.role === 'ai' ? 'Lab Memory AI' : 'You'}
                </span>
                {msg.text}
                {msg.ref && <span className="labmem-chat-ref">&ldquo;{msg.ref}&rdquo;</span>}
                {msg.sources && msg.sources.length > 1 && (
                  <div className="labmem-chat-sources">
                    {msg.sources.slice(0, 4).map((s, j) => (
                      <span key={j} className={`labmem-chat-source-tag ${s.source}`}>{s.label}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="labmem-chat-msg ai">
                <span className="labmem-chat-sender">Lab Memory AI</span>
                <span className="labmem-typing">Searching knowledge base...</span>
              </div>
            )}
            <div ref={chatEndRef} />
            <div className="labmem-full-chat-input">
              <input
                type="text"
                placeholder="Ask the Lab Memory AI anything..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                disabled={chatLoading}
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || chatLoading}
              >{chatLoading ? '...' : 'Send'}</button>
            </div>
          </div>

          {/* tips from the knowledge base */}
          <div className="labmem-onboarding-grid">
            <div className="labmem-onboarding-card">
              <span className="labmem-badge equipment" style={{ marginBottom: 10 }}>Equipment Quirk</span>
              <h4>GPU Cluster - CUDA context drops</h4>
              <p>
                Long jobs on Building 4 A100 nodes lose CUDA context after 72h.
                Checkpoint every 8 hours and add a CUDA health check to your
                training loop.
              </p>
            </div>
            <div className="labmem-onboarding-card">
              <span className="labmem-badge protocol" style={{ marginBottom: 10 }}>Protocol</span>
              <h4>IRB Approval for Health Data</h4>
              <p>
                Any project linking geography to health outcomes needs IRB
                review. Start the application at least 8 weeks early. Complete
                CITI training first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  ADD KNOWLEDGE MODAL                                             */}
      {/* ================================================================ */}
      {showModal && (
        <div className="labmem-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="labmem-modal" onClick={(e) => e.stopPropagation()}>
            <div className="labmem-modal-header">
              <h3>Add Knowledge Entry</h3>
              <button className="labmem-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="labmem-modal-body">
              <div className="labmem-modal-field">
                <label>Title</label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="What did you learn?"
                />
              </div>
              <div className="labmem-modal-field">
                <label>Category</label>
                <select value={modalCategory} onChange={(e) => setModalCategory(e.target.value)}>
                  <option value="decision">Decision</option>
                  <option value="failed">Failed Experiment</option>
                  <option value="protocol">Protocol</option>
                  <option value="convention">Convention</option>
                  <option value="equipment">Equipment Quirk</option>
                  <option value="datasource">Data Source</option>
                  <option value="method">Method</option>
                  <option value="onboarding">Onboarding</option>
                </select>
              </div>
              <div className="labmem-modal-field">
                <label>Content</label>
                <textarea
                  value={modalContent}
                  onChange={(e) => setModalContent(e.target.value)}
                  placeholder="Describe the knowledge entry..."
                  rows={5}
                />
              </div>
              <div className="labmem-modal-field">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={modalTags}
                  onChange={(e) => setModalTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
            <div className="labmem-modal-footer">
              <button className="labmem-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="labmem-modal-submit" onClick={handleAddEntry} disabled={saving}>{saving ? 'Saving...' : 'Add Entry'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
