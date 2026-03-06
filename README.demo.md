# AnyCompany CRM — Application Details

> A fictitious CRM application used as a scan target for the AWS Security Agent. Not a real CRM system.

## Features

- Pipeline Dashboard — track sample opportunities across sales stages, filter, search, sort
- Account Management — view fictitious customer accounts by industry
- Personal Pipeline — individual sales rep views with quota tracking
- Team Performance — team analytics and individual rep metrics

## Tech Stack

- React 18 + TypeScript + Vite
- AWS Cloudscape Design System
- React Router v6
- AWS Amplify (Cognito auth, API calls, S3 storage)

## Fictitious Data

- 50,000 mock opportunities (randomly generated)
- 75 fictitious company accounts
- 12 demo sales reps and managers

All data is completely fictitious.

## Local Development

```bash
# Start dev server
npm run -w frontend dev

# Build
npm run -w frontend build
```

Visit http://localhost:5173 locally. You'll need a `.env` file — copy `.env.example` and fill in values from your CDK deployment output.

## Asset Generation

Generate CRM images using Amazon Bedrock Nova Canvas:

```bash
./tools/generate-crm-assets.sh          # all 99 images (~17 min, ~$4)
python3 tools/generate-sales-avatars.py  # 12 avatars
python3 tools/generate-company-logos.py  # 75 logos
python3 tools/generate-industry-icons.py # 5 icons
python3 tools/generate-empty-states.py   # 3 illustrations
python3 tools/generate-app-logo.py       # 4 logo sizes
```

## Troubleshooting

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json && npm install

# Clear Vite cache
rm -rf lib/stacks/frontend/app/node_modules/.vite
```

## License

[Apache License Version 2.0](./LICENSE)
