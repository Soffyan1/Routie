# Operasi dan keamanan Routie

## Topologi production

Jalankan web/API dan worker sebagai service terpisah. PostgreSQL, Redis, object storage, dan SMTP harus managed atau memiliki backup/monitoring sendiri. Worker membutuhkan koneksi database privileged untuk job lintas tenant; request aplikasi memakai role biasa dan selalu membuka transaksi melalui `withTenant()`.

Worker maintenance menjalankan retensi media setiap hari. Secara default, object gambar/video baru dibersihkan 30 hari setelah semua variant yang memakai object tersebut berhasil dipublikasikan. Draft, job terjadwal, processing, dan held tidak ikut dibersihkan. Atur `MEDIA_RETENTION_DAYS` bila kebijakan paket berubah; metadata, caption, analitik, dan link publikasi tetap disimpan di PostgreSQL.

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
ENABLE_TIKTOK_DRAFT_SYNC
ENABLE_TIKTOK_AUTO_PUBLISH
ENABLE_THREADS_AUTO_PUBLISH
ENABLE_YOUTUBE_AUTO_PUBLISH
```

### TikTok OAuth dan Content Posting

TikTok memakai OAuth resmi dengan PKCE. Callback Routie mengikat state bertanda tangan ke user serta workspace, sementara verifier PKCE disimpan dalam cookie terenkripsi selama sepuluh menit. Access token TikTok berlaku sekitar 24 jam dan worker memperbaruinya otomatis menggunakan refresh token; user hanya diminta menyambungkan ulang bila TikTok menolak refresh token secara permanen.

Konfigurasi web dan worker dengan:

```text
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://app.example.com/api/auth/callback/tiktok
TIKTOK_SCOPES=user.info.basic,video.upload,video.publish
TIKTOK_MEDIA_URL_PREFIX=https://media.example.com/
```

Saat aplikasi masih dalam review, biarkan kedua flag TikTok `false`. Setelah Content Posting API dan domain/prefix media sudah disetujui, aktifkan `ENABLE_TIKTOK_DRAFT_SYNC=true` terlebih dahulu. Mode ini mengirim foto maupun video pendek ke inbox/draft TikTok; user menyelesaikan edit dan publikasi di aplikasi TikTok. `ENABLE_TIKTOK_AUTO_PUBLISH` tidak boleh diaktifkan sebelum UX Direct Post dengan persetujuan per posting, pilihan privasi, dan pengaturan interaksi selesai diaudit TikTok. TikTok tidak mengizinkan publikasi terjadwal yang mengabaikan persetujuan eksplisit user.

`TIKTOK_MEDIA_URL_PREFIX` harus berupa HTTPS publik yang diverifikasi di TikTok Developer Portal. Jangan memakai `localhost`, URL MinIO internal, atau signed URL dengan masa berlaku singkat sebagai source TikTok.

### Meta social OAuth

Facebook Pages dan Instagram Professional memakai satu Facebook Login for Business flow. Threads memakai OAuth terpisah karena token serta endpoint refresh-nya berbeda.

Konfigurasi web dan worker dengan:

```text
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=https://app.example.com/api/auth/callback/meta
META_GRAPH_API_VERSION=v24.0

THREADS_APP_ID=
THREADS_APP_SECRET=
THREADS_REDIRECT_URI=https://app.example.com/api/auth/callback/threads
```

Daftarkan redirect URI secara persis di Meta App Dashboard. Scope minimum Facebook/Instagram adalah `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, dan `instagram_content_publish`. Scope minimum Threads adalah `threads_basic` dan `threads_content_publish`.

Selama development, hanya app admin/developer/tester yang dapat memberi izin. Jangan aktifkan `ENABLE_META_AUTO_PUBLISH` atau `ENABLE_THREADS_AUTO_PUBLISH` untuk client umum sampai permission terkait mendapat Advanced Access/App Review dan app berada dalam mode Live.

Callback OAuth memverifikasi state JWT bertanda tangan, mencocokkannya dengan session user dan workspace aktif, menukar long-lived token server-side, lalu menyimpan Page/Instagram/Threads token menggunakan envelope encryption. Jika user mengelola beberapa Page, token sementara disimpan dalam cookie terenkripsi selama maksimal sepuluh menit dan UI meminta satu pilihan Page. Disconnect menghapus seluruh token lokal.

Format auto-publish tahap pertama sengaja dibatasi ke Facebook text/image, Instagram single image, serta Threads text/image. Carousel, Reels/video, dan Stories tidak boleh diiklankan atau dijadwalkan sebagai auto-publish sebelum container polling, validation, reconciliation, dan integration test masing-masing selesai.

## Zark image pilot

Integrasi Zark bersifat development-only dan hanya mendukung text-to-image. Aktifkan secara eksplisit pada web dan worker:

```text
NODE_ENV=development
ENABLE_ZARK_PROVIDER=true
ZARK_PILOT_MONTHLY_IMAGE_LIMIT=25
ZARK_API_BASE_URL=https://api.zarklab.ai
```

API key Zark disimpan per workspace melalui halaman Integrasi API dengan envelope encryption yang sama seperti provider lain. Jangan menaruh API key di source code atau variable publik browser. Validasi credential memakai endpoint MCP discovery dan tidak menjalankan generation berbayar.

Setiap request menghasilkan satu gambar kualitas Standard melalui model `auto`. File hasil diunduh server-side dari signed URL Zark, dibatasi 25 MB dan MIME PNG/JPEG/WebP, lalu disimpan permanen ke object storage Routie. Metadata aset mencatat provider job ID serta usage/credit yang dikirim Zark.

Pilot dibatasi per workspace berdasarkan jumlah percobaan generation pada audit log. Payload `/v1/complete` mengikuti field resmi Zark tanpa parameter tambahan yang tidak terdokumentasi. Worker tidak melakukan blind retry setelah stream generation dimulai. HTTP 500 yang diterima sebelum event SSE boleh dicoba ulang satu kali melalui queue; stream terputus atau hasil parsial harus dicoba ulang manual untuk menghindari pemakaian kredit ganda.

Saat Zark diaktifkan, credential provider IMAGE sebelumnya dinonaktifkan tetapi tetap tersimpan terenkripsi sebagai fallback. Gunakan tombol **Hentikan Pilot** sebelum mematikan feature flag; Routie akan menghapus credential Zark dan mengaktifkan kembali provider gambar terakhir secara otomatis. Setelah itu set `ENABLE_ZARK_PROVIDER=false` untuk menyembunyikan UI dan menolak generation baru. Aset yang pernah dibuat Zark tetap berada di storage Routie.

## Proteksi rate limit provider AI

Generation hanya memakai retry BullMQ sebagai satu-satunya lapisan retry dengan maksimal dua attempt. Adapter provider tidak melakukan retry internal agar satu job tidak melipatgandakan request tanpa terlihat oleh queue.

Worker memakai distributed Redis lock per workspace dan credential. Request dengan credential yang sama diproses berurutan dengan interval minimum `AI_PROVIDER_MIN_INTERVAL_MS` (default 4 detik), sementara credential berbeda tetap dapat berjalan paralel. Ketika provider mengembalikan HTTP 429, worker membuka circuit breaker selama nilai `Retry-After` atau `AI_PROVIDER_DEFAULT_COOLDOWN_MS` (default 60 detik). Job lain berhenti tanpa memanggil provider selama cooldown aktif.

Setelah attempt terakhir gagal, konsep berpindah ke `HELD`, placeholder diganti dengan pesan kegagalan, alasan aman dicatat ke audit log, dan user dapat memulai ulang secara eksplisit dari kalender. UI kalender melakukan polling hanya selama konsep berada dalam proses aktif dan berhenti otomatis setelah berhasil atau gagal.

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
