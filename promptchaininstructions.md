# Prompt chain / humor flavor tool — agent handoff

Use this when implementing the **humor flavors + humor flavor steps** assignment as its **own** app (new GitHub repo + new Vercel project), unless the owner explicitly scopes work inside this monorepo.

## Product goal

Build an admin-style **prompt chain tool** for managing **humor flavors** and **humor flavor steps**.

- A **humor flavor** is an ordered pipeline of **steps**. Each step consumes inputs (e.g. prior step output + image) and produces text used by later steps.
- Example step flow (conceptual):
  1. Image → text description  
  2. Description → something funny  
  3. Previous output → five short funny captions  

The UI must support designing those chains, reordering steps, and **testing** a flavor by generating captions via your backend REST API.

## Infrastructure

- **GitHub:** new repository for this project.  
- **Vercel:** new project linked to that repo.  
- **Framework preset:** **Next.js** (or let Vercel auto-detect from `package.json`).  
- **Deployment:** follow course/Vercel guidance (e.g. deployment protection off if required for grading/incognito testing).

## Authentication and authorization (non‑negotiable)

The application must **only** allow users who satisfy:

- `profiles.is_superadmin === TRUE`, **or**
- `profiles.is_matrix_admin === TRUE`

Everyone else must be blocked from using the tool’s routes and APIs (same spirit as the existing admin panel: no public access to staging/data).

**Implementation notes for agents:**

- Gate **every** protected route (and any server actions / route handlers that mutate data or call caption APIs) with this check.  
- Confirm how booleans are stored in the shared DB (`boolean`, `"true"` string, `1`, etc.) and normalize checks consistently (see patterns in this repo’s `src/lib/auth/superadmin.ts` if reusing ideas).  
- Extend profile selection to include `is_matrix_admin` wherever you enforce access.

## Functional requirements

### Humor flavors

- Create a humor flavor  
- Update a humor flavor  
- Delete a humor flavor  

### Humor flavor steps

- Create a step for a flavor  
- Update a step  
- Delete a step  
- **Reorder** steps (e.g. move step 2 before step 1; persist new order in the database)

### Captions & testing

- **Read** captions that were produced **for / by** a specific humor flavor (exact filtering depends on schema — align with `captions` / join tables / metadata columns as in the real DB).  
- **Test** a humor flavor: run caption generation using the **REST API** at **`api.almostcrackd.ai`** (Assignment 5 API). Wire env vars for base URL and any required keys/headers; do not hardcode secrets.

### Image test set

- Support generating captions using an **image test set** (definition depends on assignment/schema: fixed URLs, storage bucket, or table of test images). Implement what the DB and API expect.

## REST API integration

- Base URL: **`https://api.almostcrackd.ai`** (confirm exact paths and auth from Assignment 5 / course docs).  
- Calls must run **server-side** when secrets are involved (Route Handlers / Server Actions), not from the browser if API keys are required.  
- Handle errors and surface actionable messages in the UI.

## Data layer

- The database is almost certainly **shared Supabase** (same ecosystem as the main product). **Do not** create, alter, enable, or disable **RLS policies** unless the project owner explicitly overrides this rule.  
- Table names likely align with: `humor_flavors`, `humor_flavor_steps`, `captions`, `images` — **verify columns, FKs, and ordering field** (e.g. `position`, `sort_order`, `step_index`) against the live schema before coding assumptions into migrations/UI.

## UI / UX

- **Theme:** support **dark mode**, **light mode**, and **system default** (e.g. `prefers-color-scheme` with a persisted user preference).  
- Provide a clear layout for: flavor list → flavor detail → steps list with reorder controls → test/run panel → captions linked to that flavor.

## Suggested tech stack (if greenfield)

- **Next.js** (App Router), **TypeScript**, **npm**.  
- Supabase client for auth + data (browser/server/middleware pattern consistent with course expectations).  
- Google OAuth (or existing auth method required by the shared `profiles` table) — match whatever the assignment assumes.

## Verification checklist (before submit)

- [ ] Unauthenticated users cannot access the tool.  
- [ ] Users without both admin flags cannot access the tool.  
- [ ] Superadmin **or** matrix admin **can** access.  
- [ ] Full CRUD + reorder for flavors/steps works end-to-end.  
- [ ] Caption test flow hits `api.almostcrackd.ai` successfully with the image test set.  
- [ ] Captions for a selected flavor can be read in the UI.  
- [ ] Dark / light / system theme works.  
- [ ] Lint/build pass; env vars documented in `.env.example` (no real secrets committed).

## Open items (fill from course materials)

- Exact REST endpoints, request/response shapes, and auth for Assignment 5.  
- How “captions produced by a specific humor flavor” are keyed in the DB (column names, join tables).  
- Definition and storage of the “image test set.”

---

*This file is a handoff for AI/human implementers; update it when assignment details or schema facts are confirmed.*
