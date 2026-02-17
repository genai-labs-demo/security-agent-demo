# AWS Security Agent Demo Backend

Backend API with intentional vulnerabilities for AWS Security Agent demonstration.

## ⚠️ WARNING

This application contains **intentional security vulnerabilities** for educational purposes only. 
**DO NOT deploy to production environments.**

## Architecture

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL (AWS RDS)
- **Authentication**: AWS Cognito
- **Testing**: Jest + fast-check (property-based testing)

## Project Structure

```
backend/src/
├── app.ts                 # Express application setup
├── index.ts              # Application entry point
├── config.ts             # Configuration management
├── middleware/
│   ├── auth.ts           # JWT authentication middleware
│   ├── cors.ts           # CORS configuration
│   └── logger.ts         # Request logging
├── routes/
│   ├── auth.ts           # Authentication endpoints
│   └── health.ts         # Health check / preflight validator
└── db/
    ├── pool.ts           # Database connection pool
    ├── migrate.ts        # Database migrations
    ├── seed.ts           # Seed data
    └── setup.ts          # Complete database setup
```

## API Endpoints

### Core Endpoints

- `GET /` - API information
- `GET /api/health` - Health check and preflight validation
- `POST /api/auth/login` - User authentication with Cognito

### Vulnerability Demo Endpoints (To be implemented)

- `GET /api/profile/:userId` - SQL Injection demo
- `POST /api/comments` - XSS (stored) demo
- `GET /api/comments` - XSS (reflected) demo
- `POST /api/tools/ping` - Command Injection demo

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vulnerabledemodb
DB_USER=postgres
DB_PASSWORD=postgres

# AWS Cognito
USER_POOL_ID=us-east-1_xxxxx
USER_POOL_CLIENT_ID=xxxxx
AWS_REGION=us-east-1

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
```

## Scripts

```bash
# Build TypeScript
npm run build

# Start production server
npm start

# Start development server
npm run dev

# Run tests
npm test

# Database operations
npm run db:setup    # Run migrations and seeds
npm run db:migrate  # Run migrations only
npm run db:seed     # Run seeds only
```

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables (create `.env` file)

3. Set up database:
   ```bash
   npm run db:setup
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Testing

The application uses a dual testing approach:

- **Unit Tests**: Specific examples and edge cases
- **Property-Based Tests**: Universal properties across all inputs using fast-check

Run tests with:
```bash
npm test
```

## Implemented Features (Task 4)

✅ **4.1 Express.js Application Setup**
- Express app with middleware configuration
- CORS for CloudFront origin
- Request logging
- Database connection pool

✅ **4.2 Cognito Authentication Integration**
- JWT token verification middleware
- POST /api/auth/login endpoint
- Cognito token validation

✅ **4.3 Preflight Validator Endpoint**
- GET /api/health endpoint
- RDS database connectivity check
- Cognito configuration check
- Structured health status JSON response

## Next Steps

- Task 5: Deploy and test infrastructure
- Task 6: Implement SQL Injection vulnerability
- Task 7: Implement Command Injection vulnerability
- Task 8: Implement XSS vulnerabilities
- Task 9: Implement frontend application
