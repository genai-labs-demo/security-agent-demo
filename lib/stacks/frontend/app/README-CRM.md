# AnyCompany CRM - Sales Opportunity Management Platform

## Overview

AnyCompany CRM is a modern, enterprise-grade sales opportunity management platform built with React, TypeScript, and AWS Cloudscape Design System. This platform is a fully functional CRM that serves as the target application for the AWS Security Agent demo.

## Purpose

This platform serves as the target application for the AWS Security Agent demo, providing a realistic web application with intentional vulnerabilities for automated penetration testing.

## Current Features

### ✅ Pipeline Dashboard
- **Stage Metrics**: Visual cards showing Open Pipeline, New, Won, Lost, Overdue opportunities
- **Advanced Filtering**: Filter by date range, stage, owner, forecast category
- **Search**: Full-text search across opportunity names, accounts, and owners
- **Sortable Table**: Sort by any column (amount, close date, stage, etc.)
- **Real-time Metrics**: Automatically calculated pipeline health indicators

### ✅ Account Management
- **Account Health Tracking**: Green/Yellow/Red health indicators based on activity
- **Industry Segmentation**: Filter accounts by Technology, Healthcare, Finance, Retail, Manufacturing
- **View Modes**: Toggle between card and table views
- **Related Opportunities**: Click any account to see associated opportunities
- **Account Metrics**: Annual revenue, employee count, total opportunity value

### ✅ My Opportunities
- **Personal Pipeline**: Filter opportunities by current user
- **Quota Attainment**: Visual progress bar showing quota achievement
- **Weighted Forecast**: Probability-adjusted pipeline value
- **Overdue Alerts**: Automatic highlighting of opportunities past close date
- **Personal Metrics**: Pipeline value, closed won, win rate

### ✅ Team Performance
- **Team Metrics**: Aggregate pipeline value, win rate, average deal size
- **Individual Rep Cards**: Performance metrics for each team member
- **Performance Charts**: Pipeline trends and win rate visualizations
- **Time Period Filtering**: View metrics by quarter, month, or year
- **Quota Tracking**: Team-wide and individual quota attainment

### ✅ Responsive Design
- **Mobile Optimized**: Full functionality on phones and tablets
- **Adaptive Layouts**: Automatically adjusts to screen size
- **Touch-Friendly**: Optimized for touch interactions
- **Horizontal Scrolling**: Tables scroll on small screens

### ✅ Performance Optimized
- **Fast Load Times**: < 2 second page loads
- **Instant Filtering**: < 500ms filter response
- **Memoized Calculations**: Optimized re-renders
- **Debounced Search**: Smooth search experience

## Technology Stack

### Frontend
- **React 18+**: Modern component-based UI
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **React Router**: Client-side routing

### UI Framework
- **AWS Cloudscape Design System**: Enterprise-grade components
- **Cloudscape Charts**: Data visualization
- **Responsive Grid**: Mobile-first layouts

### State Management
- **React Context**: Global state management
- **Local State**: Component-level state with hooks
- **No Redux**: Simplified state management

### Data & Utilities
- **date-fns**: Date formatting and manipulation
- **Mock Data**: Realistic CRM data for demo

## Project Structure

```
src/
├── pages/
│   └── CRM/
│       ├── PipelinePage.tsx          # Main pipeline dashboard
│       ├── AccountsPage.tsx          # Account management
│       ├── MyOpportunitiesPage.tsx   # Personal pipeline
│       ├── TeamPerformancePage.tsx   # Team metrics
│       ├── components/
│       │   ├── pipeline/             # Pipeline components
│       │   ├── accounts/             # Account components
│       │   ├── team/                 # Team components
│       │   ├── shared/               # Shared components
│       │   └── layout/               # Layout components
│       ├── data/
│       │   ├── mockOpportunities.ts  # 150 opportunities
│       │   ├── mockAccounts.ts       # 75 accounts
│       │   └── mockTeamData.ts       # 12 team members
│       ├── utils/
│       │   ├── formatters.ts         # Currency, date formatting
│       │   ├── calculations.ts       # Pipeline metrics
│       │   └── filters.ts            # Filtering logic
│       ├── context/
│       │   └── CRMContext.tsx        # CRM state management
│       └── types.ts                  # TypeScript interfaces
├── common/
│   └── components/                   # Shared app components
└── App.tsx                           # Root component
```

## Data Models

### Opportunity
- ID, name, account reference
- Amount, close date, stage
- Next step, recent activity
- Forecast category, probability
- Owner reference

### Account
- ID, name, domain, industry
- Annual revenue, employee count
- Health status, health score
- Owner reference
- Opportunity count and total value

### Team Member
- ID, name, email, role
- Quota, pipeline value
- Closed won value, win rate
- Quota attainment percentage

## Mock Data

The platform includes realistic mock data for demo purposes:

- **150 Opportunities**: Distributed across all stages with realistic amounts ($10K - $500K)
- **75 Accounts**: Across 5 industries with realistic company names
- **12 Team Members**: Sales reps and managers with performance metrics
- **Consistent Relationships**: Opportunities link to accounts, accounts link to owners

All data represents **AnyCompany CRM FY25 Q2** performance.

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Modern web browser

### Installation

```bash
# Install dependencies
npm install

# Start dev server
npm run -w frontend dev

# Build for production
npm run -w frontend build

# Preview production build
npm run -w frontend preview
```

### Development

```bash
# Run dev server (http://localhost:5173)
npm run -w frontend dev

# Run tests
npm run -w frontend test

# Run linter
npm run -w frontend lint

# Type check
npm run -w frontend type-check
```

## Demo Preparation

See [DEMO-PREPARATION.md](./DEMO-PREPARATION.md) for comprehensive demo preparation checklist and talking points.

### Quick Demo Flow

1. **Pipeline Dashboard**: Show filtering, search, and stage metrics
2. **Accounts Page**: Demonstrate health tracking and industry filtering
3. **My Opportunities**: Highlight quota attainment and overdue alerts
4. **Team Performance**: Show team metrics and performance charts
5. **Security Dashboard**: Demonstrate vulnerability scanning with the AWS Security Agent

## Architecture

### Current Architecture
```
┌─────────────────────────────────────┐
│     AnyCompany CRM Web App          │
│   (React + TypeScript + Vite)       │
├─────────────────────────────────────┤
│  Pipeline | Accounts | Team | My    │
│  Dashboard  Management  Perf  Opps  │
├─────────────────────────────────────┤
│     Shared Components Layer         │
│  (Tables, Cards, Filters, Charts)   │
├─────────────────────────────────────┤
│      Data Management Layer          │
│   (Mock Data, State, Utils)         │
└─────────────────────────────────────┘
```

## Performance Targets

- ✅ Page load time: < 2 seconds
- ✅ Filter response: < 500ms
- ✅ Search response: < 300ms (debounced)
- ✅ Table sorting: Instant
- ✅ Navigation: Instant

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader compatible
- Proper ARIA labels
- Color contrast compliant

## Contributing

This is a demo platform. For production use, consider:

1. Replace mock data with real API calls
2. Add authentication and authorization
3. Implement data persistence
4. Add comprehensive error handling
5. Implement audit logging
6. Add data validation
7. Implement rate limiting
8. Add monitoring and alerting

## License

Apache License Version 2.0

## Support

For questions or issues, contact the AWS Technical Product Marketing team.

---

**Note**: This platform includes intentional security vulnerabilities for AWS Security Agent pen testing demonstrations.
