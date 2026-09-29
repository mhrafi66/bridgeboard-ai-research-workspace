# Portfolio Demo Mode

The original BridgeBoard deployment depended on temporary AWS hackathon resources. This repository therefore defaults to a local portfolio mode whenever `VITE_API_URL` is not set.

## Goals

- keep the project runnable for reviewers after the AWS account expires;
- preserve the original AWS backend and infrastructure code;
- never imply that synthetic demo responses are live model output;
- avoid committing account-specific endpoints, Cognito IDs, AgentCore ARNs, or credentials.

## Behavior

The Research Hub opens in the three-researcher example. Analysis, context extraction, scientific critique, and facilitator output come from `src/lib/demoResearch.js` and are explicitly labeled as portfolio-demo results.

Static workflow modules continue to expose their seeded synthetic examples. AWS-dependent capabilities such as OCR, speech, live translation, authentication, and cloud persistence remain documented in the original implementation but require a new AWS deployment.

## Re-enabling AWS

Deploy `infrastructure/template.yaml` in an AWS account and provide the resulting frontend configuration through `.env.local` using `.env.example` as the template. When `VITE_API_URL` is present, the Research Hub uses the live backend path instead of the precomputed demo responses.
