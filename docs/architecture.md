# System Architecture

## Overview

BridgeBoard follows a serverless, event-driven architecture. The browser never holds AWS credentials - all service calls are made by the Lambda function using its IAM role, authenticated by a Cognito JWT that the API Gateway validates before any Lambda invocation.

```
Browser (React 19 + Vite)
    |
    |  HTTPS + Bearer JWT
    v
Amazon API Gateway (HTTP API)
    |
    |  JWT authorizer validates Cognito token
    |  before forwarding to Lambda
    v
AWS Lambda (Python 3.12 - handler.py)
    |
    +-- Amazon DynamoDB      (persistent state)
    +-- Amazon S3            (file storage)
    +-- Amazon Bedrock       (AI reasoning)
    +-- Amazon Textract      (OCR / document reading)
    +-- Amazon Comprehend    (NLP analysis)
    +-- Amazon Translate     (language translation)
    +-- Amazon Polly         (speech synthesis)
    +-- Amazon Transcribe    (voice-to-text)
```

## Frontend

| Tech | Version | Role |
|------|---------|------|
| React | 19 | UI framework |
| Vite | 8 | Build tool, dev server |
| AWS Amplify Auth | latest | Cognito token management |
| Pure CSS | - | No component library - custom dt- prefixed classes |

The frontend is a static site deployed to S3 and served via CloudFront. It polls the API every 3 seconds for new messages - no WebSocket is needed because the polling interval is short enough to feel live and avoids the complexity of managing persistent connections in a serverless environment.

### Key frontend files

```
src/
  App.jsx                         Root app, auth, view routing
  lib/api.js                      All fetch calls to API Gateway
  features/
    research-ai/
      ResearchAIPage.jsx          Parent page: tabs, model selector, analysis panels
      DiscussionThread.jsx        Real-time chat: messages, commands, agent cards
      DiscussionThread.css        All dt- prefixed styles
    universal-input/
      VoiceInput.jsx              Microphone button, Transcribe polling
```

## Backend

A single Lambda function (`handler.py`) handles every route. Routes are dispatched by `(method, path)` pattern matching in `lambda_handler`. This keeps deployment simple - one zip, one function, one IAM role.

### Lambda configuration

| Setting | Value | Reason |
|---|---|---|
| Runtime | Python 3.12 | Latest stable, boto3 built-in |
| Timeout | 60 seconds | Textract + Bedrock chain can take 20-30s |
| Memory | 256 MB | No heavy in-memory processing; text handling only |
| Handler | `handler.lambda_handler` | Single entry point |

### Route table

| Method | Path | Handler function |
|---|---|---|
| GET | /updates | `get_updates()` |
| POST | /updates | `handle_update()` |
| GET | /action-plans | `get_action_plans()` |
| POST | /action-plan | `generate_action_plan()` |
| POST | /research/analyze-discussion | `analyze_research_discussion()` |
| POST | /research/critic | `run_scientific_critic()` |
| POST | /research/context | `analyze_research_context()` |
| POST | /research/facilitator | `run_facilitator_agent()` |
| POST | /research/upload-url | `generate_upload_url()` |
| GET | /research/messages | `get_discussion_messages()` |
| POST | /research/messages | `post_discussion_message()` |
| DELETE | /research/messages | `delete_discussion_message()` |
| POST | /research/agent-command | `handle_agent_command()` |
| POST | /ingestion/translate | Translate module |
| POST | /ingestion/speak | Polly module |
| POST | /ingestion/transcribe | Transcribe module |

## Data Storage

### DynamoDB

Single-table design with a partition key (`pk`) and sort key (`sk`).

| Entity | pk | sk | Description |
|---|---|---|---|
| Room update | `ROOM#<room-id>` | `UPDATE#<timestamp>#<id>` | Team pulse messages |
| Action plan | `ROOM#<room-id>` | `PLAN#<timestamp>#<id>` | AI-generated plans |
| Discussion message | `DISCUSSION` | `MSG#<timestamp>#<id>` | Chat messages |
| Agent response | `DISCUSSION` | `MSG#<timestamp>#<id>` | AI command results, `entity: "agent-response"` |

All items use `ScanIndexForward=True` on the discussion partition so messages arrive in chronological order. `ScanIndexForward=False` on room partitions gives newest-first for updates and plans.

### S3 - MediaBucket

All uploaded files land in `uploads/<uuid>/<safe-filename>`. The `<uuid>` prefix ensures filenames from different uploads never collide even if they share a name.

- **Upload**: pre-signed `PUT` URL, 5-minute expiry, scoped to `uploads/` prefix
- **Download**: pre-signed `GET` URL, 24-hour expiry, generated fresh on every message read
- **Lifecycle**: 7-day auto-expiry (hackathon demo, not production retention)
- **Access**: all public access blocked; CORS allows PUT/GET from the CloudFront origin and localhost

## Authentication

Cognito Hosted UI issues a JWT (access token) after login. API Gateway validates the JWT signature against the Cognito JWKS endpoint before forwarding any request to Lambda. The Lambda reads identity from `event.requestContext.authorizer.jwt.claims` - it does not trust user-supplied identity fields in the request body.

## Feature Modules

In addition to the core Research Hub and Discussion Thread, BridgeBoard includes four feature modules that extend the platform into broader research workflow areas. All four use synthetic demo data defined as inline constants within their components - no backend calls or DynamoDB storage.

### Reproducibility and Provenance

**File:** `src/features/provenance/ProvenancePage.jsx`

Tracks computational experiment runs with full provenance metadata: pipeline version, model checkpoint, dataset version, git commit, branch, GPU allocation, runtime duration, and output metrics (RMSE, R-squared, MAE). Each run links to the researcher who triggered it and optionally to a manuscript. The UI shows run status (completed, running, failed), resource usage, and a detailed provenance chain so any result can be traced back to its exact inputs and configuration.

### Lab Memory and Onboarding

**File:** `src/features/lab-memory/LabMemoryPage.jsx`

A knowledge base of institutional memory - the decisions, failed experiments, protocols, conventions, equipment quirks, data sources, and methods that a lab accumulates over time. Entries are categorised and searchable. Each entry has a summary for quick scanning and a detail section for full context. Designed to solve the onboarding problem: new lab members can browse the knowledge base to understand why things are done a certain way without asking the same questions previous members already answered.

### Research Lifecycle / Manuscripts

**File:** `src/features/manuscripts/ManuscriptsPage.jsx`

Tracks papers through the full research lifecycle: idea, literature review, drafting, internal review, submitted, revision, and published. Each manuscript shows authors, target venue, priority, progress percentage, and deadline. The pipeline view provides a visual board of where every paper stands. Papers can link back to Research Hub conversations that inspired them.

### Mentorship and Advising

**File:** `src/features/advising/AdvisingPage.jsx`

A mentorship dashboard with role-based access control. The `demoRole` prop (`pi`, `student`, or `member`) determines what the user sees:

| Role | View |
|---|---|
| PI (Principal Investigator) | Full dashboard: all student cards with status (green/amber/red), weekly check-in summaries, wins, blockers, hours, mood, milestones, AI usage analytics, and meeting scheduling |
| Student | Own status card, personal milestones, own AI usage history, and a weekly check-in form to submit updates |
| Member | Lab-wide view with aggregate statistics and team activity, without individual student detail |

This demonstrates how the same data can be presented differently based on role, enforcing appropriate information boundaries in a research supervision context.

## Content Safety and Guardrails

BridgeBoard implements a multi-layered guardrail system to protect users and enforce academic integrity:

1. **AWS Bedrock Guardrails** - managed content filters (violence, hate, prompt injection), profanity filtering, PII protection, and denied topic policies for harmful research and academic fraud
2. **Amazon Comprehend PII Detection** - custom two-tier severity system on all agent commands, blocking high-severity PII (SSN, bank accounts, AWS keys) and flagging lower-severity types
3. **Application-level validation** - `clean_text()` sanitiser, model ID allowlist, emoji allowlist, path traversal prevention, and length constraints on all inputs
4. **Infrastructure controls** - API Gateway JWT auth and throttling, Cognito password policy, S3 encryption and access controls, DynamoDB SSE and PITR

See [guardrails.md](guardrails.md) for full details, configuration values, and test cases.

## Infrastructure as Code

All AWS resources are defined in `infrastructure/template.yaml` (CloudFormation). Nothing is created by hand in the console. The deployment script in `scripts/deploy.sh` packages Lambda, updates the stack, reads outputs, builds the frontend with those values, and syncs to S3.
