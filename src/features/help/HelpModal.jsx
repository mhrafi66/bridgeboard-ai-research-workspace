/**
 * Help guide modal - explains how BridgeBoard works. Opened from the
 * "How BridgeBoard works" link in the sidebar.
 */
const SECTIONS = [
  {
    icon: '◌',
    title: 'Team pulse',
    body: 'The shared room where everyone posts short updates on what is moving, blocked, or worth sharing. Type an update and press the arrow to post. Use "Generate action plan" to have Amazon Bedrock read the updates and suggest concrete next steps assigned to named people.',
  },
  {
    icon: '✦',
    title: 'AI Research Room',
    body: 'A discussion thread for deeper research conversations. Post messages, attach files, and run AI agent commands. Select a range of messages to focus the analysis, then Analyze the discussion, run the Scientific Critic, or ask the Facilitator for the single most important next step.',
  },
  {
    icon: '/',
    title: 'Agent commands',
    body: 'Type "/" in the Research Room or a meeting to run an agent command:',
    commands: [
      ['/ask', 'Ask a question about a document, message, or topic'],
      ['/summarize', 'Summarize documents or messages'],
      ['/extract', 'OCR text out of an uploaded document'],
      ['/analyze', 'Sentiment, entities, and key phrases (Comprehend)'],
      ['/search', 'A research briefing on any topic'],
      ['/translate', 'Translate content into another language'],
      ['/todo', 'Turn a conversation into an assigned to-do list'],
      ['/litstudy', 'Search real papers (OpenAlex) and synthesize a literature study'],
      ['/remember', 'Save knowledge or a finding to the Lab Memory knowledge base'],
    ],
  },
  {
    icon: '#',
    title: 'Private rooms & meetings',
    body: 'Click "+" next to PRIVATE ROOMS to create a private space and pick members from the directory. Inside a room, add meetings (in person or online). For an in-person meeting, record it - BridgeBoard transcribes it with speaker labels, you map each speaker to a name, and then every agent command works on the transcript.',
  },
  {
    icon: '✎',
    title: 'Contribute in any language',
    body: 'The Contribute tab lets you add a research contribution by typing or speaking, in whatever language is natural to you. Your original is preserved alongside a shared-language version.',
  },
  {
    icon: '⚠',
    title: 'Guardrails',
    body: 'Before any content is sent to an AI model, BridgeBoard scans it for sensitive information. High-sensitivity data (SSNs, financial or credential data) is blocked; lower-sensitivity data is flagged with a warning. Commands that read an uploaded file always ask for your approval first.',
  },
  {
    icon: '☺',
    title: 'Your profile',
    body: 'Complete your profile (name, university, affiliation, nationality, research experience) from the bottom-left account area. Your display name appears on the messages you post, and other members can invite you to private rooms.',
  },
]

function HelpModal({ onClose }) {
  return (
    <div className="room-modal-backdrop" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-modal-head">
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> GETTING STARTED
            </div>
            <h2>How BridgeBoard works</h2>
          </div>
          <button className="help-modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <p className="help-intro">
          BridgeBoard turns student and research project conversations into
          respectful, concrete next actions - while keeping every voice visible.
        </p>

        <div className="help-sections">
          {SECTIONS.map((s) => (
            <div key={s.title} className="help-section">
              <div className="help-section-icon">{s.icon}</div>
              <div className="help-section-text">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                {s.commands && (
                  <ul className="help-cmd-list">
                    {s.commands.map(([cmd, desc]) => (
                      <li key={cmd}>
                        <code>{cmd}</code>
                        <span>{desc}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="help-modal-actions">
          <button className="room-btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

export default HelpModal
