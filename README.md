# ERDMS - Electronic Records & Document Management System

Enterprise document management system built for government records workflows.

## Architecture
- **Frontend**: React + Vite (TypeScript SPA)
- **Backend**: Node.js / Express (TypeScript)
- **Database**: PostgreSQL (metadata) + Redis (permission cache) + MinIO (optional blob storage)
- **Containerization**: Docker Compose

## Quick Start
```bash
# From infrastructure/ directory
cp .env.example .env   # fill in credentials (.env is gitignored)
docker-compose up -d
```
Frontend: http://localhost:5173 · Backend API: http://localhost:3000

Default login: `admin` / `admin123`

## Project Structure
```
erdms-workspace/
├── backend/              # Express API & modules
│   ├── routes/           # API endpoints
│   ├── models/           # DB schemas & business logic
│   ├── middleware/        # auth, authorization, rate limiting
│   ├── utils/            # file validation, helpers
│   └── app.js            # entry point
├── frontend/             # React + Vite SPA (TypeScript)
│   └── src/components/   # UI modules
└── infrastructure/       # docker-compose.yml + .env.example
```

## Sidebar Modules
1. **Dashboard** — overview & quick links
2. **Document Registration** — upload documents with a Class → File Number → Folio Number hierarchy
3. **Document List** — searchable table of all registered documents
4. **Version Control** — version history & audit logs per document
5. **Classification** — manage Classes, File Numbers, and Folio Numbers
6. **Search & Index** — full-text search across document metadata
7. **Legal CMS** — external case integration
8. **User Management** — RBAC, roles, permissions
9. **Retention & Disposal** — retention schedules
10. **Immutable Audit Trail** — tamper-evident audit log (records uploads, views, downloads)
11. **Notifications** — user inbox
12. **Task Management** — workflow & collaboration tasks

## Document Classification Hierarchy
Documents are organized in a three-tier hierarchy:
```
Class
  └── File Number
        └── Folio Number
              └── Document(s)
```
- Classes, File Numbers, and Folio Numbers are managed in the **Classification** module.
- During registration you select an existing Class, then a File Number under it, then a Folio Number under that.
- The hierarchy is enforced by foreign keys in the database.

## Document Registration Fields
- Document Name (required)
- Document File (required)
- Class (dropdown, cascading)
- File Number (dropdown, cascading under Class)
- Folio Number (dropdown, cascading under File Number)

> Note: Department and Province were removed from the registration form; classification is handled via the Class/File/Folio hierarchy instead.

## Inline Document Viewer
The Document Viewer opens documents directly in the browser:
- **PDF / Images** — rendered inline
- **Word (.docx)** — converted to HTML via mammoth.js
- **Excel (.xlsx)** — rendered as HTML tables with sheet tabs via SheetJS
- **Text / JSON** — shown inline
- **Other types** — Download button provided

All views and downloads are recorded in the Immutable Audit Trail.

## Immutable Audit Trail
The audit trail captures, among other actions:
- `document_upload`
- `document_view`
- `document_download`
- Version restores and collaboration events

Entries are hash-chained and cannot be modified or deleted.

## RBAC
- Roles: Administrator, Records Officer, Department Head, General User
- Permissions are granular (e.g. `document:register`, `document:read`, `system:manage`)
- JWT auth with 24h access tokens + refresh tokens

## Development Standards
- TypeScript
- Docker for dev/prod parity
- Vite dev server with HMR

## License
Internal Use Only — Organization Confidential
