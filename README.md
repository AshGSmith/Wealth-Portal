# Wealth Portal

Wealth Portal is a secure personal and joint finance portal for budgeting, wealth tracking, reporting, and user-managed access control.

It is built with Next.js, React, SQLite-backed authentication and app data persistence, and a mobile-first UI designed to work well in the browser, on iPhone home screen web-app installs, and in Docker deployments behind a reverse proxy.

## Version

Current release: `v0.1.10`

## Core Features

- Dashboard with month selector, summary tiles, alerts, and insights
- Budgeting by month with:
  - pots
  - expenses
  - savings
  - income-source filtering
  - budget refresh for unlocked budgets
  - locked-budget historical snapshots
- Wealth tracking for:
  - properties
  - mortgages
  - savings accounts
  - debts
  - pensions
  - investments
- Investments support with:
  - holdings
  - purchase tracking
  - valuation history
  - gain/loss reporting
- Reports with PDF download for:
  - detailed net worth
  - property information
  - savings insight
  - debt insight
  - income trends
  - investment insight
- Authentication and user management with:
  - login/logout
  - remember me
  - self-service signup
  - forgot/reset password
  - invitation-based user setup
  - admin user management
  - impersonation
  - linked users and joint ownership

## Data Model Highlights

Financial data is account-backed and server-persisted.

- Authenticated user data is stored in the backend/database, not browser-origin local storage
- Ownership is attached to records so the same user sees the same data across IP, domain, or reverse-proxy access
- Linked users support personal and joint records across key entities
- A one-time legacy migration flow exists for older locally stored browser data

Supported record areas include:

- Budgets
- Income Sources and Income Entries
- Pots
- Expenses
- Savings
- Properties
- Mortgages
- Savings Accounts
- Debts
- Pensions
- Investments

## Recent Changes In v0.1.10

- Added Investments to the Wealth area
- Added investment purchase logging and valuation history tracking
- Included investments in Wealth asset calculations with latest valuation or invested fallback
- Added Investments to Detailed Net Worth calculations and report output
- Added a dedicated Investment Insight report
- Improved reports/export coverage for investment data

## Running Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running With Docker

The repository includes:

- `Dockerfile`
- `docker-compose.yml`

Start the app with:

```bash
docker compose up --build
```

Default Docker access URL:

- [http://localhost:3333](http://localhost:3333)

The Docker setup uses a bind mount for `./.data:/app/.data`, so SQLite-backed auth and app data persist across container restarts and upgrades.

## Environment Notes

Important environment variables:

- `APP_URL`
- `AUTH_BOOTSTRAP_ADMIN_NAME`
- `AUTH_BOOTSTRAP_ADMIN_EMAIL`
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- `NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS`

For reverse proxy deployments, set `APP_URL` to the public HTTPS URL and configure `NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS` if needed.

## Authentication

The app supports:

- admin-created invited users
- self-service signup users
- shared user/auth/session handling for both flows
- secure password-based login
- password reset via email link
- admin impersonation with clear in-app indication

## Reports And PDF Export

Reports render on screen using the shared report layout and can be downloaded as real PDF files using the in-app export flow.

This includes investment data where relevant, plus the dedicated Investment Insight report.

## Mobile / iPhone Web-App Support

The app includes:

- standalone web-app metadata
- favicon and Apple home-screen icon support
- safe-area handling for iPhone rounded corners and bottom indicator
- mobile form input sizing to prevent unwanted browser zoom

If updating a saved home-screen web app on iPhone, it may help to remove and re-add the shortcut so iOS picks up the latest manifest and icon metadata.
