import { useState, useEffect } from 'react'
import { listAdvisingUpdates, createAdvisingUpdate } from '../../lib/api'
import './AdvisingPage.css'

/* ── Synthetic data ──────────────────────────────────────────────── */

const STUDENTS = [
  {
    id: 's1',
    name: 'Mumtahin Chen',
    initials: 'MC',
    color: 'coral',
    program: 'PhD Year 3',
    focus: 'Geographic bias in neural networks',
    status: 'green',
    statusLabel: 'On Track',
    lastUpdate: 'Sep 16, 2024',
    submitted: true,
    summary:
      'Completed ablation experiments. Results support distribution-shift hypothesis. Writing Section 4 of paper. Need feedback on figure layout.',
    wins: ['Ablation study complete', '2 figures generated'],
    blockers: ['Waiting for GPU cluster allocation'],
    hours: 42,
    mood: 'Focused and productive',
  },
  {
    id: 's2',
    name: 'Jordan Ellis',
    initials: 'JE',
    color: 'blue',
    program: 'PhD Year 2',
    focus: 'Architecture-independent evaluation methods',
    status: 'green',
    statusLabel: 'On Track',
    lastUpdate: 'Sep 16, 2024',
    submitted: true,
    summary:
      'Refactored evaluation pipeline. Added region-split analysis. Started draft of methodology section.',
    wins: ['Pipeline refactored', 'Clean code review'],
    blockers: [],
    hours: 38,
    mood: 'Steady progress',
  },
  {
    id: 's3',
    name: 'Ari Singh',
    initials: 'AS',
    color: 'gold',
    program: 'MS Year 2',
    focus: 'Community engagement in climate AI',
    status: 'amber',
    statusLabel: 'Needs Attention',
    lastUpdate: 'Sep 15, 2024',
    submitted: true,
    summary:
      'Met with Dr. Anderson about bias angle. Preparing seminar slides. Behind on literature review.',
    wins: ['Good mentor meeting'],
    blockers: ['Literature review behind schedule'],
    hours: 28,
    mood: 'Slightly behind',
  },
  {
    id: 's4',
    name: 'Maria Lopez',
    initials: 'ML',
    color: 'teal',
    program: 'PhD Year 4',
    focus: 'Causal inference in environmental health',
    status: 'green',
    statusLabel: 'On Track',
    lastUpdate: 'Sep 16, 2024',
    submitted: true,
    summary:
      'IRB amendment approved. Started data collection from 3 new sites. Submitted abstract to ISEE 2025.',
    wins: ['IRB approved', 'Abstract submitted'],
    blockers: ['One site has data quality issues'],
    hours: 45,
    mood: 'Energized',
  },
  {
    id: 's5',
    name: 'Chen Wei',
    initials: 'CW',
    color: 'purple',
    program: 'PhD Year 1',
    focus: 'Federated learning for multi-site data',
    status: 'red',
    statusLabel: 'At Risk',
    lastUpdate: null,
    submitted: false,
    summary: null,
    wins: [],
    blockers: [],
    hours: null,
    mood: null,
    overdue: true,
    overdueDays: 3,
    lastContact: '8 days ago',
    note: 'Missed last 1:1 meeting',
  },
]

const MILESTONES = [
  {
    id: 'm1',
    studentId: 's5',
    student: 'Chen Wei',
    initials: 'CW',
    color: 'purple',
    type: 'Qualifying Exam',
    typeClass: 'exam',
    due: 'Oct 15, 2024',
    countdown: 'OVERDUE',
    countdownClass: 'overdue',
    progress: 40,
    progressColor: 'red',
    status: 'Overdue',
    statusColor: 'red',
    signedOff: false,
    notes: 'Committee meeting not yet scheduled. Advisor follow-up needed.',
  },
  {
    id: 'm2',
    studentId: 's3',
    student: 'Ari Singh',
    initials: 'AS',
    color: 'gold',
    type: 'MS Thesis Draft',
    typeClass: 'thesis',
    due: 'Nov 1, 2024',
    countdown: '45 days',
    countdownClass: 'soon',
    progress: 55,
    progressColor: 'amber',
    status: 'At Risk',
    statusColor: 'amber',
    signedOff: false,
    notes: 'Literature review section needs significant revision before draft is ready.',
  },
  {
    id: 'm3',
    studentId: 's1',
    student: 'Mumtahin Chen',
    initials: 'MC',
    color: 'coral',
    type: 'Thesis Proposal Defense',
    typeClass: 'defense',
    due: 'Dec 10, 2024',
    countdown: '85 days',
    countdownClass: 'ok',
    progress: 78,
    progressColor: 'green',
    status: 'On Track',
    statusColor: 'green',
    signedOff: false,
    notes: 'Committee confirmed. Proposal draft in review.',
  },
  {
    id: 'm4',
    studentId: 's2',
    student: 'Jordan Ellis',
    initials: 'JE',
    color: 'blue',
    type: 'Candidacy Exam',
    typeClass: 'exam',
    due: 'Feb 15, 2025',
    countdown: '152 days',
    countdownClass: 'ok',
    progress: 65,
    progressColor: 'green',
    status: 'On Track',
    statusColor: 'green',
    signedOff: false,
    notes: 'Reading list complete. Practice presentations scheduled.',
  },
  {
    id: 'm5',
    studentId: 's4',
    student: 'Maria Lopez',
    initials: 'ML',
    color: 'teal',
    type: 'Dissertation Final Defense',
    typeClass: 'defense',
    due: 'May 2025',
    countdown: '~8 months',
    countdownClass: 'ok',
    progress: 82,
    progressColor: 'green',
    status: 'On Track',
    statusColor: 'green',
    signedOff: false,
    notes: 'Chapters 1-3 approved. Data collection on track for January completion.',
  },
  {
    id: 'm6',
    studentId: 's1',
    student: 'Mumtahin Chen',
    initials: 'MC',
    color: 'coral',
    type: 'First-Author Publication',
    typeClass: 'publication',
    due: 'Jan 31, 2025',
    countdown: '137 days',
    countdownClass: 'ok',
    progress: 90,
    progressColor: 'purple',
    status: 'On Track',
    statusColor: 'green',
    signedOff: false,
    notes: 'Manuscript drafted. Figures finalized. Target journal: NeurIPS workshop.',
  },
]

const AI_USAGE_STUDENTS = [
  {
    id: 's1',
    name: 'Mumtahin Chen',
    initials: 'MC',
    color: 'coral',
    total: 34,
    pattern: 'normal',
    commands: { ask: 12, summarize: 8, search: 6, analyze: 5, translate: 3, extract: 0 },
    note: null,
  },
  {
    id: 's2',
    name: 'Jordan Ellis',
    initials: 'JE',
    color: 'blue',
    total: 41,
    pattern: 'normal',
    commands: { ask: 15, summarize: 8, search: 10, analyze: 3, extract: 5, translate: 0 },
    note: null,
  },
  {
    id: 's3',
    name: 'Ari Singh',
    initials: 'AS',
    color: 'gold',
    total: 22,
    pattern: 'normal',
    commands: { ask: 8, summarize: 6, search: 5, analyze: 0, extract: 0, translate: 3 },
    note: null,
  },
  {
    id: 's4',
    name: 'Maria Lopez',
    initials: 'ML',
    color: 'teal',
    total: 18,
    pattern: 'light',
    commands: { ask: 7, summarize: 4, search: 5, analyze: 0, extract: 2, translate: 0 },
    note: null,
  },
  {
    id: 's5',
    name: 'Chen Wei',
    initials: 'CW',
    color: 'purple',
    total: 12,
    pattern: 'light',
    commands: { ask: 5, summarize: 2, search: 3, analyze: 2, extract: 0, translate: 0 },
    note: 'Fewer commands correlates with missed updates',
  },
]

const WEEKLY_TRENDS = [
  { label: 'W1', value: 5, level: 'full' },
  { label: 'W2', value: 4, level: 'high' },
  { label: 'W3', value: 5, level: 'full' },
  { label: 'W4', value: 3, level: 'mid' },
  { label: 'W5', value: 5, level: 'full' },
  { label: 'W6', value: 4, level: 'high' },
  { label: 'W7', value: 2, level: 'low' },
  { label: 'W8', value: 4, level: 'high' },
]

const CMD_COLORS = {
  ask: 'ask',
  summarize: 'summarize',
  search: 'search',
  analyze: 'analyze',
  extract: 'extract',
  translate: 'translate',
}

const PAST_UPDATES = [
  {
    id: 'pu1',
    date: 'Sep 9, 2024',
    wins: 'Completed initial data cleaning pipeline for multi-site dataset. Set up automated validation checks.',
    blockers: 'Need access to GPU cluster for model training runs.',
    hours: 35,
    notes: 'Planning to attend NeurIPS workshop next month. Will need travel approval.',
  },
  {
    id: 'pu2',
    date: 'Sep 2, 2024',
    wins: 'Attended workshop on transformer architectures. Drafted outline for Section 2 of thesis.',
    blockers: 'None this week.',
    hours: 40,
    notes: 'Good progress on literature review. Met with co-advisor Dr. Anderson.',
  },
  {
    id: 'pu3',
    date: 'Aug 26, 2024',
    wins: 'Literature review milestone complete. Identified 3 new relevant papers on federated learning.',
    blockers: 'Waiting for IRB amendment approval before starting participant interviews.',
    hours: 32,
    notes: 'Need to schedule committee meeting soon to discuss methodology pivot.',
  },
]

/* ── Component ───────────────────────────────────────────────────── */

function AdvisingPage({ userProfile }) {
  const demoRole = userProfile?.labRole === 'pi' || userProfile?.labRole === 'advisor'
    ? 'pi'
    : userProfile?.labRole === 'student'
      ? 'student'
      : 'member'

  const [activeTab, setActiveTab] = useState(demoRole === 'pi' ? 'overview' : 'dashboard')
  const [statusFilter, setStatusFilter] = useState('all')
  const [timeRange, setTimeRange] = useState('week')
  const [expandedCards, setExpandedCards] = useState({})
  const [signoffs, setSignoffs] = useState({})
  const [weeklyForm, setWeeklyForm] = useState({
    wins: '',
    blockers: '',
    hours: '',
    notes: '',
  })
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [toast, setToast] = useState(null)
  const [apiUpdates, setApiUpdates] = useState([])

  useEffect(() => {
    listAdvisingUpdates()
      .then((entries) => setApiUpdates(entries))
      .catch(() => {})
  }, [])

  const allPastUpdates = [
    ...apiUpdates.map((e) => ({
      id: e.sk,
      date: e.createdAt
        ? new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '',
      wins: e.wins || '',
      blockers: e.blockers || '',
      hours: e.hours || 0,
      notes: e.notes || '',
      mood: e.mood || '',
      studentName: e.studentName || '',
      sk: e.sk,
    })),
    ...PAST_UPDATES,
  ]

  const toggleExpand = (id) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleSignoff = (id) => {
    setSignoffs((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleFormChange = (field, value) => {
    setWeeklyForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    const submittedData = { ...weeklyForm }
    setFormSubmitted(true)
    setWeeklyForm({ wins: '', blockers: '', hours: '', notes: '' })
    setTimeout(() => setFormSubmitted(false), 4000)

    createAdvisingUpdate({
      wins: submittedData.wins,
      blockers: submittedData.blockers,
      hours: submittedData.hours ? parseInt(submittedData.hours, 10) : 0,
      notes: submittedData.notes,
    })
      .then((entry) => {
        if (entry) setApiUpdates((prev) => [entry, ...prev])
      })
      .catch(() => {})
  }

  const handleSchedule = (name) => {
    setToast(`Meeting request sent to ${name}`)
    setTimeout(() => setToast(null), 3000)
  }

  const filteredStudents =
    statusFilter === 'all'
      ? STUDENTS
      : STUDENTS.filter((s) => s.status === statusFilter)

  const maxBarHeight = 60

  /* ── Derived data for student view ─────────────────────────────── */
  const currentStudent = STUDENTS.find((s) => s.id === 's1')
  const studentMilestones = MILESTONES.filter((m) => m.studentId === 's1')
  const studentAiUsage = AI_USAGE_STUDENTS.find((s) => s.id === 's1')

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className="adv-page">
      {/* Page header */}
      <header className="adv-header">
        <div className="adv-kicker">
          <span className="adv-kicker-dot" />
          MENTORSHIP &amp; ADVISING
        </div>

        {demoRole === 'pi' && (
          <>
            <h1 className="adv-title">
              Advisor's window into <em>the lab.</em>
            </h1>
            <p className="adv-subtitle">
              Structured mentorship at scale -- weekly updates, milestone tracking,
              and transparent AI usage to support academic integrity across your
              research group.
            </p>
          </>
        )}

        {demoRole === 'student' && (
          <>
            <h1 className="adv-title">
              Your research <em>dashboard.</em>
            </h1>
            <p className="adv-subtitle">
              Welcome back, Mumtahin. Track your progress, submit updates,
              and stay on top of your milestones.
            </p>
          </>
        )}

        {demoRole === 'member' && (
          <>
            <h1 className="adv-title">
              Lab progress <em>overview.</em>
            </h1>
            <p className="adv-subtitle">
              A shared view of team progress to keep everyone aligned and informed
              about what the group is working on.
            </p>
          </>
        )}
      </header>

      {/* ── PI VIEW ──────────────────────────────────────────────── */}
      {demoRole === 'pi' && (
        <>
          {/* Tabs */}
          <div className="adv-tabs" role="tablist">
            <button
              className={`adv-tab${activeTab === 'overview' ? ' active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`adv-tab${activeTab === 'dashboard' ? ' active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`adv-tab${activeTab === 'milestones' ? ' active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'milestones'}
              onClick={() => setActiveTab('milestones')}
            >
              Milestones
              <span className="adv-tab-badge">1</span>
            </button>
            <button
              className={`adv-tab${activeTab === 'ai-usage' ? ' active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'ai-usage'}
              onClick={() => setActiveTab('ai-usage')}
            >
              AI Usage
            </button>
          </div>

          {/* ── TAB 0: Overview (same as member view) ─────────────────── */}
          {activeTab === 'overview' && (
            <>
              <div className="adv-section-head">
                <h2 className="adv-section-title">Team Progress</h2>
              </div>

              <div className="adv-students-grid">
                {STUDENTS.map((s) => (
                  <div
                    key={s.id}
                    className={`adv-student-card status-${s.status}`}
                  >
                    <div className="adv-student-top">
                      <div className={`adv-avatar ${s.color}`}>{s.initials}</div>
                      <div className="adv-student-info">
                        <span className="adv-student-name">{s.name}</span>
                        <span className="adv-student-program">{s.program}</span>
                        <span className="adv-student-focus">{s.focus}</span>
                      </div>
                      <span className={`adv-status-badge ${s.status}`}>
                        <span className={`adv-status-dot ${s.status}`} />
                        {s.statusLabel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="adv-section-head" style={{ marginTop: '32px' }}>
                <h2 className="adv-section-title">Team Milestones</h2>
              </div>

              <div className="adv-milestone-list">
                {MILESTONES.map((m) => (
                  <div key={m.id} className="adv-milestone-card">
                    <div className="adv-milestone-left">
                      <div className={`adv-avatar ${m.color}`}>{m.initials}</div>
                      <div className="adv-milestone-info">
                        <div className="adv-milestone-student">
                          <span className="adv-milestone-student-name">
                            {m.student}
                          </span>
                          <span className={`adv-milestone-type ${m.typeClass}`}>
                            {m.type}
                          </span>
                        </div>
                        <div className="adv-milestone-due">
                          Due: {m.due}
                          <span
                            className={`adv-milestone-countdown ${m.countdownClass}`}
                          >
                            {m.countdown}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="adv-progress-section">
                      <div className="adv-progress-row">
                        <div className="adv-progress-track">
                          <div
                            className={`adv-progress-fill ${m.progressColor}`}
                            style={{ width: `${m.progress}%` }}
                          />
                        </div>
                        <span className="adv-progress-pct">{m.progress}%</span>
                      </div>
                      <span
                        className={`adv-status-badge ${m.statusColor}`}
                        style={{ display: 'inline-flex' }}
                      >
                        <span className={`adv-status-dot ${m.statusColor}`} />
                        {m.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="adv-policy-card"
                style={{ marginTop: '32px' }}
              >
                <p
                  className="adv-policy-text"
                  style={{ textAlign: 'center', opacity: 0.8 }}
                >
                  This is the public overview visible to all lab members. Switch to
                  Dashboard, Milestones, or AI Usage tabs for advisor-only tools.
                </p>
              </div>
            </>
          )}

          {/* ── TAB 1: Dashboard ─────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <>
              {/* Quick stats */}
              <div className="adv-stats-grid">
                <div className="adv-stat-card">
                  <span className="adv-stat-label">Active Advisees</span>
                  <span className="adv-stat-value">5</span>
                  <span className="adv-stat-sub">Across 3 programs</span>
                </div>
                <div className="adv-stat-card">
                  <span className="adv-stat-label">Updates This Week</span>
                  <span className="adv-stat-value">4/5</span>
                  <span className="adv-stat-sub">1 overdue (Chen Wei)</span>
                </div>
                <div className="adv-stat-card">
                  <span className="adv-stat-label">Milestones Due (30d)</span>
                  <span className="adv-stat-value">3</span>
                  <span className="adv-stat-sub">1 overdue, 1 at risk</span>
                </div>
                <div className="adv-stat-card highlight">
                  <span className="adv-stat-label">Avg Response Time</span>
                  <span className="adv-stat-value">1.2d</span>
                  <span className="adv-stat-sub">Advisor feedback turnaround</span>
                </div>
              </div>

              {/* Controls */}
              <div className="adv-controls">
                <div className="adv-filters">
                  {[
                    { key: 'all', label: 'All Students' },
                    { key: 'green', label: 'On Track' },
                    { key: 'amber', label: 'Needs Attention' },
                    { key: 'red', label: 'At Risk' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      className={`adv-filter-btn${statusFilter === f.key ? ' active' : ''}`}
                      onClick={() => setStatusFilter(f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="adv-time-toggles">
                  {[
                    { key: 'week', label: 'This Week' },
                    { key: 'month', label: 'This Month' },
                    { key: 'quarter', label: 'This Quarter' },
                  ].map((t) => (
                    <button
                      key={t.key}
                      className={`adv-time-btn${timeRange === t.key ? ' active' : ''}`}
                      onClick={() => setTimeRange(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student cards */}
              <div className="adv-students-grid">
                {filteredStudents.map((s) => (
                  <div
                    key={s.id}
                    className={`adv-student-card status-${s.status}`}
                  >
                    <div className="adv-student-top">
                      <div className={`adv-avatar ${s.color}`}>{s.initials}</div>
                      <div className="adv-student-info">
                        <span className="adv-student-name">{s.name}</span>
                        <span className="adv-student-program">{s.program}</span>
                        <span className="adv-student-focus">{s.focus}</span>
                      </div>
                      <span className={`adv-status-badge ${s.status}`}>
                        <span className={`adv-status-dot ${s.status}`} />
                        {s.statusLabel}
                      </span>
                    </div>

                    <div className="adv-student-body">
                      {/* Update date + status */}
                      <div className="adv-update-date">
                        <span>
                          {s.lastUpdate
                            ? `Last update: ${s.lastUpdate}`
                            : 'No update submitted'}
                        </span>
                        {s.submitted ? (
                          <span className="adv-submitted-tag submitted">
                            Submitted
                          </span>
                        ) : (
                          <span className="adv-submitted-tag overdue">
                            {s.overdueDays
                              ? `${s.overdueDays} days overdue`
                              : 'Overdue'}
                          </span>
                        )}
                      </div>

                      {/* Summary or overdue notice */}
                      {s.summary ? (
                        <p className="adv-update-summary">{s.summary}</p>
                      ) : (
                        <div className="adv-overdue-notice">
                          <span>&#9888;</span>
                          <div>
                            <strong>Update not submitted</strong> -- last contact{' '}
                            {s.lastContact}. {s.note}.
                          </div>
                        </div>
                      )}

                      {/* Expand toggle */}
                      {s.submitted && (
                        <button
                          className="adv-details-toggle"
                          onClick={() => toggleExpand(s.id)}
                        >
                          {expandedCards[s.id]
                            ? '▴ Hide details'
                            : '▾ Show details'}
                        </button>
                      )}

                      {/* Expanded details */}
                      {expandedCards[s.id] && s.submitted && (
                        <div className="adv-expanded-details">
                          <div className="adv-detail-row">
                            <span className="adv-detail-label">Wins</span>
                            <span className="adv-detail-value green">
                              {s.wins.length > 0
                                ? s.wins.join(' / ')
                                : 'None reported'}
                            </span>
                          </div>
                          <div className="adv-detail-row">
                            <span className="adv-detail-label">Blockers</span>
                            <span
                              className={`adv-detail-value${s.blockers.length > 0 ? ' amber' : ''}`}
                            >
                              {s.blockers.length > 0
                                ? s.blockers.join(' / ')
                                : 'None'}
                            </span>
                          </div>
                          <div className="adv-detail-row">
                            <span className="adv-detail-label">Hours</span>
                            <span className="adv-detail-value">
                              {s.hours}h this week
                            </span>
                          </div>
                          <div className="adv-detail-row">
                            <span className="adv-detail-label">Mood</span>
                            <span className="adv-detail-value">{s.mood}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="adv-student-footer">
                      <button className="adv-action-btn">Comment</button>
                      <button
                        className="adv-action-btn"
                        onClick={() => handleSchedule(s.name)}
                      >
                        Schedule 1:1
                      </button>
                      <button className="adv-action-btn primary">
                        View History
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Weekly trends */}
              <section className="adv-trends-section">
                <div className="adv-trends-card">
                  <div className="adv-trends-head">
                    <span className="adv-trends-title">
                      Weekly update submission rate
                    </span>
                    <span className="adv-trends-meta">Last 8 weeks</span>
                  </div>
                  <div className="adv-trends-chart">
                    {WEEKLY_TRENDS.map((w) => (
                      <div key={w.label} className="adv-trend-bar-wrap">
                        <span className="adv-trend-value">{w.value}/5</span>
                        <span
                          className={`adv-trend-bar ${w.level}`}
                          style={{
                            height: `${(w.value / 5) * maxBarHeight}px`,
                          }}
                        />
                        <span className="adv-trend-label">{w.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── TAB 2: Milestones ────────────────────────────────────── */}
          {activeTab === 'milestones' && (
            <>
              {/* Milestone summary stats */}
              <div className="adv-milestones-summary">
                <div className="adv-stat-card">
                  <span className="adv-stat-label">Completed This Year</span>
                  <span className="adv-stat-value">4</span>
                  <span className="adv-stat-sub">All signed off</span>
                </div>
                <div className="adv-stat-card">
                  <span className="adv-stat-label">On Track</span>
                  <span className="adv-stat-value" style={{ color: '#1d8102' }}>
                    3
                  </span>
                  <span className="adv-stat-sub">Progressing as expected</span>
                </div>
                <div className="adv-stat-card">
                  <span className="adv-stat-label">At Risk</span>
                  <span className="adv-stat-value" style={{ color: '#ff9900' }}>
                    1
                  </span>
                  <span className="adv-stat-sub">Needs intervention</span>
                </div>
                <div className="adv-stat-card">
                  <span className="adv-stat-label">Overdue</span>
                  <span className="adv-stat-value" style={{ color: '#d13212' }}>
                    1
                  </span>
                  <span className="adv-stat-sub">Immediate action required</span>
                </div>
              </div>

              <div className="adv-section-head">
                <h2 className="adv-section-title">Upcoming milestones</h2>
              </div>

              <div className="adv-milestone-list">
                {MILESTONES.map((m) => (
                  <div key={m.id} className="adv-milestone-card">
                    {/* Left: student + milestone info */}
                    <div className="adv-milestone-left">
                      <div className={`adv-avatar ${m.color}`}>{m.initials}</div>
                      <div className="adv-milestone-info">
                        <div className="adv-milestone-student">
                          <span className="adv-milestone-student-name">
                            {m.student}
                          </span>
                          <span className={`adv-milestone-type ${m.typeClass}`}>
                            {m.type}
                          </span>
                        </div>
                        <div className="adv-milestone-due">
                          Due: {m.due}
                          <span
                            className={`adv-milestone-countdown ${m.countdownClass}`}
                          >
                            {m.countdown}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Center: progress */}
                    <div className="adv-progress-section">
                      <div className="adv-progress-row">
                        <div className="adv-progress-track">
                          <div
                            className={`adv-progress-fill ${m.progressColor}`}
                            style={{ width: `${m.progress}%` }}
                          />
                        </div>
                        <span className="adv-progress-pct">{m.progress}%</span>
                      </div>
                      <span
                        className={`adv-status-badge ${m.statusColor}`}
                        style={{ display: 'inline-flex' }}
                      >
                        <span className={`adv-status-dot ${m.statusColor}`} />
                        {m.status}
                      </span>
                      {m.notes && (
                        <div className="adv-milestone-notes">{m.notes}</div>
                      )}
                    </div>

                    {/* Right: sign-off */}
                    <div className="adv-milestone-right">
                      <label className="adv-signoff">
                        <input
                          type="checkbox"
                          checked={!!signoffs[m.id]}
                          onChange={() => toggleSignoff(m.id)}
                        />
                        Advisor sign-off
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── TAB 3: AI Usage ──────────────────────────────────────── */}
          {activeTab === 'ai-usage' && (
            <>
              {/* Overview stats */}
              <div className="adv-ai-overview">
                <div className="adv-stat-card">
                  <span className="adv-stat-label">Total Commands</span>
                  <span className="adv-stat-value">127</span>
                  <span className="adv-stat-sub">This month</span>
                </div>
                <div className="adv-stat-card">
                  <span className="adv-stat-label">Unique Users</span>
                  <span className="adv-stat-value">5</span>
                  <span className="adv-stat-sub">All advisees active</span>
                </div>
                <div className="adv-stat-card">
                  <span className="adv-stat-label">Most Used</span>
                  <span className="adv-stat-value" style={{ fontSize: '20px' }}>
                    /ask
                  </span>
                  <span className="adv-stat-sub">42 commands (33%)</span>
                </div>
                <div className="adv-stat-card highlight">
                  <span className="adv-stat-label">Top Purpose</span>
                  <span className="adv-stat-value" style={{ fontSize: '18px' }}>
                    Lit Search
                  </span>
                  <span className="adv-stat-sub">38% of all queries</span>
                </div>
              </div>

              {/* Command + Purpose breakdown */}
              <div className="adv-ai-breakdown-row">
                <div className="adv-ai-card">
                  <span className="adv-ai-card-title">
                    Command Breakdown
                  </span>
                  <div className="adv-cmd-list">
                    {[
                      { cmd: '/ask', count: 42, max: 42, cls: 'ask' },
                      { cmd: '/summarize', count: 31, max: 42, cls: 'summarize' },
                      { cmd: '/search', count: 28, max: 42, cls: 'search' },
                      { cmd: '/analyze', count: 14, max: 42, cls: 'analyze' },
                      { cmd: '/extract', count: 7, max: 42, cls: 'extract' },
                      { cmd: '/translate', count: 5, max: 42, cls: 'translate' },
                    ].map((c) => (
                      <div key={c.cmd} className="adv-cmd-row">
                        <span className="adv-cmd-name">{c.cmd}</span>
                        <div className="adv-cmd-bar-track">
                          <div
                            className={`adv-cmd-bar-fill ${c.cls}`}
                            style={{
                              width: `${(c.count / c.max) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="adv-cmd-count">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="adv-ai-card">
                  <span className="adv-ai-card-title">
                    Purpose Breakdown
                  </span>
                  <div className="adv-purpose-list">
                    {[
                      {
                        label: 'Literature search',
                        pct: 38,
                        color: '#ff9900',
                      },
                      {
                        label: 'Data analysis',
                        pct: 29,
                        color: '#0073bb',
                      },
                      {
                        label: 'Writing assistance',
                        pct: 18,
                        color: '#ec7211',
                      },
                      {
                        label: 'Code help',
                        pct: 15,
                        color: '#ff9900',
                      },
                    ].map((p) => (
                      <div key={p.label} className="adv-purpose-row">
                        <span className="adv-purpose-label">{p.label}</span>
                        <div className="adv-purpose-bar-track">
                          <div
                            className="adv-purpose-bar-fill"
                            style={{
                              width: `${p.pct}%`,
                              background: p.color,
                            }}
                          />
                        </div>
                        <span className="adv-purpose-pct">{p.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Per-student usage */}
              <div className="adv-section-head">
                <h2 className="adv-section-title">Per-student usage</h2>
              </div>

              {/* Stacked bar legend */}
              <div
                className="adv-stacked-legend"
                style={{ marginBottom: '16px' }}
              >
                {Object.entries(CMD_COLORS).map(([cmd, cls]) => (
                  <span key={cmd} className="adv-legend-item">
                    <span className={`adv-legend-dot ${cls}`} />/{cmd}
                  </span>
                ))}
              </div>

              <div className="adv-ai-student-list">
                {AI_USAGE_STUDENTS.map((s) => {
                  const total = s.total || 1
                  return (
                    <div key={s.id} className="adv-ai-student-card">
                      <div className={`adv-avatar ${s.color}`}>{s.initials}</div>
                      <div className="adv-ai-student-meta">
                        <span className="adv-ai-student-name">{s.name}</span>
                        <span className="adv-ai-student-total">
                          {s.total} commands this month
                        </span>
                      </div>
                      <div className="adv-stacked-bar-wrap">
                        <div className="adv-stacked-bar">
                          {Object.entries(s.commands)
                            .filter(([, v]) => v > 0)
                            .map(([cmd, count]) => (
                              <div
                                key={cmd}
                                className={`adv-stacked-segment ${CMD_COLORS[cmd]}`}
                                style={{
                                  width: `${(count / total) * 100}%`,
                                }}
                                title={`/${cmd}: ${count}`}
                              />
                            ))}
                        </div>
                      </div>
                      <span className={`adv-usage-badge ${s.pattern}`}>
                        {s.pattern === 'normal'
                          ? 'Normal'
                          : s.pattern === 'heavy'
                            ? 'Heavy'
                            : 'Light'}
                      </span>
                      {s.note && (
                        <span className="adv-ai-note">&#9432; {s.note}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Policy compliance */}
              <div className="adv-policy-card">
                <div className="adv-policy-icon">
                  <span>&#10022;</span>
                  <span className="adv-policy-label">
                    Academic Integrity Policy
                  </span>
                </div>
                <h3 className="adv-policy-title">
                  Transparency by design, not surveillance.
                </h3>
                <p className="adv-policy-text">
                  All AI usage in BridgeBoard is logged and transparent. Students
                  are encouraged to use AI tools for research acceleration while
                  maintaining academic integrity. Usage data helps advisors support
                  students, not penalize them. Command logs are visible to both
                  student and advisor, fostering open dialogue about responsible AI
                  use in research.
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* ── STUDENT VIEW ─────────────────────────────────────────── */}
      {demoRole === 'student' && (
        <>
          {/* Personal status card */}
          {currentStudent && (
            <div
              className={`adv-student-card status-${currentStudent.status}`}
              style={{ marginBottom: '24px' }}
            >
              <div className="adv-student-top">
                <div className={`adv-avatar ${currentStudent.color}`}>
                  {currentStudent.initials}
                </div>
                <div className="adv-student-info">
                  <span className="adv-student-name">{currentStudent.name}</span>
                  <span className="adv-student-program">
                    {currentStudent.program}
                  </span>
                  <span className="adv-student-focus">{currentStudent.focus}</span>
                </div>
                <span className={`adv-status-badge ${currentStudent.status}`}>
                  <span className={`adv-status-dot ${currentStudent.status}`} />
                  {currentStudent.statusLabel}
                </span>
              </div>
              <div className="adv-student-body">
                <div className="adv-update-date">
                  <span>Last update: {currentStudent.lastUpdate}</span>
                  <span className="adv-submitted-tag submitted">Submitted</span>
                </div>
              </div>
            </div>
          )}

          {/* Weekly update form */}
          <div className="adv-weekly-form-card">
            <h2 className="adv-form-title">Submit Weekly Update</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="adv-form-group">
                <label className="adv-form-label" htmlFor="adv-wins">
                  Wins this week
                </label>
                <textarea
                  id="adv-wins"
                  className="adv-form-textarea"
                  placeholder="What did you accomplish this week?"
                  value={weeklyForm.wins}
                  onChange={(e) => handleFormChange('wins', e.target.value)}
                />
              </div>
              <div className="adv-form-group">
                <label className="adv-form-label" htmlFor="adv-blockers">
                  Blockers
                </label>
                <textarea
                  id="adv-blockers"
                  className="adv-form-textarea"
                  placeholder="Anything blocking your progress?"
                  value={weeklyForm.blockers}
                  onChange={(e) => handleFormChange('blockers', e.target.value)}
                />
              </div>
              <div className="adv-form-group">
                <label className="adv-form-label" htmlFor="adv-hours">
                  Hours spent
                </label>
                <input
                  id="adv-hours"
                  type="number"
                  className="adv-form-number"
                  placeholder="0"
                  min="0"
                  max="168"
                  value={weeklyForm.hours}
                  onChange={(e) => handleFormChange('hours', e.target.value)}
                />
              </div>
              <div className="adv-form-group">
                <label className="adv-form-label" htmlFor="adv-notes">
                  Additional notes
                </label>
                <textarea
                  id="adv-notes"
                  className="adv-form-textarea"
                  placeholder="Anything else your advisor should know?"
                  value={weeklyForm.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                />
              </div>
              <button type="submit" className="adv-submit-btn">
                Submit Update
              </button>
              {formSubmitted && (
                <div className="adv-success-message">
                  &#10003; Weekly update submitted successfully!
                </div>
              )}
            </form>
          </div>

          {/* Past updates */}
          <div className="adv-past-updates-section">
            <h3 className="adv-past-updates-title">Your Past Updates</h3>
            {allPastUpdates.map((u) => (
              <div key={u.id} className="adv-past-update-card">
                <div className="adv-past-update-date">
                  Week of {u.date}
                </div>
                <div className="adv-past-update-field">
                  <div className="adv-past-update-field-label">Wins</div>
                  <div className="adv-past-update-field-value">{u.wins}</div>
                </div>
                <div className="adv-past-update-field">
                  <div className="adv-past-update-field-label">Blockers</div>
                  <div className="adv-past-update-field-value">
                    {u.blockers}
                  </div>
                </div>
                <div className="adv-past-update-field">
                  <div className="adv-past-update-field-label">Hours</div>
                  <div className="adv-past-update-field-value">
                    {u.hours}h
                  </div>
                </div>
                {u.notes && (
                  <div className="adv-past-update-field">
                    <div className="adv-past-update-field-label">Notes</div>
                    <div className="adv-past-update-field-value">
                      {u.notes}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Student milestones */}
          <div className="adv-section-head" style={{ marginTop: '32px' }}>
            <h2 className="adv-section-title">Your Milestones</h2>
          </div>

          <div className="adv-milestone-list">
            {studentMilestones.map((m) => (
              <div key={m.id} className="adv-milestone-card">
                <div className="adv-milestone-left">
                  <div className={`adv-avatar ${m.color}`}>{m.initials}</div>
                  <div className="adv-milestone-info">
                    <div className="adv-milestone-student">
                      <span className={`adv-milestone-type ${m.typeClass}`}>
                        {m.type}
                      </span>
                    </div>
                    <div className="adv-milestone-due">
                      Due: {m.due}
                      <span
                        className={`adv-milestone-countdown ${m.countdownClass}`}
                      >
                        {m.countdown}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="adv-progress-section">
                  <div className="adv-progress-row">
                    <div className="adv-progress-track">
                      <div
                        className={`adv-progress-fill ${m.progressColor}`}
                        style={{ width: `${m.progress}%` }}
                      />
                    </div>
                    <span className="adv-progress-pct">{m.progress}%</span>
                  </div>
                  <span
                    className={`adv-status-badge ${m.statusColor}`}
                    style={{ display: 'inline-flex' }}
                  >
                    <span className={`adv-status-dot ${m.statusColor}`} />
                    {m.status}
                  </span>
                  {m.notes && (
                    <div className="adv-milestone-notes">{m.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Student AI usage - own data only */}
          {studentAiUsage && (
            <>
              <div className="adv-section-head" style={{ marginTop: '32px' }}>
                <h2 className="adv-section-title">Your AI Usage</h2>
              </div>

              <div className="adv-ai-student-list">
                <div className="adv-ai-student-card">
                  <div className={`adv-avatar ${studentAiUsage.color}`}>
                    {studentAiUsage.initials}
                  </div>
                  <div className="adv-ai-student-meta">
                    <span className="adv-ai-student-name">
                      {studentAiUsage.name}
                    </span>
                    <span className="adv-ai-student-total">
                      {studentAiUsage.total} commands this month
                    </span>
                  </div>
                  <div className="adv-stacked-bar-wrap">
                    <div className="adv-stacked-bar">
                      {Object.entries(studentAiUsage.commands)
                        .filter(([, v]) => v > 0)
                        .map(([cmd, count]) => (
                          <div
                            key={cmd}
                            className={`adv-stacked-segment ${CMD_COLORS[cmd]}`}
                            style={{
                              width: `${(count / (studentAiUsage.total || 1)) * 100}%`,
                            }}
                            title={`/${cmd}: ${count}`}
                          />
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stacked bar legend */}
              <div
                className="adv-stacked-legend"
                style={{ marginTop: '12px', marginBottom: '16px' }}
              >
                {Object.entries(CMD_COLORS).map(([cmd, cls]) => (
                  <span key={cmd} className="adv-legend-item">
                    <span className={`adv-legend-dot ${cls}`} />/{cmd}
                  </span>
                ))}
              </div>

              <div
                className="adv-policy-card"
                style={{ marginTop: '16px' }}
              >
                <p className="adv-policy-text">
                  Your AI usage is transparently shared with your advisor to
                  foster open dialogue about responsible AI use in research.
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* ── MEMBER VIEW ──────────────────────────────────────────── */}
      {demoRole === 'member' && (
        <>
          {/* Team Progress */}
          <div className="adv-section-head">
            <h2 className="adv-section-title">Team Progress</h2>
          </div>

          <div className="adv-students-grid">
            {STUDENTS.map((s) => (
              <div
                key={s.id}
                className={`adv-student-card status-${s.status}`}
              >
                <div className="adv-student-top">
                  <div className={`adv-avatar ${s.color}`}>{s.initials}</div>
                  <div className="adv-student-info">
                    <span className="adv-student-name">{s.name}</span>
                    <span className="adv-student-program">{s.program}</span>
                    <span className="adv-student-focus">{s.focus}</span>
                  </div>
                  <span className={`adv-status-badge ${s.status}`}>
                    <span className={`adv-status-dot ${s.status}`} />
                    {s.statusLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Team Milestones */}
          <div className="adv-section-head" style={{ marginTop: '32px' }}>
            <h2 className="adv-section-title">Team Milestones</h2>
          </div>

          <div className="adv-milestone-list">
            {MILESTONES.map((m) => (
              <div key={m.id} className="adv-milestone-card">
                <div className="adv-milestone-left">
                  <div className={`adv-avatar ${m.color}`}>{m.initials}</div>
                  <div className="adv-milestone-info">
                    <div className="adv-milestone-student">
                      <span className="adv-milestone-student-name">
                        {m.student}
                      </span>
                      <span className={`adv-milestone-type ${m.typeClass}`}>
                        {m.type}
                      </span>
                    </div>
                    <div className="adv-milestone-due">
                      Due: {m.due}
                      <span
                        className={`adv-milestone-countdown ${m.countdownClass}`}
                      >
                        {m.countdown}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="adv-progress-section">
                  <div className="adv-progress-row">
                    <div className="adv-progress-track">
                      <div
                        className={`adv-progress-fill ${m.progressColor}`}
                        style={{ width: `${m.progress}%` }}
                      />
                    </div>
                    <span className="adv-progress-pct">{m.progress}%</span>
                  </div>
                  <span
                    className={`adv-status-badge ${m.statusColor}`}
                    style={{ display: 'inline-flex' }}
                  >
                    <span className={`adv-status-dot ${m.statusColor}`} />
                    {m.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Privacy note */}
          <div
            className="adv-policy-card"
            style={{ marginTop: '32px' }}
          >
            <p
              className="adv-policy-text"
              style={{ textAlign: 'center', opacity: 0.8 }}
            >
              Individual details and AI usage data are shared privately between
              students and their advisor.
            </p>
          </div>
        </>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="adv-toast">
          &#10003; {toast}
        </div>
      )}
    </div>
  )
}

export default AdvisingPage
