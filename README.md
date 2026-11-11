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
| Source code | GitHub |

## Implemented foundation

- Astro SSR application using the Cloudflare adapter.
- Cloudflare Pages configuration with D1 and R2 bindings.
- D1 schema for users, sessions, events, symposium sessions, presenters, materials, links, timer state, and audit logs.
- Seed data for 12 November, 26 November, and 3 December 2026.
- Six presentation titles supplied for 26 November and the thesis presentation on 3 December.
- Public event-date listing and health APIs.
- Login, logout, session lookup, and one-time first-administrator bootstrap.
- User administration API restricted to administrators.
- Event/session/presenter APIs with server-side role checks.
- PDF/PPTX upload to R2 with a 50 MB limit and authenticated delivery.
- HTTPS presentation-link API for Canva and other hosted slide decks.
- D1-backed timer state API, workspace polling, and a fullscreen projector display.
- Responsive landing page, sign-in page, and operator workspace.
- GitHub Actions build workflow.

## Routes and APIs

| Route | Purpose |
|---|---|
| `/` | Public event overview |
| `/login` | Sign-in |
| `/workspace` | Protected operator/moderator workspace |
| `/display/:eventId` | Fullscreen projector view |
| `GET /api/health` | Application and D1 health |
| `GET /api/events` | List event dates |
| `POST /api/events` | Create an event (operator+) |
| `/api/sessions` | Read/create event sessions |
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

## Cloudflare setup

1. Create a Cloudflare Pages project connected to this GitHub repository.
2. Set the build command to `npm run build` and output directory to `dist`.
3. Create a D1 database named `symposium-management-system`.
4. Create an R2 bucket named `symposium-management-files`.
5. Replace the D1 `database_id` placeholder in `wrangler.jsonc` with the actual database ID.
6. Bind D1 as `DB` and R2 as `FILES` in Pages settings, or deploy using the checked-in Wrangler configuration.
7. Add `BOOTSTRAP_SECRET` as a Cloudflare secret and optionally set `SESSION_TTL_DAYS`.
8. Apply the migrations to the production D1 database:
   `npx wrangler d1 migrations apply symposium-management-system --remote`.
9. Create the first administrator through the one-time bootstrap endpoint, then remove `BOOTSTRAP_SECRET`.

Do not commit real credentials, secrets, production database IDs, or presentation files.

## Initial administrator bootstrap

Send a one-time POST request to `/api/auth/bootstrap` with JSON fields `secret`, `email`, `name`, and `password`. The password must contain at least 12 characters. The endpoint refuses to create an administrator once any user exists. Remove the bootstrap secret from Cloudflare settings immediately after successful setup.

## Timer behavior

Timer state is persisted in D1. The workspace and projector view poll the API to synchronize the current phase, presenter, and countdown across signed-in devices. The browser calculates the displayed countdown from a shared end timestamp; D1 stores the authoritative state snapshot. A stable network connection is required for prompt synchronization.

## Current limitations / next milestones

- The user-management API exists; a dedicated user administration screen is still pending.
- Event creation API exists; event editing and deletion UI are pending.
- Session creation API exists; session editing/deletion UI is pending.
- Presenter editing is API-supported; a polished edit form is pending.
- Projector view currently follows the first session of the selected event.
- Timer transitions are manually controlled; automatic phase advancement and audible alerts need additional implementation/testing.
- Production deployment, Cloudflare bindings, migration application, and first-admin bootstrap still need to be configured in the Cloudflare account.
- Automated build is run by GitHub Actions; runtime integration tests against live D1/R2 are not part of CI yet.

## Event format

Default event time: 13:00–15:30 WIB (Asia/Jakarta). Presenter allocation: 10 minutes presentation, 8 minutes Q&A, and 2 minutes transition.

## Scope

This is a symposium session operations tool. It is not intended to handle registration, abstract submission, peer review, or full academic conference administration.
