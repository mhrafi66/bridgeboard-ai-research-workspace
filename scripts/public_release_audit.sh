#!/usr/bin/env bash
set -euo pipefail

patterns='AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|aws_secret_access_key[[:space:]]*=|aws_access_key_id[[:space:]]*=|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|arn:aws:(iam|bedrock-agentcore):[^:]*:[0-9]{12}|https://[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com|https://[a-z0-9]+\.cloudfront\.net|us-[a-z]+-[0-9]_[A-Za-z0-9]{8,}'

matches=$(grep -RInE "$patterns" . \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude='public_release_audit.sh' \
  --exclude='public-release-checklist.md' || true)

if [[ -n "$matches" ]]; then
  echo "Potential account-specific or secret-looking values found:" >&2
  echo "$matches" >&2
  exit 1
fi

echo "Public release audit: PASS"
