# Symposium Management System

A lightweight web application for organizing symposium presentation sequences, managing presentation materials, and operating session timers.

## Technology architecture

| Component | Technology |
|---|---|
| Frontend | Astro |
| Backend/API | Astro endpoints on Cloudflare Pages Functions |
| Database | Cloudflare D1 |
| Document storage | Cloudflare R2 |
| Hosting | Cloudflare Pages |
| Authentication | Secure cookie sessions + role-based access control (RBAC) |
| Source code | GitHub |

## Current implementation status

- Astro SSR project scaffold using the Cloudflare adapter.
- Cloudflare Pages configuration with D1 and R2 bindings.
- Initial D1 schema and event seed data for 12 November, 26 November, and 3 December 2026.
- Public event-date listing API and health endpoint.
- Password hashing using PBKDF2, database-backed sessions, login/logout endpoints, and one-time initial administrator bootstrap.
- Initial roles: administrator, operator, moderator, and viewer.
- Landing page, sign-in page, and protected workspace shell.

Presenter editing, R2 upload/download workflows, synchronized timer control, and projector display remain to be implemented. The current Astro workspace is the foundation milestone, not yet a complete replacement for all prototype functionality.

## Local development

Requirements: Node.js 22.12+ and npm.

```bash
npm install
npm run dev
```

Apply the local D1 migration:

```bash
npx wrangler d1 migrations apply symposium-management-system --local
```

## Cloudflare setup

1. Create a Cloudflare Pages project connected to this GitHub repository.
2. Set build command to `npm run build` and output directory to `dist`.
3. Create a D1 database named `symposium-management-system`.
4. Create an R2 bucket named `symposium-management-files`.
5. Replace the D1 `database_id` placeholder in `wrangler.jsonc` with the actual database ID.
6. Bind D1 as `DB` and R2 as `FILES` in Pages settings.
7. Add `BOOTSTRAP_SECRET` as a Cloudflare secret and optionally set `SESSION_TTL_DAYS`.
8. Apply the migration to the production D1 database.
9. Create the first administrator through the one-time bootstrap endpoint, then remove `BOOTSTRAP_SECRET`.

Do not commit real credentials, secrets, production database IDs, or presentation files.

## Initial administrator bootstrap

Send a one-time POST request to `/api/auth/bootstrap` with JSON fields `secret`, `email`, `name`, and `password`. The password must contain at least 12 characters. The endpoint refuses to create an administrator once any user exists. Remove the bootstrap secret from Cloudflare settings immediately after successful setup.

## RBAC roles

- `administrator`: full system administration.
- `operator`: manage events, sessions, presenters, and materials.
- `moderator`: operate session flow and timer.
- `viewer`: read-only access.

Every protected API must enforce authorization server-side. Hiding interface controls is not an authorization mechanism.

## Event format

Default event time: 13:00–15:30 WIB (Asia/Jakarta). Presenter allocation: 10 minutes presentation, 8 minutes Q&A, and 2 minutes transition. The initial migration seeds three dates and the six presentation titles supplied for 26 November 2026.

## Scope

This is a symposium session operations tool. It is not intended to handle registration, abstract submission, peer review, or full academic conference administration.
