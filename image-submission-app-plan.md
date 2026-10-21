# Plan Aplikasi Image Submission & Voting

## 1. Tujuan

Aplikasi web untuk:

1. User login melalui Keycloak.
2. User mengirim satu atau beberapa gambar.
3. Committee meninjau submission.
4. Committee memilih gambar final.
5. Setelah submission ditutup, user melakukan voting.
6. Sistem menghitung gambar favorit.
7. Admin mengelola campaign, deadline, committee, dan hasil.

**Voting model:** Multiple votes per user allowed (rank/support multiple images).

## 2. Stack Teknologi

- Next.js App Router
- TypeScript
- Bun sebagai package manager dan runtime
- Auth.js / NextAuth dengan Keycloak Provider
- PostgreSQL
- Prisma ORM
- S3-compatible object storage atau MinIO untuk local development
- Tailwind CSS
- Zod untuk validasi
- Sharp untuk image processing bila diperlukan

File gambar tidak disimpan di database. Database hanya menyimpan metadata dan object storage key.

## 3. Arsitektur

```text
Browser
  |
  v
Next.js Application
  |
  +-- Auth.js / NextAuth
  |     +-- Keycloak
  |
  +-- Route Handlers
  |     +-- PostgreSQL via Prisma
  |     +-- Object Storage
  |
  +-- User Dashboard
  +-- Committee Dashboard
  +-- Admin Dashboard
  +-- Voting Page
```

Prinsip utama:

- Semua endpoint memvalidasi session di server.
- Role tidak dipercaya dari browser.
- Role dibaca dari Keycloak claims atau groups.
- User hanya dapat mengubah submission miliknya.
- Committee hanya dapat mengelola review.
- Voting hanya aktif pada periode voting.
- Perubahan penting dicatat di audit log.

## 4. Integrasi Keycloak

Dokumentasi yang diberikan menggunakan NextAuth/Auth.js, Keycloak Provider, App Router, protected route, dan logout ke Keycloak.

### Data dari admin Keycloak

```env
KEYCLOAK_CLIENT_ID=
KEYCLOAK_CLIENT_SECRET=
KEYCLOAK_ISSUER=https://sso.example.com/realms/myrealm
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
```

### Redirect URI

Development:

```text
http://localhost:3000/api/auth/callback/keycloak
```

Production:

```text
https://your-domain.com/api/auth/callback/keycloak
```

### Konfigurasi client

Admin Keycloak perlu memastikan:

- Client authentication aktif.
- Client type: confidential.
- Standard Flow aktif.
- Valid Redirect URIs sudah terdaftar.
- Web Origins sesuai domain aplikasi.
- Post-logout redirect URI sudah terdaftar.
- Role tersedia: `user`, `committee`, `admin`.

Rekomendasi: gunakan realm roles secara konsisten.

### File authentication

```text
auth.ts
app/api/auth/[...nextauth]/route.ts
app/providers.tsx
middleware.ts
```

Session perlu memuat:

- Application user ID
- Keycloak user ID
- Email
- Name
- Roles

Jangan expose client secret, refresh token, atau database credentials ke browser.

Logout harus:

1. Menghapus session Auth.js.
2. Redirect ke endpoint logout Keycloak.
3. Mengirim `client_id`.
4. Mengirim `post_logout_redirect_uri`.

## 5. Struktur Project

```text
image-submission/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── campaigns/route.ts
│   │   ├── submissions/route.ts
│   │   ├── submissions/[id]/route.ts
│   │   ├── submissions/[id]/select/route.ts
│   │   ├── uploads/presign/route.ts
│   │   ├── votes/route.ts
│   │   └── admin/
│   │       ├── campaigns/route.ts
│   │       └── audit-logs/route.ts
│   ├── admin/page.tsx
│   ├── committee/page.tsx
│   ├── committee/submissions/page.tsx
│   ├── dashboard/page.tsx
│   ├── submit/page.tsx
│   ├── vote/page.tsx
│   ├── login/page.tsx
│   ├── layout.tsx
│   └── providers.tsx
├── components/
│   ├── auth-button.tsx
│   ├── image-upload-form.tsx
│   ├── submission-card.tsx
│   ├── committee-review-card.tsx
│   ├── vote-card.tsx
│   └── status-badge.tsx
├── lib/
│   ├── auth.ts
│   ├── authorization.ts
│   ├── prisma.ts
│   ├── storage.ts
│   ├── validation.ts
│   └── campaign.ts
├── prisma/schema.prisma
├── types/auth.d.ts
├── types/application.ts
├── middleware.ts
├── auth.ts
├── docker-compose.yml
├── package.json
├── bun.lock
├── .env.example
└── README.md
```

## 6. Database Schema

### User

```text
id
keycloakId UNIQUE
email
name
createdAt
updatedAt
```

### Campaign

```text
id
name
description
submissionStartAt
submissionEndAt
votingStartAt
votingEndAt
status
createdAt
updatedAt
```

Status:

```text
DRAFT
SUBMISSION_OPEN
SUBMISSION_CLOSED
VOTING_OPEN
VOTING_CLOSED
PUBLISHED
ARCHIVED
```

### Submission

```text
id
campaignId
userId
title
description
status
submittedAt
reviewedAt
createdAt
updatedAt
```

Status:

```text
DRAFT
SUBMITTED
SHORTLISTED
SELECTED
REJECTED
```

### Image

```text
id
submissionId
storageKey
originalName
mimeType
size
checksum
width
height
createdAt
```

### Finalist

```text
id
campaignId
imageId
selectedBy
selectedAt
```

Constraint:

```text
campaignId + imageId UNIQUE
```

Jika hanya satu finalist per user:

```text
campaignId + submissionId UNIQUE
```

### Vote

```text
id
campaignId
userId
imageId
createdAt
```

**No unique constraint.** Multiple votes per user allowed.
Constraint opsional (untuk rate limit):

```text
campaignId + userId + imageId UNIQUE (prevent duplicate vote on same image)
```

### AuditLog

```text
id
actorUserId
action
entityType
entityId
metadata
createdAt
```

Contoh action:

```text
SUBMISSION_CREATED
IMAGE_UPLOADED
FINALIST_SELECTED
FINALIST_REMOVED
VOTE_CAST
CAMPAIGN_STATUS_CHANGED
```

## 7. Campaign State

```text
DRAFT
  |
  v
SUBMISSION_OPEN
  |
  v
SUBMISSION_CLOSED
  |
  v
VOTING_OPEN
  |
  v
VOTING_CLOSED
  |
  v
PUBLISHED
```

### Submission open

- User dapat membuat submission.
- User dapat upload beberapa gambar.
- User dapat mengedit submission.
- User belum dapat voting.

### Submission closed

- User tidak dapat menambah atau mengubah submission.
- Committee dapat melakukan review.
- Committee dapat memilih finalist.

### Voting open

- Hanya finalist yang tampil.
- User dapat vote satu kali.
- Submission tidak dapat diubah.

### Voting closed

- Vote baru ditolak.
- Hasil dihitung.
- Admin dapat publish hasil.

## 8. API Endpoint

### Authentication

```text
GET  /api/auth/signin
GET  /api/auth/callback/keycloak
POST /api/auth/signout
GET  /api/auth/session
```

### Campaign

```text
GET    /api/campaigns/current
POST   /api/admin/campaigns
PATCH  /api/admin/campaigns/:id
POST   /api/admin/campaigns/:id/open-submission
POST   /api/admin/campaigns/:id/close-submission
POST   /api/admin/campaigns/:id/open-voting
POST   /api/admin/campaigns/:id/close-voting
```

### Upload

```text
POST /api/uploads/presign
POST /api/submissions/:id/images
```

Presign request:

```json
{
  "fileName": "image.jpg",
  "contentType": "image/jpeg",
  "size": 1234567
}
```

### Submission

```text
GET    /api/submissions
POST   /api/submissions
GET    /api/submissions/:id
PATCH  /api/submissions/:id
DELETE /api/submissions/:id
POST   /api/submissions/:id/submit
```

### Committee

```text
GET  /api/committee/submissions
GET  /api/committee/submissions/:id
POST /api/committee/images/:id/select
POST /api/committee/images/:id/deselect
```

### Voting

```text
GET  /api/votes/eligible
POST /api/votes
GET  /api/votes/results
```

`POST /api/votes` harus memakai unique constraint database untuk mencegah double vote.

## 9. Halaman Aplikasi

### Public

```text
/
```

Informasi campaign, status, deadline, dan tombol login.

### Login

```text
/login
```

Tombol login dengan Keycloak.

### User dashboard

```text
/dashboard
```

Menampilkan profile, submission, status, deadline, dan status voting.

### Submission

```text
/submit
```

Fitur:

- Multiple file selection
- Preview thumbnail
- Hapus gambar sebelum submit
- Title dan description
- Validasi file
- Final submit

### Committee

```text
/committee
/committee/submissions
```

Fitur:

- Daftar submission
- Filter status
- Preview gambar
- Select/deselect finalist
- Catatan review

### Voting

```text
/vote
```

Fitur:

- Menampilkan finalist
- Satu pilihan vote
- Status apakah user sudah vote
- Deadline
- Konfirmasi sebelum vote

### Admin

```text
/admin
```

Fitur:

- Membuat campaign
- Mengatur deadline
- Membuka/menutup submission
- Membuka/menutup voting
- Statistik
- Audit log
- Publish hasil

## 10. Authorization

Buat helper terpusat:

```text
requireSession()
requireRole("admin")
requireRole("committee")
requireOwner(resource)
```

| Aksi | User | Committee | Admin |
|---|---:|---:|---:|
| Upload gambar | Ya | Ya | Ya |
| Melihat submission sendiri | Ya | Ya | Ya |
| Melihat semua submission | Tidak | Ya | Ya |
| Memilih finalist | Tidak | Ya | Ya |
| Voting | Ya | Ya | Ya |
| Mengelola campaign | Tidak | Tidak | Ya |
| Melihat audit log | Tidak | Tidak | Ya |

## 11. Validasi Upload

MVP:

```text
Format: JPEG, PNG, WebP
Ukuran maksimum: 10 MB per file
Jumlah file: configurable per campaign
Dimensi minimum: misalnya 800x600
Total ukuran: configurable per submission
```

Server wajib memvalidasi:

- MIME type
- Magic bytes
- Ukuran aktual
- Dimensi gambar
- Checksum
- Object key
- Kepemilikan submission
- Campaign status

Untuk production, pertimbangkan:

- Menghapus EXIF metadata
- Generate thumbnail
- Normalisasi orientasi
- Malware scanning
- Original dan optimized image terpisah

## 12. Environment Variables

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/image_submission

KEYCLOAK_CLIENT_ID=
KEYCLOAK_CLIENT_SECRET=
KEYCLOAK_ISSUER=

AUTH_SECRET=
AUTH_URL=http://localhost:3000

STORAGE_ENDPOINT=
STORAGE_REGION=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_PUBLIC_URL=

MAX_UPLOAD_SIZE_MB=10
```

Dokumentasi menggunakan `NEXTAUTH_SECRET` dan `NEXTAUTH_URL`. Pilih naming convention sesuai versi Auth.js yang digunakan. Jangan mencampur konfigurasi Auth.js v4 dengan v5.

`.env.local` tidak boleh di-commit.

## 13. Fase Implementasi

### Phase 0 — Konfirmasi requirement

Putuskan:

- Satu campaign atau banyak campaign?
- Voting multiple votes sudah dipilih; tetapkan apakah satu gambar dapat divote ulang atau gunakan unique `campaignId + userId + imageId`.
- Satu finalist per user atau beberapa finalist?
- Committee memilih gambar atau submission?
- User boleh mengganti submission sebelum deadline?
- Hasil vote live atau hanya setelah ditutup?
- Role menggunakan realm roles atau client roles?

### Phase 1 — Project foundation

- Buat project Next.js dengan Bun.
- Aktifkan TypeScript dan ESLint.
- Tambahkan `.env.example`.
- Tambahkan Prisma dan PostgreSQL.
- Buat base layout.
- Tambahkan loading dan error state.

### Phase 2 — Keycloak authentication

- Buat Auth.js configuration.
- Tambahkan Keycloak provider.
- Tambahkan `SessionProvider`.
- Tambahkan middleware.
- Buat login dan logout.
- Map role ke session.
- Uji redirect, callback, protected page, dan full logout.

### Phase 3 — Database

- Tulis Prisma schema.
- Buat migration.
- Tambahkan seed campaign.
- Tambahkan unique constraints.
- Tambahkan transaction helper.

### Phase 4 — Campaign management

- Buat campaign model dan admin page.
- Implementasikan status transition.
- Validasi deadline.
- Batasi perubahan status untuk admin.

### Phase 5 — Submission dan upload

- Buat submission form.
- Implementasikan multi-file upload.
- Tambahkan preview.
- Implementasikan presigned upload.
- Validasi file di server.
- Simpan metadata.
- Implementasikan final submit.
- Kunci submission setelah deadline.

### Phase 6 — Committee review

- Buat committee dashboard.
- Tampilkan submission dan gambar.
- Tambahkan filter dan pagination.
- Implementasikan select/deselect finalist.
- Tambahkan audit log.

### Phase 7 — Voting

- Buat halaman finalist.
- Implementasikan satu vote per user.
- Tambahkan unique database constraint.
- Gunakan transaction.
- Tolak vote di luar voting period.
- Implementasikan agregasi hasil.

### Phase 8 — Hardening

- Rate limit upload dan vote.
- Validasi authorization pada semua endpoint.
- Tambahkan security headers.
- Validasi magic bytes.
- Tambahkan logging dan audit trail.
- Siapkan backup database.
- Gunakan private object storage dan signed URL.

### Phase 9 — Testing

Minimal test:

- Unauthenticated user ditolak.
- User hanya melihat submission sendiri.
- Committee dapat memilih finalist.
- User biasa tidak dapat memilih finalist.
- File invalid ditolak.
- Upload di luar deadline ditolak.
- Submission tidak dapat diedit setelah ditutup.
- Double vote ditolak.
- Vote di luar voting period ditolak.
- Admin dapat mengubah campaign state.
- Logout redirect ke Keycloak berhasil.

### Phase 10 — Deployment

- Deploy Next.js.
- Deploy PostgreSQL.
- Konfigurasi object storage.
- Simpan secrets di secret manager.
- Daftarkan production redirect URI di Keycloak.
- Aktifkan HTTPS.
- Uji login, upload, dan vote di production.
- Aktifkan monitoring dan backup.

## 14. Perintah Awal

```bash
bunx create-next-app@latest image-submission \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"

cd image-submission

bun add next-auth @auth/prisma-adapter
bun add @prisma/client
bun add zod
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
bun add sharp

bun add -d prisma
bunx prisma init
```

Verifikasi versi Auth.js sebelum menulis konfigurasi final.

## 15. MVP yang Dikirim Dahulu

### Wajib

- Keycloak login/logout
- User dashboard
- Multi-image upload
- Submission deadline
- Committee selection
- Voting deadline
- One vote per user
- Admin campaign state
- PostgreSQL persistence
- Object storage
- Basic audit log

### Ditunda

- Live WebSocket results
- Email notification
- AI moderation
- Vote ranking
- Anonymous public voting
- Multiple committee approval
- Excel/PDF export
- Advanced analytics
- Mobile application

## 16. Risiko dan Solusi

### Redirect URI mismatch

Daftarkan development dan production URL secara eksplisit di Keycloak.

### Role tidak terbaca

Gunakan satu strategi role, periksa decoded token, dan map role melalui Auth.js callback.

### Double vote

Gunakan unique constraint `campaignId + userId` dan transaction. Jangan hanya mengandalkan disabled button di frontend.

### File berbahaya

Gunakan magic-byte validation, MIME validation, batas ukuran, private storage, signed URL, dan malware scanning bila diperlukan.

### Committee mengubah finalist saat voting

Tolak perubahan ketika `VOTING_OPEN`, atau izinkan hanya untuk admin dengan audit log khusus.

## 17. Rekomendasi Konfigurasi MVP

```text
Framework: Next.js App Router
Runtime/package manager: Bun
Auth: Auth.js / NextAuth + Keycloak
Database: PostgreSQL + Prisma
Storage: S3-compatible object storage
Roles: user, committee, admin
Voting: multiple votes per user allowed
Vote Constraint: @@unique([campaignId, userId, imageId]) ← prevent duplicate vote on same image
Finalist: committee memilih gambar
Campaign: satu campaign aktif
Results: dihitung berdasarkan vote count per image (no ranking)
```

Urutan paling aman: selesaikan Keycloak authentication dan authorization dahulu, lalu database, upload, committee review, dan terakhir voting.
