# BridgeBoard Developer Documentation

This folder contains technical documentation for contributors and evaluators working with the BridgeBoard platform.

## Contents

| Document | Description |
|---|---|
| [architecture.md](architecture.md) | Full system architecture - frontend, Lambda, AWS services, data flows |
| [agent-commands.md](agent-commands.md) | Slash command system: agent types, AWS pipelines, methodology |
| [research-reasoning.md](research-reasoning.md) | How AI research analysis works end-to-end |
| [discussion-thread.md](discussion-thread.md) | Real-time discussion thread: polling, mentions, files, agents |
| [file-storage.md](file-storage.md) | S3 file upload/download, Textract OCR pipeline |
| [aws-services.md](aws-services.md) | Every AWS service used, why it was chosen, how it integrates |
| [guardrails.md](guardrails.md) | Content safety: Bedrock guardrails, PII detection, input validation, infrastructure controls |

### Feature Modules

| Feature | Description |
|---|---|
| Reproducibility and Provenance | Experiment run tracking with full provenance chains - pipeline, model, dataset, git commit, metrics |
| Lab Memory and Onboarding | Institutional knowledge base: decisions, failed experiments, protocols, conventions, equipment quirks |
| Research Lifecycle / Manuscripts | Paper pipeline from idea through publication - authors, venues, deadlines, progress tracking |
| Mentorship and Advising | Role-based advising dashboard with PI, Student, and Member views for research supervision |

All four feature modules use synthetic demo data with inline constants (no backend calls). The Advising module demonstrates role-based access control where PIs see all student details, students see only their own data, and lab members see aggregate team statistics.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Deploy to AWS
bash scripts/deploy.sh
```

## Project at a Glance

BridgeBoard is a research collaboration platform built on React 19 + AWS. The discussion thread is the core workspace: researchers post messages, upload documents, and invoke AI agents via slash commands. Those agents use a chain of AWS services (Textract, Comprehend, Bedrock, Translate) to analyze documents, answer questions, extract text, and surface NLP insights - all results appear inline in the shared thread.
