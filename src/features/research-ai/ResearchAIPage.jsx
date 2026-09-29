import { useState } from 'react'
import {
  API_BASE_URL,
  LANGUAGE_NAMES,
  getAuthHeaders,
  translateText,
} from '../../lib/api'
import AudioPlayer from '../universal-input/AudioPlayer'
import VoiceInput from '../universal-input/VoiceInput'
import DiscussionThread from './DiscussionThread'
import {
  PORTFOLIO_DEMO,
  buildDemoAnalysis,
  buildDemoContext,
  buildDemoCritic,
  buildDemoFacilitator,
} from '../../lib/demoResearch'


const MODEL_OPTIONS = [
  {
    id: 'us.anthropic.claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    detail: 'Recommended for research reasoning',
  },

  {
    id: 'us.anthropic.claude-opus-4-6-v1',
    label: 'Claude Opus 4.6',
    detail: 'Deep reasoning',
  },

  {
    id: 'us.amazon.nova-2-lite-v1:0',
    label: 'Nova 2 Lite',
    detail: 'Fast Amazon model',
  },

  {
    id: 'amazon.nova-lite-v1:0',
    label: 'Nova Lite',
    detail: 'Fast and economical',
  },

  {
    id: 'us.mistral.pixtral-large-2502-v1:0',
    label: 'Mistral Pixtral Large',
    detail: 'Multimodal reasoning',
  },
]


const DEFAULT_MODEL_ID =
  'us.anthropic.claude-sonnet-4-6'


const DEMO_RESEARCHERS = [
  {
    speaker: 'Mumtahin',
    text:
      'I think Dataset B performs worse because the training data is geographically concentrated. The model may be seeing a distribution shift when evaluated in new regions.',
  },

  {
    speaker: 'Maria',
    text:
      'I agree that geography may matter. Dataset B contains training measurements from only two cities, while Dataset A covers seven locations.',
  },

  {
    speaker: 'Chen',
    text:
      'I am not convinced that dataset distribution is the main cause. Architecture B also performs worse than Architecture A when both are evaluated on Dataset A, so the model architecture may be responsible.',
  },
]


function ResearchAIPage() {
  const [inputMode, setInputMode] =
    useState(PORTFOLIO_DEMO ? 'classic' : 'thread')

  const [threadEntries, setThreadEntries] =
    useState([])

  const [entries, setEntries] =
    useState(DEMO_RESEARCHERS)

  const [translations, setTranslations] =
    useState({})

  const [translating, setTranslating] =
    useState(false)

  const [analysis, setAnalysis] =
    useState(null)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const [
    selectedModel,
    setSelectedModel,
  ] = useState(DEFAULT_MODEL_ID)

  const [critic, setCritic] =
    useState(null)

  const [
    criticLoading,
    setCriticLoading,
  ] = useState(false)

  const [
    criticError,
    setCriticError,
  ] = useState('')

  const [
    researchContext,
    setResearchContext,
  ] = useState(null)

  const [
    contextLoading,
    setContextLoading,
  ] = useState(false)

  const [
    contextError,
    setContextError,
  ] = useState('')

  const [
    facilitator,
    setFacilitator,
  ] = useState(null)

  const [
    facilitatorLoading,
    setFacilitatorLoading,
  ] = useState(false)

  const [
    facilitatorError,
    setFacilitatorError,
  ] = useState('')


  function activeEntries() {
    return inputMode === 'thread'
      ? threadEntries
      : entries
  }

  function updateEntry(
    index,
    field,
    value,
  ) {
    setEntries((current) =>
      current.map(
        (entry, currentIndex) =>
          currentIndex === index
            ? {
                ...entry,
                [field]: value,
              }
            : entry,
      ),
    )
  }


  async function translateEntries() {
    const current = activeEntries()
    if (!API_BASE_URL) return current

    setTranslating(true)

    const results = await Promise.all(
      current.map(async (entry, index) => {
        if (!entry.text?.trim()) return entry

        try {
          const result = await translateText(
            entry.text,
            'en',
          )

          setTranslations((prev) => ({
            ...prev,
            [index]: result,
          }))

          return {
            ...entry,
            text: result.translatedText,
          }
        } catch {
          return entry
        }
      }),
    )

    setTranslating(false)
    return results
  }

  async function analyzeDiscussion() {
    setLoading(true)
    setError('')
    setAnalysis(null)

    setCritic(null)
    setCriticError('')

    setResearchContext(null)
    setContextError('')

    setFacilitator(null)
    setFacilitatorError('')

    if (!API_BASE_URL) {
      setAnalysis(buildDemoAnalysis(activeEntries()))
      setResearchContext(buildDemoContext())
      setLoading(false)
      return
    }

    try {
      const translatedEntries =
        await translateEntries()

      const result = await fetch(
        `${API_BASE_URL}/research/analyze-discussion`,
        {
          method: 'POST',

          headers: {
            ...(await getAuthHeaders()),

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            modelId:
              selectedModel,

            entries: translatedEntries,
          }),
        },
      )

      const data =
        await result.json()

      if (!result.ok) {
        throw new Error(
          data.error ||
            'The discussion could not be analyzed.',
        )
      }

      setAnalysis(
        data.analysis,
      )

      loadResearchContext()
    } catch (requestError) {
      setError(
        requestError.message ||
          'The AI request failed.',
      )
    } finally {
      setLoading(false)
    }
  }


  async function loadResearchContext() {
    setContextLoading(true)
    setContextError('')

    if (!API_BASE_URL) {
      setResearchContext(buildDemoContext())
      setContextLoading(false)
      return
    }

    try {
      const result = await fetch(
        `${API_BASE_URL}/research/context`,
        {
          method: 'POST',

          headers: {
            ...(await getAuthHeaders()),

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            entries: activeEntries(),
          }),
        },
      )

      const data =
        await result.json()

      if (!result.ok) {
        throw new Error(
          data.error ||
            'Research context extraction failed.',
        )
      }

      setResearchContext(
        data.context,
      )
    } catch (requestError) {
      setContextError(
        requestError.message ||
          'Research context extraction failed.',
      )
    } finally {
      setContextLoading(false)
    }
  }


  async function runFacilitatorAgent() {
    if (!analysis) {
      setFacilitatorError(
        'Analyze the discussion first.',
      )

      return
    }

    setFacilitatorLoading(true)
    setFacilitatorError('')
    setFacilitator(null)

    if (!API_BASE_URL) {
      setFacilitator(buildDemoFacilitator())
      setFacilitatorLoading(false)
      return
    }

    try {
      const result = await fetch(
        `${API_BASE_URL}/research/facilitator`,
        {
          method: 'POST',

          headers: {
            ...(await getAuthHeaders()),

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            entries: activeEntries(),
            analysis,
            critic,
          }),
        },
      )

      const data =
        await result.json()

      if (!result.ok) {
        throw new Error(
          data.error ||
            'The Research Facilitator failed.',
        )
      }

      setFacilitator(
        data.facilitator,
      )
    } catch (requestError) {
      setFacilitatorError(
        requestError.message ||
          'The Research Facilitator failed.',
      )
    } finally {
      setFacilitatorLoading(false)
    }
  }


  async function runScientificCritic() {
    if (!analysis) {
      setCriticError(
        'Analyze the discussion first.',
      )

      return
    }

    setCriticLoading(true)
    setCriticError('')
    setCritic(null)

    if (!API_BASE_URL) {
      setCritic(buildDemoCritic())
      setCriticLoading(false)
      return
    }

    try {
      const result = await fetch(
        `${API_BASE_URL}/research/critic`,
        {
          method: 'POST',

          headers: {
            ...(await getAuthHeaders()),

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            modelId:
              selectedModel,

            entries: activeEntries(),

            analysis,
          }),
        },
      )

      const data =
        await result.json()

      if (!result.ok) {
        throw new Error(
          data.error ||
            'The scientific critique failed.',
        )
      }

      setCritic(
        data.critic,
      )
    } catch (requestError) {
      setCriticError(
        requestError.message ||
          'The scientific critique failed.',
      )
    } finally {
      setCriticLoading(false)
    }
  }


  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '32px',
      }}
    >
      <div
        style={{
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.14em',
            color: '#0073bb',
          }}
        >
          BRIDGEBOARD AI
        </div>

        <h1>
          AI Research Room
        </h1>

        <p>
          Compare researcher viewpoints,
          preserve disagreement, and identify
          the next useful experiment.
        </p>

        {PORTFOLIO_DEMO && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: '#fff7e6',
              border: '1px solid #f3c969',
              fontSize: '13px',
            }}
          >
            <strong>Portfolio demo mode.</strong> AI outputs on this page are deterministic synthetic examples so the project remains runnable after the hackathon AWS account expired. The repository preserves the original AWS Lambda, Bedrock, Comprehend, Cognito, S3, DynamoDB, Transcribe, Textract, Translate, Polly, CloudFront, and AgentCore implementation.
          </div>
        )}

        <div
          style={{
            marginTop: '20px',
            maxWidth: '420px',
          }}
        >
          <label
            htmlFor="research-model"
            style={{
              display: 'block',
              fontWeight: '700',
              marginBottom: '8px',
            }}
          >
            Research reasoning model
          </label>

          <select
            id="research-model"
            value={selectedModel}
            onChange={(event) => {
              setSelectedModel(
                event.target.value,
              )
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #cccccc',
              background: '#ffffff',
            }}
          >
            {MODEL_OPTIONS.map(
              (model) => (
                <option
                  key={model.id}
                  value={model.id}
                >
                  {model.label}
                  {' — '}
                  {model.detail}
                </option>
              ),
            )}
          </select>

          <small
            style={{
              display: 'block',
              marginTop: '7px',
              opacity: 0.65,
            }}
          >
            {PORTFOLIO_DEMO
              ? 'Model selection is historical in portfolio demo mode.'
              : 'Sonnet 4.6 is the recommended default for scientific discussion analysis.'}
          </small>
        </div>
      </div>


      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          borderBottom: '1px solid #e0ddd9',
        }}
      >
        {[
          { id: 'thread', label: 'Discussion Thread', icon: '\u{1F4AC}' },
          { id: 'classic', label: 'Classic (3-slot)', icon: '\u{1F4DD}' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setInputMode(tab.id)}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight:
                inputMode === tab.id ? '700' : '500',
              color:
                inputMode === tab.id
                  ? '#16191f'
                  : '#879596',
              background: 'transparent',
              border: 'none',
              borderBottom:
                inputMode === tab.id
                  ? '2px solid #0073bb'
                  : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {inputMode === 'thread' && (
        <DiscussionThread
          onEntriesReady={setThreadEntries}
        />
      )}

      {inputMode === 'classic' && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(3, minmax(0, 1fr))',
          gap: '16px',
        }}
      >
        {entries.map(
          (entry, index) => (
            <div
              key={index}
              style={{
                padding: '20px',
                border:
                  '1px solid #dddddd',
                borderRadius: '14px',
                background: '#ffffff',
              }}
            >
              <label>
                <strong>
                  Researcher
                </strong>
              </label>

              <input
                value={
                  entry.speaker
                }
                onChange={(
                  event,
                ) =>
                  updateEntry(
                    index,
                    'speaker',
                    event.target
                      .value,
                  )
                }
                style={{
                  width: '100%',
                  boxSizing:
                    'border-box',
                  marginTop: '8px',
                  marginBottom:
                    '16px',
                  padding: '10px',
                }}
              />

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <strong>
                  Contribution
                </strong>

                <small
                  style={{
                    marginLeft: '8px',
                    fontWeight: '400',
                    color: '#999',
                  }}
                >
                  any language
                </small>

                <VoiceInput
                  onTranscript={(
                    text,
                  ) => {
                    updateEntry(
                      index,
                      'text',
                      text,
                    )
                    setTranslations(
                      (prev) => {
                        const next = {
                          ...prev,
                        }
                        delete next[
                          index
                        ]
                        return next
                      },
                    )
                  }}
                />
              </label>

              <textarea
                value={
                  entry.text
                }
                onChange={(
                  event,
                ) => {
                  updateEntry(
                    index,
                    'text',
                    event.target
                      .value,
                  )
                  setTranslations(
                    (prev) => {
                      const next = {
                        ...prev,
                      }
                      delete next[index]
                      return next
                    },
                  )
                }}
                rows={9}
                style={{
                  width: '100%',
                  boxSizing:
                    'border-box',
                  marginTop: '8px',
                  padding: '10px',
                  resize:
                    'vertical',
                }}
              />

              {translations[index] &&
                translations[index]
                  .detectedLanguage !==
                  'en' && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '12px',
                    borderRadius:
                      '8px',
                    background:
                      '#e9f3fa',
                    border:
                      '1px solid #e4dff7',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems:
                        'center',
                      gap: '6px',
                      marginBottom:
                        '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize:
                          '9px',
                        fontWeight:
                          '700',
                        letterSpacing:
                          '0.1em',
                        color:
                          '#0073bb',
                      }}
                    >
                      TRANSLATED
                    </span>

                    <span
                      style={{
                        fontSize:
                          '10px',
                        padding:
                          '2px 6px',
                        borderRadius:
                          '999px',
                        background:
                          '#ece8fa',
                      }}
                    >
                      {LANGUAGE_NAMES[
                        translations[
                          index
                        ]
                          .detectedLanguage
                      ] ||
                        translations[
                          index
                        ]
                          .detectedLanguage}
                      {' → English'}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize:
                        '12px',
                      lineHeight:
                        '1.5',
                      color: '#444',
                    }}
                  >
                    {
                      translations[
                        index
                      ]
                        .translatedText
                    }
                  </p>

                  <div
                    style={{
                      marginTop: '8px',
                      display: 'flex',
                      gap: '6px',
                    }}
                  >
                    <AudioPlayer
                      text={
                        translations[
                          index
                        ]
                          .translatedText
                      }
                      languageCode="en"
                    />

                    <AudioPlayer
                      text={
                        entry.text
                      }
                      languageCode={
                        translations[
                          index
                        ]
                          .detectedLanguage
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          ),
        )}
      </div>
      )}


      <button
        onClick={
          analyzeDiscussion
        }
        disabled={
          loading ||
          translating ||
          activeEntries().length === 0
        }
        style={{
          marginTop: '24px',
          padding:
            '14px 22px',
          fontSize: '16px',
          fontWeight: '700',
          cursor:
            loading || translating
              ? 'wait'
              : 'pointer',
        }}
      >
        {translating
          ? 'Translating contributions...'
          : loading
            ? 'Analyzing research discussion...'
            : activeEntries().length === 0
              ? 'Add messages to analyze'
              : `Analyze (${activeEntries().length} message${activeEntries().length !== 1 ? 's' : ''})`}
      </button>


      {error && (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            background: '#fff1f1',
            border:
              '1px solid #e6baba',
          }}
        >
          {error}
        </div>
      )}


      {analysis && (
        <div
          style={{
            marginTop: '40px',
          }}
        >
          <h2>
            Research analysis
          </h2>


          {contextLoading && (
            <div
              style={{
                marginTop: '18px',
                padding: '14px',
                borderRadius: '10px',
                background: '#f7f7f9',
              }}
            >
              Amazon Comprehend is extracting
              research context...
            </div>
          )}

          {contextError && (
            <div
              style={{
                marginTop: '18px',
                padding: '14px',
                borderRadius: '10px',
                background: '#fff1f1',
              }}
            >
              {contextError}
            </div>
          )}


          <section>
            <h3>
              Research question
            </h3>

            <p>
              {
                analysis.researchQuestion
              }
            </p>
          </section>


          <section>
            <h3>
              Contributions
            </h3>

            {(
              analysis.contributions ||
              []
            ).map(
              (
                contribution,
                index,
              ) => (
                <div
                  key={index}
                  style={{
                    marginBottom:
                      '12px',
                    padding:
                      '14px',
                    border:
                      '1px solid #ddd',
                    borderRadius:
                      '10px',
                  }}
                >
                  <strong>
                    {
                      contribution.speaker
                    }
                  </strong>

                  <div>
                    {
                      contribution.type
                    }
                  </div>

                  <p>
                    {
                      contribution.claim
                    }
                  </p>

                  <small>
                    {(
                      contribution.topics ||
                      []
                    ).join(
                      ' · ',
                    )}
                  </small>
                </div>
              ),
            )}
          </section>


          <section>
            <h3>
              Competing positions
            </h3>

            {(
              analysis.positions ||
              []
            ).map(
              (
                position,
                index,
              ) => (
                <div
                  key={index}
                  style={{
                    marginBottom:
                      '16px',
                    padding:
                      '16px',
                    background:
                      '#f7f7f9',
                    borderRadius:
                      '10px',
                  }}
                >
                  <strong>
                    {
                      position.label
                    }
                  </strong>

                  <p>
                    {
                      position.claim
                    }
                  </p>

                  <div>
                    Supported by:{' '}
                    {(
                      position.supporters ||
                      []
                    ).join(', ')}
                  </div>

                  {(
                    position
                      .supportingEvidence ||
                    []
                  ).length >
                    0 && (
                    <>
                      <h4>
                        Evidence
                      </h4>

                      <ul>
                        {position
                          .supportingEvidence
                          .map(
                            (
                              evidence,
                              evidenceIndex,
                            ) => (
                              <li
                                key={
                                  evidenceIndex
                                }
                              >
                                {
                                  evidence
                                }
                              </li>
                            ),
                          )}
                      </ul>
                    </>
                  )}
                </div>
              ),
            )}
          </section>


          <section>
            <h3>
              Agreements
            </h3>

            {(
              analysis.agreements ||
              []
            ).map(
              (
                agreement,
                index,
              ) => (
                <p
                  key={index}
                >
                  <strong>
                    {(
                      agreement.researchers ||
                      []
                    ).join(
                      ' + ',
                    )}
                  </strong>
                  {' — '}
                  {
                    agreement.summary
                  }
                </p>
              ),
            )}
          </section>


          <section>
            <h3>
              Disagreements
            </h3>

            {(
              analysis.disagreements ||
              []
            ).map(
              (
                disagreement,
                index,
              ) => (
                <div
                  key={index}
                  style={{
                    marginBottom:
                      '12px',
                  }}
                >
                  <strong>
                    {(
                      disagreement.researchers ||
                      []
                    ).join(
                      ' vs ',
                    )}
                  </strong>

                  <p>
                    {
                      disagreement.summary
                    }
                  </p>

                  <small>
                    Status:{' '}
                    {
                      disagreement.status
                    }
                  </small>
                </div>
              ),
            )}
          </section>


          <section>
            <h3>
              Open questions
            </h3>

            <ul>
              {(
                analysis.openQuestions ||
                []
              ).map(
                (
                  question,
                  index,
                ) => (
                  <li
                    key={index}
                  >
                    {question}
                  </li>
                ),
              )}
            </ul>
          </section>


          {analysis.recommendedExperiment && (
            <section>
              <h3>
                Suggested experiment
              </h3>

              <strong>
                {
                  analysis
                    .recommendedExperiment
                    .title
                }
              </strong>

              <p>
                {
                  analysis
                    .recommendedExperiment
                    .goal
                }
              </p>

              <p>
                <b>
                  Control:
                </b>{' '}
                {
                  analysis
                    .recommendedExperiment
                    .control
                }
              </p>

              <p>
                <b>
                  Variable:
                </b>{' '}
                {
                  analysis
                    .recommendedExperiment
                    .variable
                }
              </p>

              <p>
                <b>
                  Metric:
                </b>{' '}
                {
                  analysis
                    .recommendedExperiment
                    .metric
                }
              </p>

              <ol>
                {(
                  analysis
                    .recommendedExperiment
                    .procedure ||
                  []
                ).map(
                  (
                    step,
                    index,
                  ) => (
                    <li
                      key={index}
                    >
                      {step}
                    </li>
                  ),
                )}
              </ol>

              <p>
                <b>
                  Interpretation:
                </b>{' '}
                {
                  analysis
                    .recommendedExperiment
                    .interpretation
                }
              </p>
            </section>
          )}


          <section
            style={{
              marginTop: '24px',
              padding: '18px',
              background:
                '#f1edff',
              borderRadius:
                '12px',
            }}
          >
            <h3>
              Facilitator observation
            </h3>

            <p>
              {
                analysis.facilitatorNote
              }
            </p>
          </section>


          {researchContext && (
            <section
              style={{
                marginTop: '24px',
                marginBottom: '28px',
                padding: '20px',
                border:
                  '1px solid #dfe2e8',
                borderRadius: '14px',
                background: '#f8fafc',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'center',
                  gap: '12px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing:
                        '0.12em',
                      color: '#506070',
                    }}
                  >
                    RESEARCH CONTEXT
                  </div>

                  <h3
                    style={{
                      marginTop: '6px',
                    }}
                  >
                    Extracted research signals
                  </h3>
                </div>

                <span
                  style={{
                    fontSize: '12px',
                    padding:
                      '5px 9px',
                    borderRadius:
                      '999px',
                    background:
                      '#e7edf3',
                  }}
                >
                  {PORTFOLIO_DEMO ? 'Demo extraction' : 'Amazon Comprehend'}
                </span>
              </div>


              <div
                style={{
                  marginTop: '16px',
                }}
              >
                <strong>
                  Detected language
                </strong>

                <p>
                  {researchContext
                    .language
                    ?.code
                    ?.toUpperCase() ||
                    'Unknown'}

                  {' · '}

                  {Math.round(
                    (
                      researchContext
                        .language
                        ?.score || 0
                    ) * 100,
                  )}

                  % confidence
                </p>
              </div>


              {(
                researchContext.entities ||
                []
              ).length > 0 && (
                <div
                  style={{
                    marginTop: '18px',
                  }}
                >
                  <strong>
                    Named entities
                  </strong>

                  <div
                    style={{
                      marginTop: '10px',
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {researchContext
                      .entities
                      .map(
                        (
                          entity,
                          index,
                        ) => (
                          <span
                            key={
                              `${entity.text}-${index}`
                            }
                            style={{
                              padding:
                                '7px 10px',
                              border:
                                '1px solid #ccd5df',
                              borderRadius:
                                '999px',
                              background:
                                '#ffffff',
                              fontSize:
                                '13px',
                            }}
                          >
                            {entity.text}

                            {entity.type && (
                              <small
                                style={{
                                  marginLeft:
                                    '5px',
                                  opacity:
                                    0.55,
                                }}
                              >
                                {
                                  entity.type
                                }
                              </small>
                            )}
                          </span>
                        ),
                      )}
                  </div>
                </div>
              )}


              {(
                researchContext.keyPhrases ||
                []
              ).length > 0 && (
                <div
                  style={{
                    marginTop: '20px',
                  }}
                >
                  <strong>
                    Key phrases
                  </strong>

                  <div
                    style={{
                      marginTop: '10px',
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {researchContext
                      .keyPhrases
                      .map(
                        (
                          phrase,
                          index,
                        ) => (
                          <span
                            key={
                              `${phrase.text}-${index}`
                            }
                            style={{
                              padding:
                                '7px 10px',
                              borderRadius:
                                '8px',
                              background:
                                '#ece8fa',
                              fontSize:
                                '13px',
                            }}
                          >
                            #{phrase.text}
                          </span>
                        ),
                      )}
                  </div>
                </div>
              )}


              {researchContext.warning && (
                <p
                  style={{
                    marginTop: '16px',
                    fontSize: '13px',
                    opacity: 0.7,
                  }}
                >
                  {
                    researchContext.warning
                  }
                </p>
              )}
            </section>
          )}


          <p
            style={{
              marginTop: '20px',
              fontSize: '12px',
              opacity: 0.65,
            }}
          >
            {
              analysis.generatedBy
            }
          </p>


          <div
            style={{
              marginTop: '32px',
              paddingTop: '28px',
              borderTop:
                '1px solid #dddddd',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: '700',
                letterSpacing:
                  '0.12em',
                color: '#0073bb',
                marginBottom: '8px',
              }}
            >
              SCIENTIFIC CRITIC
            </div>

            <h2>
              Challenge the reasoning.
            </h2>

            <p>
              Ask BridgeBoard to look for
              unsupported claims, confounders,
              missing controls, ambiguous
              conclusions, and alternative
              explanations.
            </p>

            <button
              onClick={
                runScientificCritic
              }
              disabled={
                criticLoading
              }
              style={{
                marginTop: '12px',
                padding:
                  '14px 22px',
                fontSize: '15px',
                fontWeight: '700',
                cursor:
                  criticLoading
                    ? 'wait'
                    : 'pointer',
              }}
            >
              {criticLoading
                ? 'Critiquing scientific reasoning...'
                : 'Challenge this reasoning'}
            </button>

            {criticError && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px',
                  background:
                    '#fff1f1',
                  border:
                    '1px solid #e6baba',
                }}
              >
                {criticError}
              </div>
            )}
          </div>


          {critic && (
            <div
              style={{
                marginTop: '32px',
                padding: '24px',
                border:
                  '1px solid #d8d2ea',
                borderRadius: '16px',
                background: '#fbfaff',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  letterSpacing:
                    '0.12em',
                  color: '#0073bb',
                }}
              >
                BRIDGEBOARD
                SCIENTIFIC CRITIC
              </div>


              <h2>
                Scientific critique
              </h2>


              <p>
                {critic.summary}
              </p>


              {(
                critic.strengths ||
                []
              ).length > 0 && (
                <section>
                  <h3>
                    What is already strong
                  </h3>

                  <ul>
                    {critic.strengths.map(
                      (
                        strength,
                        index,
                      ) => (
                        <li
                          key={index}
                        >
                          {strength}
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              )}


              {(
                critic.concerns ||
                []
              ).length > 0 && (
                <section>
                  <h3>
                    Scientific concerns
                  </h3>

                  {critic.concerns.map(
                    (
                      concern,
                      index,
                    ) => (
                      <div
                        key={index}
                        style={{
                          marginBottom:
                            '18px',
                          padding:
                            '18px',
                          background:
                            '#ffffff',
                          border:
                            '1px solid #e0ddec',
                          borderRadius:
                            '12px',
                        }}
                      >
                        <div
                          style={{
                            display:
                              'flex',
                            gap: '8px',
                            flexWrap:
                              'wrap',
                            marginBottom:
                              '10px',
                          }}
                        >
                          <span
                            style={{
                              padding:
                                '4px 8px',
                              borderRadius:
                                '999px',
                              background:
                                '#eee9ff',
                              fontSize:
                                '12px',
                              fontWeight:
                                '700',
                            }}
                          >
                            {
                              concern.category
                            }
                          </span>

                          <span
                            style={{
                              padding:
                                '4px 8px',
                              borderRadius:
                                '999px',
                              background:
                                '#f3f3f3',
                              fontSize:
                                '12px',
                            }}
                          >
                            {
                              concern.severity
                            }
                          </span>
                        </div>


                        {concern.target && (
                          <>
                            <strong>
                              Target
                            </strong>

                            <p>
                              {
                                concern.target
                              }
                            </p>
                          </>
                        )}


                        <strong>
                          Concern
                        </strong>

                        <p>
                          {
                            concern.problem
                          }
                        </p>


                        <strong>
                          Why it matters
                        </strong>

                        <p>
                          {
                            concern
                              .whyItMatters
                          }
                        </p>


                        <strong>
                          Suggested check
                        </strong>

                        <p>
                          {
                            concern
                              .suggestedCheck
                          }
                        </p>
                      </div>
                    ),
                  )}
                </section>
              )}


              {(
                critic.missingEvidence ||
                []
              ).length > 0 && (
                <section>
                  <h3>
                    Missing evidence
                  </h3>

                  <ul>
                    {critic
                      .missingEvidence
                      .map(
                        (
                          evidence,
                          index,
                        ) => (
                          <li
                            key={index}
                          >
                            {evidence}
                          </li>
                        ),
                      )}
                  </ul>
                </section>
              )}


              {(
                critic.recommendedControls ||
                []
              ).length > 0 && (
                <section>
                  <h3>
                    Recommended controls
                  </h3>

                  <ul>
                    {critic
                      .recommendedControls
                      .map(
                        (
                          control,
                          index,
                        ) => (
                          <li
                            key={index}
                          >
                            {control}
                          </li>
                        ),
                      )}
                  </ul>
                </section>
              )}


              {(
                critic
                  .alternativeExplanations ||
                []
              ).length > 0 && (
                <section>
                  <h3>
                    Alternative explanations
                  </h3>

                  <ul>
                    {critic
                      .alternativeExplanations
                      .map(
                        (
                          explanation,
                          index,
                        ) => (
                          <li
                            key={index}
                          >
                            {
                              explanation
                            }
                          </li>
                        ),
                      )}
                  </ul>
                </section>
              )}


              {(
                critic.followUpQuestions ||
                []
              ).length > 0 && (
                <section>
                  <h3>
                    Questions to resolve
                  </h3>

                  <ul>
                    {critic
                      .followUpQuestions
                      .map(
                        (
                          question,
                          index,
                        ) => (
                          <li
                            key={index}
                          >
                            {question}
                          </li>
                        ),
                      )}
                  </ul>
                </section>
              )}


              {critic.criticNote && (
                <div
                  style={{
                    marginTop: '24px',
                    padding: '18px',
                    borderRadius:
                      '12px',
                    background:
                      '#eee9ff',
                  }}
                >
                  <strong>
                    Critic recommendation
                  </strong>

                  <p>
                    {
                      critic.criticNote
                    }
                  </p>
                </div>
              )}


              <p
                style={{
                  marginTop: '18px',
                  fontSize: '12px',
                  opacity: 0.65,
                }}
              >
                {
                  critic.generatedBy
                }
              </p>
            </div>
          )}


          <div
            style={{
              marginTop: '36px',
              padding: '24px',
              borderRadius: '16px',
              border:
                '1px solid #b5d6e9',
              background: '#e9f3fa',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.12em',
                color: '#0073bb',
              }}
            >
              AMAZON BEDROCK AGENTCORE
            </div>

            <h2>
              Research Facilitator
            </h2>

            <p>
              Ask BridgeBoard's Facilitator Agent
              to identify the single scientific issue
              that deserves the team's attention next.
            </p>

            <button
              onClick={
                runFacilitatorAgent
              }
              disabled={
                facilitatorLoading
              }
              style={{
                marginTop: '10px',
                padding: '14px 22px',
                fontSize: '15px',
                fontWeight: '700',
                cursor:
                  facilitatorLoading
                    ? 'wait'
                    : 'pointer',
              }}
            >
              {facilitatorLoading
                ? 'Facilitator is reviewing the room...'
                : 'Ask Facilitator Agent'}
            </button>

            {facilitatorError && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px',
                  background: '#fff1f1',
                  border:
                    '1px solid #e6baba',
                }}
              >
                {facilitatorError}
              </div>
            )}
          </div>


          {facilitator && (
            <section
              style={{
                marginTop: '24px',
                padding: '24px',
                borderRadius: '16px',
                background: '#f2efff',
                border:
                  '1px solid #b5d6e9',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.12em',
                  color: '#0073bb',
                }}
              >
                FACILITATOR AGENT
              </div>


              <h2>
                What needs attention next?
              </h2>


              <div
                style={{
                  marginTop: '18px',
                }}
              >
                <strong>
                  Room status
                </strong>

                <p
                  style={{
                    textTransform:
                      'capitalize',
                  }}
                >
                  {facilitator.roomStatus}
                </p>
              </div>


              <div
                style={{
                  marginTop: '18px',
                }}
              >
                <strong>
                  Priority issue
                </strong>

                <p>
                  {facilitator.priorityIssue}
                </p>
              </div>


              {facilitator
                .overlookedContribution
                ?.summary && (
                <div
                  style={{
                    marginTop: '18px',
                  }}
                >
                  <strong>
                    Contribution needing attention
                  </strong>

                  <p>
                    {facilitator
                      .overlookedContribution
                      .speaker && (
                      <>
                        <b>
                          {
                            facilitator
                              .overlookedContribution
                              .speaker
                          }
                        </b>

                        {' — '}
                      </>
                    )}

                    {
                      facilitator
                        .overlookedContribution
                        .summary
                    }
                  </p>
                </div>
              )}


              {facilitator
                .unresolvedConflict && (
                <div
                  style={{
                    marginTop: '18px',
                  }}
                >
                  <strong>
                    Unresolved conflict
                  </strong>

                  <p>
                    {
                      facilitator
                        .unresolvedConflict
                    }
                  </p>
                </div>
              )}


              {facilitator
                .evidenceGap && (
                <div
                  style={{
                    marginTop: '18px',
                  }}
                >
                  <strong>
                    Evidence gap
                  </strong>

                  <p>
                    {
                      facilitator
                        .evidenceGap
                    }
                  </p>
                </div>
              )}


              {facilitator
                .nextAction && (
                <div
                  style={{
                    marginTop: '22px',
                    padding: '18px',
                    borderRadius:
                      '12px',
                    background:
                      '#ffffff',
                    border:
                      '1px solid #ded8f4',
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '11px',
                      fontWeight:
                        '700',
                      letterSpacing:
                        '0.10em',
                      color:
                        '#0073bb',
                    }}
                  >
                    RECOMMENDED NEXT ACTION
                  </div>

                  <h3>
                    {
                      facilitator
                        .nextAction
                        .title
                    }
                  </h3>

                  <p>
                    {
                      facilitator
                        .nextAction
                        .rationale
                    }
                  </p>

                  <small>
                    Type:{' '}
                    {
                      facilitator
                        .nextAction
                        .type
                    }
                  </small>
                </div>
              )}


              {facilitator
                .facilitatorMessage && (
                <div
                  style={{
                    marginTop: '22px',
                    padding: '18px',
                    background:
                      '#ffffff',
                    borderLeft:
                      '4px solid #0073bb',
                  }}
                >
                  <strong>
                    Message to the team
                  </strong>

                  <p>
                    {
                      facilitator
                        .facilitatorMessage
                    }
                  </p>
                </div>
              )}


              <p
                style={{
                  marginTop: '18px',
                  fontSize: '12px',
                  opacity: 0.65,
                }}
              >
                {facilitator.generatedBy}
                {facilitator.fallbackUsed && (
                  <> &middot; Fallback mode</>
                )}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}


export default ResearchAIPage