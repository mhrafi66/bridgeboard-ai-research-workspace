/**
 * Renders a /litstudy agent result: the Bedrock synthesis plus the
 * real OpenAlex source list. Shared by the AI Research Room and the
 * Private Room so the command looks identical in both places.
 */
function LitStudyResult({ result }) {
  if (!result) return null
  const {
    topic,
    overview,
    themes = [],
    methods = [],
    gaps = [],
    suggestedReading = [],
    sources = [],
  } = result

  return (
    <div className="litstudy">
      {topic && (
        <div className="litstudy-topic">
          Literature study: <strong>{topic}</strong>
        </div>
      )}
      {overview && <p className="litstudy-overview">{overview}</p>}

      {themes.length > 0 && (
        <div className="litstudy-section">
          <div className="litstudy-h">Themes</div>
          {themes.map((t, i) => (
            <div key={i} className="litstudy-theme">
              <strong>{t.title}</strong>
              {Array.isArray(t.paperRefs) && t.paperRefs.length > 0 && (
                <span className="litstudy-refs">
                  {' '}
                  {t.paperRefs.map((r) => `[${r}]`).join(' ')}
                </span>
              )}
              <div className="litstudy-theme-body">{t.summary}</div>
            </div>
          ))}
        </div>
      )}

      {methods.length > 0 && (
        <div className="litstudy-section">
          <div className="litstudy-h">Methodological approaches</div>
          <ul className="litstudy-ul">
            {methods.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="litstudy-section">
          <div className="litstudy-h">Open questions and gaps</div>
          <ul className="litstudy-ul">
            {gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <div className="litstudy-section">
          <div className="litstudy-h">Sources ({sources.length}) — real papers via OpenAlex</div>
          <ol className="litstudy-sources">
            {sources.map((s, i) => {
              const idx = i + 1
              const isSuggested = suggestedReading?.includes(idx)
              const authors = (s.authors || []).slice(0, 4).join(', ')
              const authorSuffix = (s.authors || []).length > 4 ? ' et al.' : ''
              return (
                <li
                  key={idx}
                  className={isSuggested ? 'litstudy-source suggested' : 'litstudy-source'}
                >
                  <div className="litstudy-source-title">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title}
                      </a>
                    ) : (
                      s.title
                    )}
                    {isSuggested && (
                      <span className="litstudy-badge">recommended</span>
                    )}
                  </div>
                  <div className="litstudy-source-meta">
                    {authors}
                    {authorSuffix}
                    {s.year ? ` · ${s.year}` : ''}
                    {s.venue ? ` · ${s.venue}` : ''}
                    {typeof s.citedBy === 'number' ? ` · cited by ${s.citedBy}` : ''}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}

export default LitStudyResult
