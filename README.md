# CivicFix

CivicFix is a Convex-backed civic issue reporting platform for submitting, tracking, routing, and resolving public reports.

## Stack

- Next.js App Router and TypeScript
- Convex database, Auth, reactive queries, mutations, and file storage
- Leaflet/OpenStreetMap for location selection
- Tailwind CSS and Lucide icons

## Local setup

1. Install dependencies with `pnpm install`.
2. Configure `NEXT_PUBLIC_CONVEX_URL` and the Convex deployment URL.
3. Configure Convex Auth using the Convex Auth CLI so `JWT_PRIVATE_KEY` and `JWKS` remain deployment secrets.
4. Start the app with `pnpm dev`.

## Routes

- `/` authenticated citizen dashboard and report submission
- `/my-issues` citizen reports
- `/issues/[id]` protected issue detail and community activity
- `/track` public reference tracking
- `/search` public search across public reports
- `/notifications` authenticated notification center
- `/department-issues` authorized department queue
- `/admin` super-admin overview

## Security notes

Identity, ownership, roles, department scope, uploads, comments, votes, follows, and notification recipients are validated in Convex. Public tracking intentionally excludes reporter identity and private audit details. Do not commit `.env` files or Convex deployment secrets.

## Validation

```bash
pnpm exec tsc --noEmit
pnpm run build
```
