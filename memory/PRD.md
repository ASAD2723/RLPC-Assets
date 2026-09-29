# PRD — RLPC IT Assets Records (Purchase Records)

## Original problem statement
Modern responsive web app for an organization to maintain/manage employee purchase records: entry form, records table with pagination/search/filters, XLSX+PDF export, edit/delete, dashboard summary, persistent DB, validation.

## Architecture
- Frontend: React (CRA) + Tailwind + shadcn/ui. Fonts: Cabinet Grotesk + IBM Plex Sans.
- Backend: FastAPI, all routes under /api, MongoDB via MONGO_URL/DB_NAME.
- Exports: XLSX (openpyxl), PDF (reportlab) generated in-memory server-side over filtered records.
- Object storage: Emergent managed (INTEGRATION_PROXY_URL + EMERGENT_LLM_KEY) for optional bill uploads.
- Auth: hardcoded users, JWT (HS256) Bearer token in localStorage. RBAC: approvers vs editors.

## User personas / roles
- APPROVERS (can change approval): 158, IT admin.
- EDITORS (add/edit/delete but cannot approve): 16, 76, 122, 126.
- Anonymous: view-only.

## Core requirements (static)
- Purchase entry: Employee ID, Employee Name (required), Purchase Of (Mobile Purchase / Tech Device / Safety Shoes), Mode of Payment (Cash / Credit Card / Bank Transfer), Payment By (Jogy Joseph / Mohammad Omer / Muhammad Khaleel / Muhammad Abdullah), Approved by Business Manager (bool), manual Purchase Date.
- Table: 50/page pagination, search by ID/Name, filters (type, mode, payment_by, approval, date range), sticky header, empty/loading states.
- Export filtered records as XLSX and PDF. Edit/delete with confirm dialog. CSV import.

## Implemented (dates)
- 2026-09-27: MVP — form, table, pagination, search, filters, XLSX/PDF export, edit/delete, persistence. (Summary cards removed per user visual edit.)
- 2026-09-27: CSV bulk import with template + per-row error reporting.
- 2026-09-28: Hardcoded login (158), approval gating, optional bill upload (object storage), Safety Shoes option, inline approval toggle, bulk approve, Pending-only shortcut.
- 2026-09-28: Manual purchase date; second user 'IT admin'; edit/delete require login.
- 2026-09-28: Deploy readiness — stats via aggregation, export fetch capped (20k), manual-date validation.
- 2026-09-29: RBAC — 4 new editor users (16/76/122/126); approval restricted to approvers (158, IT admin); add/edit/delete/import/upload require login; login returns can_approve.

## Status
- Backend 126/126 tests pass; all frontend flows verified. No known open bugs.

## Backlog (P1/P2)
- P1: Explicit APPROVER_USERNAMES env var (decouple approver identity from .env slot position).
- P1: Editor CSV import — report count of Approved rows downgraded to not-approved.
- P2: Editor/approver audit trail (who edited/approved + when); date+time picker; bulk delete.
- P2: Refactor server.py into modules; migrate deprecated @app.on_event to lifespan.

## Next tasks
- Redeploy to publish the RBAC changes (prior deploy predates them).
