# AWS Services Reference

Every AWS service used in BridgeBoard, what it does, why it was chosen, and where in the codebase it appears.

## Amazon API Gateway (HTTP API)

**Role:** Public entry point for all browser-to-backend communication.

**Why HTTP API (not REST API):** HTTP API is simpler, cheaper, and faster than REST API for straightforward proxy-to-Lambda routing. It supports JWT authorisation natively without a custom Lambda authorizer.

**Configuration:**
- JWT authorizer validates Cognito access tokens before any request reaches Lambda
- CORS configured at the API level (not in Lambda responses) for `FrontendOrigin`
- All methods (`GET`, `POST`, `DELETE`, `OPTIONS`) allowed
- Throttling: 20 burst / 10 rate (prevents accidental runaway polling)

**Where:** `infrastructure/template.yaml` - `ActionApi`, `ApiAuthorizer`, all `ApiRoute*` resources

---

## Amazon Cognito

**Role:** User authentication. Issues JWTs that API Gateway validates.

**What it provides:**
- Hosted UI for sign-up / sign-in (no custom auth UI needed)
- Access tokens (JWTs) used as Bearer tokens on every API call
- User identity in JWT claims: `sub` (stable user ID), `email`, `username`

**What BridgeBoard does with it:**
- Uses `aws-amplify/auth` (`fetchAuthSession`) to get the current token
- Passes token as `Authorization: Bearer <token>` on every fetch
- Lambda reads `event.requestContext.authorizer.jwt.claims` for the user's identity - never trusts body-supplied identity

**Where:** `infrastructure/template.yaml` - `UserPool`, `UserPoolClient`, `UserPoolDomain`; `src/lib/api.js` - `getAuthHeaders()`; `src/App.jsx` - `signInWithRedirect()`

---

## AWS Lambda

**Role:** All application logic. Single Python 3.12 function handles every route.

**Why a single function:**
- Simpler deployment (one zip, one update)
- Shared initialisation code (boto3 clients created once at cold-start, reused across warm invocations)
- Easier IAM - one role with all needed permissions
- No inter-service latency from separate Lambda-to-Lambda calls

**Cold start mitigation:** boto3 clients are instantiated at module level, not inside handler functions. On a warm invocation (Lambda container reuse), the clients are already connected and ready.

**Timeout:** 60 seconds. The `/research/agent-command` path can chain Textract + Bedrock which takes 15-30 seconds depending on document size and model.

**Where:** `backend/handler.py`

---

## Amazon DynamoDB

**Role:** Persistent storage for all application state.

**Design pattern:** Single-table with `pk`/`sk` composite key. All entities in one table.

**Why single-table:**
- One provisioned table, one set of backups, one billing line
- Related data (all discussion messages) is co-located on the same partition, so a single `Query` operation retrieves everything without joins
- `PAY_PER_REQUEST` billing - zero cost when idle, scales automatically

**Access patterns:**
- `Query pk=DISCUSSION, sk begins_with MSG#` - all discussion messages, chronological
- `Query pk=ROOM#<id>, sk begins_with UPDATE#` - room updates, newest-first
- `Query pk=ROOM#<id>, sk begins_with PLAN#` - action plans, newest-first
- `GetItem pk=DISCUSSION, sk=MSG#<ts>#<id>` - single message for delete validation
- `DeleteItem pk=DISCUSSION, sk=MSG#<ts>#<id>` - message deletion

**Security:** Point-in-time recovery enabled, SSE at rest enabled.

**Where:** `infrastructure/template.yaml` - `UpdatesTable`; `backend/handler.py` - `_table`

---

## Amazon S3

**Role:** File storage for all uploaded documents, images, and media.

**Two buckets:**
1. `MediaBucket` - user-uploaded files, pre-signed URL access
2. `WebsiteBucket` - compiled React frontend, CloudFront serves it

**MediaBucket key design:**
```
uploads/<uuid>/<sanitised-filename>
```
UUID prefix per upload prevents collision and path traversal.

**Access model:** No public access. All access via pre-signed URLs:
- PUT URL (5 min expiry) - browser uploads directly
- GET URL (24 hour expiry) - browser fetches directly

**Where:** `infrastructure/template.yaml` - `MediaBucket`, `WebsiteBucket`; `backend/handler.py` - `_s3`, `generate_upload_url()`, `_presign_attachments()`; `src/lib/api.js` - `getUploadUrl()`, `uploadFileToS3()`

---

## Amazon Bedrock (Converse API)

**Role:** Large language model inference for all AI reasoning.

**Why Converse API (not InvokeModel):**
Converse is a unified, model-agnostic API. The same Python code works with Claude, Nova, and Mistral by changing only the `modelId` parameter. InvokeModel requires per-model payload formatting.

**Models used:**

| Model ID | Use case |
|---|---|
| `us.anthropic.claude-sonnet-4-6` | Default - research analysis, critique, facilitator, /ask, /search |
| `us.anthropic.claude-opus-4-6-v1` | High-quality analysis when selected |
| `us.amazon.nova-2-lite-v1:0` | Fast, cost-effective for simpler tasks |
| `us.mistral.pixtral-large-2502-v1:0` | Alternative model option |

**Model validation:** The `ALLOWED_MODELS` set in Lambda ensures only pre-approved model IDs can be invoked. The frontend model selector is advisory; the backend always validates.

**Temperature settings by use case:**

| Task | Temperature | Reason |
|---|---|---|
| Research analysis | 0.1 | Highly factual, grounded in supplied text |
| Scientific critique | 0.1 | Deterministic evaluation |
| Action plan | 0.2 | Slight variation acceptable |
| Facilitator | 0.2 | Slight variation acceptable |
| /ask (RAG) | 0.2 | Stay close to retrieved context |
| /search | 0.3 | Broader exploration appropriate |

**Where:** `infrastructure/template.yaml` - Bedrock IAM permissions; `backend/handler.py` - `_bedrock`, used in `analyze_research_discussion()`, `run_scientific_critic()`, `run_facilitator_agent()`, `generate_action_plan()`, `_handle_ask()`, `_handle_summarize()`, `_handle_search()`

---

## Amazon Textract

**Role:** Document reading and OCR. Extracts machine-readable text from PDFs, scanned images, and photographs.

**API used:** `start_document_text_detection` (async) + `get_document_text_detection` (polling) - handles documents of any size including multi-page research papers.

**Why async over sync (`detect_document_text`):**
- The sync API is limited to ~3 pages. Research papers are typically 10-30 pages.
- The async API processes documents of any length on Textract's infrastructure and is polled for results.
- For typical research PDFs, the async job completes in 5-15 seconds, well within the API Gateway 29-second limit.

**Why Textract over asking the LLM to read the file:**
- Textract is purpose-built for document layout analysis and handles multi-column PDFs, tables, and handwriting
- Textract is deterministic and cheap (~$0.0015/page)
- Separating OCR from reasoning makes each step independently testable and replaceable

**Integration pattern:**
```python
# 1. Start async job - Textract reads directly from S3
job = _textract.start_document_text_detection(
    DocumentLocation={"S3Object": {"Bucket": MEDIA_BUCKET, "Name": s3_key}}
)
job_id = job["JobId"]

# 2. Poll with exponential backoff (2s -> 5s max, 25s timeout)
while time.time() < deadline:
    time.sleep(delay)
    resp = _textract.get_document_text_detection(JobId=job_id)
    if resp["JobStatus"] == "SUCCEEDED":
        lines = [b["Text"] for b in resp["Blocks"] if b["BlockType"] == "LINE"]
        # paginate via NextToken to collect all pages
        break

# 3. Join LINE blocks to reconstruct reading-order text
text = "\n".join(lines)
```

**Where:** `infrastructure/template.yaml` - `textract:StartDocumentTextDetection`, `textract:GetDocumentTextDetection` IAM permissions; `backend/handler.py` - `_textract`, `_textract_extract_text()`; Used by `/extract`, `/analyze`, `/translate` commands

---

## Amazon Comprehend

**Role:** NLP analysis - language detection, sentiment classification, named entity recognition, key phrase extraction.

**Why Comprehend:**
- Purpose-built NLP models with higher accuracy than a general LLM for these specific tasks
- Structured, typed output (entity type, confidence score) ready for UI rendering
- Cost-effective: ~$0.0001 per 100 characters vs much higher Bedrock costs
- Deterministic - same input produces same output

**APIs used:**
- `detect_dominant_language` - identifies language and confidence score
- `detect_sentiment` - classifies as POSITIVE/NEGATIVE/NEUTRAL/MIXED with scores
- `detect_entities` - extracts named entities (PERSON, ORGANIZATION, LOCATION, DATE, QUANTITY, etc.)
- `detect_key_phrases` - extracts the most meaningful noun phrases

**Language gate:** Entity and phrase extraction only runs if the detected language is in `COMPREHEND_ANALYSIS_LANGUAGES`. This prevents calls that would return low-quality results for unsupported languages.

**Where:** `infrastructure/template.yaml` - Comprehend IAM permissions; `backend/handler.py` - `_comprehend`, `analyze_research_context()`, `_handle_analyze()`

---

## Amazon Translate

**Role:** Text translation between languages.

**API used:** `translate_text` with `SourceLanguageCode: "auto"` - auto-detects source language.

**Per-call limit:** 10,000 bytes. Long documents exceed this limit if sent in a single call.

**Chunking strategy:** `_translate_text_chunked()` splits text at sentence boundaries (`.`, `!`, `?`, `。`, `！`, `？`) into chunks that fit within 9,000 bytes (10% safety margin). Each chunk is translated separately and the results are rejoined. The source language is captured from the first chunk's response.

```python
# Sentence-boundary split, translate each chunk, rejoin
sentences = re.split(r'(?<=[.!?。！？])\s+', text)
# ... chunk sentences to stay under 9000 bytes ...
for chunk in chunks:
    result = _translate_client.translate_text(
        Text=chunk, SourceLanguageCode="auto", TargetLanguageCode=target_lang
    )
    translated_parts.append(result["TranslatedText"])
```

**Where:** `infrastructure/template.yaml` - Translate IAM permissions; `backend/handler.py` - `_translate_client`, `_translate_text_chunked()`, `_handle_translate_cmd()`; `src/lib/api.js` - `translateText()` (also used by ingestion tab)

---

## Amazon Polly

**Role:** Text-to-speech synthesis for the ingestion tab.

**API used:** `synthesize_speech` - converts text to MP3 audio.

**Integration:** Used by the `/ingestion/speak` endpoint. The frontend plays the returned base64 audio. Not currently used by the discussion thread.

**Where:** `infrastructure/template.yaml` - Polly IAM permissions; `backend/ingestion/polly.py`

---

## Amazon Transcribe

**Role:** Speech-to-text transcription for the voice input button in the discussion thread.

**API used:** `start_transcription_job` (async) + `get_transcription_job` (polling).

**Integration pattern (async):**
1. Browser records audio, encodes as base64
2. `POST /ingestion/transcribe` stores audio to S3, starts transcription job
3. Browser polls `GET /ingestion/transcribe?jobName=...` every 2 seconds
4. When status is `COMPLETED`, the transcript text is inserted into the message composer

**Why async:** Transcribe is an asynchronous service - transcription takes a few seconds and cannot be done synchronously in a single HTTP request.

**Where:** `infrastructure/template.yaml` - Transcribe IAM permissions; `backend/ingestion/transcribe.py`; `src/features/universal-input/VoiceInput.jsx`

---

## Amazon CloudFront

**Role:** CDN for the React frontend. Serves static assets globally with HTTPS.

**Configuration:**
- `PriceClass_100` - US, Canada, Europe only (cost optimisation for hackathon)
- `redirect-to-https` - all HTTP redirected to HTTPS
- Custom error responses for 403 and 404 return `index.html` with 200 - required for React Router client-side routing
- Origin Access Control (OAC) - CloudFront authenticates to S3 with SigV4, no public bucket needed

**Where:** `infrastructure/template.yaml` - `WebsiteDistribution`, `CloudFrontOriginAccessControl`

---

## Amazon Bedrock Guardrails

**Role:** Content safety enforcement on all AI model interactions. Filters harmful content, blocks prompt injection, detects PII, and enforces denied topic policies.

**Why Bedrock Guardrails (not custom filtering):**
Bedrock Guardrails is a managed service that evaluates both input prompts and model output before results reach the user. It runs inside the Bedrock service boundary, so filtered content never leaves AWS infrastructure. Building equivalent filtering with custom code would require maintaining separate content classifiers, regex-based PII detection, and topic models - all of which are less accurate and more expensive to maintain than the managed service.

**What it filters:**

| Category | Configuration |
|---|---|
| Content filters | SEXUAL, VIOLENCE, HATE, INSULTS, MISCONDUCT (all HIGH), PROMPT_ATTACK (HIGH on input) |
| Managed word lists | PROFANITY filter enabled |
| PII protection | SSN, credit cards, bank accounts, AWS keys BLOCKED; IP addresses, emails ANONYMIZED |
| Denied topics | `harmful-research` (weapons, dangerous materials), `academic-fraud` (data fabrication, plagiarism) |

**Integration:** The Lambda function passes `GUARDRAIL_ID` and `GUARDRAIL_VERSION` environment variables (set from CloudFormation outputs) to every Bedrock Converse call. The guardrail evaluates the conversation before and after model inference. When content is blocked, the user receives the `BlockedInputMessaging` or `BlockedOutputMessaging` text instead of the model response.

**Where:** `infrastructure/template.yaml` - `ContentSafetyGuardrail`, `ContentSafetyGuardrailVersion`; `backend/handler.py` - `GUARDRAIL_ID`, `GUARDRAIL_VERSION` environment variables passed to Bedrock Converse calls

See [guardrails.md](guardrails.md) for the full multi-layered guardrail architecture including Comprehend PII detection, application-level validation, and test cases.

---

## Service Dependency Map

```
Browser
  |-- Cognito (auth tokens)
  |-- API Gateway --> Lambda
                       |-- DynamoDB (state)
                       |-- S3 (file metadata + pre-signed URLs)
                       |-- Bedrock (AI reasoning)
                       |      |-- Bedrock Guardrails (content safety)
                       |-- Textract (document OCR)  [reads from S3 directly]
                       |-- Comprehend (NLP + PII detection)
                       |-- Translate (language)
                       |-- Polly (speech)
                       |-- Transcribe (voice)
  |-- S3 directly (file upload/download via pre-signed URLs)
  |-- CloudFront --> S3 WebsiteBucket (frontend assets)
```
