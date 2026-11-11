# Symposium Management System

A focused web application for organizing symposium presentation sequences, managing presentation materials, and operating session timers.

## Technology architecture

| Component | Technology |
|---|---|
| Frontend | Astro |
| Backend/API | Astro endpoints on Cloudflare Pages Functions |
| Database | Cloudflare D1 |
| Document storage | Cloudflare R2 |
| Hosting | Cloudflare Pages |
| Authentication | PBKDF2 password hashing + database-backed secure cookie sessions |
| Authorization | Role-based access control (RBAC) |
| Source code | GitHub (public repository) |

## Implemented application

- Astro SSR application using the Cloudflare adapter.
- Cloudflare Pages configuration with D1 and R2 bindings.
- D1 schema and seed data for 12 November, 26 November, and 3 December 2026.
- Public event-date listing (published events only) and health APIs.
- Login, logout, session lookup, persistent throttling after 8 unsuccessful attempts per email or 30 per source IP within a 15-minute window, and a race-safe one-time first-administrator bootstrap.
- Administrator user-management screen: create accounts, assign roles, and activate/deactivate accounts, with protection against removing the last active administrator.
- Schedule administration screen: create, edit, and delete events/sessions according to role permissions.
- Presenter management and editing in the operator workspace.
- PDF/PPTX upload to R2 (50 MB limit), filename sanitization, basic content-signature checks, and authenticated material delivery. PPTX validation checks the ZIP signature, not the full internal OOXML package structure.
- HTTPS presentation links, including Canva links.
- D1-backed timer state API and synchronized workspace/projector timer.
- Fullscreen projector display, selectable by `session_id`.
- GitHub Actions workflow that applies D1 migrations locally, runs Astro type checks, and builds the application.

## Routes and APIs

| Route | Purpose |
|---|---|
| `/` | Public event overview |
| `/login` | Sign-in |
| `/workspace` | Protected operator/moderator workspace |
| `/admin/schedule` | Event and session administration (administrator/operator) |
| `/admin/users` | User and role administration (administrator only) |
| `/display/:eventId?session_id=...` | Fullscreen projector view (currently requires sign-in) |
| `GET /api/health` | Application and D1 health |
| `GET /api/events` | Public event-date listing |
| `POST /api/events` | Create an event (operator+) |
| `/api/events/:id` | Update/delete an event |
| `/api/sessions` | Read/create event sessions |
| `/api/sessions/:id` | Update/delete a session |
| `/api/presenters` | Read/create presenters |
| `/api/presenters/:id` | Update/delete a presenter |
| `/api/materials` | Upload a PDF/PPTX file to R2 |
| `/api/materials/:id` | Authenticated material delivery/deletion |
| `/api/links` | Add HTTPS presentation links |
| `/api/links/:id` | Remove a presentation link |
| `/api/events/:id/timer` | Read/update synchronized timer state |
| `/api/users` | Administrator-only user listing/creation |
| `/api/users/:id` | Administrator-only role/account update |

## RBAC roles

- `administrator`: full system administration and user management.
- `operator`: manage events, sessions, presenters, and presentation materials.
- `moderator`: control session timer and presentation flow.
- `viewer`: read-only access to authenticated event information and event-visible materials.

Authorization is enforced by the API. Hiding interface controls is not an authorization mechanism.

## Local development

Requirements: Node.js 22.12+ and npm.

```bash
npm install
npm run dev
```

Apply the local D1 migrations:

```bash
npx wrangler d1 migrations apply symposium-management-system --local
```

## Cloudflare configuration

The checked-in `wrangler.jsonc` defines three isolated resource sets:

- Local development: D1 `symposium-management-system` and R2 `symposium-management-files`.
- Pages preview (use as staging): D1 `symposium-management-preview` and R2 `symposium-management-preview-files`.
- Pages production: D1 `symposium-management-production` and R2 `symposium-management-production-files`.

All environments use the same binding names (`DB` and `FILES`) so application code remains unchanged. The preview and production D1 IDs in the file are valid-format placeholders; replace them with the actual IDs before deployment. The local all-zero ID is for local development only. Configure `BOOTSTRAP_SECRET` separately as a secret in both preview and production; do not put it in `vars`. `SESSION_TTL_DAYS` is optional (defaults to 7; clamped to 1–30 days).

For deployment:

1. Create a Cloudflare Pages project connected to this GitHub repository, with `main` as the production branch.
2. Set the build command to `npm run build` and output directory to `dist`.
3. Create four Cloudflare resources: the preview D1 database and R2 bucket, plus the production D1 database and R2 bucket, using the exact names above.
4. Replace the preview and production D1 placeholder IDs in `wrangler.jsonc` with the real IDs. Keep the local all-zero ID for local development only.
5. The Wrangler file is the source of truth for Pages bindings. It defines `env.preview` for preview deployments (staging) and `env.production` for production. Verify the Cloudflare project configuration matches this file before the first deployment.
6. Configure a separate `BOOTSTRAP_SECRET` secret for each Pages environment. Do not place secrets in `vars` or commit them.
7. Apply migrations separately to preview and production:
   - `npx wrangler d1 migrations apply symposium-management-preview --remote --env preview`
   - `npx wrangler d1 migrations apply symposium-management-production --remote --env production`
8. Configure `SESSION_TTL_DAYS` if the default session lifetime is not suitable.
9. Deploy a preview first and test it. Only then deploy the production branch.
10. Create the first administrator in each environment using its one-time bootstrap endpoint, then remove that environment's `BOOTSTRAP_SECRET` immediately.
11. Verify login, role restrictions, file upload/download, schedule editing, timer synchronization, and projector behavior before using the application for a live event.

Do not commit credentials, real secrets, production database IDs, or presentation files. Keep development, staging, and production databases/buckets and secrets separate. The repository is public; production data and credentials must remain in Cloudflare.

## Initial administrator bootstrap

Send a one-time POST request to `/api/auth/bootstrap` with JSON fields `secret`, `email`, `name`, and `password`. The password must contain at least 12 characters. The endpoint refuses to create an administrator once any user exists. Remove the bootstrap secret from Cloudflare settings immediately after successful setup.

## Timer behavior

Timer state is persisted in D1 and synchronized between the workspace and projector view. The timer is currently stored per event, not independently per session. Phase transitions are operator-controlled; automatic phase advancement and audible alerts require further implementation and testing. A stable network connection is required for prompt synchronization.

## Production readiness status

The latest known GitHub Actions build passed. This confirms the application compiles; it does not confirm that production Cloudflare resources are configured or that live D1/R2 workflows have passed end-to-end tests.

Still required before production use:

- Create/configure production D1 and R2 resources and apply migrations.
- Configure the Cloudflare Pages production bindings and secrets.
- Perform the one-time administrator bootstrap and remove its secret.
- Review and test login throttling and upload validation in the deployed Cloudflare environment; consider Cloudflare WAF/rate-limiting rules as an additional edge layer.
- Run end-to-end tests against the actual Cloudflare deployment.
- Confirm backup and recovery procedures for D1 and R2.

## Event format

Default event time: 13:00–15:30 WIB (Asia/Jakarta). Each presenter has 20 minutes: 10 minutes presentation, 8 minutes Q&A, and 2 minutes transition.

## Scope

This is a symposium session operations tool. It is not intended to handle registration, abstract submission, peer review, or full academic conference administration.
