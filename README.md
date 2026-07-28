# ERDMS - Electronic Records & Document Management System

Enterprise document management for 140 personnel across Head Office and 5 Provincial Offices.

## Architecture
- **Frontend**: React + Vite (client-rendered SPA)
- **Backend**: Node.js/Express (async I/O optimized)
- **Database**: PostgreSQL (metadata) + Redis (permission cache) + MinIO (blob storage)

cp .env.example .env   # fill in real credentials, .env is gitignored
docker-compose up -d
```

### 2. Backend Setup
```bash
cd backend
npm install
npm start
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Project Structure
```
erdms-workspace/
├── backend/              # API engine & modules
│   ├── routes/           # API endpoints (ingestion, documents)
│   ├── models/           # Database schemas & logic
│   ├── utils/            # File validation, shared helpers
│   ├── db.js             # Shared PostgreSQL connection pool
│   └── app.js            # Main entry point
├── frontend/             # React + Vite SPA
│   ├── index.html
│   └── src/
│       ├── main.tsx      # Vite entry
│       ├── App.tsx
│       └── components/
└── infrastructure/       # Docker Compose services + .env.example
```

## Modules Implemented
1. **Document Ingestion & Capture** ✅
   - Multi-file uploads
   - Email monitoring
   - File validation & categorization

## Roadmap
- [ ] Metadata & Indexing Engine
- [ ] RBAC & Identity Module
- [ ] Legal CMS API Gateway
- [ ] Version Control & Collaboration
- [ ] Workflow Automation & Approval
- [ ] Retention & Disposition
- [ ] Immutable Audit Logging

## Development Standards
- TypeScript for type safety
- Docker for identical dev/prod environments
- Git commit hooks for CMS API tests
- Jest for unit testing

## Changelog (bug-fix pass)
- Fixed a broken/dangling `if` statement and an unbalanced JSX closing tag
  in `DocumentForm.tsx` that prevented the frontend from compiling at all.
- Resolved the Next.js/Vite scaffold conflict: removed the unused
  `next.config.mjs` and `pages/index.tsx` (Next only had a type import,
  `next` was never even a dependency), added a real Vite entry point
  (`index.html`, `src/main.tsx`, `src/App.tsx`).
- Added the missing TypeScript toolchain (`tsconfig.json`,
  `tsconfig.node.json`, `typescript`, `@types/react*`) — `.tsx` files
  existed with no TS config or compiler in `package.json` at all.
- Replaced `nodemailer.createTransporter(...).connect()` (a typo of
  `createTransport`, and an API nodemailer doesn't have — it can only send
  mail, not read an inbox) with a working `imapflow` + `mailparser`
  implementation, gated behind `EMAIL_MONITORING_ENABLED` so it doesn't
  throw in environments without real IMAP credentials.
- Replaced the per-request `pg.Client` singletons in `models/ingestion.js`
  and `routes/documents.js` (which raced under concurrent requests) with a
  single shared `pg.Pool` in `backend/db.js`.
- `routes/ingestion.js`'s `processQueue()` previously only logged a
  category and left `// TODO` comments — uploaded files and their
  computed category/department/province were never persisted. It now
  saves that metadata via `saveDocumentMetadata`.
- Added real content-based file validation (`utils/fileValidation.js`)
  checking file signatures/magic bytes, since the previous check only
  trusted the client-supplied `mimetype` header (trivially spoofable).
- Fixed `cors({ origin: '*', credentials: true })` — an invalid/insecure
  combination browsers reject anyway — to a configurable single origin
  with no unused credentials flag.
- Moved Postgres/MinIO credentials out of `docker-compose.yml` and into a
  gitignored `.env` (see `infrastructure/.env.example`).
- Added `.gitignore` files (root/backend/frontend) so `node_modules`,
  `uploads/*`, and `.env` aren't committed.

## License
Internal Use Only - Organization Confidential