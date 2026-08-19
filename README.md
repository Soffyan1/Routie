# Routie

Routie adalah fondasi SaaS multi-tenant untuk merencanakan, menghasilkan, meng-approve, dan memublikasikan konten sosial media dengan API AI milik client (BYOK). Repository ini berisi dashboard Next.js, API, worker BullMQ, schema PostgreSQL + pgvector, Redis, S3-compatible storage, serta adapter AI dan publisher resmi.

## Yang sudah tersedia

- SSO owner dari server pulsa, magic-link editor/approver, RBAC, tenant context, PostgreSQL RLS, dan audit event.
- Lifecycle entitlement `ACTIVE → GRACE → BLOCKED → PURGE_PENDING`, job hold, reaktivasi, dan purge worker.
- Kalender berdasarkan jumlah hari aktual (termasuk leap year), 1–3 konsep/hari, dan workflow approval dua tahap.
- BYOK terenkripsi dengan envelope encryption; secret hanya dibuka di worker.
- Adapter OpenAI, Gemini, dan Anthropic per capability; registry model allowlist dan normalized errors.
- Brand knowledge dari profil, dokumen, dan crawl web yang dilindungi SSRF; full-text PostgreSQL dan local 384-dimensional feature-hash embeddings.
- Template short-video Remotion, S3 presigned upload + completion verification, quota 20 GB, dan media metadata.
- Publisher Meta, TikTok, Threads, YouTube Shorts, serta fallback export/manual untuk X atau capability yang belum lolos app review.
- Idempotent publish job, reconciliation sebelum retry, maksimal tiga retry eksponensial, notification, dan riwayat attempt.
- Dashboard, onboarding brand, kalender, approval queue, provider settings, social capability matrix, dan team management.

Auto-publish sengaja default **off**. Aktifkan setiap feature flag hanya setelah credential production, sandbox test, dan app review platform selesai.

## Struktur

```text
apps/web        Next.js dashboard + route handlers
apps/worker     BullMQ generation/publishing/maintenance workers
packages/db     Drizzle schema, migrations, RLS, tenant transaction
packages/domain State machine, entitlement, calendar, contracts
packages/security Encryption, session, webhook, SSRF guard
packages/providers AI provider adapters
packages/publishers Social publisher adapters
packages/knowledge Crawl, chunking, local embeddings
packages/storage S3-compatible object storage
packages/media   Remotion template and renderer
```

## Menjalankan lokal

Prasyarat: Node.js 24+, npm 11+, Docker, dan FFmpeg/Chrome untuk render Remotion.

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Jalankan worker pada terminal lain:

```bash
npm run dev:worker
```

Dashboard tersedia di `http://localhost:3000`, Mailpit di `http://localhost:8025`, dan MinIO Console di `http://localhost:9001`. Seed menggunakan akun demo `owner@routie.local`; `ALLOW_DEMO_SESSION=true` hanya boleh dipakai di development.

Buat secret yang benar sebelum menjalankan aplikasi:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Masukkan keluaran pertama ke `ENVELOPE_MASTER_KEY`, keluaran kedua ke `SESSION_SECRET`, dan gunakan secret berbeda untuk webhook. Jangan commit `.env`.

## Verifikasi

```bash
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Kontrak yang harus diimplementasikan pada server pulsa ada di [docs/server-pulsa-openapi.yaml](docs/server-pulsa-openapi.yaml). Detail deployment, RLS, key rotation, retry, dan purge ada di [docs/operations.md](docs/operations.md).

## Capability platform

Capability runtime dibungkus feature flag karena API dan proses review dapat berubah. X v1 selalu `EXPORT_MANUAL`. TikTok memakai Direct Post jika disetujui dan fallback draft/export jika belum; YouTube hanya Shorts; Facebook hanya Page; Instagram hanya akun profesional.

Referensi integrasi: [TikTok Content Posting API](https://developers.tiktok.com/products/content-posting-api), [Threads API](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api), [YouTube Videos API](https://developers.google.com/youtube/v3/docs/videos), [OpenAI model catalog](https://developers.openai.com/api/docs/models), [Gemini API](https://ai.google.dev/gemini-api/docs), dan [Claude web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool).
