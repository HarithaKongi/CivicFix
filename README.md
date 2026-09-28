# CivicFix

> **AI-assisted civic issue reporting, verification, prioritization, routing, and resolution platform.**

CivicFix is a full-stack civic technology platform that turns a public issue report into a structured workflow: **Report → Verify → Prioritize → Route → Resolve → Community-verify**.

It demonstrates production-oriented skills across **Next.js, TypeScript, Convex, authentication, role-based authorization, geospatial workflows, file uploads, AI-assisted triage, realtime data, moderation, rate limiting, and automated validation**.

## Why CivicFix?

Traditional complaint systems often stop at collecting a ticket. CivicFix models the complete lifecycle of a civic issue:

1. A citizen reports an issue with location, description, and optional photo evidence.
2. The backend validates the request and generates a public reference number.
3. Issues are prioritized and routed to the relevant department.
4. Authorized staff can review, assign, update, and resolve issues.
5. Resolution evidence can be attached to the issue.
6. Citizens can follow the issue and participate in community resolution verification.
7. Public users can track and discover eligible reports without exposing private citizen information.

## Core Features

### Citizen Experience
- Secure authentication
- Citizen profile
- Civic issue reporting
- Interactive map-based location selection
- Browser geolocation support
- Photo evidence uploads
- Issue categories and descriptions
- Automatically generated CFX reference numbers
- My Issues dashboard
- Public issue tracking
- Comments
- Community support/upvotes
- Follow/unfollow issues
- Notifications
- Community resolution verification

### AI-Assisted Triage
CivicFix includes a server-side Gemini integration designed to assist with:
- Issue categorization
- Severity assessment
- Issue summaries
- Keyword extraction
- Department suggestions
- Safety concerns
- Priority factors

AI processing is performed server-side so API credentials are not exposed to the browser.

### Department Operations
- Department-scoped access
- Issue assignment
- Status transitions
- Priority calculation
- SLA tracking
- Assignment history
- Resolution evidence
- Department analytics

### Administration & Moderation
- Citizen, department staff, department admin, and super-admin roles
- Role and department management
- Abuse reporting
- Moderation actions
- Audit logging
- Protected administrative operations

### Public Civic Discovery
- Public issue map
- Public issue search
- Reference-number tracking
- Public-safe issue data
- Location-based civic issue visibility

## Issue Lifecycle

~~~text
SUBMITTED
    ↓
UNDER_REVIEW
    ↓
VERIFIED
    ↓
ASSIGNED
    ↓
IN_PROGRESS
    ↓
RESOLVED
    ↓
COMMUNITY_VERIFICATION
    ↓
VERIFIED_RESOLUTION
~~~

Additional controlled states include REJECTED and REOPENED.

Every important transition is handled through authorized backend operations and recorded in issue history.

## Architecture

~~~text
┌─────────────────────────────────────────────┐
│                 Next.js App                 │
│  Dashboard · Reports · Maps · Admin · Track │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│               Convex Backend                │
│ Auth · Queries · Mutations · Actions        │
│ Storage · Notifications · Rate Limits       │
│ Authorization · Analytics · Audit Logs      │
└───────────────┬─────────────────────────────┘
                │
       ┌────────┴─────────┐
       ▼                  ▼
 Convex Database      Gemini API
       │             Server-side AI
       ▼
Civic issue lifecycle
~~~

## Security & Authorization

Security is enforced at the backend boundary rather than relying only on frontend visibility.

Key controls include:
- Authenticated user checks
- Role-based authorization
- Department-level authorization
- Issue ownership checks
- Protected administrative mutations
- Private/public data separation
- Notification recipient validation
- Server-side file validation
- Upload size and MIME-type validation
- Server-side rate limiting
- Moderation authorization
- Security headers
- No committed API keys or deployment secrets

Public endpoints intentionally return a restricted representation of issue data and do not expose private reporter or audit information.

## Tech Stack

| Area | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS |
| UI Icons | Lucide React |
| Backend | Convex |
| Authentication | Convex Auth |
| Database | Convex |
| File Storage | Convex Storage |
| AI | Google Gemini |
| Maps | Leaflet + OpenStreetMap |
| Testing | Vitest |
| CI | GitHub Actions |
| Deployment | Vercel + Convex Production |

## Project Structure

~~~text
CivicFix/
├── app/
│   ├── admin/
│   ├── analytics/
│   ├── department-issues/
│   ├── issues/[id]/
│   ├── map/
│   ├── moderation/
│   ├── my-issues/
│   ├── notifications/
│   ├── profile/
│   ├── search/
│   ├── track/
│   └── page.tsx
│
├── components/
├── convex/
│   ├── schema.ts
│   ├── issues.ts
│   ├── auth.ts
│   ├── auth.config.ts
│   └── http.ts
├── lib/
│   ├── authorization.ts
│   └── issue-operations.ts
└── .github/workflows/verify.yml
~~~

## Local Development

### Prerequisites
- Node.js 20+
- pnpm 12+
- Convex account/deployment
- Gemini API key for AI features

### Install
~~~bash
pnpm install
~~~

### Environment
Create local environment configuration without committing secrets.

~~~env
NEXT_PUBLIC_CONVEX_URL=<your-convex-development-url>
~~~

Convex deployment secrets should be configured through Convex rather than committed to the repository.

### Run
~~~bash
pnpm dev
~~~

## Verification

~~~bash
pnpm exec tsc --noEmit
pnpm test
pnpm run build
~~~

GitHub Actions runs TypeScript validation, automated tests, and the production build on changes to main and pull requests.

## Deployment

CivicFix uses a separate Convex production deployment and Vercel for the Next.js application.

The production build uses:

~~~bash
npx convex deploy --cmd 'npm run build'
~~~

This deploys the Convex backend and then builds the Next.js application against the production Convex deployment.

Production secrets such as CONVEX_DEPLOY_KEY and GEMINI_API_KEY must be configured in the deployment environment and must never be committed.

## Engineering Highlights

This project demonstrates:
- Full-stack TypeScript development
- Reactive backend architecture
- Role-based access control
- Server-side authorization
- State-machine-style issue workflows
- Geospatial issue handling
- File upload validation
- AI-assisted backend workflows
- Realtime/reactive queries
- Community interaction systems
- Moderation and auditability
- Rate limiting
- Public/private data boundaries
- Production build verification
- CI automation

## Future Enhancements

Potential next iterations include:
- Voice reporting in English, Hindi, and Telugu
- More advanced duplicate detection
- Expanded civic analytics and hotspot detection
- Complaint-letter generation
- Open311-compatible integrations
- Additional municipal departments and configurable workflows
- More comprehensive end-to-end testing

## Author

**Haritha Kongi**

- GitHub: https://github.com/HarithaKongi
- Project: https://github.com/HarithaKongi/CivicFix

---

**CivicFix — turning civic complaints into accountable, trackable resolution workflows.**