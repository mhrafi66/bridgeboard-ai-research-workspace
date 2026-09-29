# Public Release Checklist

Before publishing a new BridgeBoard snapshot:

- [ ] Confirm all teammates are comfortable with the public portfolio copy.
- [ ] Remove `.env.production`, `.env.local`, and other environment files.
- [ ] Remove AgentCore `.cli/deployed-state.json` and account-specific target files.
- [ ] Search for AWS account IDs, temporary API URLs, Cognito IDs, and ARNs.
- [ ] Search for `AKIA`, `ASIA`, `aws_secret_access_key`, and private keys.
- [ ] Remove generated code-context/prompt dumps.
- [ ] Run `npm run build` and `npm run lint`.
- [ ] Verify portfolio demo mode works without environment variables.
- [ ] Keep cloud architecture documentation, but label old endpoints as historical rather than live.
