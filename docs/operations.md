# Operasi dan keamanan Routie

## Topologi production

Jalankan web/API dan worker sebagai service terpisah. PostgreSQL, Redis, object storage, dan SMTP harus managed atau memiliki backup/monitoring sendiri. Worker membutuhkan koneksi database privileged untuk job lintas tenant; request aplikasi memakai role biasa dan selalu membuka transaksi melalui `withTenant()`.

Gunakan tiga connection string:

- `DATABASE_URL`: role aplikasi tanpa `BYPASSRLS`.
- `DATABASE_INTEGRATION_URL`: role backend tepercaya untuk SSO/webhook/magic-link lintas tenant.
- `DATABASE_WORKER_URL`: role worker dengan `BYPASSRLS`.

Contoh provisioning dijalankan oleh administrator database, bukan aplikasi:

```sql
create role routie_app login password '<secret>' nosuperuser nobypassrls;
create role routie_integration login password '<secret>' nosuperuser bypassrls;
create role routie_worker login password '<secret>' nosuperuser bypassrls;
grant usage on schema public to routie_app, routie_integration, routie_worker;
grant select, insert, update, delete on all tables in schema public to routie_app, routie_integration, routie_worker;
grant usage, select on all sequences in schema public to routie_app, routie_integration, routie_worker;
```

Migration dijalankan oleh role owner terpisah. Jangan gunakan superuser untuk request web production.

## Secret dan credential

`ENVELOPE_MASTER_KEY` harus berupa base64 dari tepat 32 byte. Setiap credential memakai random data-encryption key AES-256-GCM; data key tersebut dibungkus master key. AAD mengikat ciphertext ke workspace, provider, dan capability sehingga secret tenant lain tidak bisa ditukar. Browser hanya menerima `lastFour`, tidak pernah ciphertext atau plaintext.

Untuk rotasi master key, deploy proses rewrap data key secara bertahap: decrypt wrapped key dengan key lama, wrap ulang dengan key baru, lalu ganti key aktif setelah seluruh row diverifikasi. Jangan log request provider mentah; logger worker hanya menyimpan normalized error dan request ID yang sudah disanitasi.

## Entitlement dan retention

- Hari 1–7 setelah expired: `GRACE`, read-only + export; generation dan publish menjadi `HELD`.
- Hari 8–30: `BLOCKED`, login dan akses data ditolak.
- Mulai hari 31: `PURGE_PENDING`; maintenance worker menghapus workspace dan seluruh row cascade. Object storage harus dihapus berdasarkan prefix workspace sebelum/bersamaan dengan purge database pada deployment production.
- Webhook aktivasi/renewal membatalkan expiry dan memulihkan workspace.

Webhook menerima timestamp Unix detik maksimal selisih lima menit. Signature adalah lowercase hex HMAC-SHA256 dari `eventId.timestamp.rawBody`, opsional diawali `sha256=`. `eventId` disimpan sebagai primary key untuk idempotensi.

## Publish safety

Setiap publish job memiliki unique idempotency key. Worker melakukan reconciliation ke platform sebelum retry, mencatat setiap attempt, dan hanya retry normalized transient errors hingga tiga kali dengan exponential backoff. Token putus, final approval belum lengkap, entitlement tidak aktif, atau feature flag belum lolos review menghasilkan `HELD`/fallback, bukan blind retry.

Aktifkan flag berikut satu per satu setelah sandbox dan app review:

```text
ENABLE_META_AUTO_PUBLISH
ENABLE_TIKTOK_AUTO_PUBLISH
ENABLE_THREADS_AUTO_PUBLISH
ENABLE_YOUTUBE_AUTO_PUBLISH
```

## Backup dan observability

- PostgreSQL: point-in-time recovery dan daily restore drill.
- Object storage: versioning/lifecycle dan inventory untuk rekonsiliasi `storage_used_bytes`.
- Redis: persistence aktif, tetapi database tetap sumber status job.
- Alert: queue lag, job `FAILED`/`HELD`, webhook signature failures, OAuth refresh failures, storage quota, purge failures, dan provider rate limits.
- Audit log: approval, edit setelah approval, schedule, credential, membership, entitlement, dan publishing.

## Security checklist

- Allowlist MIME, verify object HEAD setelah upload, malware-scan dokumen sebelum retrieval.
- Crawler hanya HTTP(S) public, memvalidasi DNS pada setiap redirect, batas 2 MB/15 detik/5 redirect.
- Tandai dokumen dan hasil web sebagai untrusted context di prompt; jangan izinkan instruksinya mengganti system policy atau memanggil tool arbitrer.
- Terapkan rate limiting di edge untuk auth, upload, generation, webhook, dan publish endpoints.
- Validasi audience/issuer OAuth, gunakan PKCE/state, scopes minimal, dan encrypt refresh token.
