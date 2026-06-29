# Reportify

AI-powered construction field reporting. Supervisors record voice notes and photos from the field. The backend transcribes, analyzes, and generates professional construction reports automatically.

**Website:** reportify.ca  
**GitHub:** https://github.com/alexsnyder3/reportify

---

## What's in this repo

```
reportify/
├── backend/      Node.js + Express API (JWT auth, Prisma, PostgreSQL, AI pipeline)
├── web/          Next.js 14 admin portal (all management screens)
├── android/      Kotlin + Jetpack Compose Android app (offline-first)
└── docker-compose.yml   PostgreSQL + Redis + MinIO (local dev)
```

---

## Prerequisites

Before you start, install these on your computer:

| Tool | Purpose | Download |
|------|---------|----------|
| **Docker Desktop** | Runs the database, cache, and file storage locally | https://www.docker.com/products/docker-desktop |
| **Node.js 20+** | Runs the backend and web app | https://nodejs.org |
| **Android Studio** | Builds and runs the Android app | https://developer.android.com/studio |
| **Git** | Already installed | — |

---

## Local Setup — Step by Step

### Step 1 — Start infrastructure (database, Redis, MinIO)

Open a terminal, go to the project folder, and run:

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432 (your database)
- Redis on port 6379 (job queue)
- MinIO on port 9000 (file storage — like a local S3)

You can verify everything is running with:
```bash
docker-compose ps
```

### Step 2 — Set up the backend

```bash
cd backend

# Copy the environment file and fill in your API keys
cp .env.example .env
```

Open `backend/.env` in any text editor and fill in:
- `WHISPER_API_KEY` — your OpenAI API key (used for Whisper transcription)
- `GEMINI_API_KEY` — your Google Gemini API key
- `DEEPSEEK_API_KEY` — your DeepSeek API key
- `JWT_SECRET` — any long random string (e.g. 64 random characters)

The database and storage settings are already configured to match Docker.

```bash
# Install dependencies
npm install

# Run database migrations (creates all tables)
npm run db:migrate

# Seed with demo data (creates admin and supervisor accounts)
npm run db:seed

# Start the backend
npm run dev
```

The backend will start at **http://localhost:3001**

**Demo accounts created by seed:**
| Email | Password | Role |
|-------|----------|------|
| admin@reportify.ca | Admin1234! | Admin |
| supervisor@reportify.ca | Super1234! | Supervisor |

### Step 3 — Set up the web app

Open a new terminal window:

```bash
cd web
npm install
npm run dev
```

The web app will open at **http://localhost:3000**

Log in with `admin@reportify.ca` / `Admin1234!`

### Step 4 — Set up the Android app

1. Open **Android Studio**
2. Choose **Open an Existing Project**
3. Navigate to the `android/` folder inside this repo and open it
4. Wait for Gradle sync to complete (downloads dependencies — may take a few minutes the first time)
5. Create an Android emulator (or connect a physical Android phone)
6. Press the green **Run** button

The app will connect to your backend at `http://10.0.2.2:3001` (which is how Android emulators reach your computer's localhost).

---

## MinIO File Storage (local S3)

MinIO is your local file storage. Access the dashboard at:
- URL: http://localhost:9001
- Username: `reportify_minio`
- Password: `reportify_minio_secret`

The backend will automatically create a bucket called `reportify` on first startup.

---

## How the system works

### Recording flow (Android → Backend → AI)

1. Supervisor opens app and taps **Record**
2. App records audio to local storage (works offline)
3. When internet returns, WorkManager uploads the file to the backend
4. Backend stores audio in MinIO, saves entry to PostgreSQL
5. GPS coordinates are compared to active jobs — entry is auto-assigned
6. **Whisper** transcribes the audio → transcript saved
7. **DeepSeek** generates a professional field report from the transcript
8. Report is available in the web portal

### Photo flow

1. Supervisor taps **Take Photo**
2. Photo saved locally, queued for upload
3. On upload: **Gemini** analyzes the photo and generates a description
4. Photo is linked to nearby voice entries (same user, same job, within 2 hours)

### Offline safety

- Nothing is deleted from the phone until the server confirms a successful upload
- WorkManager retries uploads automatically with exponential backoff
- Up to 5 retry attempts per item
- Items can be manually re-triggered from the Upload Queue screen

---

## Environment Variables (backend/.env)

```
DATABASE_URL         PostgreSQL connection string
REDIS_URL            Redis connection string
JWT_SECRET           Secret key for signing JWT tokens (make this long and random)
JWT_EXPIRES_IN       How long login tokens last (default: 7d)
PORT                 Backend port (default: 3001)
FRONTEND_URL         Web app URL (default: http://localhost:3000)
S3_ENDPOINT          MinIO/S3 endpoint
S3_REGION            Region (default: us-east-1)
S3_ACCESS_KEY        MinIO access key
S3_SECRET_KEY        MinIO secret key
S3_BUCKET            Bucket name (default: reportify)
WHISPER_API_KEY      OpenAI API key (for Whisper speech-to-text)
GEMINI_API_KEY       Google Gemini API key (for photo analysis)
DEEPSEEK_API_KEY     DeepSeek API key (for report generation)
DEEPSEEK_BASE_URL    DeepSeek API base URL
SMTP_HOST            SMTP server for invite emails
SMTP_PORT            SMTP port (default: 587)
SMTP_USER            SMTP username / email
SMTP_PASS            SMTP password / app password
EMAIL_FROM           From address for system emails
APP_URL              Web app URL (for invite links in emails)
MAX_UPLOAD_SIZE_MB   Max file upload size in MB (default: 100)
INVITE_EXPIRY_HOURS  Hours before invite links expire (default: 48)
```

---

## User Roles

| Role | Can do |
|------|--------|
| **Admin** | Everything — create jobs, invite users, view all data |
| **Manager** | View jobs, view/generate/edit reports |
| **Supervisor** | Record voice, take photos, view own entries |

---

## Inviting users

1. Log in as Admin
2. Go to **Team** in the sidebar
3. Click **Invite User**
4. Enter their email and choose a role
5. They receive an email with a link to set their password

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Register via invite token |
| GET | /api/auth/me | Current user |
| GET | /api/dashboard | Dashboard stats |
| GET/POST | /api/jobs | List / create jobs |
| PATCH/DELETE | /api/jobs/:id | Update / delete job |
| GET/POST | /api/users | List / create users |
| POST | /api/users/invite | Send invite |
| POST | /api/upload/audio | Upload voice recording |
| POST | /api/upload/photo | Upload photo |
| GET | /api/entries | List entries |
| GET | /api/entries/:id | Entry detail |
| PATCH | /api/entries/:id/job | Reassign entry to job |
| GET | /api/reports | List reports |
| GET | /api/reports/:id | Report detail |
| PATCH | /api/reports/:id | Update report status/content |

---

## Production Deployment

When ready to go live at reportify.ca:

1. Provision a VPS (DigitalOcean, Hetzner, etc.) or use a managed platform
2. Set up PostgreSQL (e.g. Supabase, Neon, or a managed Postgres)
3. Set up Redis (e.g. Upstash)
4. Use a real S3 bucket (AWS S3 or Cloudflare R2) instead of MinIO
5. Update `backend/.env` with production values
6. Point `NEXT_PUBLIC_API_URL` in `web/.env.local` to your production API
7. Build the web app: `cd web && npm run build`
8. Upload to DreamHost via FTP (the `web/.next` + `web/public` folders)

For the Android app:
1. Update `BuildConfig.API_BASE_URL` in `app/build.gradle.kts` to `https://api.reportify.ca`
2. Build a signed APK/AAB in Android Studio
3. Upload to Google Play Console

---

## Getting AI API Keys

| Service | Where to get key | Used for |
|---------|-----------------|---------|
| **Whisper** | https://platform.openai.com/api-keys | Voice transcription |
| **Gemini** | https://aistudio.google.com/app/apikey | Photo analysis |
| **DeepSeek** | https://platform.deepseek.com | Report generation |

All keys go in `backend/.env` only — never in the Android app or web app.

---

## Troubleshooting

**Backend won't start:**
- Make sure Docker Desktop is running and `docker-compose up -d` succeeded
- Check that port 5432 (PostgreSQL) isn't already in use

**"Cannot connect to database":**
- Run `docker-compose ps` and confirm postgres shows as "healthy"
- Try `docker-compose restart postgres`

**Android app can't reach backend:**
- Confirm backend is running on port 3001
- In the emulator, `10.0.2.2` maps to your computer's localhost
- On a physical phone, change `API_BASE_URL_DEBUG` in `app/build.gradle.kts` to your computer's local IP address (e.g. `http://192.168.1.100:3001`)

**AI not transcribing:**
- Check that `WHISPER_API_KEY` is set in `backend/.env`
- Check Redis is running: `docker-compose ps redis`
- Workers run automatically when backend starts — check backend console for errors

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, TypeScript, Prisma |
| Database | PostgreSQL |
| Job Queue | BullMQ + Redis |
| File Storage | MinIO (local) / S3 (production) |
| Web App | Next.js 14, TypeScript, Tailwind CSS |
| Android | Kotlin, Jetpack Compose |
| Offline Sync | Room DB, WorkManager |
| Transcription | OpenAI Whisper |
| Photo Analysis | Google Gemini |
| Report Writing | DeepSeek |
