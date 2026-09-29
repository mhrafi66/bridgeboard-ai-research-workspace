import { useState, useEffect } from 'react'
import { listManuscripts, createManuscript, deleteManuscript } from '../../lib/api'
import './ManuscriptsPage.css'

/* ── Synthetic data ──────────────────────────────────────── */

const INITIAL_PAPERS = [
  {
    id: 'p1',
    title: 'Federated Learning for Multi-Site Climate Data',
    authors: [
      { initials: 'AS', color: 'gold', name: 'Ari Singh' },
      { initials: 'CW', color: 'teal', name: 'Chen Wei' },
    ],
    venue: null,
    stage: 'idea',
    priority: 'low',
    progress: 8,
    deadline: null,
    meta: 'Brainstorm phase',
    linkedConversation: null,
  },
  {
    id: 'p2',
    title: 'Sample Size Effects on Regional Generalization',
    authors: [
      { initials: 'MC', color: 'coral', name: 'Mumtahin Chen' },
      { initials: 'JE', color: 'blue', name: 'Jordan Ellis' },
    ],
    venue: 'ICML 2025',
    stage: 'drafting',
    priority: 'high',
    progress: 42,
    deadline: 'Jan 31',
    meta: 'Target: ICML 2025',
    linkedConversation: null,
  },
  {
    id: 'p3',
    title: 'Causal Inference in Geographic Neural Networks',
    authors: [
      { initials: 'DA', color: 'purple', name: 'Dr. Anderson' },
      { initials: 'ML', color: 'green', name: 'Maria Lopez' },
    ],
    venue: 'NeurIPS 2025',
    stage: 'drafting',
    priority: 'medium',
    progress: 27,
    deadline: null,
    meta: 'Target: NeurIPS 2025',
    linkedConversation: 'Inspired by Research Hub discussion',
  },
  {
    id: 'p4',
    title: 'Architecture-Independent Distribution Shift Detection',
    authors: [
      { initials: 'JE', color: 'blue', name: 'Jordan Ellis' },
      { initials: 'DK', color: 'teal', name: 'Dr. Kim' },
    ],
    venue: 'ICLR 2025',
    stage: 'review',
    priority: 'high',
    progress: 65,
    deadline: null,
    meta: 'Round 2 of 3',
    reviewInfo: '4 comments remaining',
    linkedConversation: null,
  },
  {
    id: 'p5',
    title: 'Geographic Bias in Neural Climate Models',
    authors: [
      { initials: 'MC', color: 'coral', name: 'Mumtahin Chen' },
      { initials: 'JE', color: 'blue', name: 'Jordan Ellis' },
      { initials: 'AS', color: 'gold', name: 'Ari Singh' },
      { initials: 'DA', color: 'purple', name: 'Dr. Anderson' },
    ],
    venue: 'Nature Climate Change',
    stage: 'submitted',
    priority: 'high',
    progress: 80,
    deadline: 'Nov 15',
    meta: 'Submitted Sep 3',
    submittedInfo: 'Decision expected Nov 15',
    linkedConversation: 'Originated from Research Hub discussion',
  },
  {
    id: 'p6',
    title: 'Cross-Regional Transfer in Environmental Sensing',
    authors: [
      { initials: 'MC', color: 'coral', name: 'Mumtahin Chen' },
      { initials: 'JE', color: 'blue', name: 'Jordan Ellis' },
    ],
    venue: 'AAAI 2024',
    stage: 'accepted',
    priority: 'low',
    progress: 100,
    deadline: null,
    meta: 'Published',
    linkedConversation: null,
  },
  {
    id: 'p7',
    title: 'Equitable AI for Climate Adaptation',
    authors: [
      { initials: 'AS', color: 'gold', name: 'Ari Singh' },
      { initials: 'ML', color: 'green', name: 'Maria Lopez' },
    ],
    venue: 'FAccT 2025',
    stage: 'accepted',
    priority: 'medium',
    progress: 92,
    deadline: 'Oct 20',
    meta: 'Accepted',
    acceptedInfo: 'Camera-ready due Oct 20',
    linkedConversation: null,
  },
]

const STAGES = [
  { key: 'idea', label: 'Idea / Brainstorm', dot: 'ms-dot-idea' },
  { key: 'drafting', label: 'Drafting', dot: 'ms-dot-drafting' },
  { key: 'review', label: 'Internal Review', dot: 'ms-dot-review' },
  { key: 'submitted', label: 'Submitted', dot: 'ms-dot-submitted' },
  { key: 'accepted', label: 'Accepted / Published', dot: 'ms-dot-accepted' },
]

const TEAM_MEMBERS = [
  { name: 'Dr. Anderson', initials: 'DA', color: 'purple' },
  { name: 'Mumtahin Chen', initials: 'MC', color: 'coral' },
  { name: 'Jordan Ellis', initials: 'JE', color: 'blue' },
  { name: 'Ari Singh', initials: 'AS', color: 'gold' },
  { name: 'Maria Lopez', initials: 'ML', color: 'green' },
  { name: 'Chen Wei', initials: 'CW', color: 'teal' },
  { name: 'Dr. Kim', initials: 'DK', color: 'teal' },
]

const REVIEWER_COMMENTS = [
  {
    id: 'c1',
    reviewer: 'Reviewer 1',
    severity: 'Major',
    status: 'Addressed',
    text: 'The geographic bias metric is not well-defined. How does it differ from standard distribution shift measures?',
    linkedEdit: 'Section 2.3 rewritten',
    linkedIcon: '✎',
    assignee: { initials: 'MC', color: 'coral', name: 'Mumtahin' },
  },
  {
    id: 'c2',
    reviewer: 'Reviewer 1',
    severity: 'Minor',
    status: 'Addressed',
    text: 'Figure 3 colormap is not colorblind-safe.',
    linkedEdit: 'Figure regenerated with viridis palette',
    linkedIcon: '▣',
    assignee: { initials: 'JE', color: 'blue', name: 'Jordan' },
  },
  {
    id: 'c3',
    reviewer: 'Reviewer 2',
    severity: 'Major',
    status: 'In Progress',
    text: 'No comparison with domain adaptation baselines (DANN, CORAL). This weakens the empirical contribution significantly.',
    linkedEdit: 'Section 4 being expanded with baselines',
    linkedIcon: '✎',
    assignee: { initials: 'JE', color: 'blue', name: 'Jordan' },
  },
  {
    id: 'c4',
    reviewer: 'Reviewer 2',
    severity: 'Suggestion',
    status: 'Addressed',
    text: 'Consider discussing implications for climate justice and equitable resource allocation in underrepresented regions.',
    linkedEdit: 'Added Section 6.2 on climate justice',
    linkedIcon: '✎',
    assignee: { initials: 'AS', color: 'gold', name: 'Ari' },
  },
  {
    id: 'c5',
    reviewer: 'Reviewer 3',
    severity: 'Major',
    status: 'Pending',
    text: 'The causal claim in Section 5 is too strong given the observational evidence. Consider reframing as correlational or adding an instrumental variable analysis.',
    linkedEdit: 'Needs team discussion',
    linkedIcon: '⚑',
    assignee: { initials: 'DA', color: 'purple', name: 'Dr. Anderson' },
  },
  {
    id: 'c6',
    reviewer: 'Reviewer 3',
    severity: 'Minor',
    status: 'Addressed',
    text: 'Several typos in the appendix, particularly in equations A.3 and A.7. Table B.2 header row is misaligned.',
    linkedEdit: 'Proofread complete',
    linkedIcon: '✓',
    assignee: { initials: 'ML', color: 'green', name: 'Maria' },
  },
]

const GRANTS = [
  {
    id: 'g1',
    title: 'Equitable AI for Climate Science',
    agency: 'NSF CAREER',
    years: '2023 - 2028',
    progress: 62,
    aims: [
      {
        number: 1,
        title: 'Develop bias-aware ML architectures for climate prediction',
        progress: 75,
        papers: [
          { title: 'Geographic Bias in Neural Climate Models', status: 'submitted' },
          { title: 'Cross-Regional Transfer in Environmental Sensing', status: 'published' },
        ],
        datasets: ['ClimBias-7Region', 'GeoShift-Eval', 'CoastalTemp-v2'],
        outputs: ['bias-detect Python package', 'GeoML benchmark suite'],
        milestone: 'Submit DANN comparison results by Dec 2025',
      },
      {
        number: 2,
        title: 'Build geographic evaluation benchmarks for ML fairness',
        progress: 45,
        papers: [
          { title: 'Sample Size Effects on Regional Generalization', status: 'drafting' },
        ],
        datasets: ['RegionBench-v1', 'FairGeo-Eval'],
        outputs: ['fairgeo-bench CLI tool'],
        milestone: 'Release benchmark v2 at NeurIPS 2025 workshop',
      },
      {
        number: 3,
        title: 'Community engagement and education in equitable AI',
        progress: 68,
        papers: [
          { title: 'Equitable AI for Climate Adaptation', status: 'accepted' },
        ],
        datasets: [],
        outputs: ['ClimateAI Workshop (Spring 2024)', 'Student seminar series (ongoing)'],
        milestone: 'Host second annual workshop, Spring 2026',
      },
    ],
  },
  {
    id: 'g2',
    title: 'Environmental Health Prediction',
    agency: 'NIH R01',
    years: '2024 - 2029',
    progress: 18,
    aims: [
      {
        number: 1,
        title: 'Multi-site health outcome prediction using environmental features',
        progress: 15,
        papers: [
          { title: 'Federated Learning for Multi-Site Climate Data', status: 'idea' },
        ],
        datasets: ['EPA-AirQuality-2024'],
        outputs: [],
        milestone: 'Complete literature review by Feb 2025',
      },
      {
        number: 2,
        title: 'Causal modeling of environmental exposure pathways',
        progress: 22,
        papers: [
          { title: 'Causal Inference in Geographic Neural Networks', status: 'drafting' },
        ],
        datasets: ['ExposureDAG-v1'],
        outputs: ['causal-env R package (WIP)'],
        milestone: 'First draft of causal framework paper by Mar 2025',
      },
      {
        number: 3,
        title: 'Clinical decision support tool for environmental health risks',
        progress: 0,
        papers: [],
        datasets: [],
        outputs: [],
        milestone: 'Begin stakeholder interviews Q1 2025',
      },
    ],
  },
]

/* ── Helpers ──────────────────────────────────────────────── */

function severityClass(severity) {
  if (severity === 'Major') return 'ms-severity-major'
  if (severity === 'Minor') return 'ms-severity-minor'
  return 'ms-severity-suggestion'
}

function statusClass(status) {
  if (status === 'Addressed') return 'ms-status-addressed'
  if (status === 'In Progress') return 'ms-status-progress'
  return 'ms-status-pending'
}

function statusBadgeClass(status) {
  const map = {
    published: 'ms-status-published',
    submitted: 'ms-status-submitted',
    drafting: 'ms-status-drafting',
    idea: 'ms-status-idea',
    accepted: 'ms-status-accepted',
    'not started': 'ms-status-not-started',
  }
  return map[status] || 'ms-status-not-started'
}

function progressFillClass(stage) {
  const map = {
    idea: 'ms-fill-gold',
    drafting: 'ms-fill-blue',
    review: 'ms-fill-purple',
    submitted: 'ms-fill-coral',
    accepted: 'ms-fill-green',
  }
  return map[stage] || 'ms-fill-purple'
}

const STAGE_KEY_MAP = {
  'Idea/Brainstorm': 'idea',
  'Drafting': 'drafting',
  'Internal Review': 'review',
  'Submitted': 'submitted',
  'Accepted': 'accepted',
}

/* ── Component ───────────────────────────────────────────── */

export default function ManuscriptsPage() {
  const [activeTab, setActiveTab] = useState('papers')
  const [expandedComments, setExpandedComments] = useState({})
  const [reviewFilter, setReviewFilter] = useState('all')
  const [expandedGrants, setExpandedGrants] = useState({ g1: true, g2: true })
  const [expandedAims, setExpandedAims] = useState({ 'g1-1': true })
  const [authorFilter, setAuthorFilter] = useState('all')
  const [papers, setPapers] = useState(INITIAL_PAPERS)
  const [showNewPaperModal, setShowNewPaperModal] = useState(false)
  const [newPaperForm, setNewPaperForm] = useState({
    title: '',
    venue: '',
    stage: 'Idea/Brainstorm',
    coAuthors: [],
    priority: 'medium',
  })

  useEffect(() => {
    listManuscripts()
      .then((entries) => {
        const apiPapers = entries.map((e) => ({
          id: e.sk,
          title: e.title,
          authors: (e.authors || []).map((a) =>
            typeof a === 'string'
              ? { initials: a.slice(0, 2).toUpperCase(), color: 'blue', name: a }
              : { initials: a.initials || '', color: a.color || 'blue', name: a.name || '' }
          ),
          venue: e.journal || null,
          stage: e.status || 'idea',
          priority: 'medium',
          progress: 0,
          deadline: null,
          meta: e.journal ? 'Target: ' + e.journal : 'API entry',
          linkedConversation: null,
          sk: e.sk,
        }))
        setPapers((prev) => [...apiPapers, ...prev])
      })
      .catch(() => {})
  }, [])

  function toggleComment(id) {
    setExpandedComments(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleGrant(id) {
    setExpandedGrants(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleAim(key) {
    setExpandedAims(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleCoAuthor(name) {
    setNewPaperForm(prev => ({
      ...prev,
      coAuthors: prev.coAuthors.includes(name)
        ? prev.coAuthors.filter(n => n !== name)
        : [...prev.coAuthors, name],
    }))
  }

  function handleNewPaperSubmit(e) {
    e.preventDefault()
    if (!newPaperForm.title.trim()) return

    const stageKey = STAGE_KEY_MAP[newPaperForm.stage] || 'idea'
    const selectedAuthors = TEAM_MEMBERS.filter(m =>
      newPaperForm.coAuthors.includes(m.name)
    ).map(m => ({ initials: m.initials, color: m.color, name: m.name }))

    const newPaper = {
      id: 'p' + (Date.now()),
      title: newPaperForm.title.trim(),
      authors: selectedAuthors,
      venue: newPaperForm.venue.trim() || null,
      stage: stageKey,
      priority: newPaperForm.priority,
      progress: stageKey === 'idea' ? 5 : stageKey === 'drafting' ? 15 : 0,
      deadline: null,
      meta: stageKey === 'idea' ? 'Brainstorm phase'
        : newPaperForm.venue.trim() ? 'Target: ' + newPaperForm.venue.trim()
        : 'New paper',
      linkedConversation: null,
    }

    setPapers(prev => [...prev, newPaper])
    setNewPaperForm({
      title: '',
      venue: '',
      stage: 'Idea/Brainstorm',
      coAuthors: [],
      priority: 'medium',
    })
    setShowNewPaperModal(false)

    createManuscript({
      title: newPaper.title,
      status: newPaper.stage,
      authors: newPaper.authors,
      journal: newPaper.venue || '',
      tags: [],
    }).catch(() => {})
  }

  const filteredComments = REVIEWER_COMMENTS.filter(c => {
    if (reviewFilter === 'all') return true
    if (reviewFilter === 'major') return c.severity === 'Major'
    if (reviewFilter === 'pending') return c.status !== 'Addressed'
    return true
  })

  const filteredPapers = papers.filter(p => {
    if (authorFilter === 'all') return true
    return p.authors.some(a => a.name === authorFilter)
  })

  const uniqueAuthors = [...new Set(papers.flatMap(p => p.authors.map(a => a.name)))]

  const addressedCount = REVIEWER_COMMENTS.filter(c => c.status === 'Addressed').length
  const totalComments = REVIEWER_COMMENTS.length

  return (
    <div className="ms-page">
      {/* ── Page header ──────────────────────── */}
      <header className="ms-header">
        <span className="ms-kicker">RESEARCH LIFECYCLE</span>
        <h1 className="ms-title">
          From idea to <em>publication.</em>
        </h1>
        <p className="ms-subtitle">
          Track every manuscript from first brainstorm through peer review to
          published paper - with full visibility into co-author assignments,
          reviewer responses, and grant deliverables.
        </p>
      </header>

      {/* ── Stats ────────────────────────────── */}
      <div className="ms-stats">
        <div className="ms-stat-card">
          <span className="ms-stat-label">Active Papers</span>
          <span className="ms-stat-value">{papers.filter(p => p.stage !== 'accepted').length}</span>
          <span className="ms-stat-sub">across {new Set(papers.filter(p => p.stage !== 'accepted').map(p => p.stage)).size} stages</span>
        </div>
        <div className="ms-stat-card">
          <span className="ms-stat-label">Under Review</span>
          <span className="ms-stat-value">{papers.filter(p => p.stage === 'review' || p.stage === 'submitted').length}</span>
          <span className="ms-stat-sub">internal + external</span>
        </div>
        <div className="ms-stat-card">
          <span className="ms-stat-label">Accepted This Year</span>
          <span className="ms-stat-value">{papers.filter(p => p.stage === 'accepted').length}</span>
          <span className="ms-stat-sub">AAAI, FAccT + 1 journal</span>
        </div>
        <div className="ms-stat-card">
          <span className="ms-stat-label">Upcoming Deadlines</span>
          <span className="ms-stat-value">2</span>
          <span className="ms-stat-sub">next 60 days</span>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────── */}
      <div className="ms-tabs">
        <button
          className={'ms-tab' + (activeTab === 'papers' ? ' ms-tab-active' : '')}
          onClick={() => setActiveTab('papers')}
        >
          Papers
          <span className="ms-tab-badge">{papers.length}</span>
        </button>
        <button
          className={'ms-tab' + (activeTab === 'reviews' ? ' ms-tab-active' : '')}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews
          <span className="ms-tab-badge">6</span>
        </button>
        <button
          className={'ms-tab' + (activeTab === 'grants' ? ' ms-tab-active' : '')}
          onClick={() => setActiveTab('grants')}
        >
          Grants
          <span className="ms-tab-badge">2</span>
        </button>
      </div>

      {/* ── Tab content ──────────────────────── */}
      <div className="ms-tab-content">

        {/* ──────────────────── PAPERS TAB ────── */}
        {activeTab === 'papers' && (
          <>
            {/* Header with New Paper button */}
            <div className="ms-papers-header">
              {/* Author filter */}
              <div className="ms-review-filter" style={{ marginBottom: 0 }}>
                <button
                  className={'ms-filter-btn' + (authorFilter === 'all' ? ' ms-filter-active' : '')}
                  onClick={() => setAuthorFilter('all')}
                >
                  All authors
                </button>
                {uniqueAuthors.map(name => (
                  <button
                    key={name}
                    className={'ms-filter-btn' + (authorFilter === name ? ' ms-filter-active' : '')}
                    onClick={() => setAuthorFilter(name)}
                  >
                    {name.split(' ')[0]}
                  </button>
                ))}
              </div>

              <button
                className="ms-new-paper-btn"
                onClick={() => setShowNewPaperModal(true)}
              >
                + New Paper
              </button>
            </div>

            <div className="ms-kanban">
              {STAGES.map(stage => {
                const cards = filteredPapers.filter(p => p.stage === stage.key)
                return (
                  <div className="ms-kanban-col" key={stage.key}>
                    <div className="ms-col-header">
                      <span className={'ms-col-dot ' + stage.dot} />
                      <span className="ms-col-name">{stage.label}</span>
                      <span className="ms-col-count">{cards.length}</span>
                    </div>
                    <div className="ms-col-cards">
                      {cards.map(paper => (
                        <div
                          className={
                            'ms-paper-card ms-priority-' + paper.priority
                          }
                          key={paper.id}
                        >
                          <span className="ms-paper-title">{paper.title}</span>

                          {paper.linkedConversation && (
                            <div className="ms-conversation-badge">
                              <span className="ms-conversation-badge-icon">{'💬'}</span>
                              {paper.linkedConversation}
                            </div>
                          )}

                          {paper.venue && (
                            <span className="ms-paper-venue">{paper.venue}</span>
                          )}

                          <div className="ms-avatars">
                            {paper.authors.map(a => (
                              <span
                                key={a.initials}
                                className={'ms-avatar-sm ms-av-' + a.color}
                                title={a.name}
                              >
                                {a.initials}
                              </span>
                            ))}
                          </div>

                          <div className="ms-paper-meta">
                            <span className="ms-paper-meta-icon">{'◷'}</span>
                            {paper.meta}
                          </div>

                          <div className="ms-progress-wrap">
                            <div className="ms-progress-bar">
                              <div
                                className={'ms-progress-fill ' + progressFillClass(paper.stage)}
                                style={{ width: paper.progress + '%' }}
                              />
                            </div>
                            <span className="ms-progress-pct">{paper.progress}%</span>
                          </div>

                          {/* Stage-specific extra info */}
                          {paper.stage === 'review' && paper.reviewInfo && (
                            <div className="ms-stage-info">
                              <span className="ms-stage-badge ms-badge-purple">{paper.meta}</span>
                              <span>{paper.reviewInfo}</span>
                            </div>
                          )}
                          {paper.stage === 'submitted' && paper.submittedInfo && (
                            <div className="ms-stage-info">
                              <span className="ms-stage-badge ms-badge-warning">{paper.submittedInfo}</span>
                            </div>
                          )}
                          {paper.stage === 'accepted' && paper.acceptedInfo && (
                            <div className="ms-stage-info">
                              <span className="ms-stage-badge ms-badge-success">{paper.acceptedInfo}</span>
                            </div>
                          )}
                          {paper.stage === 'drafting' && paper.deadline && (
                            <div className="ms-stage-info">
                              <span className="ms-stage-info-icon">{'⏰'}</span>
                              <span>Deadline: {paper.deadline}</span>
                            </div>
                          )}
                          {paper.stage === 'idea' && (
                            <div className="ms-stage-info">
                              <span className="ms-stage-badge ms-badge-info">No deadline set</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ──────────────────── REVIEWS TAB ───── */}
        {activeTab === 'reviews' && (
          <div className="ms-reviews">
            {/* Comments column */}
            <div>
              <div className="ms-reviews-header">
                <div>
                  <h2 className="ms-reviews-paper-title">
                    Geographic Bias in Neural Climate Models
                  </h2>
                  <span className="ms-reviews-paper-venue">Nature Climate Change</span>
                </div>
              </div>

              {/* Filter */}
              <div className="ms-review-filter">
                <button
                  className={'ms-filter-btn' + (reviewFilter === 'all' ? ' ms-filter-active' : '')}
                  onClick={() => setReviewFilter('all')}
                >
                  All ({totalComments})
                </button>
                <button
                  className={'ms-filter-btn' + (reviewFilter === 'major' ? ' ms-filter-active' : '')}
                  onClick={() => setReviewFilter('major')}
                >
                  Major only
                </button>
                <button
                  className={'ms-filter-btn' + (reviewFilter === 'pending' ? ' ms-filter-active' : '')}
                  onClick={() => setReviewFilter('pending')}
                >
                  Unresolved
                </button>
              </div>

              {/* Comments */}
              <div className="ms-comments-list">
                {filteredComments.map(comment => {
                  const isExpanded = expandedComments[comment.id]
                  return (
                    <div
                      className={
                        'ms-comment-card' +
                        (isExpanded ? ' ms-comment-expanded' : '')
                      }
                      key={comment.id}
                      onClick={() => toggleComment(comment.id)}
                    >
                      <div className="ms-comment-top">
                        <span className="ms-reviewer-tag">{comment.reviewer}</span>
                        <span className={'ms-severity ' + severityClass(comment.severity)}>
                          {comment.severity}
                        </span>
                        <span className={'ms-status-pill ' + statusClass(comment.status)}>
                          <span className="ms-status-dot" />
                          {comment.status}
                        </span>
                      </div>
                      <p className="ms-comment-text">{comment.text}</p>
                      <span className="ms-expand-hint">Click to expand details</span>

                      {/* Expandable detail */}
                      <div className="ms-comment-detail">
                        <div className="ms-comment-linked">
                          <span className="ms-linked-icon">{comment.linkedIcon}</span>
                          <div>
                            <div className="ms-linked-label">Linked Edit</div>
                            <div className="ms-linked-value">{comment.linkedEdit}</div>
                          </div>
                        </div>
                        <div className="ms-comment-assignee">
                          <span className="ms-assignee-label">Assigned to</span>
                          <span
                            className={'ms-avatar-sm ms-av-' + comment.assignee.color}
                            style={{ width: 22, height: 22, fontSize: 7 }}
                          >
                            {comment.assignee.initials}
                          </span>
                          <span className="ms-assignee-name">{comment.assignee.name}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sidebar */}
            <div className="ms-response-sidebar">
              {/* Progress card */}
              <div className="ms-response-card ms-response-card-dark">
                <span className="ms-response-title">Response Progress</span>
                <div className="ms-big-progress">
                  <span className="ms-big-number">{addressedCount}</span>
                  <span className="ms-big-total">/ {totalComments} addressed</span>
                </div>
                <div className="ms-big-bar">
                  <div
                    className="ms-big-bar-fill"
                    style={{ width: Math.round((addressedCount / totalComments) * 100) + '%' }}
                  />
                </div>
                <div className="ms-response-breakdown">
                  <div className="ms-breakdown-item">
                    <span className="ms-breakdown-count">
                      {REVIEWER_COMMENTS.filter(c => c.status === 'Addressed').length}
                    </span>
                    <span className="ms-breakdown-label">Addressed</span>
                  </div>
                  <div className="ms-breakdown-item">
                    <span className="ms-breakdown-count">
                      {REVIEWER_COMMENTS.filter(c => c.status === 'In Progress').length}
                    </span>
                    <span className="ms-breakdown-label">In progress</span>
                  </div>
                  <div className="ms-breakdown-item">
                    <span className="ms-breakdown-count">
                      {REVIEWER_COMMENTS.filter(c => c.status === 'Pending').length}
                    </span>
                    <span className="ms-breakdown-label">Pending</span>
                  </div>
                </div>
              </div>

              {/* Deadline card */}
              <div className="ms-response-card">
                <span className="ms-response-title">Response Deadline</span>
                <div className="ms-deadline-card">
                  <div className="ms-deadline-days">
                    <span className="ms-deadline-days-num">18</span>
                    <span className="ms-deadline-days-label">days</span>
                  </div>
                  <div className="ms-deadline-info">
                    <span className="ms-deadline-text">Response due Oct 5, 2025</span>
                    <span className="ms-deadline-sub">Submitted Sep 3 to Nature Climate Change</span>
                  </div>
                </div>
              </div>

              {/* Per-reviewer progress */}
              <div className="ms-response-card">
                <span className="ms-response-title">By Reviewer</span>
                <div className="ms-reviewer-summary">
                  {[
                    { name: 'Reviewer 1', addressed: 2, total: 2 },
                    { name: 'Reviewer 2', addressed: 1, total: 2 },
                    { name: 'Reviewer 3', addressed: 1, total: 2 },
                  ].map(r => (
                    <div className="ms-reviewer-row" key={r.name}>
                      <span className="ms-reviewer-name">{r.name}</span>
                      <div className="ms-reviewer-bar-wrap">
                        <div
                          className="ms-reviewer-bar-fill"
                          style={{ width: Math.round((r.addressed / r.total) * 100) + '%' }}
                        />
                      </div>
                      <span className="ms-reviewer-fraction">
                        {r.addressed}/{r.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────── GRANTS TAB ────── */}
        {activeTab === 'grants' && (
          <div className="ms-grants">
            {GRANTS.map(grant => (
              <div className="ms-grant-card" key={grant.id}>
                <div
                  className="ms-grant-header"
                  onClick={() => toggleGrant(grant.id)}
                >
                  <div>
                    <h3 className="ms-grant-title">{grant.title}</h3>
                    <span className="ms-grant-agency">{grant.agency}</span>
                    <div className="ms-grant-years">{grant.years}</div>
                  </div>
                  <button className="ms-grant-toggle">
                    {expandedGrants[grant.id] ? '▴' : '▾'}
                  </button>
                </div>

                <div className="ms-grant-progress-row">
                  <span className="ms-grant-progress-label">Overall</span>
                  <div className="ms-grant-progress-bar">
                    <div
                      className="ms-grant-progress-fill"
                      style={{ width: grant.progress + '%' }}
                    />
                  </div>
                  <span className="ms-grant-progress-pct">{grant.progress}%</span>
                </div>

                <div className={expandedGrants[grant.id] ? 'ms-aims' : 'ms-aims ms-aims-hidden'}>
                  {grant.aims.map(aim => {
                    const aimKey = grant.id + '-' + aim.number
                    const isAimOpen = expandedAims[aimKey]
                    return (
                      <div
                        className={'ms-aim' + (isAimOpen ? ' ms-aim-expanded' : '')}
                        key={aimKey}
                      >
                        <div
                          className="ms-aim-header"
                          onClick={() => toggleAim(aimKey)}
                        >
                          <span className="ms-aim-number">{aim.number}</span>
                          <span className="ms-aim-title">{aim.title}</span>
                          <span className="ms-aim-arrow">{'▸'}</span>
                        </div>

                        <div className="ms-aim-body">
                          {/* Progress */}
                          <div className="ms-aim-progress">
                            <div className="ms-aim-progress-bar">
                              <div
                                className="ms-aim-progress-fill"
                                style={{ width: aim.progress + '%' }}
                              />
                            </div>
                            <span className="ms-aim-progress-pct">{aim.progress}%</span>
                          </div>

                          {/* Papers */}
                          {aim.papers.length > 0 && (
                            <div className="ms-aim-section">
                              <div className="ms-aim-section-label">Linked Papers</div>
                              <div className="ms-aim-items">
                                {aim.papers.map((p, i) => (
                                  <span className="ms-aim-item" key={i}>
                                    {p.title}
                                    <span className={'ms-aim-item-status ' + statusBadgeClass(p.status)}>
                                      {p.status}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Datasets */}
                          {aim.datasets.length > 0 && (
                            <div className="ms-aim-section">
                              <div className="ms-aim-section-label">Datasets</div>
                              <div className="ms-aim-items">
                                {aim.datasets.map((d, i) => (
                                  <span className="ms-aim-item" key={i}>{d}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Outputs */}
                          {aim.outputs.length > 0 && (
                            <div className="ms-aim-section">
                              <div className="ms-aim-section-label">Outputs</div>
                              <div className="ms-aim-items">
                                {aim.outputs.map((o, i) => (
                                  <span className="ms-aim-item" key={i}>{o}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* No papers message */}
                          {aim.papers.length === 0 && aim.datasets.length === 0 && aim.outputs.length === 0 && (
                            <div className="ms-aim-section">
                              <div className="ms-aim-items">
                                <span className="ms-aim-item" style={{ color: '#879596', fontStyle: 'italic' }}>
                                  Not started yet
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Milestone */}
                          <div className="ms-aim-milestone">
                            <span className="ms-milestone-icon">{'⚑'}</span>
                            <div>
                              <div className="ms-milestone-label">Next Milestone</div>
                              <div className="ms-milestone-value">{aim.milestone}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── New Paper Modal ──────────────────── */}
      {showNewPaperModal && (
        <div className="ms-modal-overlay" onClick={() => setShowNewPaperModal(false)}>
          <div className="ms-modal" onClick={e => e.stopPropagation()}>
            <div className="ms-modal-header">
              <h2>New Paper</h2>
              <button className="ms-modal-close" onClick={() => setShowNewPaperModal(false)}>
                {'✕'}
              </button>
            </div>
            <form className="ms-modal-body" onSubmit={handleNewPaperSubmit}>
              {/* Title */}
              <div className="ms-modal-field">
                <label className="ms-modal-label">Title</label>
                <input
                  className="ms-modal-input"
                  type="text"
                  placeholder="Paper title..."
                  value={newPaperForm.title}
                  onChange={e => setNewPaperForm(prev => ({ ...prev, title: e.target.value }))}
                  autoFocus
                />
              </div>

              {/* Target Venue */}
              <div className="ms-modal-field">
                <label className="ms-modal-label">Target Venue</label>
                <input
                  className="ms-modal-input"
                  type="text"
                  placeholder="e.g., NeurIPS 2025"
                  value={newPaperForm.venue}
                  onChange={e => setNewPaperForm(prev => ({ ...prev, venue: e.target.value }))}
                />
              </div>

              {/* Stage */}
              <div className="ms-modal-field">
                <label className="ms-modal-label">Stage</label>
                <select
                  className="ms-modal-select"
                  value={newPaperForm.stage}
                  onChange={e => setNewPaperForm(prev => ({ ...prev, stage: e.target.value }))}
                >
                  <option value="Idea/Brainstorm">Idea / Brainstorm</option>
                  <option value="Drafting">Drafting</option>
                  <option value="Internal Review">Internal Review</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Accepted">Accepted</option>
                </select>
              </div>

              {/* Co-Authors */}
              <div className="ms-modal-field">
                <label className="ms-modal-label">Co-Authors</label>
                <div className="ms-modal-checkbox-group">
                  {TEAM_MEMBERS.map(member => (
                    <label
                      key={member.name}
                      className={
                        'ms-modal-checkbox-item' +
                        (newPaperForm.coAuthors.includes(member.name) ? ' ms-checked' : '')
                      }
                    >
                      <input
                        type="checkbox"
                        checked={newPaperForm.coAuthors.includes(member.name)}
                        onChange={() => toggleCoAuthor(member.name)}
                      />
                      <span
                        className={'ms-avatar-sm ms-av-' + member.color}
                        style={{ width: 18, height: 18, fontSize: 6, marginRight: 0, border: 'none' }}
                      >
                        {member.initials}
                      </span>
                      {member.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="ms-modal-field">
                <label className="ms-modal-label">Priority</label>
                <div className="ms-modal-radio-group">
                  {['high', 'medium', 'low'].map(level => (
                    <label
                      key={level}
                      className={
                        'ms-modal-radio-item' +
                        (newPaperForm.priority === level ? ' ms-radio-selected' : '')
                      }
                    >
                      <input
                        type="radio"
                        name="priority"
                        value={level}
                        checked={newPaperForm.priority === level}
                        onChange={() => setNewPaperForm(prev => ({ ...prev, priority: level }))}
                      />
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="ms-modal-submit"
                disabled={!newPaperForm.title.trim()}
              >
                Add Paper
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
