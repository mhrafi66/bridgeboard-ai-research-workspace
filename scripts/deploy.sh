#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-Team-Summit}"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-bridgeboard-mvp}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:5173}"
MODEL_ID="${MODEL_ID:-us.anthropic.claude-sonnet-4-6}"
ALLOWED_MODELS="${ALLOWED_MODELS:-amazon.nova-lite-v1:0,us.amazon.nova-lite-v1:0,us.amazon.nova-2-lite-v1:0,us.anthropic.claude-opus-4-6-v1,us.anthropic.claude-sonnet-4-6,us.mistral.pixtral-large-2502-v1:0}"
FACILITATOR_AGENT_ARN="${FACILITATOR_AGENT_ARN:-}"

export AWS_PAGER=""

command -v aws >/dev/null || { echo "AWS CLI is required." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required." >&2; exit 1; }
command -v zip >/dev/null || { echo "zip is required." >&2; exit 1; }

ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
DEPLOY_BUCKET="${DEPLOY_BUCKET:-bridgeboard-deploy-${ACCOUNT_ID}}"
LAMBDA_KEY="bridgeboard-lambda-$(date +%Y%m%d%H%M%S).zip"
TEMP_DIR=$(mktemp -d -t bridgeboard-deploy.XXXXXX)
LAMBDA_ZIP="$TEMP_DIR/lambda.zip"
trap 'rm -rf "$TEMP_DIR"' EXIT

printf '\n[1/6] Packaging Lambda\n'
(cd backend && zip -q -r "$LAMBDA_ZIP" handler.py ingestion/ research/)

printf '[2/6] Preparing deployment bucket %s\n' "$DEPLOY_BUCKET"
if ! aws s3api head-bucket --bucket "$DEPLOY_BUCKET" --profile "$PROFILE" 2>/dev/null; then
  aws s3api create-bucket --bucket "$DEPLOY_BUCKET" --region "$REGION" --profile "$PROFILE" >/dev/null
fi
aws s3 cp "$LAMBDA_ZIP" "s3://${DEPLOY_BUCKET}/${LAMBDA_KEY}" --profile "$PROFILE" >/dev/null

printf '[3/6] Deploying CloudFormation stack %s\n' "$STACK_NAME"
aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file infrastructure/template.yaml \
  --parameter-overrides \
    "LambdaCodeBucket=${DEPLOY_BUCKET}" \
    "LambdaCodeKey=${LAMBDA_KEY}" \
    "ModelId=${MODEL_ID}" \
    "AllowedModels=${ALLOWED_MODELS}" \
    "FrontendOrigin=${FRONTEND_ORIGIN}" \
    "FacilitatorAgentArn=${FACILITATOR_AGENT_ARN}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --profile "$PROFILE"

printf '[4/6] Reading stack outputs\n'
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'Stacks[0].Outputs' \
  --output json)
read -r API_URL WEBSITE_BUCKET CLOUDFRONT_URL USER_POOL_ID CLIENT_ID HOSTED_DOMAIN <<EOF
$(python3 -c 'import json, sys; values={item["OutputKey"]: item["OutputValue"] for item in json.load(sys.stdin)}; print(values["ApiUrl"], values["WebsiteBucketName"], values["CloudFrontUrl"], values["UserPoolId"], values["UserPoolClientId"], values["CognitoHostedUiUrl"].replace("https://", ""))' <<< "$OUTPUTS")
EOF

printf '[5/6] Building and publishing frontend\n'
VITE_API_URL="$API_URL" \
VITE_COGNITO_USER_POOL_ID="$USER_POOL_ID" \
VITE_COGNITO_CLIENT_ID="$CLIENT_ID" \
VITE_COGNITO_DOMAIN="$HOSTED_DOMAIN" \
npm run build
aws s3 sync dist/ "s3://${WEBSITE_BUCKET}/" --delete --profile "$PROFILE" >/dev/null

printf '[6/6] Refreshing CloudFront\n'
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --profile "$PROFILE" \
  --query "DistributionList.Items[?DomainName=='${CLOUDFRONT_URL#https://}'].Id | [0]" \
  --output text)
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths '/*' \
  --profile "$PROFILE" \
  --query Invalidation.Id \
  --output text

printf '\nDeployment complete.\nFrontend: %s\nAPI: %s\nCognito user pool: %s\nCognito client: %s\n\n' "$CLOUDFRONT_URL" "$API_URL" "$USER_POOL_ID" "$CLIENT_ID"
