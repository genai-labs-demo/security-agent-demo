# Database Setup

This directory contains database migration and seed scripts for the AWS Security Agent Demo Application.

## Structure

```
db/
├── migrations/          # SQL migration files (schema creation)
│   ├── 001_create_users_table.sql
│   ├── 002_create_comments_table.sql
│   └── 003_create_vulnerability_info_table.sql
├── seeds/              # SQL seed data files (sample data)
│   ├── 001_seed_vulnerability_info.sql
│   ├── 002_seed_users.sql
│   └── 003_seed_comments.sql
├── migrate.ts          # Migration runner
├── seed.ts             # Seed data runner
└── setup.ts            # Combined setup (migrations + seeds)
```

## Usage

### Environment Variables

Set these environment variables before running database scripts:

```bash
export DB_HOST=your-rds-endpoint.amazonaws.com
export DB_PORT=5432
export DB_NAME=vulnerable_demo
export DB_USER=postgres
export DB_PASSWORD=your-password
```

### Run All Setup (Migrations + Seeds)

```bash
npm run db:setup
```

### Run Migrations Only

```bash
npm run db:migrate
```

### Run Seeds Only

```bash
npm run db:seed
```

### Direct Execution

You can also run the TypeScript files directly:

```bash
ts-node src/db/migrate.ts
ts-node src/db/seed.ts
ts-node src/db/setup.ts
```

## Database Schema

### Users Table

Stores user profile information linked to Cognito authentication.

- `id`: Primary key
- `cognito_id`: Unique Cognito user identifier
- `username`: Display name
- `email`: User email address
- `role`: User role (admin/user)
- `bio`: User biography
- `created_at`: Timestamp

### Comments Table

Stores user comments for XSS vulnerability demonstrations.

- `id`: Primary key
- `user_id`: Foreign key to users table
- `content`: Comment text (intentionally not sanitized)
- `created_at`: Timestamp

### Vulnerability Info Table

Stores educational content about each vulnerability type.

- `id`: Primary key
- `vuln_type`: Vulnerability type identifier (sql_injection, command_injection, xss)
- `title`: Vulnerability title
- `description`: Detailed description
- `sample_payloads`: JSON array of example attack payloads
- `detection_info`: Information about how AWS Security Agent detects this vulnerability
- `created_at`: Timestamp

## Notes

- Migration files are executed in alphabetical order (001, 002, 003, etc.)
- Seed files are executed in alphabetical order after migrations
- All scripts use `IF NOT EXISTS` and `ON CONFLICT` clauses for idempotency
- Sample users have placeholder Cognito IDs that should be updated after Cognito user pool creation
