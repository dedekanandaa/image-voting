# Image Submission & Voting Application — Implementation Guide

Complete guide for building the Next.js + Bun + Keycloak image voting application.

---

## Keycloak Setup (Prerequisite)

### Realm Configuration

- **Realm:** `image-voting`
- **Client:** `nextjs-app` (confidential, OpenID Connect)
- **Client Authentication:** enabled
- **Client Type:** confidential
- **Standard Flow:** enabled

### Redirect URIs

**Development:**
```
http://localhost:3000/api/auth/callback/keycloak
```

**Production:**
```
https://yourdomain.com/api/auth/callback/keycloak
```

### Client Roles

Create in Keycloak:
- `user` — regular user, can upload images and vote
- `committee` — can select finalist images
- `admin` — can manage campaigns, phases, users

### Token Mapper

Configure a User Realm Role mapper:
- Name: `realm-roles`
- Map roles as: `realm_access.roles` → ID token + access token
- This puts roles in the decoded JWT

### Data to Collect

Ask admin Keycloak for:
```env
KEYCLOAK_CLIENT_ID=nextjs-app
KEYCLOAK_CLIENT_SECRET=<generated-by-keycloak>
KEYCLOAK_ISSUER=https://sso.example.com/realms/image-voting
```

---

## Database Schema (Prisma)

### User

```prisma
model User {
  id              String      @id @default(cuid())
  keycloakId      String      @unique
  email           String      @unique
  displayName     String?
  roles           Role[]
  submissions     Submission[]
  votes           Vote[]
  auditLogs       AuditLog[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

enum Role {
  USER
  COMMITTEE
  ADMIN
}
```

### Phase

```prisma
model Phase {
  id              String      @id @default(cuid())
  name            String      @unique  // "SUBMISSION" or "VOTING"
  startDate       DateTime
  endDate         DateTime
  isActive        Boolean     @default(false)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```

### Submission

```prisma
model Submission {
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  imageUrl        String      // URL from S3 or object storage
  imagePath       String?     // Local file path if using filesystem
  imageHash       String      @unique  // SHA256 of file content
  fileName        String
  fileSize        Int
  mimeType        String
  
  title           String?
  description     String?
  
  isSelected      Boolean     @default(false)  // Committee selected this as finalist
  selectedAt      DateTime?
  selectedBy      String?     // userId of committee member
  
  votes           Vote[]
  auditLogs       AuditLog[]
  
  deletedAt       DateTime?   // Soft delete
  deletedBy       String?     // userId of deleter
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([userId])
  @@index([isSelected])
}
```

### Vote

```prisma
model Vote {
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  submissionId    String
  submission      Submission  @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  
  votedAt         DateTime    @default(now())
  revokedAt       DateTime?   // If vote was revoked
  
  auditLogs       AuditLog[]
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@unique([userId, submissionId])  // Prevent duplicate vote on same submission
  @@index([submissionId])
}
```

**Voting Model:** Multiple votes per user allowed across different submissions. User can vote on multiple images. No limit on vote count. Constraint prevents revoting the same submission.

### AuditLog

```prisma
model AuditLog {
  id              String      @id @default(cuid())
  actorId         String
  actor           User?       @relation(fields: [actorId], references: [id])
  
  action          AuditAction
  resourceType    String      // "Submission", "Vote", "Phase", "User"
  resourceId      String
  
  oldValue        Json?       // JSON object of previous state
  newValue        Json?       // JSON object of new state
  
  ipAddress       String?
  userAgent       String?
  
  createdAt       DateTime    @default(now())
}

enum AuditAction {
  SUBMISSION_UPLOAD
  SUBMISSION_DELETE
  SUBMISSION_UPDATE
  IMAGE_SELECTED
  IMAGE_DESELECTED
  VOTE_CAST
  VOTE_REVOKED
  PHASE_STARTED
  PHASE_ENDED
  USER_ROLE_CHANGED
  USER_CREATED
  USER_DELETED
}
```

### Relationships

```
User 1--* Submission
User 1--* Vote
User 1--* AuditLog
Submission 1--* Vote
Submission 1--* AuditLog
Vote 1--* AuditLog
```

---

## API Routes (Complete Reference)

### Authentication (NextAuth)

```
POST   /api/auth/signin/keycloak        ← Keycloak login redirect
GET    /api/auth/callback/keycloak      ← OIDC callback
POST   /api/auth/logout                 ← Session destruction
```

### Submissions

```
POST   /api/submissions
Input:  FormData { file, title?, description? }
Auth:   User role required
Phase:  SUBMISSION active only
Checks: File size ≤20MB, MIME type image/*, max 5 per user
Output: { id, imageUrl, fileName, uploadedAt }

GET    /api/submissions
Auth:   User role required
Output: Submission[] (user's own)

GET    /api/submissions/all
Auth:   Committee+ required
Output: Submission[] with vote counts

GET    /api/submissions/[id]
Auth:   Owner or Committee+
Output: Submission + vote count

DELETE /api/submissions/[id]
Auth:   Owner or Admin
Audit:  SUBMISSION_DELETE logged
```

### Committee Selection

```
PATCH  /api/submissions/[id]/select
Auth:   Committee+ required
Input:  { isSelected: true }
Audit:  IMAGE_SELECTED logged

PATCH  /api/submissions/[id]/select
Auth:   Committee+ required
Input:  { isSelected: false }
Audit:  IMAGE_DESELECTED logged
```

### Voting

```
POST   /api/votes
Auth:   User role required
Phase:  VOTING active only
Input:  { submissionId }
Checks: Submission isSelected = true; user may vote on multiple submissions; duplicate vote on the same submission is rejected by unique constraint.
Output: { id, submissionId, votedAt }
Audit:  VOTE_CAST logged

GET    /api/votes
Auth:   User role required
Output: Vote[] with submission details

DELETE /api/votes/[id]
Auth:   Owner or Admin
Phase:  VOTING must still be active
Audit:  VOTE_REVOKED logged

GET    /api/votes/results
Auth:   Authenticated
Output: [{ submissionId, title, imageUrl, voteCount }] DESC by votes

GET    /api/votes/results/stream
Auth:   Authenticated
Type:   text/event-stream (Server-Sent Events)
Output: Real-time vote count updates
```

### Phase/Voting Status

```
GET    /api/voting/status
Auth:   None
Output: {
  currentPhase: "SUBMISSION" | "VOTING" | null,
  phases: {
    submission: { name, startDate, endDate, isActive },
    voting: { name, startDate, endDate, isActive }
  },
  stats: { totalSubmissions, selectedCount, totalVotes }
}
```

### Admin Management

```
PATCH  /api/admin/phases/[name]
Auth:   Admin required
Input:  { startDate, endDate, isActive }
Audit:  PHASE_STARTED / PHASE_ENDED logged

GET    /api/admin/users
Auth:   Admin required
Output: User[]

PATCH  /api/admin/users/[id]/role
Auth:   Admin required
Input:  { roles: ["user", "committee"] }
Audit:  USER_ROLE_CHANGED logged
```

---

## Phase Workflow (Timeline Example)

| Date | Phase | Actions | Constraints |
|------|-------|---------|---|
| 2026-10-20 00:00 | SUBMISSION starts | Users upload images (max 5) | POST /submissions allowed |
| 2026-10-20–11-10 | SUBMISSION active | Committee selects images daily | PATCH /select allowed |
| 2026-11-10 23:59 | SUBMISSION ends | No new uploads allowed | POST /submissions → 403 |
| 2026-11-11 00:00 | VOTING starts | Users vote on selected images | POST /votes allowed |
| 2026-11-11–11-20 | VOTING active | Vote counts update real-time | GET /votes/results/stream |
| 2026-11-20 23:59 | VOTING ends | No new votes allowed | POST /votes → 403 |

**Deadline Enforcement (Server-Side Only):**
- Check `phase.endDate` on every POST/DELETE operation
- Return `403 Forbidden` if past deadline
- All dates stored in UTC
- Never trust client datetime

---

## Keycloak OIDC Authentication Flow

### Step-by-Step Flow

1. User clicks "Login" → redirects to `/api/auth/signin/keycloak`
2. NextAuth redirects browser to Keycloak:
   ```
   https://keycloak.example.com/realms/image-voting/protocol/openid-connect/auth
   ?client_id=nextjs-app
   &redirect_uri=http://localhost:3000/api/auth/callback/keycloak
   &response_type=code
   &scope=openid+email+profile
   ```
3. User authenticates at Keycloak (username/password, social, etc.)
4. Keycloak redirects to callback URL with authorization code:
   ```
   http://localhost:3000/api/auth/callback/keycloak?code=<AUTH_CODE>
   ```
5. NextAuth backend exchanges code for tokens (POST to Keycloak `/token` endpoint)
6. Response contains:
   ```json
   {
     "access_token": "...",
     "id_token": "...",
     "refresh_token": "...",
     "expires_in": 300
   }
   ```
7. NextAuth decodes ID token JWT (header.payload.signature):
   ```json
   {
     "sub": "keycloak-user-id-12345",
     "email": "user@example.com",
     "name": "User Name",
     "aud": "nextjs-app",
     "realm_access": {
       "roles": ["user", "committee"]
     }
   }
   ```
8. JWT callback runs → user upserted to database by `keycloakId`
9. Session callback runs → roles added to session object
10. Session stored in secure httpOnly cookie
11. Refresh tokens handled automatically by NextAuth (transparent refresh)

### NextAuth Callbacks (auth.ts)

```typescript
// JWT callback: runs when token created or refreshed
jwt: async ({ token, account, user }) => {
  if (account) {
    // Initial login
    token.accessToken = account.access_token;
    token.roles = user.roles;
    token.keycloakId = user.id;
  }
  if (account?.expires_at && Date.now() >= account.expires_at * 1000) {
    // Refresh token if expired
    // NextAuth handles this automatically
  }
  return token;
}

// Session callback: runs on session request
session: async ({ session, token }) => {
  session.user.id = token.sub;
  session.user.roles = token.roles;
  session.user.keycloakId = token.keycloakId;
  // Sync to database
  await prisma.user.upsert({
    where: { keycloakId: token.keycloakId },
    create: {
      keycloakId: token.keycloakId,
      email: session.user.email,
      displayName: session.user.name,
      roles: token.roles
    },
    update: { displayName: session.user.name }
  });
  return session;
}

// Authorized callback: runs in middleware
authorized: ({ token }) => {
  return !!token;  // Redirect if no token
}
```

---

## Project Structure

```
image-voting-app/
├── app/
│   ├── middleware.ts                           ← Role-based route protection
│   ├── layout.tsx                              ← RootLayout with SessionProvider
│   ├── page.tsx                                ← Home/public info page
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── callback/page.tsx
│   │   ├── logout/page.tsx
│   │   └── error/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                            ← User dashboard
│   │   ├── submit/page.tsx                     ← Upload form
│   │   ├── gallery/page.tsx                    ← All submissions
│   │   └── results/page.tsx                    ← Vote results
│   ├── committee/
│   │   ├── layout.tsx
│   │   ├── page.tsx                            ← Committee dashboard
│   │   └── [id]/page.tsx                       ← Review single submission
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── phases/page.tsx                     ← Manage submission/voting phases
│   │   └── users/page.tsx                      ← Manage user roles
│   └── api/
│       ├── auth/[...nextauth]/route.ts         ← NextAuth routes
│       ├── submissions/
│       │   ├── route.ts                        ← POST (upload), GET (user's)
│       │   ├── all/route.ts                    ← GET all (committee+)
│       │   └── [id]/
│       │       ├── route.ts                    ← GET, DELETE
│       │       └── select/route.ts             ← PATCH select/deselect
│       ├── votes/
│       │   ├── route.ts                        ← POST (vote), GET (user's)
│       │   ├── [id]/route.ts                   ← DELETE (revoke)
│       │   └── results/route.ts                ← GET (aggregated)
│       ├── votes/results/stream/route.ts       ← GET (SSE)
│       ├── voting/status/route.ts              ← Phase info + stats
│       └── admin/
│           ├── phases/[name]/route.ts          ← PATCH phase
│           ├── users/route.ts                  ← GET all users
│           └── users/[id]/role/route.ts        ← PATCH user role
├── components/
│   ├── auth/
│   │   ├── AuthButton.tsx
│   │   ├── RoleGuard.tsx
│   │   └── SignOutButton.tsx
│   ├── submission/
│   │   ├── UploadForm.tsx
│   │   ├── SubmissionCard.tsx
│   │   └── SubmissionList.tsx
│   ├── committee/
│   │   ├── SelectButton.tsx
│   │   └── CommitteeCard.tsx
│   ├── voting/
│   │   ├── VoteCard.tsx
│   │   ├── VoteButton.tsx
│   │   └── ResultsList.tsx
│   └── common/
│       ├── PhaseStatus.tsx
│       └── Countdown.tsx
├── lib/
│   ├── auth.ts                                 ← Keycloak config, callbacks
│   ├── db.ts                                   ← Prisma client singleton
│   ├── s3.ts                                   ← S3/object storage helpers
│   ├── validation.ts                           ← Zod schemas
│   ├── permissions.ts                          ← Authorization helpers
│   ├── constants.ts                            ← Config (max file size, etc.)
│   └── utils.ts                                ← Utility functions
├── hooks/
│   ├── useAuth.ts                              ← useSession, withAuth hook
│   ├── useSubmissions.ts                       ← Query/mutation for submissions
│   ├── useVotes.ts                             ← Query/mutation for votes
│   └── usePhase.ts                             ← Query for phase status
├── types/
│   ├── index.ts                                ← App types
│   ├── next-auth.d.ts                          ← NextAuth augmentation (roles)
│   └── api.ts                                  ← API request/response types
├── prisma/
│   ├── schema.prisma                           ← Complete schema above
│   └── seed.ts                                 ← Demo data
├── styles/
│   └── globals.css
├── public/
├── .env.example
├── .env.local
├── next.config.js
├── bunfig.toml
├── tsconfig.json
├── package.json
├── bun.lock
└── README.md
```

---

## Package Dependencies

### package.json

```json
{
  "name": "image-voting-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "db:migrate": "prisma migrate deploy",
    "db:seed": "prisma db seed"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.3.0",
    "next-auth": "^4.24.0",
    "@auth/prisma-adapter": "^1.0.0",
    "@prisma/client": "^5.7.0",
    "@tanstack/react-query": "^5.0.0",
    "zod": "^3.22.0",
    "tailwindcss": "^3.3.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "sharp": "^0.33.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/s3-request-presigner": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "eslint": "^8.0.0",
    "prisma": "^5.7.0"
  }
}
```

### bunfig.toml

```toml
[install]
peer = true

[build]
target = "node"

[test]
root = "."
```

---

## Environment Variables (.env.local)

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/image_voting

# Keycloak
KEYCLOAK_CLIENT_ID=nextjs-app
KEYCLOAK_CLIENT_SECRET=<generated-by-keycloak>
KEYCLOAK_ISSUER=https://sso.example.com/realms/image-voting

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generated: openssl rand -base64 32>

# Object Storage (S3 / MinIO)
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_BUCKET=image-voting
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_PUBLIC_URL=http://localhost:9000/image-voting

# Configuration
MAX_UPLOAD_SIZE_MB=20
MAX_SUBMISSIONS_PER_USER=5
NODE_ENV=development
```

---

## Critical Implementation Details

### 1. Deadline Enforcement (CRITICAL)

Every submission/vote POST or DELETE must check:

```typescript
const phase = await db.phase.findFirst({
  where: { isActive: true }
});

if (!phase || new Date() > phase.endDate) {
  return new Response("Phase not active", { status: 403 });
}
```

- Check server datetime only
- Return 403 Forbidden if expired
- Client UI disabled by phase status, not as enforcement

### 2. Vote Integrity

- **Database unique constraint:** `@@unique([userId, submissionId])` prevents revoting same submission
- Multiple votes per user on different submissions allowed
- Duplicate vote on same submission rejected at DB level
- Transaction recommended for vote insertion (prevent race conditions on count)

### 3. Image Security

```typescript
import sharp from "sharp";

const metadata = await sharp(buffer).metadata();
if (!metadata.hasAlpha && !["jpeg", "png", "webp"].includes(metadata.format)) {
  throw new Error("Invalid image format");
}

// Sanitize filename
const safe = filename.replace(/[^a-z0-9._-]/gi, "");
```

- Validate MIME type + magic bytes
- Sanitize filenames
- Store files in private S3 bucket with signed URLs

### 4. Bun Integration

- Use `bun install` (faster than npm)
- `bun run dev` to start Next.js
- Compatible with Next.js 14+ without special config
- `bunfig.toml` configures build target

### 5. Audit Trail

Every sensitive action must log:

```typescript
await db.auditLog.create({
  data: {
    actorId: session.user.id,
    action: "VOTE_CAST",
    resourceType: "Vote",
    resourceId: vote.id,
    oldValue: null,
    newValue: { submissionId, votedAt: new Date() },
    ipAddress: req.headers["x-forwarded-for"],
    userAgent: req.headers["user-agent"]
  }
});
```

- Immutable table (no updates/deletes to AuditLog)
- Captures IP and user agent
- oldValue/newValue as JSON for diffs

---

## Critical Files to Implement First

1. **`auth.ts`** — Keycloak configuration, JWT/session callbacks, token refresh
2. **`prisma/schema.prisma`** — Complete schema: User, Phase, Submission, Vote, AuditLog
3. **`app/api/auth/[...nextauth]/route.ts`** — NextAuth route handler
4. **`app/api/submissions/route.ts`** — Image upload with validation
5. **`app/api/votes/route.ts`** — Vote casting with phase check + unique constraint
6. **`middleware.ts`** — Route protection, role checks
7. **`types/next-auth.d.ts`** — NextAuth type augmentation for roles
8. **`lib/constants.ts`** — Max file size, submission limits
9. **`app/api/voting/status/route.ts`** — Public phase info endpoint
10. **`components/auth/RoleGuard.tsx`** — Client-side RBAC wrapper

---

## Initialize Project

```bash
bunx create-next-app@latest image-voting-app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false

cd image-voting-app

bun add next-auth @auth/prisma-adapter
bun add @prisma/client
bun add zod
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
bun add sharp
bun add @tanstack/react-query

bun add -d prisma
bunx prisma init
```

---

## Testing Checklist

- [ ] Unauthenticated user redirected to Keycloak login
- [ ] User synced to DB after first login (keycloakId unique)
- [ ] Role correctly mapped to session
- [ ] User can upload image only during SUBMISSION phase
- [ ] Submission count limited to 5 per user
- [ ] File size validated (max 20MB)
- [ ] MIME type validated (image/*)
- [ ] Committee member can select/deselect finalist
- [ ] Non-committee user cannot access `/api/submissions/all`
- [ ] Vote casting rejected outside VOTING phase
- [ ] User can vote on multiple submissions
- [ ] Duplicate vote on the same submission prevented by unique constraint
- [ ] Vote count aggregated correctly in results
- [ ] SSE stream `/api/votes/results/stream` sends updates
- [ ] Admin can transition phase states
- [ ] Audit log captures all sensitive actions
- [ ] Full logout redirects to Keycloak and clears session
- [ ] Refresh token handled automatically by NextAuth

---

## Deployment Checklist

Before production:

- [ ] `NEXTAUTH_URL` set to production domain
- [ ] `NEXTAUTH_SECRET` generated (not localhost value)
- [ ] Keycloak redirect URIs updated (production domain)
- [ ] Keycloak client changed to `public` if no backend auth, or keep `confidential` with secure secret
- [ ] PostgreSQL running with SSL/TLS enabled
- [ ] S3 bucket private, signed URLs enforced
- [ ] Environment variables in secret manager (not .env file)
- [ ] HTTPS enforced (Next.js behind reverse proxy or Vercel)
- [ ] Database backups automated
- [ ] Audit logs archived or replicated
- [ ] Monitor login failures, storage quota
- [ ] Rate limiting on upload/vote endpoints (middleware or reverse proxy)

---

## MVP Delivered

### Must Include

- Keycloak login/logout with role mapping
- User dashboard with own submissions
- Multi-image upload with validation
- Submission phase enforcement
- Committee selection interface
- Voting interface allowing multiple votes per user (one per submission)
- Vote results aggregation
- Admin campaign/phase management
- PostgreSQL persistence
- Object storage (S3-compatible)
- Basic audit log
- Server-side deadline enforcement

### Defer to v2

- Live WebSocket results
- Email notifications
- AI content moderation
- Batch vote export
- Anonymous voting mode
- Multi-phase campaigns
- Advanced analytics dashboard
- Mobile app

